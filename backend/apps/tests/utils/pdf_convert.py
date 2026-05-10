"""HOTFIX — PDF'ni PNG sahifalariga aylantirish.

Brave/Chrome shield'lar PDF iframe'larini bloklashi sababli, talaba
PDF'ni iframe orqali ko'rolmaydi. Yechim: PDF upload qilinganda darhol
har sahifani PNG'ga aylantiramiz va frontend `<img>` galereya sifatida
chiqaradi (img tag'ini hech qanday shield bloklamaydi).

`pdf2image` `poppler-utils` paketiga tayanadi. Server uchun:
    sudo apt install -y poppler-utils
Lokal Mac uchun:
    brew install poppler

Agar paket o'rnatilmagan bo'lsa, `convert_pdf_to_pages()` `RuntimeError`
qaytaradi — chaqiruvchi joy uni log qilib jim o'tib ketsin (server hali ham
test'ni saqlaydi, faqat sahifalar bo'sh qoladi).
"""

import logging
from pathlib import Path

from django.conf import settings


logger = logging.getLogger(__name__)


def convert_pdf_to_pages(
    pdf_path: str | Path,
    output_dir_relative: str,
    dpi: int = 150,
) -> list[str]:
    """PDF'ni PNG sahifalarga aylantiradi va media URL ro'yxatini qaytaradi.

    Args:
        pdf_path: PDF faylga absolyut yo'l
        output_dir_relative: MEDIA_ROOT ostida papka, masalan 'pdf_pages/<uuid>'
        dpi: 150 — o'qish uchun yetarli; 200 — keskinroq, lekin sekinroq

    Returns:
        Sahifalarning media-relativ URL'lari ro'yxati.
        Masalan: ['/media/pdf_pages/abc/page_1.png', '/media/pdf_pages/abc/page_2.png']

    Raises:
        RuntimeError: agar pdf2image yoki poppler o'rnatilmagan bo'lsa.
    """
    try:
        from pdf2image import convert_from_path
    except ImportError as e:
        raise RuntimeError(
            'pdf2image not installed — `pip install pdf2image` and '
            '`apt install poppler-utils` (or `brew install poppler`) required.',
        ) from e

    output_dir_abs = Path(settings.MEDIA_ROOT) / output_dir_relative
    output_dir_abs.mkdir(parents=True, exist_ok=True)

    images = convert_from_path(str(pdf_path), dpi=dpi, fmt='png')
    page_urls: list[str] = []
    media_url = settings.MEDIA_URL.rstrip('/') + '/'

    for i, img in enumerate(images, start=1):
        filename = f'page_{i}.png'
        abs_path = output_dir_abs / filename
        img.save(abs_path, 'PNG', optimize=True)
        rel_url = f'{media_url}{output_dir_relative}/{filename}'
        if not rel_url.startswith('/'):
            rel_url = '/' + rel_url
        page_urls.append(rel_url)

    return page_urls


def safe_convert(pdf_test) -> None:
    """`PDFTest` instance uchun konvertatsiyani ishonchli ishga tushiradi.

    Xatolarni log qiladi va rivojda paket bo'lmasa ham server qulamasligini
    ta'minlaydi. Muvaffaqiyat bo'lsa `pdf_test.pdf_pages` va
    `pdf_test.pdf_page_count` to'ldiriladi va saqlanadi.
    """
    if not pdf_test.pdf_file:
        return
    output_dir = f'pdf_pages/{pdf_test.public_id}'
    try:
        pages = convert_pdf_to_pages(pdf_test.pdf_file.path, output_dir)
    except Exception as e:
        logger.warning(
            'PDF konvertatsiyasi muvaffaqiyatsiz (test_id=%s): %s',
            pdf_test.public_id, e,
        )
        return
    pdf_test.pdf_pages = pages
    pdf_test.pdf_page_count = len(pages)
    pdf_test.save(update_fields=['pdf_pages', 'pdf_page_count'])
