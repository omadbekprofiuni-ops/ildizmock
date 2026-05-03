"""Seed: Diyorbek's IELTS Listening — Day 18 (Cambridge IELTS 11 Test 4)."""

from apps.tests.models import Test, ListeningPart, Question

TEST_NAME = "Diyorbek's IELTS Listening — Day 18"

Test.objects.filter(
    name=TEST_NAME, organization__isnull=True, is_global=True,
).delete()

test = Test.objects.create(
    name=TEST_NAME,
    module='listening',
    test_type='academic',
    difficulty='medium',
    duration_minutes=40,
    description='IELTS Listening — 4 part, 40 ta savol.',
    is_published=True,
    status='published',
    category="Diyorbek's IELTS",
    organization=None,
    is_global=True,
)

DURATIONS = {1: 458, 2: 364, 3: 387, 4: 1088}

parts = {}
for n in (1, 2, 3, 4):
    p = ListeningPart.objects.create(
        test=test, part_number=n,
        audio_duration_seconds=DURATIONS[n],
        instructions=f'Listen to Part {n} and answer the questions.',
    )
    p.audio_file.name = f'listening_audio/2026/05/day18_part{n}.mp3'
    p.save(update_fields=['audio_file'])
    parts[n] = p

# ====================================================================
# PART 1 — Working in a summer camp in the USA (notes completion, fill, ONE WORD/NUMBER)
# ====================================================================
P1_INSTR = (
    'Complete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.'
)
P1 = [
    (1,  'General counsellors — need experience of working with children as a ______ .', 'leader', []),
    (2,  'Specialist counsellors could use skills in: sport, e.g. ______', 'tennis', []),
    (3,  'Job in summer camp lasts for ______ weeks with the chance to travel afterwards.', 'eight', ['8']),
    (4,  'Job starts in ______ .', 'June', []),
    (5,  'First week of job is used for ______ .', 'training', []),
    (6,  'Officially, counsellors must be at least ______ years old.', '19', ['nineteen']),
    (7,  'Salary: ______ US $.', '985', []),
    (8,  'Must pay for: own ______ (£138).', 'insurance', []),
    (9,  'Must pay for: a ______ check in UK (£36).', 'police', []),
    (10, 'Can get a ______ on travel in America after summer camp.', 'discount', []),
]
for n, txt, ans, alts in P1:
    Question.objects.create(
        listening_part=parts[1], order=n, question_number=n,
        question_type='fill', text=txt, prompt=txt,
        options=[], correct_answer=ans, acceptable_answers=alts, alt_answers=alts,
        group_id=1, instruction=P1_INSTR if n == 1 else '',
    )

# ====================================================================
# PART 2 — Personal make-over service (multi-select MCQ + matching)
# ====================================================================
# Q11-12: Choose TWO letters, A-E. Answers: A, B (in either order).
# Q13-14: Choose TWO letters, A-E. Answers: C, A (in either order).

MCQ_TWO_INSTR = 'Choose TWO letters, A–E.'
MCQ_TWO_INSTR_FOLLOWUP = (
    "(This question is paired with the next one — together they form the two "
    "correct letters.)"
)

Q11_OPTS = [
    'A. a review of her wardrobe',
    'B. a booklet on fashion',
    'C. advice on hairstyling',
    "D. a day's shopping with a stylist",
    'E. photos of her in new clothes',
]
# Q11 + Q12: speaker's personal make-over included A and B (either order).
for n, ans in [(11, 'A. a review of her wardrobe'), (12, 'B. a booklet on fashion')]:
    Question.objects.create(
        listening_part=parts[2], order=n, question_number=n,
        question_type='mcq',
        text=("Which TWO things did the speaker's personal make-over include? "
              + ("(first answer)" if n == 11 else "(second answer)")),
        prompt="Which TWO things did the speaker's personal make-over include?",
        options=Q11_OPTS,
        correct_answer=ans,
        acceptable_answers=['A. a review of her wardrobe', 'B. a booklet on fashion'],
        alt_answers=['A. a review of her wardrobe', 'B. a booklet on fashion'],
        group_id=2,
        instruction=(MCQ_TWO_INSTR if n == 11 else MCQ_TWO_INSTR_FOLLOWUP),
    )

Q13_OPTS = [
    'A. It saved her a lot of time.',
    'B. It saved her a lot of money.',
    'C. It made her more self-confident.',
    'D. It improved her image at work.',
    'E. It made her more adventurous.',
]
# Q13 + Q14: things she appreciated — C and A (either order).
for n, ans in [(13, 'C. It made her more self-confident.'), (14, 'A. It saved her a lot of time.')]:
    Question.objects.create(
        listening_part=parts[2], order=n, question_number=n,
        question_type='mcq',
        text=('Which TWO things did the speaker appreciate about the make-over service? '
              + ("(first answer)" if n == 13 else "(second answer)")),
        prompt='Which TWO things did the speaker appreciate about the make-over service?',
        options=Q13_OPTS,
        correct_answer=ans,
        acceptable_answers=[
            'A. It saved her a lot of time.',
            'C. It made her more self-confident.',
        ],
        alt_answers=[
            'A. It saved her a lot of time.',
            'C. It made her more self-confident.',
        ],
        group_id=3,
        instruction=(MCQ_TWO_INSTR if n == 13 else MCQ_TWO_INSTR_FOLLOWUP),
    )

# Q15-20: Matching — stores → information letter A-H
P2_INFO = [
    'A. charges a fee',
    'B. necessary to book in advance',
    'C. time is limited',
    'D. available in larger stores only',
    'E. advice on furniture also available',
    'F. now offers a service for men',
    'G. free alteration service provided',
    'H. showers available',
]
P2_MATCH_INSTR = (
    'What information is given about the personal shopping services at each '
    'of the following stores? Choose SIX answers from the box (A–H).'
)
P2_STORES = [
    (15, 'Hallberry',       'A. charges a fee'),
    (16, "Rivero",           'C. time is limited'),
    (17, "Justine's",        'G. free alteration service provided'),
    (18, 'Blank and White', 'H. showers available'),
    (19, 'Wave',            'F. now offers a service for men'),
    (20, "Dizzy's",          'B. necessary to book in advance'),
]
for n, store, ans in P2_STORES:
    Question.objects.create(
        listening_part=parts[2], order=n, question_number=n,
        question_type='matching',
        text=f'Store {n - 14}: {store}',
        prompt=f'{store} — choose A-H',
        options=P2_INFO, correct_answer=ans, group_id=4,
        instruction=P2_MATCH_INSTR if n == 15 else '',
    )

# ====================================================================
# PART 3 — Bachelor of Communications Degree
# ====================================================================
# Q21-24: Choose A, B or C
P3_MCQ_INSTR = 'Choose the correct letter, A, B or C.'

P3_MCQ = [
    (21,
     'Simon thinks the Global Communications major',
     ['A. will help him get work in other countries.',
      'B. has easier courses than the Public Relations major.',
      'C. could lead to a well-paid job in New Zealand.'],
     'A. will help him get work in other countries.'),
    (22,
     'Simon says that the Economic Principles course was',
     ['A. too challenging for him.',
      'B. uninteresting as a subject.',
      'C. similar to other courses on the major.'],
     'B. uninteresting as a subject.'),
    (23,
     'Anna thinks that the foreign language courses',
     ['A. give students a better understanding of the whole major.',
      'B. are less useful than the courses dealing with culture.',
      'C. should remain optional to students.'],
     'A. give students a better understanding of the whole major.'),
    (24,
     "What reason does Anna give for her choice of foreign language?",
     ['A. It was a language she had previously studied.',
      'B. It would enable her to travel.',
      'C. It could be useful in commerce.'],
     'C. It could be useful in commerce.'),
]
for n, txt, opts, ans in P3_MCQ:
    Question.objects.create(
        listening_part=parts[3], order=n, question_number=n,
        question_type='mcq', text=txt, prompt=txt,
        options=opts, correct_answer=ans, group_id=5,
        instruction=P3_MCQ_INSTR if n == 21 else '',
    )

# Q25-26: Choose TWO letters, A-E. Answers: A, E (in either order)
Q25_OPTS = [
    'A. They encourage freedom of thought.',
    'B. They help individual students in seminars.',
    'C. They are willing to adapt courses.',
    'D. They are enthusiastic about their subject.',
    'E. They encourage students to improve.',
]
for n, ans in [(25, 'A. They encourage freedom of thought.'),
               (26, 'E. They encourage students to improve.')]:
    Question.objects.create(
        listening_part=parts[3], order=n, question_number=n,
        question_type='mcq',
        text=('Which TWO things do Anna and Simon both appreciate about their lecturers? '
              + ("(first answer)" if n == 25 else "(second answer)")),
        prompt='Which TWO things do Anna and Simon both appreciate about their lecturers?',
        options=Q25_OPTS,
        correct_answer=ans,
        acceptable_answers=[
            'A. They encourage freedom of thought.',
            'E. They encourage students to improve.',
        ],
        alt_answers=[
            'A. They encourage freedom of thought.',
            'E. They encourage students to improve.',
        ],
        group_id=6,
        instruction=(MCQ_TWO_INSTR if n == 25 else MCQ_TWO_INSTR_FOLLOWUP),
    )

# Q27-30: Matching — courses → skills A-F
P3_SKILLS = [
    'A. making decisions under pressure',
    'B. working in large groups',
    'C. reducing problems between co-workers',
    'D. talking in public',
    'E. understanding cultural differences',
    'F. using logical argument',
]
P3_MATCH_INSTR = (
    'Which skills are developed in the following courses? Choose FOUR answers '
    'from the box (A–F).'
)
P3_COURSES = [
    (27, 'Communication 1',     'D. talking in public'),
    (28, 'Psychology',          'B. working in large groups'),
    (29, 'Interpersonal Skills','C. reducing problems between co-workers'),
    (30, 'Communication 3',     'E. understanding cultural differences'),
]
for n, course, ans in P3_COURSES:
    Question.objects.create(
        listening_part=parts[3], order=n, question_number=n,
        question_type='matching',
        text=f'{course}',
        prompt=f'{course} — choose A-F',
        options=P3_SKILLS, correct_answer=ans, group_id=7,
        instruction=P3_MATCH_INSTR if n == 27 else '',
    )

# ====================================================================
# PART 4 — The Fairy Tern (notes completion, ONE WORD only)
# ====================================================================
P4_INSTR = 'Complete the notes below. Write ONE WORD ONLY for each answer.'
P4 = [
    (31, 'Fairy tern builds its nest on the beach or next to a ______ .', 'river', []),
    (32, '1953: first research into tern numbers (finding: problematic to ______ bird numbers)', 'estimate', []),
    (33, '1984: only three ______ alive', 'pairs', []),
    (34, 'Loss of habitat because of vacation homes — ______', 'farming', []),
    (35, 'The ______ are eaten by predators.', 'eggs', []),
    (36, 'A ______ can destroy nests (e.g. 1983)', 'storm', []),
    (37, 'Nesting areas are protected by — a ______', 'guard', []),
    (38, 'Nesting areas are protected by — a ______', 'fence', []),
    (39, 'Recommendations: A larger number of breeding birds in ______', 'captivity', []),
    (40, 'Make more use of the ______ to inform the public', 'media', []),
]
for n, txt, ans, alts in P4:
    Question.objects.create(
        listening_part=parts[4], order=n, question_number=n,
        question_type='fill', text=txt, prompt=txt,
        options=[], correct_answer=ans, acceptable_answers=alts, alt_answers=alts,
        group_id=8, instruction=P4_INSTR if n == 31 else '',
    )

print(f'OK created test={test.id} name="{test.name}"')
total = 0
for p in parts.values():
    qc = p.questions.count()
    total += qc
    print(f'  Part {p.part_number}: audio={p.audio_file.name} ({p.audio_duration_seconds}s) — {qc} questions')
print(f'TOTAL questions: {total}')
