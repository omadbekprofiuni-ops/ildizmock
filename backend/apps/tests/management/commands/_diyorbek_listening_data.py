"""Listening test ma'lumotlari — Diyorbek's IELTS Listening Day 18.

Faqat data — `seed_default_tests` buyrug'i tomonidan import qilinadi.
"""

# =============================================================================
# PART 1 — Working in a summer camp in the USA (notes completion)
# =============================================================================

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

# =============================================================================
# PART 2 — Personal make-over service (multi-MCQ + matching)
# =============================================================================

MCQ_TWO_INSTR = 'Choose TWO letters, A–E.'
MCQ_TWO_FOLLOWUP = (
    '(This question is paired with the previous one — together they form the '
    'two correct letters.)'
)

# Q11/12
MCQ_TWO_TEXT_INCLUDE = "Which TWO things did the speaker's personal make-over include?"
Q11_OPTS = [
    'A. a review of her wardrobe',
    'B. a booklet on fashion',
    'C. advice on hairstyling',
    "D. a day's shopping with a stylist",
    'E. photos of her in new clothes',
]

# Q13/14
MCQ_TWO_TEXT_APPRECIATE = (
    'Which TWO things did the speaker appreciate about the make-over service?'
)
Q13_OPTS = [
    'A. It saved her a lot of time.',
    'B. It saved her a lot of money.',
    'C. It made her more self-confident.',
    'D. It improved her image at work.',
    'E. It made her more adventurous.',
]

# Q15-20: matching stores → information letter A-H
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
    (16, 'Rivero',          'C. time is limited'),
    (17, "Justine's",       'G. free alteration service provided'),
    (18, 'Blank and White', 'H. showers available'),
    (19, 'Wave',            'F. now offers a service for men'),
    (20, "Dizzy's",         'B. necessary to book in advance'),
]

# =============================================================================
# PART 3 — Bachelor of Communications Degree
# =============================================================================

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
     'What reason does Anna give for her choice of foreign language?',
     ['A. It was a language she had previously studied.',
      'B. It would enable her to travel.',
      'C. It could be useful in commerce.'],
     'C. It could be useful in commerce.'),
]

# Q25/26
MCQ_TWO_TEXT_LECTURERS = (
    'Which TWO things do Anna and Simon both appreciate about their lecturers?'
)
Q25_OPTS = [
    'A. They encourage freedom of thought.',
    'B. They help individual students in seminars.',
    'C. They are willing to adapt courses.',
    'D. They are enthusiastic about their subject.',
    'E. They encourage students to improve.',
]

# Q27-30: matching courses → skills A-F
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
    (29, 'Interpersonal Skills', 'C. reducing problems between co-workers'),
    (30, 'Communication 3',     'E. understanding cultural differences'),
]

# =============================================================================
# PART 4 — The Fairy Tern (notes completion)
# =============================================================================

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
