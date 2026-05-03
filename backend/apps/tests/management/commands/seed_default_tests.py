"""Default global tests yaratish — Reading + Listening + Writing.

Server'ga deploy qilingandan keyin:
    python manage.py seed_default_tests

Idempotent — qayta ishga tushirilsa eski testlarni o'chirib yangidan yaratadi.

Media fayllar:
- Writing chart image — `backend/seed_media/writing_charts/april29_population_chart.jpg`
  avtomatik MEDIA_ROOT/writing_charts/2026/05/ ga ko'chiriladi.
- Listening audio fayllar — agar `backend/seed_media/listening_audio/`
  papkasida day18_part{1..4}.mp3 fayllari bo'lsa, ular ham ko'chiriladi.
  Yo'q bo'lsa, audio_file path saqlanadi va admin keyinroq qo'lda yuklab
  qayta biriktirishi kerak bo'ladi (`/admin/upload/audio` orqali).
"""

import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.tests.models import (
    ListeningPart, Passage, Question, Test, WritingTask,
)


class Command(BaseCommand):
    help = 'Diyorbek\'s IELTS uchun default global testlar yaratish.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--skip-media', action='store_true',
            help='Media fayllarni MEDIA_ROOT ga ko\'chirmang.',
        )

    def handle(self, *args, **options):
        skip_media = options['skip_media']

        with transaction.atomic():
            self.stdout.write('Reading test...')
            self._seed_reading()
            self.stdout.write('Listening test...')
            self._seed_listening(skip_media)
            self.stdout.write('Writing test...')
            self._seed_writing(skip_media)

        self.stdout.write(self.style.SUCCESS('OK — barcha default testlar yaratildi.'))

    # =================================================================
    # Media helpers
    # =================================================================

    def _seed_media_dir(self) -> Path:
        # backend/seed_media/
        return Path(settings.BASE_DIR) / 'seed_media'

    def _copy_media(self, rel_path: str) -> bool:
        """seed_media/<rel_path> → MEDIA_ROOT/<rel_path>. True qaytaradi
        agar source mavjud va ko'chirildi."""
        src = self._seed_media_dir() / rel_path
        if not src.exists():
            return False
        dst = Path(settings.MEDIA_ROOT) / rel_path
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        return True

    # =================================================================
    # READING — 3 passage / 40 questions
    # =================================================================

    def _seed_reading(self):
        TEST_NAME = "Diyorbek's IELTS Reading — Test 1"
        Test.objects.filter(
            name=TEST_NAME, organization__isnull=True, is_global=True,
        ).delete()

        test = Test.objects.create(
            name=TEST_NAME,
            module='reading', test_type='academic', difficulty='medium',
            duration_minutes=60,
            description='3 ta passage, 40 ta savol. Academic Reading.',
            is_published=True, status='published',
            category="Diyorbek's IELTS",
            organization=None, is_global=True,
        )

        # ------ Passage 1 ------
        from . import _diyorbek_reading_data as r
        p1 = Passage.objects.create(
            test=test, part_number=1, title=r.P1_TITLE,
            subtitle=r.P1_SUBTITLE, content=r.P1_CONTENT, order=1,
            instructions='You should spend about 20 minutes on Questions 1–13.',
        )
        for n, txt, ans in r.P1_TFNG:
            Question.objects.create(
                passage=p1, order=n, question_number=n,
                question_type='tfng', text=txt, prompt=txt,
                options=['TRUE', 'FALSE', 'NOT GIVEN'],
                correct_answer=ans, group_id=1,
                instruction=r.TFNG_INSTR if n == 1 else '',
            )
        for n, txt, ans, alts in r.P1_FILL:
            Question.objects.create(
                passage=p1, order=n, question_number=n,
                question_type='fill', text=txt, prompt=txt,
                options=[], correct_answer=ans,
                acceptable_answers=alts, alt_answers=alts, group_id=2,
                instruction=r.FILL_INSTR if n == 8 else '',
            )

        # ------ Passage 2 ------
        p2 = Passage.objects.create(
            test=test, part_number=2,
            title='The economic effect of climate',
            subtitle="Latitude is crucial to a nation's strength, says Anjana Ahuja",
            content=r.P2_CONTENT, order=2,
            instructions='You should spend about 20 minutes on Questions 14–26.',
        )
        for n, txt, ans in r.P2_MH:
            Question.objects.create(
                passage=p2, order=n, question_number=n,
                question_type='matching', text=txt, prompt=txt,
                options=r.HEADINGS_LIST, correct_answer=ans, group_id=3,
                instruction=r.MH_INSTR if n == 14 else '',
            )
        for n, txt, ans, alts in r.P2_SC:
            Question.objects.create(
                passage=p2, order=n, question_number=n,
                question_type='fill', text=txt, prompt=txt,
                options=[], correct_answer=ans,
                acceptable_answers=alts, alt_answers=alts, group_id=4,
                instruction=r.SC_INSTR if n == 21 else '',
            )

        # ------ Passage 3 ------
        p3 = Passage.objects.create(
            test=test, part_number=3,
            title='Redesigning the Cleveland Museum of Art',
            content=r.P3_CONTENT, order=3,
            instructions='You should spend about 20 minutes on Questions 27–40.',
        )
        for n, txt, opts, ans in r.P3_MCQ:
            Question.objects.create(
                passage=p3, order=n, question_number=n,
                question_type='mcq', text=txt, prompt=txt,
                options=opts, correct_answer=ans, group_id=5,
                instruction=r.MCQ_INSTR if n == 27 else '',
            )
        for n, txt, ans in r.P3_YN:
            Question.objects.create(
                passage=p3, order=n, question_number=n,
                question_type='ynng', text=txt, prompt=txt,
                options=['YES', 'NO', 'NOT GIVEN'],
                correct_answer=ans, group_id=6,
                instruction=r.YN_INSTR if n == 31 else '',
            )
        for n, txt, ans, alts in r.P3_SUMMARY:
            Question.objects.create(
                passage=p3, order=n, question_number=n,
                question_type='fill', text=txt, prompt=txt,
                options=[], correct_answer=ans,
                acceptable_answers=alts, alt_answers=alts, group_id=7,
                instruction=r.SUMMARY_INSTR if n == 36 else '',
            )

    # =================================================================
    # LISTENING — 4 part / 40 questions
    # =================================================================

    def _seed_listening(self, skip_media: bool):
        TEST_NAME = "Diyorbek's IELTS Listening — Day 18"
        Test.objects.filter(
            name=TEST_NAME, organization__isnull=True, is_global=True,
        ).delete()

        test = Test.objects.create(
            name=TEST_NAME,
            module='listening', test_type='academic', difficulty='medium',
            duration_minutes=40,
            description='IELTS Listening — 4 part, 40 ta savol.',
            is_published=True, status='published',
            category="Diyorbek's IELTS",
            organization=None, is_global=True,
        )

        from . import _diyorbek_listening_data as L

        DURATIONS = {1: 458, 2: 364, 3: 387, 4: 1088}
        parts = {}
        for n in (1, 2, 3, 4):
            p = ListeningPart.objects.create(
                test=test, part_number=n,
                audio_duration_seconds=DURATIONS[n],
                instructions=f'Listen to Part {n} and answer the questions.',
            )
            rel = f'listening_audio/2026/05/day18_part{n}.mp3'
            if not skip_media:
                self._copy_media(rel)
            p.audio_file.name = rel
            p.save(update_fields=['audio_file'])
            parts[n] = p

        # P1 - notes completion
        for n, txt, ans, alts in L.P1:
            Question.objects.create(
                listening_part=parts[1], order=n, question_number=n,
                question_type='fill', text=txt, prompt=txt,
                options=[], correct_answer=ans,
                acceptable_answers=alts, alt_answers=alts, group_id=1,
                instruction=L.P1_INSTR if n == 1 else '',
            )

        # P2 11/12 multi-MCQ A,B
        for n, ans in [(11, L.Q11_OPTS[0]), (12, L.Q11_OPTS[1])]:
            Question.objects.create(
                listening_part=parts[2], order=n, question_number=n,
                question_type='mcq',
                text=L.MCQ_TWO_TEXT_INCLUDE + (
                    " (first answer)" if n == 11 else " (second answer)"),
                prompt=L.MCQ_TWO_TEXT_INCLUDE,
                options=L.Q11_OPTS, correct_answer=ans,
                acceptable_answers=[L.Q11_OPTS[0], L.Q11_OPTS[1]],
                alt_answers=[L.Q11_OPTS[0], L.Q11_OPTS[1]],
                group_id=2,
                instruction=L.MCQ_TWO_INSTR if n == 11 else L.MCQ_TWO_FOLLOWUP,
            )
        # P2 13/14 multi-MCQ C,A
        for n, ans in [(13, L.Q13_OPTS[2]), (14, L.Q13_OPTS[0])]:
            Question.objects.create(
                listening_part=parts[2], order=n, question_number=n,
                question_type='mcq',
                text=L.MCQ_TWO_TEXT_APPRECIATE + (
                    " (first answer)" if n == 13 else " (second answer)"),
                prompt=L.MCQ_TWO_TEXT_APPRECIATE,
                options=L.Q13_OPTS, correct_answer=ans,
                acceptable_answers=[L.Q13_OPTS[2], L.Q13_OPTS[0]],
                alt_answers=[L.Q13_OPTS[2], L.Q13_OPTS[0]],
                group_id=3,
                instruction=L.MCQ_TWO_INSTR if n == 13 else L.MCQ_TWO_FOLLOWUP,
            )
        # P2 15-20 matching stores
        for n, store, ans in L.P2_STORES:
            Question.objects.create(
                listening_part=parts[2], order=n, question_number=n,
                question_type='matching',
                text=f'Store {n - 14}: {store}',
                prompt=f'{store} — choose A-H',
                options=L.P2_INFO, correct_answer=ans, group_id=4,
                instruction=L.P2_MATCH_INSTR if n == 15 else '',
            )
        # P3 21-24 MCQ
        for n, txt, opts, ans in L.P3_MCQ:
            Question.objects.create(
                listening_part=parts[3], order=n, question_number=n,
                question_type='mcq', text=txt, prompt=txt,
                options=opts, correct_answer=ans, group_id=5,
                instruction=L.P3_MCQ_INSTR if n == 21 else '',
            )
        # P3 25/26 multi-MCQ A,E
        for n, ans in [(25, L.Q25_OPTS[0]), (26, L.Q25_OPTS[4])]:
            Question.objects.create(
                listening_part=parts[3], order=n, question_number=n,
                question_type='mcq',
                text=L.MCQ_TWO_TEXT_LECTURERS + (
                    " (first answer)" if n == 25 else " (second answer)"),
                prompt=L.MCQ_TWO_TEXT_LECTURERS,
                options=L.Q25_OPTS, correct_answer=ans,
                acceptable_answers=[L.Q25_OPTS[0], L.Q25_OPTS[4]],
                alt_answers=[L.Q25_OPTS[0], L.Q25_OPTS[4]],
                group_id=6,
                instruction=L.MCQ_TWO_INSTR if n == 25 else L.MCQ_TWO_FOLLOWUP,
            )
        # P3 27-30 matching courses
        for n, course, ans in L.P3_COURSES:
            Question.objects.create(
                listening_part=parts[3], order=n, question_number=n,
                question_type='matching', text=course, prompt=course,
                options=L.P3_SKILLS, correct_answer=ans, group_id=7,
                instruction=L.P3_MATCH_INSTR if n == 27 else '',
            )
        # P4 31-40 notes completion
        for n, txt, ans, alts in L.P4:
            Question.objects.create(
                listening_part=parts[4], order=n, question_number=n,
                question_type='fill', text=txt, prompt=txt,
                options=[], correct_answer=ans,
                acceptable_answers=alts, alt_answers=alts, group_id=8,
                instruction=L.P4_INSTR if n == 31 else '',
            )

    # =================================================================
    # WRITING — Task 1 + Task 2
    # =================================================================

    def _seed_writing(self, skip_media: bool):
        TEST_NAME = "Diyorbek's IELTS Writing — Test 1 (April 29)"
        Test.objects.filter(
            name=TEST_NAME, organization__isnull=True, is_global=True,
        ).delete()

        test = Test.objects.create(
            name=TEST_NAME,
            module='writing', test_type='academic', difficulty='medium',
            duration_minutes=60,
            description='IELTS Academic Writing — Task 1 (bar chart) + Task 2 (essay).',
            is_published=True, status='published',
            category="Diyorbek's IELTS",
            organization=None, is_global=True,
        )

        t1 = WritingTask.objects.create(
            test=test, task_number=1,
            prompt=(
                'The bar chart below shows the proportion of the population aged 65 '
                'and over of three countries (Canada, Germany, UK) in 1980 and 2000 '
                'and prediction in 2030.\n\n'
                'Summarise the information by selecting and reporting the main '
                'features, and make comparisons where relevant.\n\nWrite at least 150 words.'
            ),
            min_words=150, suggested_minutes=20,
            requirements='Describe the chart, compare the three countries across years.',
        )
        chart_rel = 'writing_charts/2026/05/april29_population_chart.jpg'
        if not skip_media:
            # Try canonical place first; fallback to root seed_media folder
            if not self._copy_media(chart_rel):
                self._copy_media('writing_charts/april29_population_chart.jpg')
                chart_rel = 'writing_charts/april29_population_chart.jpg'
        t1.chart_image.name = chart_rel
        t1.save(update_fields=['chart_image'])

        WritingTask.objects.create(
            test=test, task_number=2,
            prompt=(
                "In today's world of advanced science and technology, we still greatly "
                'value our artists such as musicians, painters and writers.\n\n'
                'What can art tell us about life that science and technology cannot?\n\n'
                'Give reasons for your answer and include any relevant examples from '
                'your own knowledge or experience.\n\nWrite at least 250 words.'
            ),
            min_words=250, suggested_minutes=40,
            requirements='Express and justify your opinion with examples.',
        )

        Passage.objects.create(
            test=test, part_number=1, title='Task 1', content=t1.prompt,
            instructions=t1.requirements, min_words=t1.min_words, order=1,
        )
        Passage.objects.create(
            test=test, part_number=2, title='Task 2',
            content=test.writing_tasks.get(task_number=2).prompt,
            instructions='Express and justify your opinion with examples.',
            min_words=250, order=2,
        )
