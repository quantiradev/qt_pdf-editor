"""Google Fonts: family index + on-demand TTF download, cached on disk.

The whole catalogue (~1900 families) is far too large to bundle, so a family's
TTF is fetched the first time it is actually used and then reused from disk.

Both endpoints are used without an API key:
  * the family list comes from the public metadata JSON;
  * the *v1* CSS endpoint is what hands back **truetype** URLs — the modern
    css2 endpoint only serves woff2, which PyMuPDF cannot embed. Requesting it
    with urllib's default User-Agent is what makes Google fall back to TTF.

Everything degrades to None/[] when offline; callers fall back to Base-14.
"""
from __future__ import annotations

import json
import re
import threading
import urllib.parse
import urllib.request
from pathlib import Path

_DIR = Path(__file__).parent / "data" / "fonts"
_FILES = _DIR / "files"
_INDEX = _DIR / "index.json"

_META_URL = "https://fonts.google.com/metadata/fonts"
_CSS_URL = "https://fonts.googleapis.com/css?family={fam}:{style}"
_TIMEOUT = 20

#: PDF core fonts — always available, never fetched.
BASE14_FAMILIES = {"helv", "tiro", "cour"}

_lock = threading.Lock()
_list: list[str] | None = None
_set: set[str] = set()


def _get(url: str) -> bytes:
    return urllib.request.urlopen(url, timeout=_TIMEOUT).read()


def families() -> list[str]:
    """Every Google Fonts family name. Disk-cached; [] when offline."""
    global _list, _set
    with _lock:
        if _list is not None:
            return _list
        names: list[str] = []
        if _INDEX.exists():
            try:
                names = json.loads(_INDEX.read_text(encoding="utf-8"))
            except Exception:
                names = []
        if not names:
            try:
                raw = _get(_META_URL).decode("utf-8", "ignore").lstrip(")]}'\n")
                names = sorted(m["family"]
                               for m in json.loads(raw)["familyMetadataList"])
                _INDEX.parent.mkdir(parents=True, exist_ok=True)
                _INDEX.write_text(json.dumps(names), encoding="utf-8")
            except Exception:
                names = []   # offline: caller keeps the Base-14 trio
        _list = names
        _set = set(names)
        return names


def is_google(family: str) -> bool:
    if not family or family in BASE14_FAMILIES:
        return False
    families()
    return family in _set


def font_path(family: str, bold: bool = False, italic: bool = False) -> str | None:
    """Local TTF for one family+style, downloaded once. None when the family
    is not a Google font or the fetch fails — the caller then uses Base-14."""
    if not is_google(family):
        return None
    weight = "700" if bold else "400"
    style = weight + "italic" if italic else weight
    stem = re.sub(r"[^A-Za-z0-9]+", "_", family)
    dest = _FILES / f"{stem}-{style}.ttf"
    if dest.exists() and dest.stat().st_size > 1024:
        return str(dest)

    with _lock:
        if dest.exists() and dest.stat().st_size > 1024:
            return str(dest)
        quoted = urllib.parse.quote(family)
        for want in (style, weight, "400"):   # not every family ships every cut
            try:
                css = _get(_CSS_URL.format(fam=quoted, style=want)).decode()
            except Exception:
                continue
            urls = re.findall(r"url\((https://[^)]+?\.ttf)\)", css)
            if not urls:
                continue
            try:
                data = _get(urls[0])
            except Exception:
                continue
            if len(data) < 1024:
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return str(dest)
    return None
