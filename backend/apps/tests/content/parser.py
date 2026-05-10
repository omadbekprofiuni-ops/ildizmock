"""ETAP 30 — Content DSL → safe HTML parser.

Adminning markdown-uslubidagi manba matnini xavfsiz HTML'ga aylantiradi.
HTML injection oldini olish uchun avval html.escape() qo'llaniladi, keyin
ruxsat etilgan inline tag'lar regex orqali qayta tiklanadi.

Qo'llab-quvvatlanadigan DSL:
    # H1   ## H2   ### H3   #### H4
    **bold**       *italic*
    - bullet       1. numbered
    {1}            inline input (answer N=1)
    {15:LARGE}     keng input
    ---            <hr>
    > quote        <blockquote>
    [passage]...[/passage]   div.passage-box
    [box]...[/box]           div.callout-box
    [mcq:5]A. ... B. ...[/mcq]
    [tfng:6]statement[/tfng]
"""
from __future__ import annotations

import html
import re

INPUT_MARKER_RE = re.compile(r'\{(\d{1,3})(?::([A-Z]+))?\}')
BOLD_RE = re.compile(r'\*\*(.+?)\*\*')
ITALIC_RE = re.compile(r'(?<!\*)\*([^*]+)\*(?!\*)')
HR_RE = re.compile(r'^---\s*$')

INPUT_SIZE_CLASS = {
    'SMALL': 'input-sm',
    'MEDIUM': 'input-md',
    'LARGE': 'input-lg',
}


def render_inline(line: str) -> str:
    """Inline markdown'ni HTML'ga aylantiradi.

    Avval hamma narsani escape qilamiz (xavfsizlik), keyin ruxsat etilgan
    inline tag'larni qayta tiklayamiz.
    """
    out = html.escape(line)
    out = BOLD_RE.sub(r'<strong>\1</strong>', out)
    out = ITALIC_RE.sub(r'<em>\1</em>', out)

    def _input(m: re.Match) -> str:
        num = m.group(1)
        size_hint = (m.group(2) or 'MEDIUM').upper()
        css = INPUT_SIZE_CLASS.get(size_hint, 'input-md')
        return f'<input data-q="{num}" class="answer-input {css}" />'

    out = INPUT_MARKER_RE.sub(_input, out)
    return out


def _heading_level(line: str) -> tuple[int, str] | None:
    """Returns (level, text) yoki None."""
    m = re.match(r'^(#{1,5})\s+(.+)$', line)
    if m:
        return len(m.group(1)), m.group(2).strip()
    return None


def parse_content(source: str) -> str:
    """Top-level parser. Manba DSL'dan HTML qaytaradi."""
    if not source:
        return ''

    lines = source.replace('\r\n', '\n').split('\n')
    out: list[str] = []

    in_passage = False
    in_box = False
    in_list_ul = False
    in_list_ol = False
    in_mcq: dict | None = None  # {start_q, statements: list}
    in_tfng: dict | None = None
    in_matching: dict | None = None

    def close_lists():
        nonlocal in_list_ul, in_list_ol
        if in_list_ul:
            out.append('</ul>')
            in_list_ul = False
        if in_list_ol:
            out.append('</ol>')
            in_list_ol = False

    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        stripped = line.strip()

        if not stripped:
            close_lists()
            i += 1
            continue

        # Container blocks
        if stripped == '[passage]':
            close_lists()
            out.append('<div class="passage-box">')
            in_passage = True
            i += 1
            continue
        if stripped == '[/passage]':
            close_lists()
            out.append('</div>')
            in_passage = False
            i += 1
            continue
        if stripped == '[box]':
            close_lists()
            out.append('<div class="callout-box">')
            in_box = True
            i += 1
            continue
        if stripped == '[/box]':
            close_lists()
            out.append('</div>')
            in_box = False
            i += 1
            continue

        # MCQ block
        mcq_open = re.match(r'^\[mcq:(\d+)\]\s*$', stripped)
        if mcq_open:
            close_lists()
            in_mcq = {'q': int(mcq_open.group(1)), 'lines': []}
            i += 1
            continue
        if stripped == '[/mcq]' and in_mcq:
            q = in_mcq['q']
            stem_lines: list[str] = []
            options: list[str] = []
            for ln in in_mcq['lines']:
                if re.match(r'^[A-J]\.\s+', ln):
                    options.append(ln)
                else:
                    stem_lines.append(ln)
            stem = ' '.join(s.strip() for s in stem_lines if s.strip())
            out.append(f'<div class="mcq" data-q="{q}">')
            if stem:
                out.append(f'<p class="mcq-stem"><strong>{q}.</strong> {render_inline(stem)}</p>')
            out.append('<ul class="mcq-options">')
            for opt in options:
                m = re.match(r'^([A-J])\.\s+(.+)$', opt)
                if not m:
                    continue
                letter, text = m.group(1), m.group(2)
                out.append(
                    f'<li><label><input type="radio" name="q-{q}" '
                    f'value="{letter}" data-q="{q}"/> '
                    f'<strong>{letter}.</strong> {render_inline(text)}</label></li>'
                )
            out.append('</ul></div>')
            in_mcq = None
            i += 1
            continue
        if in_mcq is not None:
            in_mcq['lines'].append(stripped)
            i += 1
            continue

        # TFNG block
        tfng_open = re.match(r'^\[(tfng|ynng):(\d+)\]\s*$', stripped)
        if tfng_open:
            close_lists()
            in_tfng = {
                'kind': tfng_open.group(1),
                'q': int(tfng_open.group(2)),
                'lines': [],
            }
            i += 1
            continue
        if stripped in ('[/tfng]', '[/ynng]') and in_tfng:
            q = in_tfng['q']
            statement = ' '.join(s.strip() for s in in_tfng['lines'] if s.strip())
            options = (
                ['TRUE', 'FALSE', 'NOT GIVEN']
                if in_tfng['kind'] == 'tfng'
                else ['YES', 'NO', 'NOT GIVEN']
            )
            out.append(f'<div class="tfng" data-q="{q}">')
            out.append(
                f'<p class="tfng-stem"><strong>{q}.</strong> '
                f'{render_inline(statement)}</p>',
            )
            out.append('<div class="tfng-options">')
            for v in options:
                out.append(
                    f'<label><input type="radio" name="q-{q}" '
                    f'value="{v}" data-q="{q}"/> {v}</label>',
                )
            out.append('</div></div>')
            in_tfng = None
            i += 1
            continue
        if in_tfng is not None:
            in_tfng['lines'].append(stripped)
            i += 1
            continue

        # Matching block
        match_open = re.match(r'^\[matching:(\d+)-(\d+)\]\s*$', stripped)
        if match_open:
            close_lists()
            in_matching = {
                'first': int(match_open.group(1)),
                'last': int(match_open.group(2)),
                'lines': [],
            }
            i += 1
            continue
        if stripped == '[/matching]' and in_matching:
            out.append('<div class="matching">')
            for ln in in_matching['lines']:
                out.append(f'<p>{render_inline(ln)}</p>')
            out.append('</div>')
            in_matching = None
            i += 1
            continue
        if in_matching is not None:
            in_matching['lines'].append(stripped)
            i += 1
            continue

        # HR
        if HR_RE.match(stripped):
            close_lists()
            out.append('<hr/>')
            i += 1
            continue

        # Heading
        h = _heading_level(stripped)
        if h:
            close_lists()
            level, text = h
            out.append(f'<h{level}>{render_inline(text)}</h{level}>')
            i += 1
            continue

        # Blockquote
        if stripped.startswith('> '):
            close_lists()
            text = stripped[2:]
            out.append(f'<blockquote>{render_inline(text)}</blockquote>')
            i += 1
            continue

        # Bullet list
        bullet = re.match(r'^[-*]\s+(.+)$', stripped)
        if bullet:
            if in_list_ol:
                out.append('</ol>')
                in_list_ol = False
            if not in_list_ul:
                out.append('<ul>')
                in_list_ul = True
            out.append(f'<li>{render_inline(bullet.group(1))}</li>')
            i += 1
            continue

        # Numbered list
        numbered = re.match(r'^\d+\.\s+(.+)$', stripped)
        if numbered:
            if in_list_ul:
                out.append('</ul>')
                in_list_ul = False
            if not in_list_ol:
                out.append('<ol>')
                in_list_ol = True
            out.append(f'<li>{render_inline(numbered.group(1))}</li>')
            i += 1
            continue

        # Default — paragraph
        close_lists()
        out.append(f'<p>{render_inline(stripped)}</p>')
        i += 1

    close_lists()
    if in_passage:
        out.append('</div>')
    if in_box:
        out.append('</div>')

    return '\n'.join(out)
