"""AI-Assisted IELTS question generation via Claude API.

Takes a passage text and asks Claude to generate IELTS Reading questions
in a strict JSON shape that can be fed straight into the easy-create flow.
"""
from __future__ import annotations

import json
import logging
import re

import anthropic
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.authentication import CookieJWTAuthentication
from apps.organizations.models import Organization, OrganizationMembership
from apps.organizations.permissions import IsCenterAdmin

log = logging.getLogger(__name__)

# IELTS Reading is the most amenable to LLM generation — Listening needs
# audio, Writing/Speaking are single prompts. Keep this list narrow.
ALLOWED_MODULES = {'reading', 'listening'}

# Caps to keep token usage and request time bounded.
MAX_PASSAGE_CHARS = 8000  # ≈ 1500 words, well above a real IELTS passage
MIN_PASSAGE_CHARS = 200   # short snippets give junk questions

SYSTEM_PROMPT = (
    "You are an experienced IELTS Reading test designer. "
    "You generate exam-quality questions strictly in JSON format. "
    "Your questions must:\n"
    "- Test comprehension at multiple levels (gist, detail, inference, vocabulary)\n"
    "- Be answerable strictly from the passage (no outside knowledge)\n"
    "- Match real IELTS difficulty for the level requested\n"
    "- Use a balanced mix of question types\n"
    "- Have unambiguous correct answers\n\n"
    "Output ONLY valid JSON — no preamble, no commentary, no code fences."
)


def _build_user_prompt(passage: str, count: int, difficulty: str) -> str:
    return (
        f"Generate exactly {count} IELTS Reading questions for the passage below.\n\n"
        f"Difficulty: {difficulty} (Band {{4.5-5.5: beginner, 5.5-6.5: intermediate, "
        "6.5-7.5: advanced, 7.5+: expert}}).\n\n"
        "Use a mix of these question_type values:\n"
        '  - "tfng": True / False / Not Given. correct_answer ∈ '
        '{"TRUE", "FALSE", "NOT GIVEN"}, options must be null.\n'
        '  - "mcq": Multiple choice. options is an array of 4 strings, '
        "correct_answer is the exact text of one option.\n"
        '  - "fill": Fill-in-the-blank with a short answer (1-3 words). '
        "correct_answer is that short text, options must be null.\n"
        '  - "short_answer": Free-response one-line answer. options must be null.\n\n'
        "Return JSON in this EXACT shape (no extra fields, no comments):\n"
        "{\n"
        '  "questions": [\n'
        "    {\n"
        '      "order": 1,\n'
        '      "question_type": "tfng",\n'
        '      "text": "<question text>",\n'
        '      "options": null,\n'
        '      "correct_answer": "TRUE",\n'
        '      "points": 1\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "PASSAGE:\n"
        "----\n"
        f"{passage}\n"
        "----"
    )


def _check_center_admin(user, slug: str) -> Organization:
    org = get_object_or_404(Organization, slug=slug)
    if user.role == 'superadmin':
        return org
    if not OrganizationMembership.objects.filter(
        user=user, organization=org, role__in=['admin', 'owner'],
    ).exists():
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('You are not an admin of this center.')
    return org


def _extract_json(text: str) -> dict:
    """Strip optional code fences, then parse. Raises ValueError on failure."""
    s = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", s, re.DOTALL)
    if fence:
        s = fence.group(1).strip()
    return json.loads(s)


@api_view(['POST'])
@authentication_classes([CookieJWTAuthentication])
@permission_classes([IsAuthenticated, IsCenterAdmin])
def ai_generate_questions(request, org_slug=None):
    """POST /api/v1/center/<slug>/tests/ai-generate-questions/

    Body: {
      "module": "reading",
      "passage_text": "...",
      "count": 13,         // optional, default 13, max 20
      "difficulty": "intermediate",  // optional
    }

    Response (200): { "questions": [ ... ] }   // raw AI output, ready for easy-create
    Response (400): { "detail": "..." }
    Response (502): { "detail": "..." }       // upstream Claude API error
    """
    _check_center_admin(request.user, org_slug)

    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        return Response(
            {'detail': 'AI question generation is not configured. '
                       'Add ANTHROPIC_API_KEY to backend/.env and restart.'},
            status=503,
        )

    data = request.data
    module = (data.get('module') or '').strip().lower()
    if module not in ALLOWED_MODULES:
        return Response(
            {'detail': 'AI generation supports only "reading" or "listening" modules.'},
            status=400,
        )

    passage = (data.get('passage_text') or '').strip()
    if len(passage) < MIN_PASSAGE_CHARS:
        return Response(
            {'detail': f'Passage too short — paste at least {MIN_PASSAGE_CHARS} characters.'},
            status=400,
        )
    if len(passage) > MAX_PASSAGE_CHARS:
        return Response(
            {'detail': f'Passage too long — keep it under {MAX_PASSAGE_CHARS} characters.'},
            status=400,
        )

    try:
        count = int(data.get('count') or 13)
    except (TypeError, ValueError):
        count = 13
    count = max(3, min(count, 20))

    difficulty = (data.get('difficulty') or 'intermediate').strip().lower()
    if difficulty not in ('beginner', 'intermediate', 'advanced', 'expert'):
        difficulty = 'intermediate'

    client = anthropic.Anthropic(api_key=api_key)
    try:
        # Cache the system prompt — same across every request, paid once
        # then read at ~0.1× cost. See shared/prompt-caching.md.
        message = client.messages.create(
            model='claude-opus-4-7',
            max_tokens=4096,
            system=[{
                'type': 'text',
                'text': SYSTEM_PROMPT,
                'cache_control': {'type': 'ephemeral'},
            }],
            messages=[{
                'role': 'user',
                'content': _build_user_prompt(passage, count, difficulty),
            }],
        )
    except anthropic.AuthenticationError:
        log.error('Claude API key rejected.')
        return Response(
            {'detail': 'AI service authentication failed. '
                       'Check ANTHROPIC_API_KEY in backend/.env.'},
            status=502,
        )
    except anthropic.RateLimitError:
        return Response(
            {'detail': 'AI service is rate-limited. Try again in a minute.'},
            status=502,
        )
    except anthropic.APIError as exc:
        log.error('Claude API error: %s', exc)
        return Response(
            {'detail': f'AI service error: {exc}'},
            status=502,
        )
    except Exception as exc:  # noqa: BLE001
        log.exception('Unexpected error calling Claude API')
        return Response(
            {'detail': f'Unexpected error: {type(exc).__name__}: {exc}'},
            status=500,
        )

    # Pull out the first text block. Claude Opus 4.7 may emit empty thinking
    # blocks before text; we skip those.
    text_blocks = [b.text for b in message.content if getattr(b, 'type', '') == 'text']
    if not text_blocks:
        return Response(
            {'detail': 'AI returned no text. Try again or shorten the passage.'},
            status=502,
        )

    try:
        parsed = _extract_json(text_blocks[0])
    except (ValueError, json.JSONDecodeError):
        log.warning('AI returned non-JSON output: %s', text_blocks[0][:300])
        return Response(
            {'detail': 'AI returned an unparseable answer. Try again — '
                       'sometimes a re-run produces clean JSON.'},
            status=502,
        )

    questions = parsed.get('questions') if isinstance(parsed, dict) else None
    if not isinstance(questions, list) or not questions:
        return Response(
            {'detail': 'AI returned no questions. Try a longer or richer passage.'},
            status=502,
        )

    # Light shape validation — fix small issues so the easy-create flow
    # doesn't fail on unexpected fields.
    valid_types = {'tfng', 'mcq', 'fill', 'short_answer'}
    cleaned = []
    for i, q in enumerate(questions, start=1):
        if not isinstance(q, dict):
            continue
        qt = q.get('question_type')
        if qt not in valid_types:
            continue
        cleaned.append({
            'order': int(q.get('order') or i),
            'question_type': qt,
            'text': str(q.get('text') or '').strip(),
            'options': q.get('options') if qt == 'mcq' else None,
            'correct_answer': str(q.get('correct_answer') or '').strip(),
            'instruction': '',
            'points': int(q.get('points') or 1),
        })

    if not cleaned:
        return Response(
            {'detail': 'AI output had no usable questions. Try again.'},
            status=502,
        )

    return Response({
        'questions': cleaned,
        'usage': {
            'input_tokens': message.usage.input_tokens,
            'output_tokens': message.usage.output_tokens,
            'cache_read_input_tokens': getattr(
                message.usage, 'cache_read_input_tokens', 0,
            ),
            'cache_creation_input_tokens': getattr(
                message.usage, 'cache_creation_input_tokens', 0,
            ),
        },
    })
