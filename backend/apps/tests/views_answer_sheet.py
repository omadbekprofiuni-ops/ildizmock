"""ETAP 27 PART 5.1 — Smart Answer Sheet endpoint'lari.

Asosiy endpoint:
  POST /api/v1/admin/answer-sheet/preview/
       body: { "answer_text": "1. station\\n2. TRUE\\n..." }
       response: ParseResult JSON (groups, types, warnings, errors)

Bu endpoint frontend live preview komponenti har bosishda chaqiradi —
DBga hech nima yozilmaydi.
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .smart_answer_sheet import build_answer_key, parse_answer_key_text


def _serialize_parse_result(pr) -> dict:
    return {
        'total_questions': pr.total_questions,
        'warnings': pr.warnings,
        'errors': pr.errors,
        'groups': [
            {
                'start': g.start,
                'end': g.end,
                'qtype': g.qtype,
                'questions': [
                    {
                        'order': q.order,
                        'answer': q.raw_answer,
                        'qtype': q.qtype,
                        'confidence': q.confidence,
                        'reason': q.reason,
                        'answer_key': build_answer_key(g.qtype, q.raw_answer),
                    }
                    for q in g.questions
                ],
            }
            for g in pr.groups
        ],
    }


class AnswerSheetPreviewView(APIView):
    """Pasted javoblarni parse qiladi va detected types qaytaradi."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        text = request.data.get('answer_text', '') or ''
        result = parse_answer_key_text(text)
        return Response(_serialize_parse_result(result))
