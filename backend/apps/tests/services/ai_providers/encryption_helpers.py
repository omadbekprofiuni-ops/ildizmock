"""Local re-export of decrypt helper for ai_providers factory.

`apps.tests.services.encryption` modulini factory ichida import qilsak
import order'da bog'liqlikka qaramay ishlaydi, lekin alohida modul bilan
chaqiruvchi qatlamni yengilroq qilamiz.
"""
from __future__ import annotations


def decrypt_db_key(encrypted: str) -> str:
    """encrypted_api_key (Fernet ciphertext) → plain API key."""
    from ..encryption import decrypt_api_key

    return decrypt_api_key(encrypted)
