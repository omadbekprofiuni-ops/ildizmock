"""Mock IELTS sertifikati (ReportLab orqali PDF)."""

from io import BytesIO

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas


def _safe_score(value, fmt='{:.1f}', dash='—'):
    if value is None:
        return dash
    try:
        return fmt.format(float(value))
    except (TypeError, ValueError):
        return dash


def generate_certificate(participant, certificate=None) -> BytesIO:
    """ReportLab bilan A4-landscape mock sertifikatni qaytaradi (BytesIO)."""

    buffer = BytesIO()
    width, height = landscape(A4)
    c = canvas.Canvas(buffer, pagesize=landscape(A4))

    # Background
    c.setFillColorRGB(0.97, 0.98, 1.0)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Border
    c.setStrokeColorRGB(0.12, 0.27, 0.6)
    c.setLineWidth(3)
    c.rect(1.2 * cm, 1.2 * cm, width - 2.4 * cm, height - 2.4 * cm, fill=0, stroke=1)
    c.setLineWidth(1)
    c.setStrokeColorRGB(0.7, 0.78, 0.95)
    c.rect(1.6 * cm, 1.6 * cm, width - 3.2 * cm, height - 3.2 * cm, fill=0, stroke=1)

    # Watermark
    c.saveState()
    c.setFillColorRGB(0.88, 0.9, 0.95)
    c.setFont('Helvetica-Bold', 90)
    c.translate(width / 2, height / 2)
    c.rotate(28)
    c.drawCentredString(0, 0, 'MOCK TEST')
    c.restoreState()

    # Logo / Library name (top-right)
    org = participant.session.organization
    c.setFont('Helvetica-Bold', 11)
    c.setFillColorRGB(0.3, 0.3, 0.3)
    c.drawRightString(width - 2.5 * cm, height - 2.5 * cm, getattr(org, 'name', '') or '')

    # Logo (markaz logosi)
    try:
        if org and getattr(org, 'logo', None):
            c.drawImage(
                org.logo.path,
                width - 6 * cm, height - 5.4 * cm,
                width=3.2 * cm, height=2.2 * cm,
                preserveAspectRatio=True, mask='auto',
            )
    except Exception:
        pass

    # Brand
    c.setFillColorRGB(0.12, 0.27, 0.6)
    c.setFont('Helvetica-Bold', 14)
    c.drawString(2.5 * cm, height - 2.5 * cm, 'ILDIZmock')
    c.setFont('Helvetica', 9)
    c.setFillColorRGB(0.4, 0.4, 0.5)
    c.drawString(2.5 * cm, height - 3 * cm, 'IELTS Mock Test Platform')

    # Title
    c.setFillColorRGB(0.07, 0.18, 0.45)
    c.setFont('Helvetica-Bold', 36)
    c.drawCentredString(width / 2, height - 6 * cm, 'IELTS MOCK TEST')
    c.setFont('Helvetica', 16)
    c.setFillColorRGB(0.35, 0.4, 0.55)
    c.drawCentredString(width / 2, height - 7 * cm, 'Certificate of Completion')

    # Awarded text
    c.setFont('Helvetica', 13)
    c.setFillColorRGB(0.35, 0.4, 0.55)
    c.drawCentredString(width / 2, height - 9 * cm, 'This certifies that')

    # Student name
    c.setFont('Helvetica-Bold', 30)
    c.setFillColorRGB(0.05, 0.05, 0.1)
    c.drawCentredString(width / 2, height - 10.5 * cm, participant.full_name or '—')

    c.setFont('Helvetica', 13)
    c.setFillColorRGB(0.35, 0.4, 0.55)
    c.drawCentredString(width / 2, height - 11.5 * cm, 'achieved an Overall Band Score of')

    # Score capsule
    box_w = 6.5 * cm
    box_h = 2.5 * cm
    box_x = width / 2 - box_w / 2
    box_y = height - 14.5 * cm
    c.setFillColorRGB(0.12, 0.27, 0.6)
    c.roundRect(box_x, box_y, box_w, box_h, 0.5 * cm, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont('Helvetica-Bold', 56)
    c.drawCentredString(width / 2, box_y + 0.55 * cm, _safe_score(participant.overall_band_score))

    # Section scores
    sections = [
        ('Listening', participant.listening_score),
        ('Reading', participant.reading_score),
        ('Writing', participant.writing_score),
        ('Speaking', participant.speaking_score),
    ]
    cell_w = 4 * cm
    total_w = cell_w * 4
    start_x = width / 2 - total_w / 2
    y = height - 17 * cm
    for i, (label, value) in enumerate(sections):
        x = start_x + i * cell_w
        c.setStrokeColorRGB(0.7, 0.75, 0.85)
        c.roundRect(x + 0.3 * cm, y, cell_w - 0.6 * cm, 1.6 * cm, 0.2 * cm, fill=0, stroke=1)
        c.setFont('Helvetica', 10)
        c.setFillColorRGB(0.4, 0.45, 0.6)
        c.drawCentredString(x + cell_w / 2, y + 1.05 * cm, label)
        c.setFont('Helvetica-Bold', 18)
        c.setFillColorRGB(0.07, 0.18, 0.45)
        c.drawCentredString(x + cell_w / 2, y + 0.3 * cm, _safe_score(value))

    # Footer — test date + markaz aloqasi
    c.setFont('Helvetica', 11)
    c.setFillColorRGB(0.35, 0.4, 0.55)
    c.drawCentredString(
        width / 2, 4 * cm,
        f"Test Date: {participant.session.date.strftime('%d %B %Y')}",
    )

    contact_bits = []
    address = (getattr(org, 'address', '') or '').strip()
    phone = (getattr(org, 'contact_phone', '') or '').strip()
    email = (getattr(org, 'contact_email', '') or '').strip()
    if address:
        contact_bits.append(address)
    if phone:
        contact_bits.append(phone)
    if email:
        contact_bits.append(email)
    if contact_bits:
        c.setFont('Helvetica', 9)
        c.setFillColorRGB(0.45, 0.5, 0.6)
        c.drawCentredString(width / 2, 3.2 * cm, '  ·  '.join(contact_bits))

    c.setFont('Helvetica-Oblique', 9)
    c.setFillColorRGB(0.5, 0.5, 0.55)
    c.drawCentredString(
        width / 2, 2.5 * cm,
        'This is a practice (mock) test certificate. It is not an official IELTS result.',
    )
    c.drawCentredString(
        width / 2, 2 * cm,
        'Issued by ILDIZmock Platform · ildizmock.uz',
    )

    # ETAP 20 — Certificate number + verification URL (agar berilgan bo'lsa)
    if certificate is not None:
        c.setFont('Helvetica-Bold', 10)
        c.setFillColorRGB(0.12, 0.27, 0.6)
        c.drawString(
            2.5 * cm, 1.4 * cm,
            f'Certificate No: {certificate.certificate_number}',
        )
        c.setFont('Helvetica', 8)
        c.setFillColorRGB(0.45, 0.5, 0.6)
        verify_url = _build_verify_url(certificate)
        c.drawRightString(
            width - 2.5 * cm, 1.4 * cm,
            f'Verify: {verify_url}',
        )

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


def _build_verify_url(certificate) -> str:
    """Frontend orqali tekshirish URL'ini quradi."""
    from django.conf import settings
    base = getattr(settings, 'FRONTEND_URL', '') or 'https://ildizmock.uz'
    return f'{base.rstrip("/")}/verify/{certificate.verification_code}'


def render_certificate_pdf(certificate) -> BytesIO:
    """ETAP 20 — Persistent Certificate uchun PDF (snapshot fields'dan)."""
    return generate_certificate(certificate.participant, certificate=certificate)
