# ETAP 20: PROFESSIONAL CERTIFICATE SYSTEM

**Maqsad:** IELTStation-level professional sertifikat tizimi - teacher yaratadi, student ko'radi, PDF download qiladi.

---

## 🎯 CERTIFICATE REQUIREMENTS

### Real IELTS Certificate Analysis:

**Cambridge IELTS Certificate:**
```
┌─────────────────────────────────────────────────────┐
│  [Cambridge Logo]    IELTS Test Report Form          │
│                                                       │
│  Candidate Name: DILNOZA RAHIMOVA                    │
│  Candidate Number: 12345678                          │
│  Centre Number: UZ001                                │
│  Test Date: 15 March 2026                           │
│                                                       │
│  ┌───────────────────────────────────────────┐      │
│  │  Listening:         7.5                    │      │
│  │  Reading:           7.0                    │      │
│  │  Writing:           6.5                    │      │
│  │  Speaking:          7.0                    │      │
│  │  ─────────────────────────────────────     │      │
│  │  Overall Band Score: 7.0                   │      │
│  └───────────────────────────────────────────┘      │
│                                                       │
│  Test Centre: ILDIZ Education Center                 │
│  Examiner: Shoxrux Karimov                           │
│                                                       │
│  [Signature]              [Official Stamp]           │
│  Certificate No: ILDIZ-2026-03-001                   │
│  Issue Date: 16 March 2026                           │
└─────────────────────────────────────────────────────┘
```

**Key Elements:**
```
✅ Organization branding (logo + name)
✅ Student information
✅ Test date
✅ Band scores (all 4 modules + overall)
✅ Certificate number (unique)
✅ Teacher/examiner name
✅ Signatures & stamp
✅ Professional design
✅ PDF export
```

---

## 🏗️ ARCHITECTURE

### Certificate Workflow:

```
1. Mock Session Completes
   ↓
2. Teacher Grades Writing/Speaking
   ↓
3. Overall Band Score Calculated
   ↓
4. Teacher Reviews Results
   ↓
5. Teacher Generates Certificate
   ↓
6. Certificate Saved to Database
   ↓
7. Student Sees Certificate in Dashboard
   ↓
8. Student Downloads PDF
```

---

## 📋 DATABASE MODELS

### Certificate Model

**Fayl:** `backend/apps/certificates/models.py`

```python
from django.db import models
from django.contrib.auth import get_user_model
from apps.students.models import StudentProfile
from apps.mock.models import MockSession
from apps.tests.models import Attempt
from datetime import datetime

User = get_user_model()


class CertificateTemplate(models.Model):
    """
    Certificate template - customizable by organization
    """
    
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='certificate_templates',
        verbose_name='Organization'
    )
    
    name = models.CharField(
        max_length=200,
        verbose_name='Template Name',
        help_text='e.g., Standard Certificate, Premium Certificate'
    )
    
    # Design
    header_text = models.CharField(
        max_length=200,
        default='IELTS Mock Test Certificate',
        verbose_name='Header Text'
    )
    
    footer_text = models.TextField(
        blank=True,
        verbose_name='Footer Text',
        help_text='Additional info or disclaimer'
    )
    
    # Logo
    logo = models.ImageField(
        upload_to='certificate_logos/',
        null=True,
        blank=True,
        verbose_name='Organization Logo'
    )
    
    # Colors (hex codes)
    primary_color = models.CharField(
        max_length=7,
        default='#E53935',
        verbose_name='Primary Color',
        help_text='Hex code, e.g., #E53935'
    )
    
    secondary_color = models.CharField(
        max_length=7,
        default='#212121',
        verbose_name='Secondary Color'
    )
    
    # Layout
    show_qr_code = models.BooleanField(
        default=True,
        verbose_name='Show QR Code',
        help_text='QR code for verification'
    )
    
    show_stamp = models.BooleanField(
        default=True,
        verbose_name='Show Stamp Placeholder'
    )
    
    # Status
    is_active = models.BooleanField(
        default=True,
        verbose_name='Active'
    )
    
    is_default = models.BooleanField(
        default=False,
        verbose_name='Default Template'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'certificate_templates'
        verbose_name = 'Certificate Template'
        verbose_name_plural = 'Certificate Templates'
    
    def __str__(self):
        return f"{self.organization.name} - {self.name}"


class Certificate(models.Model):
    """
    Individual certificate issued to a student
    """
    
    # Student & Test
    student = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='certificates',
        verbose_name='Student'
    )
    
    attempt = models.OneToOneField(
        Attempt,
        on_delete=models.CASCADE,
        related_name='certificate',
        verbose_name='Test Attempt'
    )
    
    mock_session = models.ForeignKey(
        MockSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='certificates',
        verbose_name='Mock Session'
    )
    
    # Certificate Details
    certificate_number = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Certificate Number',
        help_text='e.g., ILDIZ-2026-03-001'
    )
    
    test_date = models.DateField(
        verbose_name='Test Date'
    )
    
    issue_date = models.DateField(
        auto_now_add=True,
        verbose_name='Issue Date'
    )
    
    # Scores
    listening_score = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        verbose_name='Listening Score'
    )
    
    reading_score = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        verbose_name='Reading Score'
    )
    
    writing_score = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        verbose_name='Writing Score'
    )
    
    speaking_score = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        verbose_name='Speaking Score'
    )
    
    overall_band_score = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        verbose_name='Overall Band Score'
    )
    
    # Issuer
    issued_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='issued_certificates',
        verbose_name='Issued By (Teacher)'
    )
    
    # Template
    template = models.ForeignKey(
        CertificateTemplate,
        on_delete=models.SET_NULL,
        null=True,
        related_name='certificates',
        verbose_name='Template Used'
    )
    
    # PDF
    pdf_file = models.FileField(
        upload_to='certificates/',
        null=True,
        blank=True,
        verbose_name='PDF File'
    )
    
    # Verification
    verification_code = models.CharField(
        max_length=64,
        unique=True,
        blank=True,
        verbose_name='Verification Code',
        help_text='For QR code verification'
    )
    
    # Status
    is_revoked = models.BooleanField(
        default=False,
        verbose_name='Revoked',
        help_text='Certificate cancelled/invalid'
    )
    
    revoked_at = models.DateTimeField(
        null=True,
        blank=True
    )
    
    revoked_reason = models.TextField(
        blank=True
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'certificates'
        verbose_name = 'Certificate'
        verbose_name_plural = 'Certificates'
        ordering = ['-issue_date']
        indexes = [
            models.Index(fields=['certificate_number']),
            models.Index(fields=['verification_code']),
        ]
    
    def __str__(self):
        return f"{self.certificate_number} - {self.student.user.get_full_name()}"
    
    def save(self, *args, **kwargs):
        # Generate certificate number
        if not self.certificate_number:
            self.certificate_number = self.generate_certificate_number()
        
        # Generate verification code
        if not self.verification_code:
            import secrets
            self.verification_code = secrets.token_urlsafe(32)
        
        super().save(*args, **kwargs)
    
    def generate_certificate_number(self):
        """
        Generate unique certificate number
        Format: ILDIZ-YYYY-MM-XXX
        """
        org_code = self.student.organization.name[:6].upper().replace(' ', '')
        year = self.test_date.year
        month = self.test_date.month
        
        # Count certificates this month
        count = Certificate.objects.filter(
            test_date__year=year,
            test_date__month=month,
            student__organization=self.student.organization
        ).count()
        
        return f"{org_code}-{year}-{month:02d}-{count + 1:03d}"
    
    def get_verification_url(self):
        """Get public verification URL"""
        from django.conf import settings
        return f"{settings.FRONTEND_URL}/verify/{self.verification_code}"
```

---

## 🎨 PDF GENERATION

### Using WeasyPrint (Professional Quality)

**Install:**
```bash
pip install weasyprint --break-system-packages
```

**Fayl:** `backend/apps/certificates/pdf_generator.py`

```python
from weasyprint import HTML, CSS
from django.template.loader import render_to_string
from django.conf import settings
import os
import qrcode
from io import BytesIO
import base64


class CertificatePDFGenerator:
    """
    Generate professional PDF certificates
    """
    
    def __init__(self, certificate):
        self.certificate = certificate
        self.template = certificate.template
    
    def generate(self):
        """Generate PDF and save to file"""
        
        # Generate QR code
        qr_code_base64 = self._generate_qr_code()
        
        # Prepare context
        context = {
            'certificate': self.certificate,
            'template': self.template,
            'student': self.certificate.student,
            'organization': self.certificate.student.organization,
            'qr_code': qr_code_base64,
            'verification_url': self.certificate.get_verification_url(),
        }
        
        # Render HTML
        html_string = render_to_string('certificates/certificate_template.html', context)
        
        # Generate PDF
        pdf_file = HTML(string=html_string, base_url=settings.STATIC_URL).write_pdf()
        
        # Save to file
        filename = f"certificate_{self.certificate.certificate_number}.pdf"
        filepath = os.path.join(settings.MEDIA_ROOT, 'certificates', filename)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with open(filepath, 'wb') as f:
            f.write(pdf_file)
        
        # Update certificate model
        self.certificate.pdf_file = f'certificates/{filename}'
        self.certificate.save()
        
        return filepath
    
    def _generate_qr_code(self):
        """Generate QR code for verification"""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=2,
        )
        qr.add_data(self.certificate.get_verification_url())
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{img_base64}"
```

---

### HTML Template

**Fayl:** `backend/templates/certificates/certificate_template.html`

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Certificate - {{ certificate.certificate_number }}</title>
    <style>
        @page {
            size: A4 landscape;
            margin: 0;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            width: 297mm;
            height: 210mm;
            position: relative;
            background: linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%);
        }
        
        .certificate {
            width: 100%;
            height: 100%;
            padding: 30mm;
            position: relative;
        }
        
        /* Border */
        .certificate::before {
            content: '';
            position: absolute;
            top: 15mm;
            left: 15mm;
            right: 15mm;
            bottom: 15mm;
            border: 3px solid {{ template.primary_color }};
            border-radius: 10px;
        }
        
        .certificate::after {
            content: '';
            position: absolute;
            top: 18mm;
            left: 18mm;
            right: 18mm;
            bottom: 18mm;
            border: 1px solid {{ template.secondary_color }};
            border-radius: 8px;
        }
        
        /* Header */
        .header {
            text-align: center;
            margin-bottom: 20mm;
        }
        
        .logo {
            width: 60mm;
            height: auto;
            margin-bottom: 5mm;
        }
        
        .header-text {
            font-size: 28pt;
            font-weight: bold;
            color: {{ template.primary_color }};
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        
        .organization-name {
            font-size: 18pt;
            color: {{ template.secondary_color }};
            margin-top: 3mm;
        }
        
        /* Body */
        .content {
            text-align: center;
            margin-bottom: 15mm;
        }
        
        .certificate-text {
            font-size: 14pt;
            color: #555;
            margin-bottom: 5mm;
        }
        
        .student-name {
            font-size: 32pt;
            font-weight: bold;
            color: {{ template.secondary_color }};
            margin: 8mm 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .achievement-text {
            font-size: 12pt;
            color: #666;
            margin-bottom: 10mm;
            line-height: 1.6;
        }
        
        /* Scores */
        .scores-container {
            background: white;
            border: 2px solid {{ template.primary_color }};
            border-radius: 8px;
            padding: 10mm;
            margin: 0 auto 10mm;
            max-width: 180mm;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .scores-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 5mm;
            margin-bottom: 5mm;
        }
        
        .score-item {
            text-align: center;
        }
        
        .score-label {
            font-size: 10pt;
            color: #666;
            margin-bottom: 2mm;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .score-value {
            font-size: 24pt;
            font-weight: bold;
            color: {{ template.primary_color }};
        }
        
        .overall-score {
            border-top: 2px solid #ddd;
            padding-top: 5mm;
            margin-top: 5mm;
        }
        
        .overall-label {
            font-size: 12pt;
            color: #666;
            margin-bottom: 2mm;
            text-transform: uppercase;
        }
        
        .overall-value {
            font-size: 36pt;
            font-weight: bold;
            color: {{ template.primary_color }};
        }
        
        /* Footer */
        .footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: auto;
        }
        
        .footer-left,
        .footer-center,
        .footer-right {
            flex: 1;
            text-align: center;
        }
        
        .signature-line {
            border-top: 2px solid #333;
            width: 50mm;
            margin: 0 auto 2mm;
        }
        
        .footer-label {
            font-size: 9pt;
            color: #666;
        }
        
        .footer-value {
            font-size: 10pt;
            font-weight: bold;
            color: #333;
        }
        
        .qr-code {
            width: 20mm;
            height: 20mm;
        }
        
        .certificate-number {
            font-size: 8pt;
            color: #999;
            margin-top: 2mm;
        }
        
        /* Watermark */
        .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 72pt;
            color: rgba(229, 57, 53, 0.05);
            font-weight: bold;
            z-index: -1;
        }
    </style>
</head>
<body>
    <div class="certificate">
        <!-- Watermark -->
        <div class="watermark">ILDIZMOCK</div>
        
        <!-- Header -->
        <div class="header">
            {% if template.logo %}
            <img src="{{ template.logo.url }}" alt="Logo" class="logo">
            {% endif %}
            
            <div class="header-text">{{ template.header_text }}</div>
            <div class="organization-name">{{ organization.name }}</div>
        </div>
        
        <!-- Content -->
        <div class="content">
            <p class="certificate-text">This is to certify that</p>
            
            <h1 class="student-name">{{ student.user.get_full_name }}</h1>
            
            <p class="achievement-text">
                has successfully completed the IELTS Mock Examination<br>
                on {{ certificate.test_date|date:"d F Y" }}<br>
                and achieved the following band scores:
            </p>
            
            <!-- Scores -->
            <div class="scores-container">
                <div class="scores-grid">
                    <div class="score-item">
                        <div class="score-label">Listening</div>
                        <div class="score-value">{{ certificate.listening_score }}</div>
                    </div>
                    
                    <div class="score-item">
                        <div class="score-label">Reading</div>
                        <div class="score-value">{{ certificate.reading_score }}</div>
                    </div>
                    
                    <div class="score-item">
                        <div class="score-label">Writing</div>
                        <div class="score-value">{{ certificate.writing_score }}</div>
                    </div>
                    
                    <div class="score-item">
                        <div class="score-label">Speaking</div>
                        <div class="score-value">{{ certificate.speaking_score }}</div>
                    </div>
                </div>
                
                <div class="overall-score">
                    <div class="overall-label">Overall Band Score</div>
                    <div class="overall-value">{{ certificate.overall_band_score }}</div>
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="footer-left">
                <div class="signature-line"></div>
                <p class="footer-label">Examiner</p>
                <p class="footer-value">{{ certificate.issued_by.get_full_name }}</p>
            </div>
            
            <div class="footer-center">
                {% if template.show_qr_code %}
                <img src="{{ qr_code }}" alt="QR Code" class="qr-code">
                <p class="certificate-number">{{ certificate.certificate_number }}</p>
                {% endif %}
            </div>
            
            <div class="footer-right">
                <div class="signature-line"></div>
                <p class="footer-label">Issue Date</p>
                <p class="footer-value">{{ certificate.issue_date|date:"d F Y" }}</p>
            </div>
        </div>
        
        {% if template.footer_text %}
        <div style="text-align: center; margin-top: 5mm; font-size: 8pt; color: #999;">
            {{ template.footer_text }}
        </div>
        {% endif %}
    </div>
</body>
</html>
```

---

## 🔧 IMPLEMENTATION

### STEP 1: Teacher Generates Certificate

**Fayl:** `backend/apps/certificates/views.py`

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Certificate, CertificateTemplate
from .pdf_generator import CertificatePDFGenerator
from apps.tests.models import Attempt
from apps.students.models import StudentProfile


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_certificate(request, attempt_id):
    """
    Teacher generates certificate for a completed test
    """
    
    # Permission check
    if request.user.role not in ['teacher', 'admin']:
        return Response({'error': 'Permission denied'}, status=403)
    
    # Get attempt
    attempt = get_object_or_404(Attempt, pk=attempt_id)
    
    # Check if already has certificate
    if hasattr(attempt, 'certificate'):
        return Response({
            'error': 'Certificate already exists',
            'certificate_id': attempt.certificate.id
        }, status=400)
    
    # Get student profile
    student = attempt.user.student_profile
    
    # Get template
    template_id = request.data.get('template_id')
    if template_id:
        template = get_object_or_404(CertificateTemplate, pk=template_id)
    else:
        # Use default template
        template = CertificateTemplate.objects.filter(
            organization=request.user.library,
            is_default=True
        ).first()
    
    # Create certificate
    certificate = Certificate.objects.create(
        student=student,
        attempt=attempt,
        mock_session=attempt.mock_session if hasattr(attempt, 'mock_session') else None,
        test_date=attempt.created_at.date(),
        listening_score=attempt.listening_band_score,
        reading_score=attempt.reading_band_score,
        writing_score=attempt.writing_band_score,
        speaking_score=attempt.speaking_band_score,
        overall_band_score=attempt.overall_band_score,
        issued_by=request.user,
        template=template
    )
    
    # Generate PDF
    generator = CertificatePDFGenerator(certificate)
    pdf_path = generator.generate()
    
    return Response({
        'success': True,
        'certificate': {
            'id': certificate.id,
            'certificate_number': certificate.certificate_number,
            'pdf_url': certificate.pdf_file.url,
            'verification_url': certificate.get_verification_url()
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_certificates(request):
    """
    Get all certificates for logged-in student
    """
    
    # Get student profile
    student = request.user.student_profile
    
    # Get certificates
    certificates = student.certificates.filter(
        is_revoked=False
    ).select_related('template', 'issued_by')
    
    certificate_list = []
    for cert in certificates:
        certificate_list.append({
            'id': cert.id,
            'certificate_number': cert.certificate_number,
            'test_date': cert.test_date,
            'issue_date': cert.issue_date,
            'overall_band_score': float(cert.overall_band_score),
            'listening_score': float(cert.listening_score),
            'reading_score': float(cert.reading_score),
            'writing_score': float(cert.writing_score),
            'speaking_score': float(cert.speaking_score),
            'pdf_url': cert.pdf_file.url if cert.pdf_file else None,
            'verification_url': cert.get_verification_url(),
            'issued_by': cert.issued_by.get_full_name()
        })
    
    return Response({
        'certificates': certificate_list
    })


@api_view(['GET'])
def verify_certificate(request, verification_code):
    """
    Public endpoint - verify certificate authenticity
    """
    
    try:
        certificate = Certificate.objects.get(
            verification_code=verification_code,
            is_revoked=False
        )
        
        return Response({
            'valid': True,
            'certificate': {
                'certificate_number': certificate.certificate_number,
                'student_name': certificate.student.user.get_full_name(),
                'test_date': certificate.test_date,
                'issue_date': certificate.issue_date,
                'overall_band_score': float(certificate.overall_band_score),
                'organization': certificate.student.organization.name
            }
        })
        
    except Certificate.DoesNotExist:
        return Response({
            'valid': False,
            'error': 'Certificate not found or has been revoked'
        }, status=404)
```

---

## STEP 2: Frontend - Teacher Interface

**Fayl:** `frontend/src/pages/center/GenerateCertificate.tsx`

```typescript
import React, { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';

export const GenerateCertificate: React.FC<{ attemptId: number }> = ({ attemptId }) => {
  const [loading, setLoading] = useState(false);
  const [certificate, setCertificate] = useState<any>(null);
  
  const handleGenerate = async () => {
    setLoading(true);
    
    try {
      const response = await api.post(`/certificates/generate/${attemptId}/`);
      
      setCertificate(response.data.certificate);
      toast.success('Certificate generated!');
      
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">
        📜 Generate Certificate
      </h3>
      
      {!certificate ? (
        <div>
          <p className="text-gray-600 mb-4">
            Generate a professional certificate for this test result.
          </p>
          
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? 'Generating...' : '→ Generate Certificate'}
          </button>
        </div>
      ) : (
        <div className="bg-green-50 border-2 border-green-600 rounded-xl p-6">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">✅</div>
            <h4 className="text-lg font-bold text-gray-900">
              Certificate Generated!
            </h4>
            <p className="text-gray-600">
              {certificate.certificate_number}
            </p>
          </div>
          
          <div className="flex gap-3">
            <a
              href={certificate.pdf_url}
              download
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-center py-3 rounded-lg font-semibold"
            >
              📥 Download PDF
            </a>
            
            <a
              href={certificate.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-3 rounded-lg font-semibold"
            >
              👁️ View PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## STEP 3: Student Dashboard

**Fayl:** `frontend/src/pages/student/MyCertificates.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export const MyCertificates: React.FC = () => {
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchCertificates();
  }, []);
  
  const fetchCertificates = async () => {
    try {
      const response = await api.get('/certificates/my-certificates/');
      setCertificates(response.data.certificates);
    } catch (error) {
      console.error('Failed to fetch certificates:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        📜 My Certificates
      </h1>
      
      {loading ? (
        <div className="text-center py-12 text-gray-600">
          Loading...
        </div>
      ) : certificates.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📜</div>
          <p className="text-xl text-gray-600">
            No certificates yet
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map(cert => (
            <div
              key={cert.id}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              {/* Certificate Preview */}
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 p-6 text-center">
                <div className="text-4xl mb-2">🏆</div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {cert.overall_band_score}
                </div>
                <div className="text-sm text-gray-600">
                  Overall Band Score
                </div>
              </div>
              
              {/* Details */}
              <div className="p-6">
                <div className="mb-4">
                  <p className="text-xs text-gray-600 mb-1">Certificate Number</p>
                  <p className="font-mono text-sm font-semibold text-gray-900">
                    {cert.certificate_number}
                  </p>
                </div>
                
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-600">L</p>
                    <p className="font-bold text-primary-600">{cert.listening_score}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600">R</p>
                    <p className="font-bold text-primary-600">{cert.reading_score}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600">W</p>
                    <p className="font-bold text-primary-600">{cert.writing_score}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600">S</p>
                    <p className="font-bold text-primary-600">{cert.speaking_score}</p>
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 mb-4">
                  <p>Test Date: {new Date(cert.test_date).toLocaleDateString()}</p>
                  <p>Issued: {new Date(cert.issue_date).toLocaleDateString()}</p>
                  <p>Examiner: {cert.issued_by}</p>
                </div>
                
                <div className="flex gap-2">
                  <a
                    href={cert.pdf_url}
                    download
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-center py-2 rounded-lg text-sm font-semibold"
                  >
                    📥 Download
                  </a>
                  
                  <a
                    href={cert.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-2 rounded-lg text-sm font-semibold"
                  >
                    👁️ View
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

**ETAP 20 TO'LIQ - PROFESSIONAL CERTIFICATE SYSTEM!** 📜
