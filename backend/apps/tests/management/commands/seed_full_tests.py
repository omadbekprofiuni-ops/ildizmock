"""Seed 4 Reading + 4 Listening + 4 Writing tests, one per difficulty level.

Replaces all global (organization=null) tests. Idempotent.
Run: python manage.py seed_full_tests
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.tests.models import Passage, Question, Test


class Command(BaseCommand):
    help = 'Seed 4 reading + 4 listening + 4 writing tests, one per difficulty.'

    @transaction.atomic
    def handle(self, *args, **opts):
        Test.objects.filter(organization__isnull=True).delete()

        self.create_reading_tests()
        self.create_listening_tests()
        self.create_writing_tests()

        for module in ['reading', 'listening', 'writing']:
            count = Test.objects.filter(
                organization__isnull=True, module=module,
            ).count()
            self.stdout.write(self.style.SUCCESS(f'{module}: {count} tests'))

    # ============================================================
    # READING
    # ============================================================
    def create_reading_tests(self):
        tests = [
            # ============ BEGINNER ============
            {
                'name': 'The Origins of Coffee',
                'difficulty': 'beginner',
                'duration': 20,
                'passage_title': 'The Origins of Coffee',
                'passage': """Coffee is one of the most popular beverages in the world today, but its origins are surprisingly humble. According to legend, coffee was discovered in Ethiopia around the 9th century by a goat herder named Kaldi. He noticed that his goats became unusually energetic after eating the red berries from a particular bush.

Kaldi reported his findings to a local monastery, where the abbot made a drink with the berries and discovered it kept him alert during evening prayers. Word soon spread, and coffee began its long journey from Ethiopia to the Arabian Peninsula.

By the 15th century, coffee was being grown in Yemen, and by the 16th century, it had spread throughout the Middle East. Coffee houses, known as "qahveh khaneh," became popular meeting places where people would discuss politics, listen to music, and play games.

European travelers brought coffee back from their journeys to the Middle East, and by the 17th century, coffee houses were appearing in major European cities. London alone had over 300 coffee houses by 1675, many of which became important centers of business and intellectual discussion.

Today, coffee is grown in over 70 countries around the world. Brazil produces the most, followed by Vietnam and Colombia. The coffee industry employs millions of people and generates billions of dollars in revenue each year.""",
                'questions': [
                    {'order': 1, 'type': 'tfng', 'group': 1,
                     'instruction': 'Do the following statements agree with the information in the passage? Write TRUE, FALSE, or NOT GIVEN.',
                     'text': 'Coffee was first discovered in Ethiopia.',
                     'options': ['TRUE', 'FALSE', 'NOT GIVEN'],
                     'answer': 'TRUE'},
                    {'order': 2, 'type': 'tfng', 'group': 1,
                     'text': 'Kaldi was a farmer who grew coffee plants.',
                     'options': ['TRUE', 'FALSE', 'NOT GIVEN'],
                     'answer': 'FALSE'},
                    {'order': 3, 'type': 'tfng', 'group': 1,
                     'text': 'The first coffee house was opened in London.',
                     'options': ['TRUE', 'FALSE', 'NOT GIVEN'],
                     'answer': 'FALSE'},
                    {'order': 4, 'type': 'tfng', 'group': 1,
                     'text': 'Coffee was used in religious ceremonies in Yemen.',
                     'options': ['TRUE', 'FALSE', 'NOT GIVEN'],
                     'answer': 'NOT GIVEN'},
                    {'order': 5, 'type': 'mcq', 'group': 2,
                     'instruction': 'Choose the correct letter, A, B, C or D.',
                     'text': 'According to the passage, when did coffee houses appear in Europe?',
                     'options': ['9th century', '15th century', '17th century', '19th century'],
                     'answer': '17th century'},
                    {'order': 6, 'type': 'mcq', 'group': 2,
                     'text': 'Which country produces the most coffee today?',
                     'options': ['Vietnam', 'Brazil', 'Colombia', 'Ethiopia'],
                     'answer': 'Brazil'},
                    {'order': 7, 'type': 'mcq', 'group': 2,
                     'text': 'How many coffee houses were in London by 1675?',
                     'options': ['Over 100', 'Over 200', 'Over 300', 'Over 500'],
                     'answer': 'Over 300'},
                    {'order': 8, 'type': 'fill', 'group': 3,
                     'instruction': 'Complete the sentences below. Write NO MORE THAN TWO WORDS for each answer.',
                     'text': 'Coffee houses were called ______ in the Middle East.',
                     'answer': 'qahveh khaneh'},
                    {'order': 9, 'type': 'fill', 'group': 3,
                     'text': 'Coffee is grown in over ______ countries today.',
                     'answer': '70'},
                    {'order': 10, 'type': 'fill', 'group': 3,
                     'text': 'The goat herder who discovered coffee was named ______.',
                     'answer': 'Kaldi'},
                ],
            },
            # ============ INTERMEDIATE ============
            {
                'name': 'The Concept of Intelligence',
                'difficulty': 'intermediate',
                'duration': 20,
                'passage_title': 'The Concept of Intelligence',
                'passage': """[HEADING: A]
Looked at in one way, everyone knows what intelligence is; looked at in another way, no one does. In other words, people all have unconscious notions—known as 'implicit theories'—of intelligence, but no one knows for certain what it actually is. This chapter addresses how people conceptualize intelligence, whatever it may actually be.

[HEADING: B]
Why should we even care what people think intelligence is, as opposed only to valuing whatever it actually is? There are at least four reasons people's conceptions of intelligence matter. First, implicit theories drive how people perceive and evaluate their own intelligence and that of others.

[HEADING: C]
Second, implicit theories of intelligence are the basis on which people decide what kinds of behavior are intelligent. In some countries, being quick to answer is considered intelligent, whereas in others, taking time to reflect is prized.

[HEADING: D]
Third, theorists' implicit theories may guide their construction of explicit theories. Scientists develop research programs partly because they already have implicit theories to investigate further.

[HEADING: E]
Fourth, in everyday life, people use implicit theories to judge others. These judgments affect hiring decisions, promotions, school admissions, and friendships.

[HEADING: F]
Research suggests that non-scientists behave differently towards people they believe to be intelligent versus those they perceive as unintelligent. They speak differently, share different information, and show different levels of patience.

[HEADING: G]
In conclusion, understanding implicit theories of intelligence is central to understanding both intelligence itself and how people navigate the social world.""",
                'questions': [
                    {'order': 1, 'type': 'matching', 'group': 1,
                     'instruction': 'Which paragraph contains the following information? Choose the correct letter A-G.',
                     'text': "information about how non-scientists' assumptions about intelligence influence their behaviour",
                     'options': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
                     'answer': 'F'},
                    {'order': 2, 'type': 'matching', 'group': 1,
                     'text': 'a reference to lack of clarity over the definition of intelligence',
                     'options': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
                     'answer': 'A'},
                    {'order': 3, 'type': 'matching', 'group': 1,
                     'text': "the point that researchers' implicit and explicit theories may differ",
                     'options': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
                     'answer': 'D'},
                    {'order': 4, 'type': 'matching', 'group': 1,
                     'text': 'a list of reasons why understanding intelligence matters in everyday life',
                     'options': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
                     'answer': 'E'},
                    {'order': 5, 'type': 'tfng', 'group': 2,
                     'instruction': 'Do the following statements agree with the information given? Write TRUE, FALSE, or NOT GIVEN.',
                     'text': 'Most people have a clear and consistent definition of intelligence.',
                     'options': ['TRUE', 'FALSE', 'NOT GIVEN'],
                     'answer': 'FALSE'},
                    {'order': 6, 'type': 'tfng', 'group': 2,
                     'text': "Parents' beliefs about intelligence affect how they raise their children.",
                     'options': ['TRUE', 'FALSE', 'NOT GIVEN'],
                     'answer': 'NOT GIVEN'},
                    {'order': 7, 'type': 'tfng', 'group': 2,
                     'text': 'In some cultures, taking time to think is considered intelligent.',
                     'options': ['TRUE', 'FALSE', 'NOT GIVEN'],
                     'answer': 'TRUE'},
                    {'order': 8, 'type': 'mcq', 'group': 3,
                     'instruction': 'Choose the correct letter A, B, C or D.',
                     'text': 'According to the passage, implicit theories of intelligence affect:',
                     'options': ['Only academic settings', 'Hiring and friendships', 'Government decisions', 'Athletic performance'],
                     'answer': 'Hiring and friendships'},
                    {'order': 9, 'type': 'mcq', 'group': 3,
                     'text': 'The author suggests that non-scientists:',
                     'options': ['Always treat people equally', 'Behave differently based on perceived intelligence', 'Cannot judge intelligence at all', 'Are smarter than scientists'],
                     'answer': 'Behave differently based on perceived intelligence'},
                    {'order': 10, 'type': 'fill', 'group': 4,
                     'instruction': 'Complete the sentence. Write NO MORE THAN TWO WORDS.',
                     'text': 'Unconscious notions of intelligence are called ______ theories.',
                     'answer': 'implicit'},
                ],
            },
            # ============ ADVANCED ============
            {
                'name': 'Climate Change and Bird Migration',
                'difficulty': 'advanced',
                'duration': 20,
                'passage_title': 'Climate Change and Bird Migration',
                'passage': """Recent ornithological studies have revealed profound shifts in the migratory patterns of birds across multiple continents, with researchers attributing these changes primarily to global climate change. These findings, published in the journal Nature Climate Change, document alterations in timing, distance, and route selection that have significant implications for ecosystem stability.

For centuries, bird migration has been governed by remarkably precise biological clocks, evolved over millennia to synchronize departure with optimal environmental conditions at destination sites. However, longitudinal data spanning 40 years now demonstrates that many species are arriving at breeding grounds two to three weeks earlier than they did in the 1980s. This phenological shift, while seemingly minor, creates cascading ecological problems.

The most critical issue involves what scientists term "trophic mismatch." Migratory birds time their arrival to coincide with peak food availability—typically insects emerging from larval stages or seeds reaching maturity. When birds arrive earlier than their food sources are ready, breeding success plummets. The pied flycatcher in the Netherlands has experienced a 90% population decline in some areas due to this mismatch, as caterpillar populations now peak before chicks hatch.

Conversely, some species are abandoning migration entirely. Blackcaps, traditionally migrating from central Europe to the Mediterranean, are increasingly overwintering in the United Kingdom, where milder winters and abundant garden bird feeders provide sufficient resources. While this represents adaptive behavior, it also disrupts established ecological relationships in their traditional wintering grounds.

Route changes pose additional challenges. Satellite tracking reveals that some Arctic-breeding species now follow more northerly routes during spring migration, attempting to exploit earlier ice melt. However, these alternative pathways often lack adequate refueling stations—wetlands and grasslands where exhausted migrants can rest and feed. Mortality rates have correspondingly increased.

The conservation implications are substantial. Traditional protected area networks, designed around historical migration patterns, may prove inadequate as species shift their ranges. Conservation biologists are advocating for "dynamic conservation" approaches—flexible protected zones that can be adjusted as patterns evolve.""",
                'questions': [
                    {'order': 1, 'type': 'mcq', 'group': 1,
                     'instruction': 'Choose the correct letter A, B, C or D.',
                     'text': 'According to the passage, the main cause of changing bird migration is:',
                     'options': ['Habitat destruction', 'Climate change', 'Predator increases', 'Pollution'],
                     'answer': 'Climate change'},
                    {'order': 2, 'type': 'mcq', 'group': 1,
                     'text': 'How much earlier are some birds arriving compared to the 1980s?',
                     'options': ['1 week', '2-3 weeks', '1 month', '2 months'],
                     'answer': '2-3 weeks'},
                    {'order': 3, 'type': 'mcq', 'group': 1,
                     'text': 'The pied flycatcher population decline is mainly due to:',
                     'options': ['Hunting', 'Trophic mismatch', 'Disease', 'Loss of habitat'],
                     'answer': 'Trophic mismatch'},
                    {'order': 4, 'type': 'mcq', 'group': 1,
                     'text': 'Why are blackcaps staying in the UK during winter?',
                     'options': ['Government protection', 'Milder winters and food availability', 'Too tired to migrate', 'Lack of breeding sites'],
                     'answer': 'Milder winters and food availability'},
                    {'order': 5, 'type': 'tfng', 'group': 2,
                     'instruction': "Do the following statements agree with the claims of the writer? Write YES, NO, or NOT GIVEN.",
                     'text': 'All bird species are migrating earlier than before.',
                     'options': ['YES', 'NO', 'NOT GIVEN'],
                     'answer': 'NO'},
                    {'order': 6, 'type': 'tfng', 'group': 2,
                     'text': 'New northern migration routes have fewer rest stops.',
                     'options': ['YES', 'NO', 'NOT GIVEN'],
                     'answer': 'YES'},
                    {'order': 7, 'type': 'tfng', 'group': 2,
                     'text': 'The pied flycatcher is now extinct in the Netherlands.',
                     'options': ['YES', 'NO', 'NOT GIVEN'],
                     'answer': 'NO'},
                    {'order': 8, 'type': 'tfng', 'group': 2,
                     'text': 'Garden bird feeders should be removed to prevent migration changes.',
                     'options': ['YES', 'NO', 'NOT GIVEN'],
                     'answer': 'NOT GIVEN'},
                    {'order': 9, 'type': 'fill', 'group': 3,
                     'instruction': 'Complete the sentences. Write NO MORE THAN THREE WORDS.',
                     'text': 'Scientists call the timing problem between birds and food "______".',
                     'answer': 'trophic mismatch'},
                    {'order': 10, 'type': 'fill', 'group': 3,
                     'text': 'Conservation biologists recommend "______" approaches that can adjust over time.',
                     'answer': 'dynamic conservation'},
                ],
            },
            # ============ EXPERT ============
            {
                'name': 'Quantum Computing: A New Frontier',
                'difficulty': 'expert',
                'duration': 20,
                'passage_title': 'Quantum Computing: A New Frontier',
                'passage': """Quantum computing represents a paradigmatic shift in computational science, leveraging the counterintuitive principles of quantum mechanics to perform calculations exponentially faster than classical computers for specific problem classes. While conventional computers process information using binary bits—either 0 or 1—quantum computers utilize quantum bits, or "qubits," which can exist in superposition, simultaneously representing multiple states.

The mathematical foundations of quantum computing emerged in the early 1980s with theoretical contributions from Richard Feynman and David Deutsch. Feynman observed that simulating quantum systems on classical computers required exponentially increasing resources, leading him to propose that quantum computers might be uniquely suited to such tasks. Deutsch subsequently formalized the concept of a universal quantum computer, demonstrating its theoretical computational superiority for certain algorithms.

Contemporary quantum computing exploits two fundamental quantum phenomena: superposition and entanglement. Superposition allows a single qubit to encode multiple values simultaneously, while entanglement creates non-local correlations between qubits—a phenomenon Einstein famously dismissed as "spooky action at a distance." When qubits become entangled, the state of one immediately influences the others, regardless of physical separation. These properties enable quantum computers to explore vast solution spaces in parallel.

Despite theoretical promise, practical quantum computing faces formidable engineering challenges. Qubits are exquisitely sensitive to environmental disturbances—electromagnetic interference, thermal fluctuations, even cosmic rays can cause "decoherence," whereby qubits lose their quantum properties and behave classically. Maintaining quantum coherence requires extreme isolation: most current systems operate at temperatures approaching absolute zero, requiring sophisticated cryogenic infrastructure.

Recent breakthroughs have accelerated progress toward "quantum advantage"—the demonstrable superiority of quantum systems over classical equivalents for specific computations. In 2019, Google's Sycamore processor performed a calculation in 200 seconds that would purportedly require a classical supercomputer 10,000 years. While critics have questioned the practical relevance of the chosen problem, the demonstration marked a significant milestone.

Cryptography stands among the fields most likely to be revolutionized—or disrupted—by quantum computing. Shor's algorithm, developed in 1994, can theoretically factor large numbers exponentially faster than any known classical algorithm, threatening current public-key cryptographic systems that secure global digital infrastructure. This has spurred urgent research into "post-quantum cryptography," developing algorithms resistant to quantum attacks.

The trajectory of quantum computing remains uncertain. Optimists envision transformative applications in drug discovery, materials science, and climate modeling within a decade. Skeptics caution that scaling current systems to commercially useful sizes—requiring millions of stable, error-corrected qubits—may prove impossibly difficult. What remains clear is that quantum computing has transitioned from theoretical curiosity to active engineering challenge, with substantial implications for science, security, and society.""",
                'questions': [
                    {'order': 1, 'type': 'matching', 'group': 1,
                     'instruction': 'Match each name with the correct contribution. Choose A-D.',
                     'text': 'Proposed using quantum computers to simulate quantum systems',
                     'options': ['Feynman', 'Deutsch', 'Shor', 'Einstein'],
                     'answer': 'Feynman'},
                    {'order': 2, 'type': 'matching', 'group': 1,
                     'text': 'Formalized the concept of a universal quantum computer',
                     'options': ['Feynman', 'Deutsch', 'Shor', 'Einstein'],
                     'answer': 'Deutsch'},
                    {'order': 3, 'type': 'matching', 'group': 1,
                     'text': 'Created an algorithm that threatens current cryptography',
                     'options': ['Feynman', 'Deutsch', 'Shor', 'Einstein'],
                     'answer': 'Shor'},
                    {'order': 4, 'type': 'matching', 'group': 1,
                     'text': 'Skeptical about quantum entanglement as a phenomenon',
                     'options': ['Feynman', 'Deutsch', 'Shor', 'Einstein'],
                     'answer': 'Einstein'},
                    {'order': 5, 'type': 'mcq', 'group': 2,
                     'instruction': 'Choose the correct letter A, B, C or D.',
                     'text': 'What is the main difference between qubits and classical bits?',
                     'options': ['Qubits are physical, bits are virtual', 'Qubits can exist in superposition', 'Qubits are larger', 'Bits are faster'],
                     'answer': 'Qubits can exist in superposition'},
                    {'order': 6, 'type': 'mcq', 'group': 2,
                     'text': 'Why do quantum computers need extreme cooling?',
                     'options': ['To save energy', 'To prevent decoherence', 'For storage', 'To speed up calculations'],
                     'answer': 'To prevent decoherence'},
                    {'order': 7, 'type': 'mcq', 'group': 2,
                     'text': "Google's Sycamore processor demonstrated:",
                     'options': ['Total quantum supremacy', 'Quantum advantage on a specific problem', 'A new internet protocol', 'Improved AI'],
                     'answer': 'Quantum advantage on a specific problem'},
                    {'order': 8, 'type': 'tfng', 'group': 3,
                     'instruction': "Do the following statements agree with the writer's views? Write YES, NO, or NOT GIVEN.",
                     'text': 'Quantum computing will replace classical computing entirely within 10 years.',
                     'options': ['YES', 'NO', 'NOT GIVEN'],
                     'answer': 'NOT GIVEN'},
                    {'order': 9, 'type': 'tfng', 'group': 3,
                     'text': 'Post-quantum cryptography is being developed in response to quantum threats.',
                     'options': ['YES', 'NO', 'NOT GIVEN'],
                     'answer': 'YES'},
                    {'order': 10, 'type': 'fill', 'group': 4,
                     'instruction': 'Complete each sentence. Write NO MORE THAN TWO WORDS.',
                     'text': 'When qubits lose their quantum properties, this is called ______.',
                     'answer': 'decoherence'},
                ],
            },
        ]

        for t in tests:
            test = Test.objects.create(
                name=t['name'],
                module='reading',
                difficulty=t['difficulty'],
                duration_minutes=t['duration'],
                is_published=True,
                organization=None,
                is_global=True,
            )
            passage = Passage.objects.create(
                test=test,
                part_number=1,
                title=t['passage_title'],
                content=t['passage'],
                order=1,
            )
            for q in t['questions']:
                Question.objects.create(
                    passage=passage,
                    order=q['order'],
                    question_type=q['type'],
                    text=q['text'],
                    options=q.get('options', []),
                    correct_answer=q['answer'],
                    group_id=q['group'],
                    instruction=q.get('instruction', ''),
                )

    # ============================================================
    # LISTENING
    # ============================================================
    def create_listening_tests(self):
        tests = [
            # ============ BEGINNER ============
            {
                'name': 'Hotel Booking Inquiry',
                'difficulty': 'beginner',
                'duration': 10,
                'transcript': """Receptionist: Good morning, Riverside Hotel. How can I help you?
Caller: Hi, I'd like to book a room for next weekend.
Receptionist: Certainly. What dates exactly?
Caller: Friday the 15th to Sunday the 17th.
Receptionist: Two nights then. Single or double?
Caller: Double please. With a sea view if possible.
Receptionist: Let me check. Yes, we have a double sea view available at 120 pounds per night.
Caller: Does that include breakfast?
Receptionist: Continental breakfast is included, yes.
Caller: Do you have parking?
Receptionist: We have on-site parking for 10 pounds per night.
Caller: My name is John Smith, S-M-I-T-H.
Receptionist: Contact number?
Caller: 0207 555 4892.
Receptionist: Wonderful. Total cost will be 260 pounds.""",
                'questions': [
                    {'order': 1, 'type': 'fill', 'group': 1,
                     'instruction': 'Complete the booking form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
                     'text': 'Hotel name: ______ Hotel',
                     'answer': 'Riverside'},
                    {'order': 2, 'type': 'fill', 'group': 1,
                     'text': 'Number of nights: ______',
                     'answer': '2'},
                    {'order': 3, 'type': 'fill', 'group': 1,
                     'text': 'Room type: ______ with sea view',
                     'answer': 'double'},
                    {'order': 4, 'type': 'fill', 'group': 1,
                     'text': 'Price per night: ______ pounds',
                     'answer': '120'},
                    {'order': 5, 'type': 'fill', 'group': 1,
                     'text': 'Breakfast type: ______',
                     'answer': 'continental'},
                    {'order': 6, 'type': 'fill', 'group': 1,
                     'text': 'Parking cost: ______ pounds per night',
                     'answer': '10'},
                    {'order': 7, 'type': 'fill', 'group': 1,
                     'text': "Customer's surname: ______",
                     'answer': 'Smith'},
                    {'order': 8, 'type': 'fill', 'group': 1,
                     'text': 'Phone: 0207 555 ______',
                     'answer': '4892'},
                    {'order': 9, 'type': 'fill', 'group': 1,
                     'text': 'Total cost: ______ pounds',
                     'answer': '260'},
                    {'order': 10, 'type': 'mcq', 'group': 2,
                     'instruction': 'Choose the correct letter A, B, or C.',
                     'text': 'When does the customer want to stay?',
                     'options': ['This weekend', 'Next weekend', 'In two weeks'],
                     'answer': 'Next weekend'},
                ],
            },
            # ============ INTERMEDIATE ============
            {
                'name': 'University Library Tour',
                'difficulty': 'intermediate',
                'duration': 10,
                'transcript': """Welcome to today's library orientation. My name is Sarah, your guide.

We're at the main entrance. The reception desk is open from 9 AM to 10 PM during term time.

Follow me right to the silent study area on the ground floor. We have over 200 individual study spaces. No talking allowed here.

Down this corridor are the group study rooms. There are 12 rooms, bookable online up to 2 weeks in advance.

Upstairs, the first floor has fiction and literature, organized by genre. The librarian's desk is near the staircase.

Second floor: academic books by subject. Computer science is east wing, humanities and social sciences west wing.

Important: students borrow up to 10 books at a time. Standard loan is 3 weeks, but high-demand books just 1 week.

Top floor: 60 computer workstations. Printing is 5 pence black and white, 20 pence color.""",
                'questions': [
                    {'order': 1, 'type': 'fill', 'group': 1,
                     'instruction': 'Complete the notes. Write NO MORE THAN TWO WORDS AND/OR A NUMBER.',
                     'text': "Tour guide's name: ______",
                     'answer': 'Sarah'},
                    {'order': 2, 'type': 'fill', 'group': 1,
                     'text': 'Library hours: 9 AM to ______',
                     'answer': '10 PM'},
                    {'order': 3, 'type': 'fill', 'group': 1,
                     'text': 'Silent study spaces: over ______',
                     'answer': '200'},
                    {'order': 4, 'type': 'fill', 'group': 1,
                     'text': 'Number of group study rooms: ______',
                     'answer': '12'},
                    {'order': 5, 'type': 'fill', 'group': 1,
                     'text': 'Booking advance: up to ______ weeks',
                     'answer': '2'},
                    {'order': 6, 'type': 'fill', 'group': 1,
                     'text': 'Maximum books to borrow: ______',
                     'answer': '10'},
                    {'order': 7, 'type': 'fill', 'group': 1,
                     'text': 'Standard loan period: ______ weeks',
                     'answer': '3'},
                    {'order': 8, 'type': 'fill', 'group': 1,
                     'text': 'Number of computer workstations: ______',
                     'answer': '60'},
                    {'order': 9, 'type': 'mcq', 'group': 2,
                     'instruction': 'Choose the correct letter A, B, or C.',
                     'text': 'Where is computer science section located?',
                     'options': ['West wing', 'East wing', 'Top floor'],
                     'answer': 'East wing'},
                    {'order': 10, 'type': 'mcq', 'group': 2,
                     'text': 'How much does color printing cost per page?',
                     'options': ['5 pence', '10 pence', '20 pence'],
                     'answer': '20 pence'},
                ],
            },
            # ============ ADVANCED ============
            {
                'name': 'Job Interview at TechCorp',
                'difficulty': 'advanced',
                'duration': 10,
                'transcript': """Interviewer: Thank you for coming today, Daniel. Please take a seat.
Daniel: Thank you for having me.
Interviewer: I've reviewed your CV. Tell me about your background.
Daniel: I graduated from Manchester University in 2022 with a Computer Science degree. Then I worked for two years at a startup called Brightline, leading a team of four engineers building a logistics platform. I left to find a more research-oriented role.
Interviewer: The position is senior backend developer. Our team has eight engineers. Salary range is 62,000 to 78,000 depending on experience, with annual bonus up to 12 percent.
Daniel: Sounds excellent. Working hours?
Interviewer: Flexible. Three days office Tuesday Wednesday Thursday, two days remote. Office is at 24 Hampton Street, near Liverpool Street station.
Daniel: Training opportunities?
Interviewer: New starters receive 1,500 pounds per year for conferences and online courses. Probation lasts six months, then permanent contract for those who meet objectives.
Daniel: Could you tell me about technical challenges?
Interviewer: We're scaling our microservices to handle ten times current load. Database performance is the main bottleneck. We need someone with strong PostgreSQL experience.""",
                'questions': [
                    {'order': 1, 'type': 'fill', 'group': 1,
                     'instruction': 'Complete the form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER.',
                     'text': "Candidate's name: Daniel ______",
                     'answer': 'Smith'},
                    {'order': 2, 'type': 'fill', 'group': 1,
                     'text': 'University attended: ______ University',
                     'answer': 'Manchester'},
                    {'order': 3, 'type': 'fill', 'group': 1,
                     'text': 'Graduation year: ______',
                     'answer': '2022'},
                    {'order': 4, 'type': 'fill', 'group': 1,
                     'text': 'Previous employer: ______',
                     'answer': 'Brightline'},
                    {'order': 5, 'type': 'fill', 'group': 1,
                     'text': 'Engineers led: ______',
                     'answer': '4'},
                    {'order': 6, 'type': 'fill', 'group': 1,
                     'text': 'Maximum salary: ______ pounds',
                     'answer': '78000'},
                    {'order': 7, 'type': 'fill', 'group': 1,
                     'text': 'Annual training budget: ______ pounds',
                     'answer': '1500'},
                    {'order': 8, 'type': 'fill', 'group': 1,
                     'text': 'Probation period: ______ months',
                     'answer': '6'},
                    {'order': 9, 'type': 'mcq', 'group': 2,
                     'instruction': 'Choose the correct letter A, B, or C.',
                     'text': 'How many days per week is office attendance required?',
                     'options': ['2 days', '3 days', '5 days'],
                     'answer': '3 days'},
                    {'order': 10, 'type': 'mcq', 'group': 2,
                     'text': "What is the team's main technical challenge?",
                     'options': ['User interface design', 'Database performance', 'Mobile compatibility'],
                     'answer': 'Database performance'},
                ],
            },
            # ============ EXPERT ============
            {
                'name': 'Climate Research Lecture',
                'difficulty': 'expert',
                'duration': 10,
                'transcript': """Good afternoon. Today's lecture focuses on climate change impact on global biodiversity over the past three decades.

Recent studies by the International Biodiversity Research Consortium reveal alarming trends. Approximately 25 percent of all assessed species are now threatened, with mammals, amphibians, and corals facing the most precipitous declines.

Three primary mechanisms drive biodiversity loss. First, habitat alteration. As temperatures rise, ecosystems shift their boundaries. Polar species are particularly vulnerable, with the Arctic warming at four times the global average rate.

Second, phenological mismatches. This refers to disruption of synchronized timing between interdependent species. For instance, if flowers bloom before pollinators emerge, both species suffer. Studies have documented mismatches of up to three weeks in temperate ecosystems.

Third, ocean acidification. As oceans absorb increasing carbon dioxide, their pH levels decrease. This particularly affects marine organisms with calcium carbonate shells, including corals, mollusks, and some plankton.

The cascading effects are profound. When keystone species decline, entire food webs collapse. The implications extend to ecosystem services like pollination and water purification.

Conservation strategies must incorporate climate projections. Traditional protected areas may become unsuitable as climates shift. We need adaptive management, including ecological corridors and assisted species migration.""",
                'questions': [
                    {'order': 1, 'type': 'fill', 'group': 1,
                     'instruction': 'Complete the notes. Write NO MORE THAN TWO WORDS AND/OR A NUMBER.',
                     'text': 'Time period studied: past ______ decades',
                     'answer': '3'},
                    {'order': 2, 'type': 'fill', 'group': 1,
                     'text': 'Percentage of species threatened: ______',
                     'answer': '25'},
                    {'order': 3, 'type': 'fill', 'group': 1,
                     'text': 'Arctic warming rate: ______ times global average',
                     'answer': '4'},
                    {'order': 4, 'type': 'fill', 'group': 1,
                     'text': 'Maximum phenological mismatch: ______ weeks',
                     'answer': '3'},
                    {'order': 5, 'type': 'fill', 'group': 2,
                     'instruction': 'Complete the notes about three mechanisms of biodiversity loss.',
                     'text': 'Mechanism 1: ______ alteration',
                     'answer': 'habitat'},
                    {'order': 6, 'type': 'fill', 'group': 2,
                     'text': 'Mechanism 2: ______ mismatches',
                     'answer': 'phenological'},
                    {'order': 7, 'type': 'fill', 'group': 2,
                     'text': 'Mechanism 3: ocean ______',
                     'answer': 'acidification'},
                    {'order': 8, 'type': 'mcq', 'group': 3,
                     'instruction': 'Choose the correct letter A, B, or C.',
                     'text': 'Which group faces the most severe decline?',
                     'options': ['Birds and fish', 'Mammals, amphibians, and corals', 'Insects only'],
                     'answer': 'Mammals, amphibians, and corals'},
                    {'order': 9, 'type': 'mcq', 'group': 3,
                     'text': 'Ocean acidification mainly affects organisms with:',
                     'options': ['Soft bodies', 'Calcium carbonate shells', 'Long lifespans'],
                     'answer': 'Calcium carbonate shells'},
                    {'order': 10, 'type': 'mcq', 'group': 3,
                     'text': 'What conservation approach is recommended?',
                     'options': ['Static protected areas', 'Adaptive management with corridors', 'Cease all human activity'],
                     'answer': 'Adaptive management with corridors'},
                ],
            },
        ]

        for t in tests:
            test = Test.objects.create(
                name=t['name'],
                module='listening',
                difficulty=t['difficulty'],
                duration_minutes=t['duration'],
                is_published=True,
                organization=None,
                is_global=True,
            )
            passage = Passage.objects.create(
                test=test,
                part_number=1,
                title=t['name'],
                content=t['transcript'],
                order=1,
                # audio_file: admin uploads later
            )
            for q in t['questions']:
                Question.objects.create(
                    passage=passage,
                    order=q['order'],
                    question_type=q['type'],
                    text=q['text'],
                    options=q.get('options', []),
                    correct_answer=q['answer'],
                    group_id=q['group'],
                    instruction=q.get('instruction', ''),
                )

    # ============================================================
    # WRITING
    # ============================================================
    def create_writing_tests(self):
        tests = [
            {
                'name': 'Daily Routine Description',
                'difficulty': 'beginner',
                'duration': 30,
                'task_prompt': 'Describe your typical daily routine. Include what time you wake up, what you do during the day, and what time you go to bed. Write at least 150 words.',
                'min_words': 150,
            },
            {
                'name': 'Bakery Earnings Graph (Task 1)',
                'difficulty': 'intermediate',
                'duration': 30,
                'task_prompt': 'The graph shows the annual earnings of three bakeries in London from 2000 to 2010. Summarize the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
                'min_words': 150,
            },
            {
                'name': 'Public Transport vs Roads',
                'difficulty': 'advanced',
                'duration': 40,
                'task_prompt': 'Some people think governments should spend more money on public transport. Others believe building more roads is more important. Discuss both views and give your own opinion. Write at least 250 words.',
                'min_words': 250,
            },
            {
                'name': 'Technology in Education',
                'difficulty': 'expert',
                'duration': 40,
                'task_prompt': 'In many countries, traditional teaching methods are being replaced by technology-based learning. Discuss the advantages and disadvantages of this trend. To what extent do you agree or disagree? Write at least 250 words.',
                'min_words': 250,
            },
        ]

        for t in tests:
            test = Test.objects.create(
                name=t['name'],
                module='writing',
                difficulty=t['difficulty'],
                duration_minutes=t['duration'],
                is_published=True,
                organization=None,
                is_global=True,
            )
            Passage.objects.create(
                test=test,
                part_number=1,
                title=t['name'],
                content=t['task_prompt'],
                min_words=t['min_words'],
                order=1,
            )
