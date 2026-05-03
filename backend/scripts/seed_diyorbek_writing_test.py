"""Seed: Diyorbek's IELTS Writing — Test 1 (April 29). Global test."""

from apps.tests.models import Test, WritingTask, Passage

TEST_NAME = "Diyorbek's IELTS Writing — Test 1 (April 29)"

Test.objects.filter(
    name=TEST_NAME, organization__isnull=True, is_global=True,
).delete()

test = Test.objects.create(
    name=TEST_NAME,
    module='writing',
    test_type='academic',
    difficulty='medium',
    duration_minutes=60,
    description='IELTS Academic Writing — Task 1 (bar chart) + Task 2 (essay).',
    is_published=True,
    status='published',
    category="Diyorbek's IELTS",
    organization=None,
    is_global=True,
)

# ---- Task 1 ----
t1 = WritingTask.objects.create(
    test=test,
    task_number=1,
    prompt=(
        'The bar chart below shows the proportion of the population aged 65 '
        'and over of three countries (Canada, Germany, UK) in 1980 and 2000 '
        'and prediction in 2030.\n\n'
        'Summarise the information by selecting and reporting the main '
        'features, and make comparisons where relevant.\n\n'
        'Write at least 150 words.'
    ),
    min_words=150,
    suggested_minutes=20,
    requirements='Describe the chart, compare the three countries across years.',
)
# Attach the chart image (already copied to media/writing_charts/2026/05/)
t1.chart_image.name = 'writing_charts/2026/05/april29_population_chart.jpg'
t1.save(update_fields=['chart_image'])

# ---- Task 2 ----
t2 = WritingTask.objects.create(
    test=test,
    task_number=2,
    prompt=(
        "In today's world of advanced science and technology, we still greatly "
        'value our artists such as musicians, painters and writers.\n\n'
        'What can art tell us about life that science and technology cannot?\n\n'
        'Give reasons for your answer and include any relevant examples from '
        'your own knowledge or experience.\n\n'
        'Write at least 250 words.'
    ),
    min_words=250,
    suggested_minutes=40,
    requirements='Express and justify your opinion with examples.',
)

# Some flows show writing tasks via Passage model — also create passages for compatibility.
Passage.objects.create(
    test=test, part_number=1, title='Task 1', content=t1.prompt,
    instructions=t1.requirements, min_words=t1.min_words, order=1,
)
Passage.objects.create(
    test=test, part_number=2, title='Task 2', content=t2.prompt,
    instructions=t2.requirements, min_words=t2.min_words, order=2,
)

print(f'OK created test={test.id} name="{test.name}"')
print(f'  Task 1: {t1.task_number} ({t1.min_words} words) chart={t1.chart_image.name}')
print(f'  Task 2: {t2.task_number} ({t2.min_words} words)')
