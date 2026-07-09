"""Simple file-based storage: PDFs on disk + JSON metadata index.

Every mutation of a PDF is preceded by a snapshot copy (see
`snapshot_before_change`), which powers document-level undo/redo — the PDF
file itself is the single source of truth for edits.
"""
import json
import shutil
import threading
import time
import uuid
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
FILES_DIR = DATA_DIR / "files"
HISTORY_DIR = DATA_DIR / "history"
DB_PATH = DATA_DIR / "db.json"

MAX_HISTORY = 20

_lock = threading.Lock()


def _ensure_dirs():
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)


def _load() -> dict:
    if not DB_PATH.exists():
        return {}
    try:
        return json.loads(DB_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save(db: dict):
    _ensure_dirs()
    tmp = DB_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(db, indent=2), encoding="utf-8")
    tmp.replace(DB_PATH)


def path_for(file_id: str) -> Path:
    return FILES_DIR / f"{file_id}.pdf"


def create(name: str, data: bytes, pages: int) -> dict:
    _ensure_dirs()
    file_id = uuid.uuid4().hex[:12]
    path_for(file_id).write_bytes(data)
    now = time.time()
    meta = {
        "id": file_id,
        "name": name,
        "size": len(data),
        "pages": pages,
        "version": 1,
        "created_at": now,
        "updated_at": now,
        "opened_at": now,
        "deleted": False,
    }
    with _lock:
        db = _load()
        db[file_id] = meta
        _save(db)
    return meta


def get(file_id: str) -> dict | None:
    with _lock:
        return _load().get(file_id)


def update(file_id: str, *, bump_version: bool = False, **fields) -> dict | None:
    with _lock:
        db = _load()
        meta = db.get(file_id)
        if not meta:
            return None
        meta.update(fields)
        meta["updated_at"] = time.time()
        if bump_version:
            meta["version"] = int(meta.get("version", 1)) + 1
        if path_for(file_id).exists():
            meta["size"] = path_for(file_id).stat().st_size
        _save(db)
        return meta


def touch_opened(file_id: str):
    update(file_id, opened_at=time.time())


def list_files(include_deleted: bool = False) -> list[dict]:
    with _lock:
        db = _load()
    items = [m for m in db.values() if include_deleted or not m.get("deleted")]
    items.sort(key=lambda m: m.get("opened_at", 0), reverse=True)
    return items


def soft_delete(file_id: str) -> bool:
    return update(file_id, deleted=True) is not None


def restore(file_id: str) -> bool:
    return update(file_id, deleted=False) is not None


def hard_delete(file_id: str) -> bool:
    with _lock:
        db = _load()
        if file_id not in db:
            return False
        snaps = db[file_id].get("undo", []) + db[file_id].get("redo", [])
        del db[file_id]
        _save(db)
    try:
        path_for(file_id).unlink(missing_ok=True)
        for name in snaps:
            (HISTORY_DIR / name).unlink(missing_ok=True)
    except OSError:
        pass
    return True


# ------------------------------------------------------------ edit history

def public(meta: dict | None) -> dict | None:
    """Meta as sent to clients: internal snapshot lists become booleans."""
    if meta is None:
        return None
    out = {k: v for k, v in meta.items() if k not in ("undo", "redo")}
    out["can_undo"] = bool(meta.get("undo"))
    out["can_redo"] = bool(meta.get("redo"))
    return out


def _unlink_snap(name: str):
    try:
        (HISTORY_DIR / name).unlink(missing_ok=True)
    except OSError:
        pass


def snapshot_before_change(file_id: str):
    """Copy the current PDF so the upcoming change can be undone."""
    src = path_for(file_id)
    if not src.exists():
        return
    _ensure_dirs()
    with _lock:
        db = _load()
        meta = db.get(file_id)
        if not meta:
            return
        name = f"{file_id}-{meta.get('version', 1)}-{uuid.uuid4().hex[:6]}.pdf"
        shutil.copyfile(src, HISTORY_DIR / name)
        stack = meta.setdefault("undo", [])
        stack.append(name)
        while len(stack) > MAX_HISTORY:
            _unlink_snap(stack.pop(0))
        for r in meta.get("redo", []):
            _unlink_snap(r)
        meta["redo"] = []
        _save(db)


def _swap(file_id: str, pop_from: str, push_to: str) -> dict | None:
    """Shared undo/redo: restore the popped snapshot, keep current for reverse."""
    _ensure_dirs()
    with _lock:
        db = _load()
        meta = db.get(file_id)
        if not meta or not meta.get(pop_from):
            return None
        snap_name = meta[pop_from].pop()
        snap = HISTORY_DIR / snap_name
        cur = path_for(file_id)
        if not snap.exists() or not cur.exists():
            _save(db)
            return None
        keep = f"{file_id}-{meta.get('version', 1)}-{uuid.uuid4().hex[:6]}.pdf"
        shutil.copyfile(cur, HISTORY_DIR / keep)
        meta.setdefault(push_to, []).append(keep)
        shutil.copyfile(snap, cur)
        snap.unlink(missing_ok=True)
        meta["version"] = int(meta.get("version", 1)) + 1
        meta["updated_at"] = time.time()
        meta["size"] = cur.stat().st_size
        _save(db)
        return meta


def undo(file_id: str) -> dict | None:
    return _swap(file_id, "undo", "redo")


def redo(file_id: str) -> dict | None:
    return _swap(file_id, "redo", "undo")
