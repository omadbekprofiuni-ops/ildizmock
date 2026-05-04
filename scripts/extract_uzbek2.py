#!/usr/bin/env python3
"""Extract every line containing Uzbek-marker words.
Print line:text so I can build a comprehensive translation map.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "frontend" / "src"

UZBEK_RX = re.compile(
    r"(?<![A-Za-z])(qilish|qilasiz|qilam|qilad|uchun|bekor|saqla|yarat|tahrir|chirish|chirmoq|chirilgan|chirib|qo['ʻ‘’]sh|yuklash|yuklan|yuklang|yuklab|yuklandi|talaba|talabalar|sessiya|sessiya|davomat|guruh|sozla|ustoz|o['ʻ‘’]quv|o['ʻ‘’]chir|izlash|qidir|noto['ʻ‘’]g|ma['ʻ‘’]lumot|topil|topilmadi|tasdiq|tugat|chegirma|kerak|maxsus|ro['ʻ‘’]yxat|qaytar|tahlil|haqida|tarix|hisobot|jadval|amallar|qatnash|davom|boshqaruv|qiyinlik|sarlavha|natija|qism|reja|hafta|kun|haftalik|kunlik|oylik|yillik|bosh|olish|ko['ʻ‘’]rin|menyu|to['ʻ‘’]ldir|nomi|narx|jami|aktiv|nofaol|yopil|ochil|sinash|topshir|tugatildi|boshlandi|tugadi|bog['ʻ‘’]liq|cheklov|aloqa|yordam|qo['ʻ‘’]ll|sana|tartib|qator|tanlang|bering|kiritildi|topildi|topshirildi|imtihon|sinov|namuna|chegara|qisqa|uzun|to['ʻ‘’]g['ʻ‘’]ri|noto['ʻ‘’]g['ʻ‘’]ri|hozir|orqali|tomon|tashqari|ichida|ostida|ustida|yaqin|uzoq|tez|sekin|haqq|lekin|ammo|chunki|biroq|albatta|chunon|yana|hali|hech|qaysi|qancha|necha|ushbu|mana|qachon|qancha|qaerda|qancha|kerakli|ko['ʻ‘’]p|kam|past|baland|katta|kichik|yangi|eski|yaxshi|yomon|chiroyli|barcha|ba['ʻ‘’]zi|hamma|hech|biror|qisman|to['ʻ‘’]liq|alohida|umumiy|asosiy|qo['ʻ‘’]shimcha|markaz|tashrif|talabalar|talabani|ko['ʻ‘’]rinmaydi|ko['ʻ‘’]rinadi|biriktir|guruhsiz|qoladi|kunlari|vaqtlari|allaqachon|atigi|hisob-kitob|daromad)(?![A-Za-z])",
    re.IGNORECASE,
)

# Skip code identifiers / urls / imports
SKIP_LINE_RX = re.compile(r"^\s*(import|export|//|/\*|from\s|\*\s)")

for f in SRC.rglob("*"):
    if not f.is_file() or f.suffix not in {".tsx", ".ts", ".jsx", ".js"}:
        continue
    try:
        text = f.read_text(encoding="utf-8")
    except Exception:
        continue
    for i, line in enumerate(text.splitlines(), 1):
        if SKIP_LINE_RX.search(line):
            continue
        if UZBEK_RX.search(line):
            print(f"{f.relative_to(ROOT)}:{i}: {line.strip()}")
