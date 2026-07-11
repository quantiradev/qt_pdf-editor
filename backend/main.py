"""PDF Studio backend — FastAPI + PyMuPDF."""
import re
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import BaseModel

import auth
import pdf_ops
import storage

app = FastAPI(title="PDF Studio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "app://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        loc = " -> ".join(str(x) for x in err.get("loc", []))
        msg = err.get("msg")
        errors.append(f"{loc}: {msg}")
    error_msg = "; ".join(errors) or "Validation error"
    return JSONResponse(
        status_code=422,
        content={"error": error_msg, "detail": error_msg},
    )


def _meta_or_404(file_id: str) -> dict:
    meta = storage.get(file_id)
    if not meta:
        raise HTTPException(404, "File not found")
    if not storage.path_for(file_id).exists():
        raise HTTPException(410, "File data is missing")
    return meta


def _safe_name(name: str) -> str:
    name = re.sub(r"[^\w\-. ()\[\]]+", "_", name).strip() or "document.pdf"
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    return name


def _stem(meta: dict) -> str:
    return re.sub(r"\.pdf$", "", meta["name"], flags=re.I)


# ------------------------------------------------------------ authentication

class RegisterBody(BaseModel):
    name: str
    email: str
    password: str


class LoginBody(BaseModel):
    email: str
    password: str


@app.post("/api/auth/register")
def register(body: RegisterBody, response: Response):
    name = body.name.strip()
    email = body.email.strip().lower()
    password = body.password

    if not name or not email or not password:
        raise HTTPException(400, "Name, email, and password are required")

    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters long")

    existing_user = auth.get_user_by_email(email)
    if existing_user:
        raise HTTPException(400, "User already exists with this email")

    user = auth.create_user(name, email, password)
    token = auth.sign_jwt({"userId": user["id"], "email": user["email"], "name": user["name"]})

    response.set_cookie(
        key="qt_token",
        value=token,
        httponly=True,
        max_age=24 * 60 * 60,  # 24 hours
        samesite="lax",
        path="/"
    )

    return {
        "success": True,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"]
        }
    }


@app.post("/api/auth/login")
def login(body: LoginBody, response: Response):
    email = body.email.strip().lower()
    password = body.password

    if not email or not password:
        raise HTTPException(400, "Email and password are required")

    user = auth.get_user_by_email(email)
    if not user:
        raise HTTPException(401, "Invalid email or password")

    if not auth.verify_password(password, user["passwordHash"]):
        raise HTTPException(401, "Invalid email or password")

    token = auth.sign_jwt({"userId": user["id"], "email": user["email"], "name": user["name"]})

    response.set_cookie(
        key="qt_token",
        value=token,
        httponly=True,
        max_age=24 * 60 * 60,  # 24 hours
        samesite="lax",
        path="/"
    )

    return {
        "success": True,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"]
        }
    }


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(
        key="qt_token",
        path="/"
    )
    return {"success": True}


@app.get("/api/auth/me")
def me(request: Request):
    token = request.cookies.get("qt_token")
    if not token:
        return {"loggedIn": False}

    payload = auth.verify_jwt(token)
    if not payload:
        return {"loggedIn": False}

    return {
        "loggedIn": True,
        "user": {
            "email": payload.get("email"),
            "name": payload.get("name")
        }
    }


# ------------------------------------------------------------ files

@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/health")
def root_health():
    return {"status": "ok", "message": "Backend is running"}


@app.post("/api/files/upload")
async def upload(file: UploadFile = File(...)):
    data = await file.read()
    try:
        pages = pdf_ops.page_count(data)
    except Exception:
        raise HTTPException(400, "Could not open this PDF")
    meta = storage.create(_safe_name(file.filename or "document.pdf"), data, pages)
    return storage.public(meta)


@app.get("/api/files")
def list_files(include_deleted: bool = False):
    return [storage.public(m) for m in storage.list_files(include_deleted=include_deleted)]


@app.get("/api/files/{file_id}")
def get_meta(file_id: str):
    return storage.public(_meta_or_404(file_id))


@app.post("/api/files/{file_id}/open")
def mark_opened(file_id: str):
    _meta_or_404(file_id)
    storage.touch_opened(file_id)
    return {"ok": True}


class RenameBody(BaseModel):
    name: str


@app.patch("/api/files/{file_id}")
def rename(file_id: str, body: RenameBody):
    _meta_or_404(file_id)
    return storage.public(storage.update(file_id, name=_safe_name(body.name)))


@app.api_route("/api/files/{file_id}/content", methods=["GET", "HEAD"])
def content(file_id: str, v: int | None = None):
    _meta_or_404(file_id)
    data = storage.path_for(file_id).read_bytes()
    return Response(data, media_type="application/pdf",
                    headers={"Cache-Control": "no-store"})


@app.get("/api/files/{file_id}/download")
def download(file_id: str):
    meta = _meta_or_404(file_id)
    data = storage.path_for(file_id).read_bytes()
    return Response(data, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{meta["name"]}"'})


@app.delete("/api/files/{file_id}")
def delete(file_id: str, permanent: bool = False):
    if not storage.get(file_id):
        raise HTTPException(404, "File not found")
    if permanent:
        storage.hard_delete(file_id)
    else:
        storage.soft_delete(file_id)
    return {"ok": True}


@app.post("/api/files/{file_id}/restore")
def restore(file_id: str):
    if not storage.restore(file_id):
        raise HTTPException(404, "File not found")
    return {"ok": True}


# ------------------------------------------------------------ document info

@app.get("/api/files/{file_id}/outline")
def outline(file_id: str):
    _meta_or_404(file_id)
    return pdf_ops.get_outline(storage.path_for(file_id))


@app.get("/api/files/{file_id}/paragraphs")
def paragraphs(file_id: str, page: int = 0):
    _meta_or_404(file_id)
    return pdf_ops.get_paragraphs(storage.path_for(file_id), page)


@app.get("/api/files/{file_id}/notes")
def notes(file_id: str):
    _meta_or_404(file_id)
    return pdf_ops.list_notes(storage.path_for(file_id))


class NoteBody(BaseModel):
    text: str


@app.patch("/api/files/{file_id}/notes/{xref}")
def edit_note(file_id: str, xref: int, body: NoteBody):
    _meta_or_404(file_id)
    with storage.op_lock(file_id):
        storage.snapshot_before_change(file_id)
        if not pdf_ops.update_note(storage.path_for(file_id), xref, body.text):
            raise HTTPException(404, "Note not found")
        return storage.public(storage.update(file_id, bump_version=True))


@app.delete("/api/files/{file_id}/notes/{xref}")
def remove_note(file_id: str, xref: int):
    _meta_or_404(file_id)
    with storage.op_lock(file_id):
        storage.snapshot_before_change(file_id)
        if not pdf_ops.delete_note(storage.path_for(file_id), xref):
            raise HTTPException(404, "Note not found")
        return storage.public(storage.update(file_id, bump_version=True))


# ------------------------------------------------------------ save edits

class AnnotationsBody(BaseModel):
    annotations: list[dict[str, Any]]


@app.post("/api/files/{file_id}/annotations")
def save_annotations(file_id: str, body: AnnotationsBody):
    _meta_or_404(file_id)
    if not body.annotations:
        raise HTTPException(400, "No edits supplied")
    with storage.op_lock(file_id):
        storage.snapshot_before_change(file_id)
        try:
            warnings, changed_pages = pdf_ops.bake_annotations(
                storage.path_for(file_id), body.annotations)
        except ValueError as exc:
            raise HTTPException(409, str(exc))
        except Exception as exc:
            raise HTTPException(422, f"Could not apply edits: {exc}")
        meta = storage.update(file_id, bump_version=True,
                              pages=pdf_ops.page_count(
                                  storage.path_for(file_id).read_bytes()))
    out = storage.public(meta)
    out["warnings"] = warnings
    out["changed_pages"] = changed_pages
    return out


@app.post("/api/files/{file_id}/undo")
def undo(file_id: str):
    _meta_or_404(file_id)
    with storage.op_lock(file_id):
        meta = storage.undo(file_id)
        if meta is None:
            raise HTTPException(409, "Nothing to undo")
        pages = pdf_ops.page_count(storage.path_for(file_id).read_bytes())
        return storage.public(storage.update(file_id, pages=pages))


@app.post("/api/files/{file_id}/redo")
def redo(file_id: str):
    _meta_or_404(file_id)
    with storage.op_lock(file_id):
        meta = storage.redo(file_id)
        if meta is None:
            raise HTTPException(409, "Nothing to redo")
        pages = pdf_ops.page_count(storage.path_for(file_id).read_bytes())
        return storage.public(storage.update(file_id, pages=pages))


class WatermarkBody(BaseModel):
    text: str = "CONFIDENTIAL"
    color: str = "#c0392b"
    opacity: float = 0.18
    fontSize: float | None = None
    rotate: float = -45
    pages: str = "all"


@app.post("/api/files/{file_id}/watermark")
def watermark(file_id: str, body: WatermarkBody):
    meta = _meta_or_404(file_id)
    try:
        pages = pdf_ops.parse_ranges(body.pages, meta["pages"])
    except Exception as exc:
        raise HTTPException(400, f"Bad page range: {exc}")
    with storage.op_lock(file_id):
        storage.snapshot_before_change(file_id)
        pdf_ops.add_watermark(
            storage.path_for(file_id), text=body.text, color=body.color,
            opacity=max(0.02, min(1.0, body.opacity)),
            font_size=body.fontSize, rotate=body.rotate, pages=pages)
        return storage.public(storage.update(file_id, bump_version=True))


# ------------------------------------------------------------ page operations

class PagesBody(BaseModel):
    pages: list[int]


class RotateBody(PagesBody):
    degrees: int = 90


class OrderBody(BaseModel):
    order: list[int]


class ExtractBody(PagesBody):
    name: str | None = None


def _bumped(file_id: str) -> dict:
    path = storage.path_for(file_id)
    return storage.public(storage.update(
        file_id, bump_version=True,
        pages=pdf_ops.page_count(path.read_bytes())))


@app.post("/api/files/{file_id}/pages/rotate")
def rotate(file_id: str, body: RotateBody):
    _meta_or_404(file_id)
    if body.degrees % 90 != 0:
        raise HTTPException(400, "Rotation must be a multiple of 90")
    with storage.op_lock(file_id):
        storage.snapshot_before_change(file_id)
        pdf_ops.rotate_pages(storage.path_for(file_id), body.pages, body.degrees)
        return _bumped(file_id)


@app.post("/api/files/{file_id}/pages/delete")
def remove_pages(file_id: str, body: PagesBody):
    _meta_or_404(file_id)
    with storage.op_lock(file_id):
        storage.snapshot_before_change(file_id)
        try:
            pdf_ops.delete_pages(storage.path_for(file_id), body.pages)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        return _bumped(file_id)


@app.post("/api/files/{file_id}/pages/duplicate")
def duplicate(file_id: str, body: PagesBody):
    _meta_or_404(file_id)
    with storage.op_lock(file_id):
        storage.snapshot_before_change(file_id)
        pdf_ops.duplicate_pages(storage.path_for(file_id), body.pages)
        return _bumped(file_id)


@app.post("/api/files/{file_id}/pages/reorder")
def reorder(file_id: str, body: OrderBody):
    _meta_or_404(file_id)
    with storage.op_lock(file_id):
        storage.snapshot_before_change(file_id)
        try:
            pdf_ops.reorder_pages(storage.path_for(file_id), body.order)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        return _bumped(file_id)


@app.post("/api/files/{file_id}/pages/extract")
def extract(file_id: str, body: ExtractBody):
    meta = _meta_or_404(file_id)
    try:
        data = pdf_ops.extract_pages(storage.path_for(file_id), body.pages)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    name = _safe_name(body.name or f"{_stem(meta)} (extract).pdf")
    return storage.public(storage.create(name, data, pdf_ops.page_count(data)))


class SplitBody(BaseModel):
    ranges: str  # e.g. "1-3, 4-6, 7-"


@app.post("/api/files/{file_id}/split")
def split(file_id: str, body: SplitBody):
    meta = _meta_or_404(file_id)
    try:
        groups = pdf_ops.parse_range_groups(body.ranges, meta["pages"])
        parts = pdf_ops.split_document(storage.path_for(file_id), groups)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    created = []
    for i, data in enumerate(parts):
        name = _safe_name(f"{_stem(meta)} (part {i + 1}).pdf")
        created.append(storage.public(
            storage.create(name, data, pdf_ops.page_count(data))))
    return created


class MergeBody(BaseModel):
    file_ids: list[str]
    name: str | None = None


@app.post("/api/files/merge")
def merge(body: MergeBody):
    if len(body.file_ids) < 2:
        raise HTTPException(400, "Pick at least two documents to merge")
    paths = []
    for fid in body.file_ids:
        _meta_or_404(fid)
        paths.append(storage.path_for(fid))
    data = pdf_ops.merge_documents(paths)
    name = _safe_name(body.name or "Merged document.pdf")
    return storage.public(storage.create(name, data, pdf_ops.page_count(data)))


# ------------------------------------------------------------ export

@app.get("/api/files/{file_id}/export")
def export(file_id: str, format: str = "pdf", pages: str = "all", dpi: int = 150):
    meta = _meta_or_404(file_id)
    fmt = format.lower()
    dpi = max(72, min(600, dpi))
    try:
        page_list = pdf_ops.parse_ranges(pages, meta["pages"])
    except Exception as exc:
        raise HTTPException(400, f"Bad page range: {exc}")
    stem = _stem(meta)

    if fmt == "pdf":
        data = pdf_ops.extract_pages(storage.path_for(file_id), page_list)
        return Response(data, media_type="application/pdf", headers={
            "Content-Disposition": f'attachment; filename="{stem} (export).pdf"'})

    if fmt not in ("png", "jpg", "jpeg"):
        raise HTTPException(400, "format must be pdf, png or jpg")
    fmt = "png" if fmt == "png" else "jpg"
    entries = pdf_ops.export_images(storage.path_for(file_id), page_list, fmt, dpi)
    if not entries:
        raise HTTPException(400, "No valid pages selected")
    if len(entries) == 1:
        name, data = entries[0]
        media = "image/png" if fmt == "png" else "image/jpeg"
        return Response(data, media_type=media, headers={
            "Content-Disposition": f'attachment; filename="{stem} {name}"'})
    data = pdf_ops.zip_bytes(entries)
    return Response(data, media_type="application/zip", headers={
        "Content-Disposition": f'attachment; filename="{stem} ({fmt} export).zip"'})


if __name__ == '__main__':
    import uvicorn
    import sys
    port = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[1] == '--port' else 8000
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
