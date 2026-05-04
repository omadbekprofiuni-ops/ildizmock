#!/usr/bin/env python3
"""Scan frontend source for quoted strings containing Uzbek words.
Print unique strings sorted by frequency.
"""
import re
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "frontend" / "src"

# Distinct Uzbek markers — words / suffixes unlikely in English source
UZBEK_RX = re.compile(
    r"(qilish|uchun|bekor|saqla|yarat|tahrir|chirish|chirilgan|qo['ʻ‘’]sh|yuklash|yuklandi|yuklan|talaba|sessiya|davomat|guruh|sozla|ustoz|o['ʻ‘’]quvchi|o['ʻ‘’]chirish|izlash|qidir|noto['ʻ‘’]g|ma['ʻ‘’]lumot|topilmadi|yuklanmoqda|tasdiq|tugat|chegirma|narx|hisob|tanla|ochish|yopish|chiqish|profil|sahifa|kiriting|kirish|kerak|maxsus|ro['ʻ‘’]yxat|qaytar|tahlil|holat|haqida|tarix|hisobot|jadval|amallar|qatnash|ishonchli|davom|boshqaruv|qiyinlik|sarlavha|javob|natija|sinov|reja|hafta|kun|oy|yil|bosh|olish|ko['ʻ‘’]rish|menyu|to['ʻ‘’]ldir|nomi|narxi|narxlar|jami|aktiv|nofaol|yopil|ochil|sinash|topshir|tugatildi|boshlandi|tugadi|bog['ʻ‘’]liq|ma['ʻ‘’]ruza|bo['ʻ‘’]l|cheklov|aloqa|yordam|qo['ʻ‘’]ll|kuni|sana|tartib|qism|ma['ʻ‘’]l|qatori|qator|chiq|tanlang|bering|kiritildi|topildi|topshirildi|imkon|imtihon|sinov|namuna|natija|chegara|qisqa|uzun|to['ʻ‘’]g['ʻ‘’]ri|noto['ʻ‘’]g['ʻ‘’]ri|kelish|kelgan|kettan|olchov|miqdor|miqdori|sonni|sano|hozir|yonida|orqali|orqada|tomon|tashqari|ichida|ostida|ustida|yaqin|uzoq|tez|sekin)",
    re.IGNORECASE,
)
# Match strings in single, double, backtick quotes
STR_RX = re.compile(r"""("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`)""")

counter = Counter()
file_strings: dict[str, set[str]] = {}

for f in SRC.rglob("*"):
    if not f.is_file() or f.suffix not in {".tsx", ".ts", ".jsx", ".js"}:
        continue
    try:
        text = f.read_text(encoding="utf-8")
    except Exception:
        continue
    for m in STR_RX.finditer(text):
        s = m.group(0)
        # strip quotes
        body = s[1:-1]
        if not body.strip():
            continue
        # Skip strings that span newlines — likely a parser artefact from
        # mismatched apostrophes inside comments.
        if "\n" in s:
            continue
        # Skip very long strings (>200 chars): probably code, not UI text
        if len(s) > 250:
            continue
        if UZBEK_RX.search(body):
            counter[s] += 1
            file_strings.setdefault(str(f.relative_to(ROOT)), set()).add(s)

print(f"# Unique strings: {len(counter)}\n")
for s, n in counter.most_common():
    print(f"{n:3}  {s}")

# Per-file index — last
print("\n\n# === FILE -> STRINGS ===\n")
for fpath, strs in sorted(file_strings.items()):
    print(f"\n## {fpath} ({len(strs)})")
    for s in sorted(strs):
        print(f"  {s}")
