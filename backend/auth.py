"""Authentication logic for QT PDF Editor.

Matches Node.js Express user creation, password hashing (PBKDF2-HMAC-SHA512),
and manual HS256 JWT sign/verify logic.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Path to the user storage database
DB_PATH = Path(__file__).parent / "data" / "users.json"
JWT_SECRET = os.environ.get(
    "JWT_SECRET", "qt-pdf-editor-secret-key-12345-super-secret-key-for-pdf-editor"
)


def load_users() -> List[Dict[str, Any]]:
    """Loads users list from local database file."""
    try:
        if not DB_PATH.parent.exists():
            DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        if not DB_PATH.exists():
            with open(DB_PATH, "w", encoding="utf-8") as f:
                json.dump([], f)
            return []
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading users: {e}")
        return []


def save_users(users: List[Dict[str, Any]]) -> None:
    """Saves users list to local database file."""
    try:
        if not DB_PATH.parent.exists():
            DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(DB_PATH, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2)
    except Exception as e:
        print(f"Error saving users: {e}")


def hash_password(password: str) -> str:
    """Hashes a password with PBKDF2-HMAC-SHA512 (matching Node.js pbkdf2Sync)."""
    salt = secrets.token_hex(16)
    # Node.js pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    pwd_hash = hashlib.pbkdf2_hmac(
        "sha512",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        1000,
        dklen=64
    ).hex()
    return f"{salt}:{pwd_hash}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verifies a password against a stored PBKDF2 hash."""
    try:
        parts = stored_hash.split(":")
        if len(parts) != 2:
            return False
        salt, pwd_hash = parts
        test_hash = hashlib.pbkdf2_hmac(
            "sha512",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            1000,
            dklen=64
        ).hex()
        return hmac.compare_digest(pwd_hash, test_hash)
    except Exception:
        return False


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Retrieves a user by email (case-insensitive)."""
    users = load_users()
    email_lower = email.strip().lower()
    for u in users:
        if u.get("email", "").lower() == email_lower:
            return u
    return None


def create_user(name: str, email: str, password_plain: str) -> Dict[str, Any]:
    """Creates a new user and saves to database."""
    users = load_users()
    new_user = {
        "id": str(uuid.uuid4()),  # generates a unique UUID v4 string
        "name": name.strip(),
        "email": email.strip().lower(),
        "passwordHash": hash_password(password_plain),
        "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
    }
    users.append(new_user)
    save_users(users)
    return new_user


# JWT Implementation using standard base64url and hmac-sha256 matching Node's implementation


def base64url_encode(data: bytes) -> str:
    """Encodes bytes to base64url string without padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def base64url_decode(s: str) -> bytes:
    """Decodes a base64url string with padding restoration."""
    padding = "=" * (4 - (len(s) % 4))
    return base64.urlsafe_b64decode((s + padding).encode("utf-8"))


def sign_jwt(payload: Dict[str, Any], expires_in_seconds: int = 86400) -> str:
    """Generates a signed HS256 JWT string."""
    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = base64url_encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )

    now = int(time.time())
    full_payload = {**payload, "iat": now, "exp": now + expires_in_seconds}
    encoded_payload = base64url_encode(
        json.dumps(full_payload, separators=(",", ":")).encode("utf-8")
    )

    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    signature = hmac.new(
        JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    encoded_signature = base64url_encode(signature)

    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"


def verify_jwt(token: str) -> Optional[Dict[str, Any]]:
    """Verifies a JWT token signature and expiry, returning the payload if valid."""
    if not token:
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None

    encoded_header, encoded_payload, signature = parts
    try:
        signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
        expected_signature = hmac.new(
            JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256
        ).digest()
        encoded_expected_signature = base64url_encode(expected_signature)

        if not hmac.compare_digest(signature, encoded_expected_signature):
            return None

        payload = json.loads(base64url_decode(encoded_payload).decode("utf-8"))
        now = int(time.time())

        if "exp" in payload and now > payload["exp"]:
            return None

        return payload
    except Exception:
        return None
