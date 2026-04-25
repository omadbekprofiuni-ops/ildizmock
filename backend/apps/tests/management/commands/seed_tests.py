"""Seed 4 Reading + 4 Listening + 4 Writing tests, one per difficulty level."""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.tests.models import Passage, Question, Test


# ============================================================
# READING — 4 tests
# ============================================================

R1_PASSAGE = """
Coffee is one of the most popular beverages in the world today, but its origins are
surprisingly humble. According to legend, coffee was discovered in Ethiopia around the
9th century by a goat herder named Kaldi. He noticed that his goats became unusually
energetic after eating the red berries from a particular bush.

Kaldi reported his findings to a local monastery, where the abbot made a drink with
the berries and discovered it kept him alert during evening prayers. Word soon spread,
and coffee began its long journey from Ethiopia to the Arabian Peninsula.

By the 15th century, coffee was being grown in Yemen, and by the 16th century, it had
spread throughout the Middle East. Coffee houses, known as "qahveh khaneh", became
popular meeting places where people would discuss politics and listen to music.

European travellers brought coffee back from their journeys, and by the 17th century
coffee houses were appearing in major European cities. London alone had over 300 coffee
houses by 1675, many of which became important centres of business and discussion.

Today, coffee is grown in over 70 countries around the world. Brazil produces the most,
followed by Vietnam and Colombia. The coffee industry employs millions of people and
generates billions of dollars in revenue each year.
""".strip()

R1_QUESTIONS = [
    {'order': 1, 'question_type': 'tfng', 'group_id': 1,
     'instruction': 'Choose TRUE, FALSE or NOT GIVEN.',
     'text': 'Coffee was first discovered in Ethiopia.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'True'},
    {'order': 2, 'question_type': 'tfng', 'group_id': 1,
     'text': 'Kaldi was a farmer who grew coffee plants.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 3, 'question_type': 'tfng', 'group_id': 1,
     'text': 'The first coffee houses appeared in Europe.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 4, 'question_type': 'mcq', 'group_id': 2,
     'instruction': 'Choose A, B, C or D.',
     'text': 'According to the passage, when did coffee houses appear in London?',
     'options': ['9th century', '15th century', '17th century', '19th century'],
     'correct_answer': '17th century'},
    {'order': 5, 'question_type': 'mcq', 'group_id': 2,
     'text': 'Which country produces the most coffee today?',
     'options': ['Ethiopia', 'Vietnam', 'Brazil', 'Colombia'],
     'correct_answer': 'Brazil'},
    {'order': 6, 'question_type': 'fill', 'group_id': 3,
     'instruction': 'Write NO MORE THAN TWO WORDS.',
     'text': 'Coffee was discovered by a ________.',
     'correct_answer': 'goat herder', 'acceptable_answers': ['herder']},
    {'order': 7, 'question_type': 'fill', 'group_id': 3,
     'text': 'In the Middle East, coffee houses were called ________.',
     'correct_answer': 'qahveh khaneh',
     'acceptable_answers': ['qahveh', 'qahveh khaneh']},
]


R2_PASSAGE = """
Much that has been written on the subject of intelligence owes more to investment in
particular theoretical frameworks than to solid empirical research. Intelligence is
not a single, unitary capacity but rather a collection of abilities — verbal reasoning,
spatial perception, memory, and so on. Different cultures emphasise different
components: Western academic traditions privilege logical-mathematical ability, while
communities elsewhere place equal or greater weight on social intelligence, practical
problem-solving, and cooperative effectiveness.

Psychologists have proposed numerous models. Charles Spearman argued for a general
factor (g) underlying all intellectual tasks. Howard Gardner proposed at least seven
distinct intelligences, including musical, bodily-kinaesthetic, and interpersonal.
Robert Sternberg's triarchic theory distinguishes analytical, creative and practical
intelligences — the last of which, he argues, most conventional IQ tests fail to
measure.

Critics note that cross-cultural comparisons are hampered by the fact that almost every
standardised test reflects the values and assumptions of its designers. A child from a
rural community may score poorly on geometric tests yet demonstrate remarkable
intelligence when planning the planting of a field or mediating a dispute.
""".strip()

R2_QUESTIONS = [
    {'order': 1, 'question_type': 'mcq', 'group_id': 1,
     'instruction': 'Choose A, B, C or D.',
     'text': 'According to the passage, intelligence is best described as:',
     'options': ['A single inherited ability', 'A collection of different abilities',
                 'A culturally universal concept', 'A measure of schooling'],
     'correct_answer': 'A collection of different abilities'},
    {'order': 2, 'question_type': 'mcq', 'group_id': 1,
     'text': 'Which theorist proposed a general factor (g)?',
     'options': ['Charles Spearman', 'Howard Gardner', 'Robert Sternberg', 'None'],
     'correct_answer': 'Charles Spearman'},
    {'order': 3, 'question_type': 'tfng', 'group_id': 2,
     'instruction': 'Choose TRUE, FALSE or NOT GIVEN.',
     'text': 'Western tradition has always valued social intelligence above logical ability.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 4, 'question_type': 'tfng', 'group_id': 2,
     'text': 'Sternberg believes practical intelligence is poorly captured by IQ tests.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'True'},
    {'order': 5, 'question_type': 'matching', 'group_id': 3,
     'instruction': 'Match each theorist to their theory.',
     'text': 'Spearman',
     'options': ['Triarchic theory', 'Multiple intelligences', 'General factor', 'Practical reasoning'],
     'correct_answer': 'General factor'},
    {'order': 6, 'question_type': 'matching', 'group_id': 3,
     'text': 'Gardner',
     'options': ['Triarchic theory', 'Multiple intelligences', 'General factor', 'Practical reasoning'],
     'correct_answer': 'Multiple intelligences'},
    {'order': 7, 'question_type': 'matching', 'group_id': 3,
     'text': 'Sternberg',
     'options': ['Triarchic theory', 'Multiple intelligences', 'General factor', 'Practical reasoning'],
     'correct_answer': 'Triarchic theory'},
]


R3_PASSAGE = """
Anthropogenic climate change is reshaping where people choose, and are forced, to live.
The most visible movements result from sudden disasters — floods, hurricanes, droughts —
but a quieter, longer-term displacement is driven by gradual environmental degradation.
Coastal erosion in West Africa, salinisation of farmland in Bangladesh, and
desertification in the Sahel have all triggered migration that, while rarely featured
in international media, accounts for the majority of climate-related movement worldwide.

Researchers distinguish between internal and cross-border climate migration. The vast
majority — perhaps 90% — of those displaced by environmental factors remain within
their own country, often relocating from rural areas to peripheral urban settlements.
Cross-border movement tends to follow established economic migration corridors and is
rarely formally classified as climate-related, even when environmental stress is the
underlying trigger.

Policy responses lag well behind the reality. International law does not recognise
"climate refugees" as a protected category, leaving displaced people to navigate
immigration systems that were not designed with environmental drivers in mind. Some
nations, particularly small island states, have begun to negotiate planned relocation
programmes for entire communities, but these arrangements remain rare.
""".strip()

R3_QUESTIONS = [
    {'order': 1, 'question_type': 'mcq', 'group_id': 1,
     'instruction': 'Choose A, B, C or D.',
     'text': 'Most climate-related migration globally is driven by:',
     'options': ['Sudden disasters', 'Long-term degradation',
                 'Political instability', 'Economic opportunity'],
     'correct_answer': 'Long-term degradation'},
    {'order': 2, 'question_type': 'mcq', 'group_id': 1,
     'text': 'Approximately what proportion of climate-displaced people stay within their country?',
     'options': ['Around 50%', 'Around 70%', 'About 90%', 'Less than 10%'],
     'correct_answer': 'About 90%'},
    {'order': 3, 'question_type': 'tfng', 'group_id': 2,
     'instruction': 'Choose TRUE, FALSE or NOT GIVEN.',
     'text': 'International law currently classifies climate refugees as a protected group.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 4, 'question_type': 'tfng', 'group_id': 2,
     'text': 'Some small island states have started planned relocation programmes.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'True'},
    {'order': 5, 'question_type': 'fill', 'group_id': 3,
     'instruction': 'Write ONE WORD only.',
     'text': 'In Bangladesh, agricultural land is affected by ________.',
     'correct_answer': 'salinisation', 'acceptable_answers': ['salinization']},
    {'order': 6, 'question_type': 'fill', 'group_id': 3,
     'text': 'Internal migrants often move to peripheral ________ settlements.',
     'correct_answer': 'urban'},
]


R4_PASSAGE = """
Quantum computing represents a paradigm shift in computational science, exploiting
quantum-mechanical phenomena such as superposition and entanglement to process
information in ways classical computers cannot. Whereas classical bits exist as either
0 or 1, quantum bits — qubits — can exist in superposition, occupying both states
simultaneously until measured. This property allows certain quantum algorithms to
explore an exponentially large solution space in parallel.

Shor's algorithm, demonstrated theoretically in 1994, can factor large integers in
polynomial time. Since most contemporary public-key cryptography depends on the
computational difficulty of factoring, the algorithm threatens the foundations of
digital security as currently practised. The race to develop "post-quantum" cryptographic
schemes has consequently intensified.

Practical realisation, however, remains difficult. Qubits are extraordinarily fragile;
decoherence — loss of quantum information through environmental interaction — limits
useful computation to fractions of a second on most architectures. Error-correction
schemes typically require thousands of physical qubits to encode a single logical qubit
reliably. Despite these challenges, recent demonstrations of "quantum advantage" by IBM
and Google suggest that the technology is approaching genuine utility.
""".strip()

R4_QUESTIONS = [
    {'order': 1, 'question_type': 'mcq', 'group_id': 1,
     'instruction': 'Choose A, B, C or D.',
     'text': 'A qubit differs from a classical bit because it can:',
     'options': ['Hold any integer', 'Be both 0 and 1 simultaneously',
                 'Operate at room temperature', 'Be cloned indefinitely'],
     'correct_answer': 'Be both 0 and 1 simultaneously'},
    {'order': 2, 'question_type': 'mcq', 'group_id': 1,
     'text': 'Shor\'s algorithm primarily threatens which area of digital security?',
     'options': ['Hashing', 'Public-key cryptography', 'Symmetric ciphers', 'Random number generation'],
     'correct_answer': 'Public-key cryptography'},
    {'order': 3, 'question_type': 'tfng', 'group_id': 2,
     'instruction': 'Choose TRUE, FALSE or NOT GIVEN.',
     'text': 'Decoherence increases the duration of useful quantum computation.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 4, 'question_type': 'tfng', 'group_id': 2,
     'text': 'Error-correction can require thousands of physical qubits per logical qubit.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'True'},
    {'order': 5, 'question_type': 'fill', 'group_id': 3,
     'instruction': 'Write ONE WORD only.',
     'text': 'Loss of quantum information through environmental interaction is called ________.',
     'correct_answer': 'decoherence'},
    {'order': 6, 'question_type': 'fill', 'group_id': 3,
     'text': 'Shor\'s algorithm was demonstrated theoretically in ________.',
     'correct_answer': '1994'},
]


# ============================================================
# LISTENING — 4 tests (transcript shown to admins; audio uploaded later)
# ============================================================

L1_TRANSCRIPT = """
[Phone rings]
RECEPTIONIST: Good morning, Riverside Hotel. How can I help you?
CALLER: Hi, I'd like to book a room for next weekend.
RECEPTIONIST: Certainly. What dates exactly?
CALLER: Friday the 15th to Sunday the 17th.
RECEPTIONIST: Two nights. Single or double?
CALLER: Double please. With a sea view if possible.
RECEPTIONIST: We have a double sea view at £120 per night.
CALLER: Does that include breakfast?
RECEPTIONIST: Continental breakfast is included.
CALLER: My name is John Smith — S-M-I-T-H.
RECEPTIONIST: And your phone?
CALLER: 0207 555 4892.
""".strip()

L1_QUESTIONS = [
    {'order': 1, 'question_type': 'fill', 'group_id': 1,
     'instruction': 'Write ONE WORD AND/OR A NUMBER.',
     'text': 'Hotel name: ________ Hotel',
     'correct_answer': 'Riverside', 'acceptable_answers': ['riverside']},
    {'order': 2, 'question_type': 'fill', 'group_id': 1,
     'text': 'Number of nights: ________',
     'correct_answer': '2', 'acceptable_answers': ['two']},
    {'order': 3, 'question_type': 'fill', 'group_id': 1,
     'text': 'Price per night: £________',
     'correct_answer': '120'},
    {'order': 4, 'question_type': 'fill', 'group_id': 1,
     'text': 'Caller name: John ________',
     'correct_answer': 'Smith', 'acceptable_answers': ['smith']},
    {'order': 5, 'question_type': 'fill', 'group_id': 1,
     'text': 'Phone: 0207 ________ 4892',
     'correct_answer': '555'},
    {'order': 6, 'question_type': 'mcq', 'group_id': 2,
     'instruction': 'Choose A, B or C.',
     'text': 'Breakfast type included is:',
     'options': ['Continental', 'Full English', 'None'],
     'correct_answer': 'Continental'},
]


L2_TRANSCRIPT = """
SARAH: Welcome to Central Library. I'm Sarah, your guide today.
The help desk is on your left as you enter. Behind it you'll find journals.
The reference collection is on the second floor. Group study rooms must be
booked online. The silent reading area is on the fourth floor.

Library cards are valid for 3 years. Postgraduates can borrow up to 25 items
for 28 days. Overdue fines are 20 pence per day.

Research support is on Tuesdays and Thursdays, 2 to 4 pm. The cafe closes at
9 pm on weekdays.
""".strip()

L2_QUESTIONS = [
    {'order': 1, 'question_type': 'matching', 'group_id': 1,
     'instruction': 'Where in the library is each facility?',
     'text': 'Help desk',
     'options': ['Ground floor — left', 'Second floor', 'Fourth floor', 'Online only'],
     'correct_answer': 'Ground floor — left'},
    {'order': 2, 'question_type': 'matching', 'group_id': 1,
     'text': 'Reference collection',
     'options': ['Ground floor — left', 'Second floor', 'Fourth floor', 'Online only'],
     'correct_answer': 'Second floor'},
    {'order': 3, 'question_type': 'matching', 'group_id': 1,
     'text': 'Silent reading',
     'options': ['Ground floor — left', 'Second floor', 'Fourth floor', 'Online only'],
     'correct_answer': 'Fourth floor'},
    {'order': 4, 'question_type': 'fill', 'group_id': 2,
     'instruction': 'Write ONE WORD AND/OR A NUMBER.',
     'text': 'Library card valid: ________ years',
     'correct_answer': '3', 'acceptable_answers': ['three']},
    {'order': 5, 'question_type': 'fill', 'group_id': 2,
     'text': 'Loan period: ________ days',
     'correct_answer': '28'},
    {'order': 6, 'question_type': 'fill', 'group_id': 2,
     'text': 'Daily fine: ________ pence',
     'correct_answer': '20'},
    {'order': 7, 'question_type': 'mcq', 'group_id': 3,
     'instruction': 'Choose A, B or C.',
     'text': 'Cafe closes on weekdays at:',
     'options': ['8 pm', '9 pm', '10 pm'],
     'correct_answer': '9 pm'},
]


L3_TRANSCRIPT = """
INTERVIEWER: Thank you for coming in, Daniel. Tell me about your background.
DANIEL: I graduated from Manchester University in 2022 with Computer Science.
After graduation I worked for two years at Brightline, leading a team of four.
INTERVIEWER: The role we offer is senior backend developer. Salary £62,000–£78,000
plus 12% bonus. Three days in office: Tuesday, Wednesday, Thursday.
DANIEL: What about training?
INTERVIEWER: £1,500 per year for conferences. Probation is 6 months.
""".strip()

L3_QUESTIONS = [
    {'order': 1, 'question_type': 'fill', 'group_id': 1,
     'instruction': 'Write ONE WORD AND/OR A NUMBER.',
     'text': 'University: ________',
     'correct_answer': 'Manchester'},
    {'order': 2, 'question_type': 'fill', 'group_id': 1,
     'text': 'Year of graduation: ________',
     'correct_answer': '2022'},
    {'order': 3, 'question_type': 'fill', 'group_id': 1,
     'text': 'Previous employer: ________',
     'correct_answer': 'Brightline'},
    {'order': 4, 'question_type': 'mcq', 'group_id': 2,
     'instruction': 'Choose A, B or C.',
     'text': 'Office days are:',
     'options': ['Mon-Wed-Fri', 'Tue-Wed-Thu', 'Every weekday'],
     'correct_answer': 'Tue-Wed-Thu'},
    {'order': 5, 'question_type': 'mcq', 'group_id': 2,
     'text': 'Probation lasts:',
     'options': ['Three months', 'Six months', 'Twelve months'],
     'correct_answer': 'Six months'},
    {'order': 6, 'question_type': 'fill', 'group_id': 3,
     'text': 'Maximum salary: £________',
     'correct_answer': '78000', 'acceptable_answers': ['78,000']},
    {'order': 7, 'question_type': 'fill', 'group_id': 3,
     'text': 'Training budget per year: £________',
     'correct_answer': '1500', 'acceptable_answers': ['1,500']},
]


L4_TRANSCRIPT = """
Today's lecture covers climate-driven biodiversity loss. Recent studies show that
approximately a quarter of assessed species are now classified as threatened. Three
mechanisms drive this loss: habitat alteration, phenological mismatch, and ocean
acidification. Polar species are particularly vulnerable, with the Arctic warming at
four times the global rate. Mismatches of up to three weeks have been documented in
temperate ecosystems. Conservation strategies must incorporate climate projections —
traditional protected areas may become unsuitable as climates shift.
""".strip()

L4_QUESTIONS = [
    {'order': 1, 'question_type': 'fill', 'group_id': 1,
     'instruction': 'Write ONE WORD AND/OR A NUMBER.',
     'text': 'Approximately ________ of assessed species are threatened.',
     'correct_answer': 'a quarter',
     'acceptable_answers': ['one quarter', '25%', 'one-quarter']},
    {'order': 2, 'question_type': 'fill', 'group_id': 1,
     'text': 'The Arctic warms at ________ times the global rate.',
     'correct_answer': 'four', 'acceptable_answers': ['4']},
    {'order': 3, 'question_type': 'fill', 'group_id': 1,
     'text': 'Maximum mismatch documented: ________ weeks',
     'correct_answer': 'three', 'acceptable_answers': ['3']},
    {'order': 4, 'question_type': 'matching', 'group_id': 2,
     'instruction': 'Match each mechanism to its description.',
     'text': 'Habitat alteration',
     'options': ['Geographic range shifts', 'Disrupted timing',
                 'pH change in water', 'Genetic drift'],
     'correct_answer': 'Geographic range shifts'},
    {'order': 5, 'question_type': 'matching', 'group_id': 2,
     'text': 'Phenological mismatch',
     'options': ['Geographic range shifts', 'Disrupted timing',
                 'pH change in water', 'Genetic drift'],
     'correct_answer': 'Disrupted timing'},
    {'order': 6, 'question_type': 'matching', 'group_id': 2,
     'text': 'Ocean acidification',
     'options': ['Geographic range shifts', 'Disrupted timing',
                 'pH change in water', 'Genetic drift'],
     'correct_answer': 'pH change in water'},
]


# ============================================================
# WRITING — 4 tests (one per level)
# ============================================================

WRITING_TESTS = [
    {
        'name': 'Daily Routine Description',
        'difficulty': 'beginner',
        'duration': 20,
        'min_words': 150,
        'prompt': (
            'Describe your typical daily routine. Include what time you wake up, '
            'what you do during the day, and what time you go to bed.\n\n'
            'Write at least 150 words.'
        ),
    },
    {
        'name': 'Bakery Earnings Graph',
        'difficulty': 'intermediate',
        'duration': 20,
        'min_words': 150,
        'prompt': (
            'The graph shows the annual earnings of three bakeries in London from '
            '2000 to 2010.\n\nSummarise the information by selecting and reporting '
            'the main features, and make comparisons where relevant.\n\n'
            'Write at least 150 words.'
        ),
    },
    {
        'name': 'Public Transport vs Roads',
        'difficulty': 'advanced',
        'duration': 40,
        'min_words': 250,
        'prompt': (
            'Some people think governments should spend more money on public '
            'transport. Others believe building more roads is more important.\n\n'
            'Discuss both views and give your own opinion.\n\n'
            'Write at least 250 words.'
        ),
    },
    {
        'name': 'Technology in Education',
        'difficulty': 'expert',
        'duration': 40,
        'min_words': 250,
        'prompt': (
            'In many countries, traditional teaching methods are being replaced by '
            'technology-based learning.\n\nDiscuss the advantages and disadvantages '
            'of this trend. To what extent do you agree or disagree?\n\n'
            'Write at least 250 words.'
        ),
    },
]


class Command(BaseCommand):
    help = 'Seed 4 reading + 4 listening + 4 writing tests (one per difficulty level).'

    def add_arguments(self, parser):
        parser.add_argument('--fresh', action='store_true',
                            help='Delete ALL existing tests first.')

    @transaction.atomic
    def handle(self, *args, **opts):
        if opts.get('fresh'):
            n = Test.objects.count()
            Test.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'--fresh: deleted {n} test(s).'))

        # Reading
        self._make_reading('The Origins of Coffee', 'beginner', 20, R1_PASSAGE, R1_QUESTIONS)
        self._make_reading('The Concept of Intelligence', 'intermediate', 20, R2_PASSAGE, R2_QUESTIONS)
        self._make_reading('Climate Change and Migration', 'advanced', 20, R3_PASSAGE, R3_QUESTIONS)
        self._make_reading('Quantum Computing: A New Frontier', 'expert', 20, R4_PASSAGE, R4_QUESTIONS)

        # Listening
        self._make_listening('Hotel Booking Inquiry', 'beginner', 10, L1_TRANSCRIPT, L1_QUESTIONS)
        self._make_listening('University Library Tour', 'intermediate', 10, L2_TRANSCRIPT, L2_QUESTIONS)
        self._make_listening('Job Interview at TechCorp', 'advanced', 10, L3_TRANSCRIPT, L3_QUESTIONS)
        self._make_listening('Climate Research Lecture', 'expert', 10, L4_TRANSCRIPT, L4_QUESTIONS)

        # Writing
        for w in WRITING_TESTS:
            t = Test.objects.create(
                name=w['name'], module='writing', test_type='academic',
                difficulty=w['difficulty'], duration_minutes=w['duration'],
                description=f'IELTS Writing — {w["difficulty"]} level',
                is_published=True,
            )
            Passage.objects.create(
                test=t, part_number=1, title=w['name'],
                content=w['prompt'], min_words=w['min_words'], order=1,
            )
            self.stdout.write(self.style.SUCCESS(
                f'  Writing: {w["name"]:35s} ({w["difficulty"]})'))

        self.stdout.write(self.style.SUCCESS('=== Seed complete ==='))
        self.stdout.write(self.style.SUCCESS(
            f'  Total: {Test.objects.count()} tests, {Question.objects.count()} questions'))

    def _make_reading(self, name, difficulty, duration, passage, questions):
        t = Test.objects.create(
            name=name, module='reading', test_type='academic',
            difficulty=difficulty, duration_minutes=duration,
            description=f'IELTS Reading — {difficulty} level',
            is_published=True,
        )
        p = Passage.objects.create(
            test=t, part_number=1, title=name, content=passage, order=1,
        )
        for q in questions:
            Question.objects.create(passage=p, **q)
        self.stdout.write(self.style.SUCCESS(
            f'  Reading:   {name:35s} ({difficulty}) — {len(questions)} questions'))

    def _make_listening(self, name, difficulty, duration, transcript, questions):
        t = Test.objects.create(
            name=name, module='listening', test_type='academic',
            difficulty=difficulty, duration_minutes=duration,
            description=f'IELTS Listening — {difficulty} level',
            is_published=True,
        )
        p = Passage.objects.create(
            test=t, part_number=1, title=name, content=transcript, order=1,
        )
        for q in questions:
            Question.objects.create(passage=p, **q)
        self.stdout.write(self.style.SUCCESS(
            f'  Listening: {name:35s} ({difficulty}) — {len(questions)} questions'))
