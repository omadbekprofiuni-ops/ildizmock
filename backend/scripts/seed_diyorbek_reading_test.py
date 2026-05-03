"""Seed: Diyorbek's IELTS — Reading Test (3 passages, 40 questions).

Run from project root:
    cd backend && source venv/bin/activate && python manage.py shell < scripts/seed_diyorbek_reading_test.py
"""

from apps.tests.models import Test, Passage, Question

TEST_NAME = "Diyorbek's IELTS Reading — Test 1"

# Idempotent: remove old copy if exists (global only)
Test.objects.filter(
    name=TEST_NAME, organization__isnull=True, is_global=True,
).delete()

test = Test.objects.create(
    name=TEST_NAME,
    module='reading',
    test_type='academic',
    difficulty='medium',
    duration_minutes=60,
    description='3 ta passage, 40 ta savol. Academic Reading.',
    is_published=True,
    status='published',
    category="Diyorbek's IELTS",
    organization=None,
    is_global=True,
)

# ====================================================================
# PASSAGE 1 — The last man who knew everything
# ====================================================================

P1_TITLE = 'The last man who knew everything'
P1_CONTENT = """In the 21st century, it would be quite impossible for even the most learned man to know everything. However, as recently as the 18th century, there were those whose knowledge encompassed most of the information available at that time. This is a review of a biography of one such man.

Thomas Young (1773–1829) contributed 63 articles to the great British encyclopaedia, Encyclopaedia Britannica, including 46 biographical entries (mostly on scientists and classical scholars), and substantial essays on 'Bridge' (a card game), 'Egypt', 'Languages' and 'Tides'. Was someone who could write authoritatively about so many subjects a genius, or a dilettante? In an ambitious biography, Andrew Robinson argues that Young is a good contender to be described as 'the last man who knew everything'.

Young has competition, however: the phrase which Robinson uses as the title of his biography of Young also serves as the subtitle of two other recent biographies: Leonard Warren's 1998 life of palaeontologist Joseph Leidy (1823–1891) and Paula Findlen's 2004 book on Athanasius Kircher (1602–1680).

Young, of course, did more than write encyclopaedia entries. He presented his first paper, on the human eye, to the prestigious academic institution, the Royal Society of London at the age of 20 and was elected a Fellow of the Society shortly afterwards. In the paper, which seeks to explain how the eye focuses on objects at varying distances, Young hypothesised that this was achieved by changes in the shape of the lens. He also theorised that light travels in waves, and believed that, to be able to see in colour, there must be three receptors in the eye corresponding to the three 'principal colours' (red, green and violet) to which the retina could respond. All these hypotheses were subsequently proved to be correct. Later in his life, when he was in his forties, Young was instrumental in cracking the code that unlocked the unknown script on the Rosetta Stone, a tablet found in Egypt by the Napoleonic army in 1799. The stone has text in three alphabets: Greek, Egyptian hieroglyphs, and something originally unrecognisable. The unrecognisable script is now known as 'demotic' and, as Young deduced, is related directly to Egyptian hieroglyphs. His initial work on this appeared in the Britannica entry 'Egypt'. In another entry, Young coined the term 'Indo-European' to describe the family of languages spoken throughout most of Europe and northern India. These works are the landmark achievements of a man who was a child prodigy but who, unlike many remarkable children, did not fade into obscurity as an adult.

Born in 1773 in Somerset in England, Young lived with his maternal grandfather from an early age. He devoured books from the age of two and excelled at Latin, Greek, mathematics and natural philosophy (the 18th-century term for science). After leaving school, he was greatly encouraged by Richard Brocklesby, a physician and Fellow of the Royal Society. Following Brocklesby's lead, Young decided to pursue a career in medicine. He studied in London and then moved on to more formal education in Edinburgh, Göttingen and Cambridge. After completing his medical training at the University of Cambridge in 1808, Young set up practice as a physician in London and a few years later was appointed physician at St. George's Hospital.

Young's skill as a physician, however, did not equal his talent as a scholar of natural philosophy or linguistics. In 1801, he had been appointed to a professorship of natural philosophy at the Royal Institution, where he delivered as many as 60 lectures a year. His opinions were requested by civic and national authorities on matters such as the introduction of gas lighting to London streets and methods of ship construction. From 1819, he was superintendent of the Nautical Almanac and secretary to the Board of Longitude. Between 1816 and 1825, he contributed many entries to the Encyclopaedia Britannica, and throughout his career he authored numerous other essays, papers and books.

Young is a perfect subject for a biography — perfect, but daunting. Few men contributed so much to so many technical fields. Robinson's aim is to introduce non-scientists to Young's work and life. He succeeds, providing clear expositions of the technical material (especially that on optics and Egyptian hieroglyphs). Some readers of this book will, like Robinson, find Young's accomplishments impressive; others will see him as some historians have — as a dilettante. Yet despite the rich material presented in this book, readers will not end up knowing Young personally. We catch glimpses of a playful Young, doodling Greek and Latin phrases in his notes on medical lectures and translating the verses that a young lady had written on the walls of a summerhouse into Greek elegiacs. Young was introduced into elite society, attended the theatre and learned to dance and play the flute. In addition, he was an accomplished horseman. However, his personal life looks pale next to his vibrant career and studies.

Young married Eliza Maxwell in 1804, and according to Robinson, 'their marriage was happy and she appreciated his work'. Almost all we know about her is that she sustained her husband through some rancorous disputes about optics and that she worried about money when his medical career was slow to take off. Little evidence survives concerning the complexities of Young's relationships with his mother and father. Robinson does not credit them with shaping Young's extraordinary mind. Despite the lack of details concerning Young's relationships, however, anyone interested in what it means to be a genius should read this book."""

p1 = Passage.objects.create(
    test=test, part_number=1, title=P1_TITLE,
    subtitle="In the 21st century, it would be quite impossible for even the most learned man to know everything…",
    content=P1_CONTENT, order=1,
    instructions='You should spend about 20 minutes on Questions 1–13.',
)

# Q1-7 TFNG
TFNG_INSTR = (
    'Do the following statements agree with the information given in Reading '
    'Passage 1?\n\nWrite TRUE if the statement agrees with the information, '
    'FALSE if the statement contradicts the information, NOT GIVEN if there is '
    'no information on this.'
)
P1_TFNG = [
    (1, "Other people have been referred to as 'the last man who knew everything'.", 'TRUE'),
    (2, "The fact that Young's childhood brilliance continued into adulthood was normal.", 'FALSE'),
    (3, "Young's talents as a doctor are described as surpassing his other skills.", 'FALSE'),
    (4, "Young's advice was sought by several bodies responsible for local and national matters.", 'NOT GIVEN'),
    (5, "All Young's written works were published in the Encyclopaedia Britannica.", 'TRUE'),
    (6, 'Young was interested in a range of social pastimes.', 'TRUE'),
    (7, 'Young suffered from poor health in his later years.', 'NOT GIVEN'),
]
for n, txt, ans in P1_TFNG:
    Question.objects.create(
        passage=p1, order=n, question_number=n,
        question_type='tfng', text=txt, prompt=txt,
        options=['TRUE', 'FALSE', 'NOT GIVEN'],
        correct_answer=ans, group_id=1,
        instruction=TFNG_INSTR if n == 1 else '',
    )

# Q8-13 short answer / fill
FILL_INSTR = (
    'Answer the questions below. Choose NO MORE THAN THREE WORDS AND/OR A '
    'NUMBER from the passage for each answer.'
)
P1_FILL = [
    (8,  'How many life stories did Thomas Young write for the Encyclopaedia Britannica?', '46', []),
    (9,  "What was the subject of Thomas Young's first academic paper?",
         'human eye', ['the human eye', 'human eye accommodation']),
    (10, 'What name did Young give to a group of languages?', 'Indo-European', ['Indo European']),
    (11, 'Who inspired Young to enter the medical profession?', 'Richard Brocklesby', []),
    (12, 'At which place of higher learning did Young hold a teaching position?',
         'Royal Institution', ['the Royal Institution']),
    (13, "What was the improvement to London roads on which Young's ideas were sought?",
         'gas lighting', []),
]
for n, txt, ans, alts in P1_FILL:
    Question.objects.create(
        passage=p1, order=n, question_number=n,
        question_type='fill', text=txt, prompt=txt,
        options=[], correct_answer=ans, acceptable_answers=alts,
        alt_answers=alts, group_id=2,
        instruction=FILL_INSTR if n == 8 else '',
    )

# ====================================================================
# PASSAGE 2 — The economic effect of climate
# ====================================================================

P2_CONTENT = """A. Dr William Masters was reading a book about mosquitoes when an idea struck him. 'There was this anecdote about the yellow fever epidemic that hit Philadelphia in 1793.' Masters recalls. 'This epidemic decimated the city until the first frost came.' The sub-zero temperatures froze out the insects, allowing Philadelphia to recover. If weather could be the key to a city's fortunes, Masters thought, then why not to historical fortunes of nations? And could frost lie at the heart of one of the most enduring economic mysteries of all — why are almost all the wealthy, industrialized nations to be found where the climate is cooler?

B. After two years of research, he thinks that he has found a piece of the puzzle. Masters, an agricultural economist from Purdue University in Indiana, and Margaret McMillan at Tufts University, Boston, show that annual frosts are among the factors that distinguish rich nations from poor ones. Their study is published this month in the Journal of Economic Growth. The pair speculate that cold snaps have two main benefits — they freeze pests that would otherwise destroy crops, and also freeze organisms, such as those carried by mosquitoes, that carry disease. The result is agricultural abundance and a big workforce.

C. The academics took two sets of information. The first was average income for countries, the second was climate data provided by the University of East Anglia. They found a curious tally between the sets. Countries having five or more frosty days in the winter months are uniformly rich; those with fewer than five are impoverished. The authors speculate that the five-day figure is important; it could be the minimum time needed to kill pests in the soil. To illustrate this, Masters notes: 'Finland is a small country that is growing quickly, but Bolivia is a small country that isn't growing at all. Perhaps climate has something to do with that.'

D. Other minds have applied themselves to the split between poor and rich nations, citing anthropological, climatic and zoological reasons for why temperate nations are the most affluent. Jared Diamond, from the University of California at Los Angeles, pointed out in his book Guns, Germs and Steel that Eurasia is broadly aligned east-west, while Africa and the Americas are aligned north-south. So in Europe crops could move quickly across latitudes because climates are similar. One of the first domesticated crops, einkorn wheat, extended quickly from the Middle East into Europe; it took twice as long for it to get from Mexico to what is now the eastern United States. This easy movement along similar latitudes in Eurasia would also have meant a faster dissemination of other technologies, such as the wheel and writing, Diamond speculates.

E. There are exceptions to the 'cold equals rich' argument. There are well-heeled tropical countries such as Singapore, a result of its superior trading position. Likewise, not all European countries are moneyed. Masters stresses that climate will never be the overriding factor — the wealth of nations is too complicated to be attributable to just one factor. Climate, he feels, somehow combines with other factors — such as the presence of institutions, including governments, and access to trading routes — to determine whether a country will do well.

F. In the past, Masters says, economists thought that institutions had the biggest effect on the economy, because they brought order to a country in the form of, for example, laws and property rights. With order, so the thinking went, came affluence. 'But there are some problems that even countries with institutions have not been able to get around.' he says. 'My feeling is that, as countries get richer, they get better institutions. And the accumulation of wealth and improvement in governing institutions are both helped by a favourable environment, including climate.'

G. This does not mean, he insists, that tropical countries are beyond economic help and destined to remain penniless. Instead of aid being geared towards improving administrative systems, it should be spent on technology to improve agriculture and to combat disease. Masters cites one example: 'There are regions in India that have been provided with irrigation — agricultural productivity has gone up and there has been an improvement in health.' Supplying vaccines against tropical diseases and developing crop varieties that can grow in the tropics would break the poverty cycle."""

p2 = Passage.objects.create(
    test=test, part_number=2,
    title='The economic effect of climate',
    subtitle="Latitude is crucial to a nation's strength, says Anjana Ahuja",
    content=P2_CONTENT, order=2,
    instructions='You should spend about 20 minutes on Questions 14–26.',
)

# Q14-20 Matching headings
HEADINGS = [
    ('i',    'Level of wealth affected by several other influences besides climate'),
    ('ii',   'The failure of vaccination programmes'),
    ('iii',  'The problems experienced by small countries'),
    ('iv',   'The role of governments in creating wealth'),
    ('v',    'The best use of financial assistance'),
    ('vi',   "The inspiration for Masters's research"),
    ('vii',  'The advantages of cold weather to people and agriculture'),
    ('viii', 'Positive correlations between climate and economy'),
    ('ix',   'Reflecting on the traditional view'),
    ('x',    'Crop spread in Europe and other continents'),
]
HEADINGS_LIST = [f'{r} — {t}' for r, t in HEADINGS]
MH_INSTR = (
    'Reading Passage 2 has seven paragraphs, A–G. Choose the correct heading '
    'for each paragraph from the list of headings below. Write the correct '
    'roman numeral (i–x) in boxes 14–20.'
)
P2_MH = [
    (14, 'Paragraph A', 'vi'),
    (15, 'Paragraph B', 'vii'),
    (16, 'Paragraph C', 'viii'),
    (17, 'Paragraph D', 'x'),
    (18, 'Paragraph E', 'i'),
    (19, 'Paragraph F', 'ix'),
    (20, 'Paragraph G', 'v'),
]
for n, txt, ans in P2_MH:
    Question.objects.create(
        passage=p2, order=n, question_number=n,
        question_type='matching', text=txt, prompt=txt,
        options=HEADINGS_LIST,
        correct_answer=ans, group_id=3,
        instruction=MH_INSTR if n == 14 else '',
    )

# Q21-26 Sentence completion (fill)
SC_INSTR = (
    'Complete the sentences below. Choose NO MORE THAN THREE WORDS from the '
    'passage for each answer.'
)
P2_SC = [
    (21, 'Philadelphia recovered from its ______ when the temperature dropped dramatically.',
         'epidemic', ['Epidemic']),
    (22, '______ is an example of a small country whose economy is expanding.',
         'Finland', ['finland']),
    (23, '______ spread more slowly from Mexico than it did from the Middle East.',
         'einkorn wheat', ['Einkorn Wheat', 'Einkorn wheat']),
    (24, 'Technology spread more quickly in ______ than in Africa.',
         'Eurasia', ['eurasia']),
    (25, '______ is economically rich in spite of its tropical climate.',
         'Singapore', ['singapore']),
    (26, 'Aid should be used to improve agriculture rather than to improve ______.',
         'administrative systems', ['administrative system']),
]
for n, txt, ans, alts in P2_SC:
    Question.objects.create(
        passage=p2, order=n, question_number=n,
        question_type='fill', text=txt, prompt=txt,
        options=[], correct_answer=ans, acceptable_answers=alts,
        alt_answers=alts, group_id=4,
        instruction=SC_INSTR if n == 21 else '',
    )

# ====================================================================
# PASSAGE 3 — Redesigning the Cleveland Museum of Art
# ====================================================================

P3_CONTENT = """Most great art museums have personalities based on the combined effect of their permanent collections and the buildings they occupy and the Cleveland Museum of Art is no exception. The museum's $320 million expansion and renovation project gave the institution a fresh, innovative quality that has gained much attention. And that change, which focuses on social equality, can be summed up in two words: cultural parity.

America's large art museums tend to segregate their collections in self-contained departments, treating art history as a straight-line chronology, grouped by Western notions of scientific and technological progress. They begin with the ancient past and proceed up to the present. At the renovated Cleveland museum, where permanent collection galleries surround a big central atrium, art history now unfolds as a 5,000-year global dialogue among civilizations, without a sense of hierarchy. The museum's new layout emphasizes a sense of balance and connection among global cultures, and especially between Asian and Western art. You can cruise from ancient Greece or medieval France to 16th-century Japan or seventh-century Cambodia with ease, and with the ever-visible atrium in the heart of the museum layout as a useful central point of orientation. The overall message is that all world cultures have something to teach one another. It's a take-away that could be embraced by any lover of art or anyone curious about what it means to be human.

Chronology hasn't vanished, however. Broad sections of the museum, particularly those dealing with Western art inside the museum's renovated 1916 building and its new East Wing, are organized according to both geography and the march of time. But before its renovation and expansion, the museum more or less forced visitors to follow a strict linear framework. Once you started, it was hard to bail out in the middle. Former Director Katharine Lee Reid called the gallery sequence 'the snake', an aptly unattractive description. Cultures or civilizations that fell outside the framework seemed shunted aside. The museum's acclaimed Asian collection, for example, used to occupy galleries on the lower two levels of the 1916 building — areas that felt as if they were cut off in a deep, dark basement.

Today, the ease of moving from one part of the museum to another makes it possible to dip into or out of the flow wherever you like, and to make cross-cultural comparisons. Finding one's way has also been facilitated by the museum's ArtLens mobile app and the 40-foot-long 'Collection Wall', an interactive screen that enables visitors to access audio tours or create their own tour and to transfer the information to their smart phone. By capitalizing on mobile devices, the museum has kept its gallery installations free of explanatory video screens or digital interfaces that would distract from the art on view. The overall philosophy of the museum's gallery installations is to keep things simple, to get out of the way, and to let the art speak for itself.

Designed by architect Rafael Viñoly, the eight-year expansion and renovation increased gallery space by 32 percent, to 133,599 square feet. Roughly the same number of objects are on view now as before the expansion and renovation. The goal of the project was not just to significantly expand the display area within the museum. Jeffrey Strean, the museum's director of design and architecture says, 'We wanted to show approximately the same amount [of art] but give it breathing room.' By virtue of its relatively manageable size and vastly improved interior layout, the Cleveland museum has a clarity and intimacy that might be envied by its larger peers, including the Metropolitan Museum of Art in New York, the Museum of Fine Arts, Boston, and the Philadelphia Museum of Art. The sense of focus in Cleveland stems not just from the museum's new layout but also from the general nature of the permanent collection as an assembly of singular objects selected as examples of their kind. In Cleveland, you can sidle up close to an exquisite fifth-century B.C. Atalanta Lekythos, an ancient Greek olive oil jug that depicts the mythical story of a virgin huntress who promised to marry the man who could outrun her. Display cases at the Metropolitan Museum of Art hold dozens of pieces from the same period as the Cleveland example, but the effect of seeing so many in New York is completely different from seeing a single example, up close, in Cleveland. At a certain point at the Metropolitan Museum of Art, exhaustion sets in.

Individual galleries within the Cleveland museum all have specific hierarchies which guide how their collection is displayed, based on the comparative significance of the works on view. Virtually every gallery is organized around key works of art displayed in centrally located cases or on walls where there is open space to stand back and see the art. These touchstone artworks include Pablo Picasso's seminal Blue Period depiction of human misery, La Vie, on view in the East Wing modern art galleries. On the opposite side of the museum in the West Wing, there's a monumental seventh-century Cambodian statue of the Hindu god Krishna who saved the Earth from a flood by raising a mountain over his head. The prominence accorded to these and other highlights in the collection reinforces the museum's newfound sense of a more equitable depiction of art through the ages. The message is subtle, pervasive and deeply thought-provoking. And in a melting-pot city composed of scores of ethnic immigrant populations from around the world, the museum's new perspective on ethnic inclusion feels right on target."""

p3 = Passage.objects.create(
    test=test, part_number=3,
    title='Redesigning the Cleveland Museum of Art',
    content=P3_CONTENT, order=3,
    instructions='You should spend about 20 minutes on Questions 27–40.',
)

# Q27-30 MCQ
MCQ_INSTR = 'Choose the correct letter, A, B, C or D.'
P3_MCQ = [
    (27,
     'What does the writer suggest about art museums in the first paragraph?',
     [
         'A. The focus of an art museum should be on the culture of its own country.',
         "B. An art museum's permanent collection determines its popularity.",
         "C. The cost of an art museum's renovation often attracts public attention.",
         "D. Both the art and building create an art museum's character.",
     ],
     'D. Both the art and building create an art museum\'s character.'),
    (28,
     'What does the second paragraph say about the display of art in the renovated Cleveland museum?',
     [
         'A. The permanent collection has been given greater prominence.',
         'B. The art is arranged to reflect its international nature.',
         'C. The artworks are organised according to advances in technology.',
         'D. The prominence of the Western art collection has been reduced.',
     ],
     'B. The art is arranged to reflect its international nature.'),
    (29,
     'What are we told about the Cleveland museum before it was renovated?',
     [
         'A. The sequence of displays was confusing for many visitors.',
         'B. Visitors had little choice about the route they took through the building.',
         'C. Many visitors chose to leave the gallery without seeing the whole collection.',
         'D. There was not enough information for visitors about the featured artists.',
     ],
     'B. Visitors had little choice about the route they took through the building.'),
    (30,
     'What does the writer suggest about the use of phones in the museum in paragraph four?',
     [
         'A. Visitors are sometimes distracted by interactive smartphone apps.',
         'B. Large video screens are more distracting than smartphones.',
         'C. More visitors listen to audio guides because they have smartphone apps.',
         'D. Smartphone apps mean less information is displayed near the artworks.',
     ],
     'D. Smartphone apps mean less information is displayed near the artworks.'),
]
for n, txt, opts, ans in P3_MCQ:
    Question.objects.create(
        passage=p3, order=n, question_number=n,
        question_type='mcq', text=txt, prompt=txt,
        options=opts, correct_answer=ans, group_id=5,
        instruction=MCQ_INSTR if n == 27 else '',
    )

# Q31-35 YES/NO/NOT GIVEN
YN_INSTR = (
    'Do the following statements agree with the views of the writer in '
    'Reading Passage 3?\n\nWrite YES if the statement agrees with the views '
    'of the writer, NO if the statement contradicts the views of the writer, '
    'NOT GIVEN if it is impossible to say what the writer thinks about this.'
)
P3_YN = [
    (31, "America's large art collections are generally organised into separate sections according to date.", 'YES'),
    (32, 'The new atrium helps visitors know where they are within the museum.', 'YES'),
    (33, "Katharine Lee Reid's description of the museum before renovation is unfair.", 'NOT GIVEN'),
    (34, 'The Asian collection was more prominent when it was displayed in the 1916 building.', 'NO'),
    (35, 'Rafael Viñoly was employed in order to attract more visitors to the museum.', 'NOT GIVEN'),
]
for n, txt, ans in P3_YN:
    Question.objects.create(
        passage=p3, order=n, question_number=n,
        question_type='ynng', text=txt, prompt=txt,
        options=['YES', 'NO', 'NOT GIVEN'],
        correct_answer=ans, group_id=6,
        instruction=YN_INSTR if n == 31 else '',
    )

# Q36-40 Summary completion (fill from a word bank)
SUMMARY_INSTR = (
    "Complete the summary 'Cleveland's individual galleries' below. Choose "
    'ONE WORD from the passage for each answer.'
)
P3_SUMMARY = [
    (36, 'Individual galleries in the Cleveland museum display their artworks according to their own ______ .',
         'hierarchies', []),
    (37, 'Most galleries display the artworks in areas that allow free movement or they are positioned in the middle of the room. Picasso\'s La Vie is displayed where there is open ______ to stand back and see the art.',
         'space', []),
    (38, "Picasso's La Vie, a study in ______ , is one of the museum's most significant pieces.",
         'misery', []),
    (39, 'Important works such as this and the Cambodian statue of Krishna are displayed in a manner that promotes a more ______ depiction of art through the ages.',
         'equitable', []),
    (40, 'According to the reviewer, the museum accurately reflects ______ in US society.',
         'diversity', []),
]
for n, txt, ans, alts in P3_SUMMARY:
    Question.objects.create(
        passage=p3, order=n, question_number=n,
        question_type='fill', text=txt, prompt=txt,
        options=[], correct_answer=ans, acceptable_answers=alts,
        alt_answers=alts, group_id=7,
        instruction=SUMMARY_INSTR if n == 36 else '',
    )

print(f'OK created test={test.id} name="{test.name}" passages={test.passages.count()}')
for p in test.passages.all().order_by('order'):
    print(f'  - Part {p.part_number}: {p.title}  ({p.questions.count()} questions)')
total = sum(p.questions.count() for p in test.passages.all())
print(f'TOTAL questions: {total}')
