import random
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.attempts.models import Attempt, WritingSubmission
from apps.tests.models import Passage, Question, Test

User = get_user_model()


# ============================================================
# READING — 4 tests, 10 questions each (40 total)
# ============================================================

READING_1_PASSAGE = """
Much that has been written on the subject of intelligence owes more to
investment in particular theoretical frameworks than to solid empirical
research. Intelligence is not a single, unitary capacity but rather a
collection of abilities — verbal reasoning, spatial perception, memory,
and so on. Different cultures emphasise different components: in Western
academic traditions, logical-mathematical ability has long been
privileged, while communities elsewhere place equal or greater weight on
social intelligence, practical problem-solving, and the ability to
cooperate effectively within a group.

Psychologists have proposed numerous models. Charles Spearman argued for
a general factor (g) underlying all intellectual tasks. Howard Gardner,
by contrast, proposed at least seven distinct intelligences, including
musical, bodily-kinaesthetic, and interpersonal. Robert Sternberg's
triarchic theory further distinguishes analytical, creative and
practical intelligences — the last of which, he argues, most
conventional IQ tests fail to measure.

Critics note that cross-cultural comparisons are hampered by the fact
that almost every standardised test reflects the values and assumptions
of its designers. A child from a rural agricultural community may score
poorly on a test asking them to arrange geometric shapes, yet
demonstrate remarkable intelligence when asked to plan the planting of
a field or mediate a dispute between neighbours.
""".strip()

READING_1_QUESTIONS = [
    {'order': 1, 'question_type': 'mcq', 'group_id': 1,
     'instruction': 'Choose the correct answer A, B, C or D.',
     'text': 'According to the passage, intelligence is best described as:',
     'options': ['A single inherited ability',
                 'A collection of different abilities',
                 'A culturally universal concept',
                 'A measure of schooling'],
     'correct_answer': 'A collection of different abilities'},
    {'order': 2, 'question_type': 'mcq', 'group_id': 1,
     'text': 'Which theorist proposed a general factor (g)?',
     'options': ['Charles Spearman', 'Howard Gardner',
                 'Robert Sternberg', 'None of the above'],
     'correct_answer': 'Charles Spearman'},
    {'order': 3, 'question_type': 'tfng', 'group_id': 2,
     'instruction': 'Choose TRUE, FALSE or NOT GIVEN.',
     'text': 'Western tradition has always valued social intelligence above logical ability.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 4, 'question_type': 'tfng', 'group_id': 2,
     'text': 'Sternberg believes practical intelligence is poorly captured by standard IQ tests.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'True'},
    {'order': 5, 'question_type': 'tfng', 'group_id': 2,
     'text': "Gardner's model includes at least seven intelligences.",
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'True'},
    {'order': 6, 'question_type': 'fill', 'group_id': 3,
     'instruction': 'Write NO MORE THAN TWO WORDS.',
     'text': 'Spearman argued for a ________ factor underlying all intellectual tasks.',
     'correct_answer': 'general',
     'acceptable_answers': ['general (g)', 'g']},
    {'order': 7, 'question_type': 'fill', 'group_id': 3,
     'text': 'Standardised tests often reflect the values of their ________.',
     'correct_answer': 'designers',
     'acceptable_answers': ['designer']},
    {'order': 8, 'question_type': 'matching', 'group_id': 4,
     'instruction': 'Match each theorist to their theory.',
     'text': 'Spearman',
     'options': ['Triarchic theory', 'Multiple intelligences',
                 'General factor (g)', 'Practical reasoning'],
     'correct_answer': 'General factor (g)'},
    {'order': 9, 'question_type': 'matching', 'group_id': 4,
     'text': 'Gardner',
     'options': ['Triarchic theory', 'Multiple intelligences',
                 'General factor (g)', 'Practical reasoning'],
     'correct_answer': 'Multiple intelligences'},
    {'order': 10, 'question_type': 'matching', 'group_id': 4,
     'text': 'Sternberg',
     'options': ['Triarchic theory', 'Multiple intelligences',
                 'General factor (g)', 'Practical reasoning'],
     'correct_answer': 'Triarchic theory'},
]


READING_2_PASSAGE = """
The Lost Art of Letter Writing

Before instant messaging and email, the personal letter served as both a
practical means of communication and an intimate art form. Across the
seventeenth and eighteenth centuries, written correspondence flourished
in Europe, with educated people exchanging dozens of letters every week.
Postal reform in nineteenth-century Britain, when Rowland Hill
introduced the Penny Post in 1840, made letters affordable for ordinary
households for the first time, and the volume of personal mail
increased dramatically.

Historians studying these archives note that letters of the period
follow elaborate conventions of address and farewell. Friends would
sign off "Your affectionate servant"; lovers concealed their feelings
beneath formal phrases. The slow rhythm of correspondence — sometimes
weeks between letter and reply — encouraged careful drafting. Writers
would often produce a fair copy after a rough draft, mindful that their
words would be reread, perhaps shared aloud at family gatherings, and
ultimately preserved.

Today, scholars worry that the disappearance of personal letters means
losing a rich source of biographical and social evidence. Emails are
rarely archived; text messages vanish entirely. Some literary
biographers have responded by mining surviving postcards or even social
media posts, although the latter rarely match the depth of nineteenth-
century correspondence. Nonetheless, a small revival is underway:
writing workshops promote handwritten letters as a meditative practice,
and stationery shops report rising sales of fountain pens and
high-quality paper.
""".strip()

READING_2_QUESTIONS = [
    {'order': 1, 'question_type': 'matching', 'group_id': 1,
     'instruction': 'Which paragraph contains the following information? Choose A, B or C.',
     'text': 'A reference to a specific historical postal reform',
     'options': ['Paragraph A', 'Paragraph B', 'Paragraph C'],
     'correct_answer': 'Paragraph A'},
    {'order': 2, 'question_type': 'matching', 'group_id': 1,
     'text': 'A description of typical letter conventions',
     'options': ['Paragraph A', 'Paragraph B', 'Paragraph C'],
     'correct_answer': 'Paragraph B'},
    {'order': 3, 'question_type': 'matching', 'group_id': 1,
     'text': 'A modern revival of letter-writing as a hobby',
     'options': ['Paragraph A', 'Paragraph B', 'Paragraph C'],
     'correct_answer': 'Paragraph C'},
    {'order': 4, 'question_type': 'tfng', 'group_id': 2,
     'instruction': 'Choose TRUE, FALSE or NOT GIVEN.',
     'text': 'The Penny Post was introduced in 1840.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'True'},
    {'order': 5, 'question_type': 'tfng', 'group_id': 2,
     'text': 'Most eighteenth-century writers exchanged about one letter per month.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 6, 'question_type': 'tfng', 'group_id': 2,
     'text': 'Lovers in the period openly expressed their feelings in letters.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 7, 'question_type': 'tfng', 'group_id': 2,
     'text': 'Modern biographers find social media posts as informative as old letters.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 8, 'question_type': 'fill', 'group_id': 3,
     'instruction': 'Complete the summary. Write ONE WORD only.',
     'text': 'Writers often prepared a fair copy after a ________ draft.',
     'correct_answer': 'rough'},
    {'order': 9, 'question_type': 'fill', 'group_id': 3,
     'text': 'Letters were sometimes shared aloud at family ________.',
     'correct_answer': 'gatherings',
     'acceptable_answers': ['gathering']},
    {'order': 10, 'question_type': 'fill', 'group_id': 3,
     'text': 'Stationery shops report increasing sales of fountain ________.',
     'correct_answer': 'pens',
     'acceptable_answers': ['pen']},
]


READING_3_PASSAGE = """
Climate Change and Migration

Anthropogenic climate change is reshaping where people choose, and are
forced, to live. The most visible movements are the result of sudden
disasters — floods, hurricanes, droughts — but a quieter, longer-term
displacement is driven by gradual environmental degradation. Coastal
erosion in West Africa, salinisation of farmland in Bangladesh, and
desertification in the Sahel have all triggered migration that, while
rarely featured in international media, accounts for the majority of
climate-related movement worldwide.

Researchers distinguish between internal and cross-border climate
migration. The vast majority — perhaps 90% — of those displaced by
environmental factors remain within their own country, often relocating
from rural areas to peripheral urban settlements. Cross-border movement
tends to follow established economic migration corridors and is rarely
formally classified as climate-related, even when environmental stress
is the underlying trigger.

Policy responses lag well behind the reality. International law does
not recognise "climate refugees" as a protected category, leaving
displaced people to navigate immigration systems that were not designed
with environmental drivers in mind. Some nations, particularly small
island states, have begun to negotiate planned relocation programmes
for entire communities, but these arrangements remain rare. Many
analysts argue that adaptation in place — through irrigation systems,
sea defences and crop diversification — must complement managed
migration if humanitarian outcomes are to improve.
""".strip()

READING_3_QUESTIONS = [
    {'order': 1, 'question_type': 'mcq', 'group_id': 1,
     'instruction': 'Choose the correct answer A, B, C or D.',
     'text': 'Most climate-related migration globally is driven by:',
     'options': ['Sudden disasters such as hurricanes',
                 'Long-term environmental degradation',
                 'Political instability',
                 'Economic opportunity'],
     'correct_answer': 'Long-term environmental degradation'},
    {'order': 2, 'question_type': 'mcq', 'group_id': 1,
     'text': 'Approximately what proportion of climate-displaced people remain within their own country?',
     'options': ['Around 50%', 'Around 70%', 'About 90%', 'Less than 10%'],
     'correct_answer': 'About 90%'},
    {'order': 3, 'question_type': 'mcq', 'group_id': 1,
     'text': 'According to the passage, which of the following is NOT mentioned as a climate-related cause of migration?',
     'options': ['Coastal erosion', 'Salinisation', 'Desertification', 'Air pollution'],
     'correct_answer': 'Air pollution'},
    {'order': 4, 'question_type': 'tfng', 'group_id': 2,
     'instruction': 'Choose TRUE, FALSE or NOT GIVEN.',
     'text': 'International law currently classifies climate refugees as a protected group.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 5, 'question_type': 'tfng', 'group_id': 2,
     'text': 'Some small island states have started planned relocation programmes.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'True'},
    {'order': 6, 'question_type': 'tfng', 'group_id': 2,
     'text': 'Cross-border climate migration is widely covered by the international media.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 7, 'question_type': 'fill', 'group_id': 3,
     'instruction': 'Complete the summary. Write NO MORE THAN TWO WORDS.',
     'text': 'Policy makers should combine planned migration with adaptation through irrigation, sea defences and crop ________.',
     'correct_answer': 'diversification'},
    {'order': 8, 'question_type': 'fill', 'group_id': 3,
     'text': 'In Bangladesh, agricultural land is affected by ________.',
     'correct_answer': 'salinisation',
     'acceptable_answers': ['salinization']},
    {'order': 9, 'question_type': 'fill', 'group_id': 3,
     'text': 'Internal migrants often move from rural areas to peripheral ________ settlements.',
     'correct_answer': 'urban'},
    {'order': 10, 'question_type': 'fill', 'group_id': 3,
     'text': 'Adaptation strategies need to ________ managed migration.',
     'correct_answer': 'complement'},
]


READING_4_PASSAGE = """
The Origins of Coffee

A. The cultivation of coffee began on the Ethiopian highlands, where
the wild Coffea arabica plant grew naturally in forested upland regions
above 1,500 metres. Local Oromo people had long chewed the berries
mixed with animal fat, but it was Sufi monks in fifteenth-century Yemen
who transformed coffee into a brewed beverage. Roasting and grinding
the beans produced a stimulant that helped them stay awake during long
nightly devotions, and the practice quickly spread among the
intellectual circles of Mecca and Cairo.

B. By the sixteenth century, Ottoman authorities had attempted, with
limited success, to ban coffee houses, suspecting that the gatherings
inspired political dissent. Despite the prohibitions, the houses
flourished as informal forums for poetry, business and gossip.
European merchants, encountering coffee in Constantinople, carried it
to Venice and then to London. The first English coffee house opened
in Oxford in 1650, and within decades hundreds had opened across the
capital, where they came to be known as "penny universities" because a
single coin bought admission to lively conversation.

C. Today, three quarters of the world's coffee is produced in just six
countries, with Brazil alone accounting for around a third of global
output. Yet smallholder farmers — often working plots of fewer than
five hectares — supply most of the world's specialty arabica. As
climate change disrupts traditional growing belts, researchers are
turning back to forgotten species such as Coffea stenophylla, once
abandoned for its lower yield, in the hope of breeding more
heat-tolerant varieties.
""".strip()

READING_4_QUESTIONS = [
    {'order': 1, 'question_type': 'matching', 'group_id': 1,
     'instruction': 'Match each heading to the correct paragraph.',
     'text': 'Paragraph A',
     'options': ['Modern coffee economics',
                 'Origins and early religious use',
                 'Spread to Europe and coffee house culture'],
     'correct_answer': 'Origins and early religious use'},
    {'order': 2, 'question_type': 'matching', 'group_id': 1,
     'text': 'Paragraph B',
     'options': ['Modern coffee economics',
                 'Origins and early religious use',
                 'Spread to Europe and coffee house culture'],
     'correct_answer': 'Spread to Europe and coffee house culture'},
    {'order': 3, 'question_type': 'matching', 'group_id': 1,
     'text': 'Paragraph C',
     'options': ['Modern coffee economics',
                 'Origins and early religious use',
                 'Spread to Europe and coffee house culture'],
     'correct_answer': 'Modern coffee economics'},
    {'order': 4, 'question_type': 'tfng', 'group_id': 2,
     'instruction': 'Choose TRUE, FALSE or NOT GIVEN.',
     'text': 'Coffea arabica originally grew at altitudes below 1,500 metres.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 5, 'question_type': 'tfng', 'group_id': 2,
     'text': 'Yemeni Sufis prepared coffee as a brewed drink.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'True'},
    {'order': 6, 'question_type': 'tfng', 'group_id': 2,
     'text': 'Ottoman bans on coffee houses were entirely successful.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 7, 'question_type': 'tfng', 'group_id': 2,
     'text': 'Coffea stenophylla produces a higher yield than arabica.',
     'options': ['True', 'False', 'Not Given'],
     'correct_answer': 'False'},
    {'order': 8, 'question_type': 'mcq', 'group_id': 3,
     'instruction': 'Choose the correct answer A, B, C or D.',
     'text': 'English coffee houses were nicknamed "penny universities" because:',
     'options': ['Universities charged one penny',
                 'Lectures were given for a penny',
                 'A single coin bought entry to lively conversation',
                 'They were free for students'],
     'correct_answer': 'A single coin bought entry to lively conversation'},
    {'order': 9, 'question_type': 'mcq', 'group_id': 3,
     'text': 'Brazil produces approximately what share of global coffee?',
     'options': ['One tenth', 'One quarter', 'One third', 'One half'],
     'correct_answer': 'One third'},
    {'order': 10, 'question_type': 'mcq', 'group_id': 3,
     'text': 'Researchers are revisiting Coffea stenophylla mainly because of:',
     'options': ['Its higher yield',
                 'Its heat tolerance',
                 'Its caffeine content',
                 'Its disease resistance'],
     'correct_answer': 'Its heat tolerance'},
]


# ============================================================
# LISTENING — 4 tests, 10 questions each (40 total)
# ============================================================

LISTENING_1_TRANSCRIPT = """
You will hear a phone conversation between Adam, a new resident, and
Sara, the receptionist at South City Cycling Club. Adam wants to join
the club. He gives his full name as Adam Brown and his current address
as 47 Miller Street. The receptionist confirms the postcode SW9 4PT and
notes his mobile number, 07946 522389.

Adam asks about training sessions. Sara explains that the most popular
group ride takes place on Saturday mornings, leaving from the clubhouse
at 8 a.m. Beginner sessions run on Wednesday evenings. Adam decides to
sign up for the annual membership at £180 per year because he plans to
ride at least twice a week. He chooses to pay by direct debit. The
session leader for new members is Mark Bennett, who can be contacted on
extension 142.
""".strip()

LISTENING_1_QUESTIONS = [
    {'order': 1, 'question_type': 'fill', 'group_id': 1,
     'instruction': 'Write ONE WORD AND/OR A NUMBER.',
     'text': 'Name: Adam ________',
     'correct_answer': 'Brown', 'acceptable_answers': ['brown']},
    {'order': 2, 'question_type': 'fill', 'group_id': 1,
     'text': 'Address: ________ Street',
     'correct_answer': 'Miller', 'acceptable_answers': ['miller']},
    {'order': 3, 'question_type': 'fill', 'group_id': 1,
     'text': 'Postcode: ________',
     'correct_answer': 'SW9 4PT', 'acceptable_answers': ['sw94pt', 'sw9 4pt']},
    {'order': 4, 'question_type': 'fill', 'group_id': 1,
     'text': 'Telephone: 07946 ________',
     'correct_answer': '522389'},
    {'order': 5, 'question_type': 'fill', 'group_id': 1,
     'text': 'Most popular group ride day: ________',
     'correct_answer': 'Saturday', 'acceptable_answers': ['sat']},
    {'order': 6, 'question_type': 'mcq', 'group_id': 2,
     'instruction': 'Choose the correct letter A, B or C.',
     'text': 'Which membership type does Adam choose?',
     'options': ['Monthly', 'Annual', 'Student'],
     'correct_answer': 'Annual'},
    {'order': 7, 'question_type': 'mcq', 'group_id': 2,
     'text': 'How does Adam plan to pay?',
     'options': ['Cash at the desk', 'Credit card', 'Direct debit'],
     'correct_answer': 'Direct debit'},
    {'order': 8, 'question_type': 'fill', 'group_id': 3,
     'text': 'Annual membership price: £________',
     'correct_answer': '180'},
    {'order': 9, 'question_type': 'fill', 'group_id': 3,
     'text': 'Beginner sessions take place on ________ evenings.',
     'correct_answer': 'Wednesday', 'acceptable_answers': ['wed']},
    {'order': 10, 'question_type': 'fill', 'group_id': 3,
     'text': 'Session leader extension: ________',
     'correct_answer': '142'},
]


LISTENING_2_TRANSCRIPT = """
You will hear a telephone conversation between a customer, Mr Ali, and a
hotel receptionist who is taking a booking enquiry. Mr Ali wants to
reserve a double room for two nights, arriving on the 15th of October.
The receptionist explains that a standard double costs £95 per night,
while a superior room with a sea view is £130. Breakfast is included.

Mr Ali asks about parking. The receptionist tells him that on-site
parking is free for guests. The hotel is located on Queen's Avenue,
opposite the cinema, and the nearest tube station, Lancaster Gate, is
about a five-minute walk away. The leisure centre, with a swimming pool
and sauna, is on the second floor. The breakfast room is on the ground
floor next to the main lobby. The receptionist mentions that the chef
will need to know about any dietary requirements; Mr Ali confirms he is
vegetarian and would prefer a low-salt menu where possible.
""".strip()

LISTENING_2_QUESTIONS = [
    {'order': 1, 'question_type': 'fill', 'group_id': 1,
     'instruction': 'Complete the booking form. Write ONE WORD AND/OR A NUMBER.',
     'text': 'Room type: ________',
     'correct_answer': 'double'},
    {'order': 2, 'question_type': 'fill', 'group_id': 1,
     'text': 'Number of nights: ________',
     'correct_answer': '2', 'acceptable_answers': ['two']},
    {'order': 3, 'question_type': 'fill', 'group_id': 1,
     'text': 'Arrival date: ________ October',
     'correct_answer': '15', 'acceptable_answers': ['15th', 'fifteenth']},
    {'order': 4, 'question_type': 'fill', 'group_id': 1,
     'text': 'Standard room price per night: £________',
     'correct_answer': '95'},
    {'order': 5, 'question_type': 'fill', 'group_id': 1,
     'text': 'Sea-view room price: £________',
     'correct_answer': '130'},
    {'order': 6, 'question_type': 'mcq', 'group_id': 2,
     'instruction': 'Choose the correct letter A, B or C.',
     'text': 'On-site parking is:',
     'options': ['Charged at £10 per day', 'Free for guests', 'Unavailable'],
     'correct_answer': 'Free for guests'},
    {'order': 7, 'question_type': 'mcq', 'group_id': 2,
     'text': 'Mr Ali requests a menu that is:',
     'options': ['Low-salt and vegetarian', 'Gluten-free', 'Halal'],
     'correct_answer': 'Low-salt and vegetarian'},
    {'order': 8, 'question_type': 'matching', 'group_id': 3,
     'instruction': 'Where in the hotel can each facility be found?',
     'text': 'Leisure centre',
     'options': ['Ground floor', 'Second floor', 'Third floor', 'Basement'],
     'correct_answer': 'Second floor'},
    {'order': 9, 'question_type': 'matching', 'group_id': 3,
     'text': 'Breakfast room',
     'options': ['Ground floor', 'Second floor', 'Third floor', 'Basement'],
     'correct_answer': 'Ground floor'},
    {'order': 10, 'question_type': 'fill', 'group_id': 4,
     'text': 'Nearest tube station: ________ Gate',
     'correct_answer': 'Lancaster'},
]


LISTENING_3_TRANSCRIPT = """
You will hear a tour given by Maria, a senior librarian, to a group of
new postgraduate students arriving at the university library.

"Welcome to Central Library. Let me give you a quick orientation. As
you walk in, the help desk is on your left. Behind it, you'll find the
journals and periodicals section. The reference collection — including
all law books, you cannot borrow these — is on the second floor. Group
study rooms must be booked online, and the silent reading area is on
the top floor, the fourth.

You'll receive a library card valid for three years. To borrow books,
simply tap your card on the self-service kiosks near the main entrance.
The standard loan period is 28 days for postgraduates, and you may have
up to 25 items at a time. The fine for overdue books is 20 pence per day.

If you need help with academic searches, drop by the research support
desk on Tuesday or Thursday afternoons between 2 and 4 p.m. Finally,
please remember that the cafe on the ground floor closes at 9 p.m. on
weekdays."
""".strip()

LISTENING_3_QUESTIONS = [
    {'order': 1, 'question_type': 'matching', 'group_id': 1,
     'instruction': 'Where in the library is each facility?',
     'text': 'Help desk',
     'options': ['Ground floor — left of entrance',
                 'Second floor — reference',
                 'Fourth floor — silent reading',
                 'Online booking only'],
     'correct_answer': 'Ground floor — left of entrance'},
    {'order': 2, 'question_type': 'matching', 'group_id': 1,
     'text': 'Reference collection',
     'options': ['Ground floor — left of entrance',
                 'Second floor — reference',
                 'Fourth floor — silent reading',
                 'Online booking only'],
     'correct_answer': 'Second floor — reference'},
    {'order': 3, 'question_type': 'matching', 'group_id': 1,
     'text': 'Silent reading area',
     'options': ['Ground floor — left of entrance',
                 'Second floor — reference',
                 'Fourth floor — silent reading',
                 'Online booking only'],
     'correct_answer': 'Fourth floor — silent reading'},
    {'order': 4, 'question_type': 'matching', 'group_id': 1,
     'text': 'Group study rooms',
     'options': ['Ground floor — left of entrance',
                 'Second floor — reference',
                 'Fourth floor — silent reading',
                 'Online booking only'],
     'correct_answer': 'Online booking only'},
    {'order': 5, 'question_type': 'fill', 'group_id': 2,
     'instruction': 'Write ONE WORD AND/OR A NUMBER.',
     'text': 'Library card validity: ________ years',
     'correct_answer': '3', 'acceptable_answers': ['three']},
    {'order': 6, 'question_type': 'fill', 'group_id': 2,
     'text': 'Loan period for postgraduates: ________ days',
     'correct_answer': '28'},
    {'order': 7, 'question_type': 'fill', 'group_id': 2,
     'text': 'Maximum items on loan: ________',
     'correct_answer': '25'},
    {'order': 8, 'question_type': 'fill', 'group_id': 2,
     'text': 'Daily fine: ________ pence',
     'correct_answer': '20'},
    {'order': 9, 'question_type': 'mcq', 'group_id': 3,
     'instruction': 'Choose the correct letter A, B or C.',
     'text': 'Research support desk hours:',
     'options': ['Mondays 2-4 pm', 'Tuesdays and Thursdays 2-4 pm',
                 'Every weekday afternoon'],
     'correct_answer': 'Tuesdays and Thursdays 2-4 pm'},
    {'order': 10, 'question_type': 'mcq', 'group_id': 3,
     'text': 'The cafe on weekdays closes at:',
     'options': ['8 p.m.', '9 p.m.', '10 p.m.'],
     'correct_answer': '9 p.m.'},
]


LISTENING_4_TRANSCRIPT = """
You will hear part of a job interview at TechCorp. The interviewer,
Janet, asks the candidate, Daniel, about his background.

Daniel explains that he graduated from Manchester University in 2022
with a degree in Computer Science. After graduation he worked for two
years at a startup called Brightline, where he led a team of four
engineers building a logistics platform. He left to look for a more
research-oriented role.

Janet describes the position. The team currently has eight engineers,
and they are looking for a senior backend developer. The salary range
is £62,000 to £78,000 depending on experience, with an annual bonus of
up to 12 per cent. Working hours are flexible — three days in the
office on Tuesday, Wednesday and Thursday, and two days remote. The
office is at 24 Hampton Street, near Liverpool Street station.

Daniel asks about training. Janet says new starters receive a budget
of £1,500 per year for conferences and online courses. Probation lasts
six months, after which a permanent contract is offered to those who
meet objectives.
""".strip()

LISTENING_4_QUESTIONS = [
    {'order': 1, 'question_type': 'fill', 'group_id': 1,
     'instruction': 'Write ONE WORD AND/OR A NUMBER.',
     'text': 'Daniel graduated from ________ University.',
     'correct_answer': 'Manchester'},
    {'order': 2, 'question_type': 'fill', 'group_id': 1,
     'text': 'Year of graduation: ________',
     'correct_answer': '2022'},
    {'order': 3, 'question_type': 'fill', 'group_id': 1,
     'text': 'Previous employer: ________',
     'correct_answer': 'Brightline'},
    {'order': 4, 'question_type': 'fill', 'group_id': 1,
     'text': 'Number of engineers Daniel led: ________',
     'correct_answer': '4', 'acceptable_answers': ['four']},
    {'order': 5, 'question_type': 'mcq', 'group_id': 2,
     'instruction': 'Choose the correct letter A, B or C.',
     'text': 'The role being offered is:',
     'options': ['Junior frontend developer',
                 'Senior backend developer',
                 'Engineering manager'],
     'correct_answer': 'Senior backend developer'},
    {'order': 6, 'question_type': 'mcq', 'group_id': 2,
     'text': 'Office days are:',
     'options': ['Mon-Wed-Fri', 'Tue-Wed-Thu', 'Every weekday'],
     'correct_answer': 'Tue-Wed-Thu'},
    {'order': 7, 'question_type': 'mcq', 'group_id': 2,
     'text': 'Probation lasts:',
     'options': ['Three months', 'Six months', 'Twelve months'],
     'correct_answer': 'Six months'},
    {'order': 8, 'question_type': 'fill', 'group_id': 3,
     'text': 'Top of salary range: £________',
     'correct_answer': '78000', 'acceptable_answers': ['78,000', '78 000']},
    {'order': 9, 'question_type': 'fill', 'group_id': 3,
     'text': 'Annual bonus up to ________%',
     'correct_answer': '12'},
    {'order': 10, 'function': 'fill', 'question_type': 'fill', 'group_id': 3,
     'text': 'Training budget per year: £________',
     'correct_answer': '1500', 'acceptable_answers': ['1,500']},
]


# ============================================================
# WRITING — 1 task (kept from previous seed)
# ============================================================

WRITING_1_PROMPT = (
    'The chart below shows the monthly earnings of three small bakeries '
    'in a London neighbourhood over the course of 2025.\n\n'
    'Summarise the information by selecting and reporting the main '
    'features, and make comparisons where relevant.\n\n'
    'Write at least 150 words.'
)


# ============================================================
# Command
# ============================================================

class Command(BaseCommand):
    help = 'Seed the database with prototype IELTS tests (Reading + Listening + Writing).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fresh', action='store_true',
            help='Delete ALL existing tests before seeding.',
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        if opts.get('fresh'):
            count = Test.objects.count()
            Test.objects.all().delete()
            self.stdout.write(self.style.WARNING(
                f'--fresh: deleted {count} existing test(s).'))

        # Always remove any with the seed names so re-runs are idempotent
        Test.objects.filter(name__in=[
            'The Concept of Intelligence',
            'The Lost Art of Letter Writing',
            'Climate Change and Migration',
            'The Origins of Coffee',
            'South City Cycling Club',
            'Hotel Booking Inquiry',
            'University Library Tour',
            'Job Interview at TechCorp',
            'Bakery Earnings Chart',
        ]).delete()

        # 4 reading: beginner / intermediate / advanced / expert
        self._make_reading_test('The Origins of Coffee', 20, 'beginner',
                                READING_4_PASSAGE, READING_4_QUESTIONS,
                                'Academic Reading — heading matching + T/F/NG + MCQ.')
        self._make_reading_test('The Concept of Intelligence', 20, 'intermediate',
                                READING_1_PASSAGE, READING_1_QUESTIONS,
                                'Academic Reading — Passage 1, 10 questions.')
        self._make_reading_test('The Lost Art of Letter Writing', 20, 'intermediate',
                                READING_2_PASSAGE, READING_2_QUESTIONS,
                                'Academic Reading — paragraph matching + T/F/NG + completion.')
        self._make_reading_test('Climate Change and Migration', 20, 'advanced',
                                READING_3_PASSAGE, READING_3_QUESTIONS,
                                'Academic Reading — MCQ + summary completion.')

        self._make_listening_test('South City Cycling Club', 10, 'beginner',
                                  LISTENING_1_TRANSCRIPT, LISTENING_1_QUESTIONS,
                                  'Listening Section 1 — form completion.')
        self._make_listening_test('Hotel Booking Inquiry', 10, 'beginner',
                                  LISTENING_2_TRANSCRIPT, LISTENING_2_QUESTIONS,
                                  'Listening Section 1 — note completion + map.')
        self._make_listening_test('University Library Tour', 10, 'intermediate',
                                  LISTENING_3_TRANSCRIPT, LISTENING_3_QUESTIONS,
                                  'Listening Section 2 — labelling + MCQ.')
        self._make_listening_test('Job Interview at TechCorp', 10, 'advanced',
                                  LISTENING_4_TRANSCRIPT, LISTENING_4_QUESTIONS,
                                  'Listening Section 3 — fill blanks + MCQ.')

        # Writing
        writing = Test.objects.create(
            name='Bakery Earnings Chart',
            module='writing', test_type='academic',
            difficulty='intermediate', duration_minutes=20,
            description='Academic Writing Task 1 — describe a line chart in at least 150 words.',
            is_published=True,
        )
        Passage.objects.create(
            test=writing, part_number=1,
            title='Writing Task 1', content=WRITING_1_PROMPT,
            min_words=150, order=1,
        )
        self.stdout.write(self.style.SUCCESS(
            f'Writing: {writing.name} — Task 1 (AI grading Phase 2)'))

        # --- Teacher account + assign to existing student ---
        teacher_phone = '+998900000001'
        teacher, t_created = User.objects.update_or_create(
            phone=teacher_phone,
            defaults={
                'first_name': 'Aziz', 'last_name': 'Karimov',
                'role': 'teacher', 'is_staff': False, 'is_active': True,
            },
        )
        teacher.set_password('teacher123')
        teacher.save()
        self.stdout.write(self.style.SUCCESS(
            f'Teacher: {teacher.phone} (Aziz Karimov) — '
            f'{"created" if t_created else "updated"}'))

        # Auto-assign teacher to a known student if exists
        student = User.objects.filter(phone='+998901234567').first()
        if student and student.role == 'student':
            student.teacher = teacher
            student.save(update_fields=['teacher'])

        # --- 5 demo students with attempts and 1 pending writing each ---
        DEMO_STUDENTS = [
            ('+998901111111', 'Dilnoza',  'Rashidova',  Decimal('7.0')),
            ('+998902222222', 'Sardor',   'Karimov',    Decimal('6.5')),
            ('+998903333333', 'Nilufar',  'Yusupova',   Decimal('8.0')),
            ('+998904444444', 'Bobur',    'Aliev',      Decimal('6.0')),
            ('+998905555555', 'Ziyoda',   'Tursunova',  Decimal('7.5')),
        ]
        reading_tests = list(Test.objects.filter(module='reading'))
        listening_tests = list(Test.objects.filter(module='listening'))
        writing_test = Test.objects.filter(module='writing').first()

        rng = random.Random(42)
        for phone, fn, ln, target in DEMO_STUDENTS:
            user, _ = User.objects.update_or_create(
                phone=phone,
                defaults={
                    'first_name': fn, 'last_name': ln,
                    'role': 'student', 'is_active': True,
                    'target_band': target, 'language': 'uz',
                    'teacher': teacher,
                },
            )
            user.set_password('pass1234')
            user.save()
            # Clear old fake attempts for this user
            Attempt.objects.filter(user=user).delete()

            # 2–3 graded attempts (reading/listening only — writing has separate flow)
            for _ in range(rng.randint(2, 3)):
                pool = reading_tests + listening_tests
                t = rng.choice(pool)
                # 10 questions in each seeded test
                total = 10
                # Bias raw_score toward target (+/- 2)
                target_raw = max(0, min(total, int(round(float(target) * total / 9))))
                raw = max(0, min(total, target_raw + rng.randint(-2, 2)))
                started = timezone.now() - timedelta(days=rng.randint(1, 30))
                a = Attempt.objects.create(
                    user=user, test=t, status='graded',
                    raw_score=raw, total_questions=total,
                    band_score=Decimal(str(round(min(9, max(0, raw * 0.9 + 0.5)) * 2) / 2)),
                    submitted_at=started + timedelta(minutes=rng.randint(15, 50)),
                )
                Attempt.objects.filter(pk=a.pk).update(started_at=started)

            # 1 pending writing
            if writing_test:
                a = Attempt.objects.create(
                    user=user, test=writing_test, status='submitted',
                    essay_text=(
                        f'The chart shows monthly bakery earnings. {fn} would describe '
                        'overall trends and key comparisons here. Bakery A had the '
                        'highest earnings throughout the year while Bakery C remained '
                        'lowest. There was a noticeable peak in July before settling '
                        'back to mid-range values by October.'
                    ),
                    word_count=52,
                    submitted_at=timezone.now() - timedelta(days=rng.randint(1, 5)),
                )
                WritingSubmission.objects.create(
                    attempt=a,
                    essay_text=a.essay_text,
                    word_count=a.word_count,
                    status='pending',
                )

        self.stdout.write(self.style.SUCCESS(
            f'Demo students: {len(DEMO_STUDENTS)} ta yaratildi (har biri 2–3 graded + 1 pending writing)'))

        self.stdout.write(self.style.SUCCESS('=== Seed complete ==='))
        total_q = Question.objects.count()
        self.stdout.write(self.style.SUCCESS(
            f'Total: {Test.objects.count()} tests, {total_q} questions'))

    def _make_reading_test(self, name, duration, difficulty, passage, questions, desc):
        t = Test.objects.create(
            name=name, module='reading', test_type='academic',
            difficulty=difficulty, duration_minutes=duration,
            description=desc, is_published=True,
        )
        p = Passage.objects.create(
            test=t, part_number=1, title=name, content=passage, order=1,
        )
        for q in questions:
            q = {k: v for k, v in q.items() if k != 'function'}
            Question.objects.create(passage=p, **q)
        self.stdout.write(self.style.SUCCESS(
            f'Reading: {name} — {len(questions)} questions'))

    def _make_listening_test(self, name, duration, difficulty, transcript, questions, desc):
        t = Test.objects.create(
            name=name, module='listening', test_type='academic',
            difficulty=difficulty, duration_minutes=duration,
            description=desc, is_published=True,
        )
        p = Passage.objects.create(
            test=t, part_number=1, title=name, content=transcript, order=1,
        )
        for q in questions:
            q = {k: v for k, v in q.items() if k != 'function'}
            Question.objects.create(passage=p, **q)
        self.stdout.write(self.style.SUCCESS(
            f'Listening: {name} — {len(questions)} questions'))
