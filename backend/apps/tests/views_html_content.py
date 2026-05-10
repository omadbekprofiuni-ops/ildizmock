"""ETAP 30 — HTML Test Platform admin endpoint'lari.

POST /api/v1/admin/html-content/preview/
     body: {"source": "...", "answer_key": {1: "x", 2: "y"}}
     response: {html, validation: {ok, declared, answered, errors, warnings}}

Live preview va admin'ga answer_key bilan kelishuv tekshiruvini beradi.
DBga hech nima yozmaydi.
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .content import parse_content, validate_content


class HtmlContentPreviewView(APIView):
    """Markdown-uslubidagi DSL'ni HTML'ga aylantiradi va answer_key
    kelishuvini tekshiradi.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        source = request.data.get('source', '') or ''
        answer_key = request.data.get('answer_key') or {}

        html = parse_content(source)
        validation = validate_content(source, answer_key)

        return Response({
            'html': html,
            'validation': {
                'ok': validation.ok,
                'declared_questions': validation.declared_questions,
                'answered_questions': validation.answered_questions,
                'errors': validation.errors,
                'warnings': validation.warnings,
            },
        })
