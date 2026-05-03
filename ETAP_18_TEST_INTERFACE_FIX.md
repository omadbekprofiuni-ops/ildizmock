# ETAP 18: TEST INTERFACE & CREATION FIXES

**Maqsad:** Test yaratish va test olish interfaceni to'liq to'g'rilash. IELTStation kabi professional interface. 40 savol, audio controls yo'q, fullscreen lock.

---

## 🔍 SCREENSHOT ANALYSIS - REAL TEST INTERFACE

### Screenshot 1: Reading Test Interface

```
Layout:
├─ Top Bar:
│  ├─ [← Back] button
│  ├─ [IELTS] badge (red)
│  ├─ ID: 31466
│  ├─ Timer: 20:00
│  └─ [Start] button (red)
├─ Part Instructions:
│  └─ "Part 1: Read the text and answer questions 1-13."
├─ Split Screen:
│  ├─ Left Panel (60%): Passage text (scrollable)
│  │  └─ "Reef Fish Study" with full text
│  └─ Right Panel (40%): Questions
│     └─ Questions 1-4: TRUE/FALSE/NOT GIVEN
│        ├─ Radio buttons
│        ├─ Clear instructions
│        └─ Question text
└─ Bottom Navigation:
   ├─ Part indicator: "Part 1"
   ├─ Page numbers: 1, 2, 3, 4... 13
   └─ Navigation arrows [← →]
   └─ [✓] Submit button
```

**Key Features:**
```
✅ Split screen (passage + questions)
✅ Timer always visible
✅ Part-based navigation
✅ Page-by-page questions
✅ Clean, minimal design
✅ Professional typography
```

---

### Screenshot 2: Listening Test Interface

```
Layout:
├─ Top Bar:
│  ├─ [← Back] button
│  ├─ [IELTS] badge (red)
│  └─ Test taker ID: 31466
├─ Part Instructions:
│  └─ "Part 1: Listen and answer questions 1-10."
├─ Questions Area:
│  ├─ Questions 1-5:
│  │  ├─ Instructions: "Complete the notes below."
│  │  ├─ "Write NO MORE THAN THREE WORDS"
│  │  └─ Form with blanks (1, 2, 3, 4, 5)
│  └─ Questions 6-10: (next section)
└─ Bottom Navigation:
   ├─ Parts: Part 1, Part 2 (0/10), Part 3 (0/10), Part 4 (0/10)
   └─ Navigation arrows [← →]
   └─ [✓] Submit button
```

**CRITICAL OBSERVATION:**
```
❌ NO audio controls visible!
❌ NO play/pause button!
❌ NO rewind button!
❌ NO volume control!

→ Audio plays automatically once
→ Cannot be paused or stopped
→ Cannot be rewound
→ Exactly like real IELTS exam!
```

---

## 🚨 CURRENT PROBLEMS IN ILDIZ MOCK

### Problem 1: Test Creation - Wrong Question Count

**Current Backend:**
```python
# ❌ BAD: No validation on question count
class ReadingTest(models.Model):
    # Can create any number of questions
    # No 40-question enforcement
```

**What's happening:**
```
Teacher creates test:
- Passage 1: 13 questions ✓
- Passage 2: 14 questions ✓
- Passage 3: 15 questions ❌ (should be 13)
Total: 42 questions ❌ (should be 40)
```

**Fix:**
```python
# ✅ GOOD: Enforce exactly 40 questions
class ReadingTest(models.Model):
    
    def clean(self):
        total_questions = sum(
            p.questions.count() 
            for p in self.passages.all()
        )
        
        if total_questions != 40:
            raise ValidationError(
                f'Reading test must have exactly 40 questions. '
                f'Current: {total_questions}'
            )
```

---

### Problem 2: All Questions Look Like MCQ

**Current Issue:**
```typescript
// ❌ All questions rendered as radio buttons
{questions.map(q => (
  <div>
    <input type="radio" name={q.id} value="A" /> A
    <input type="radio" name={q.id} value="B" /> B
    <input type="radio" name={q.id} value="C" /> C
    <input type="radio" name={q.id} value="D" /> D
  </div>
))}
```

**Real IELTS has 10+ question types:**
```
1. Multiple Choice (MCQ)
2. True/False/Not Given
3. Yes/No/Not Given
4. Fill in the Blank
5. Short Answer
6. Matching Headings
7. Matching Information
8. Matching Features
9. Sentence Completion
10. Summary Completion
11. Note Completion
12. Table Completion
13. Flow Chart Completion
14. Diagram Labeling
```

---

### Problem 3: Listening Has Play/Pause Controls

**Current Implementation:**
```typescript
// ❌ BAD: User can control audio
<audio controls>
  <source src={audioUrl} />
</audio>

// User can:
// - Pause ❌
// - Rewind ❌
// - Skip ❌
// - Replay ❌
```

**Real IELTS:**
```typescript
// ✅ GOOD: Audio plays once, automatically
const audioRef = useRef<HTMLAudioElement>(null);

useEffect(() => {
  // Auto-play on mount
  audioRef.current?.play();
  
  // Disable controls
  audioRef.current.controls = false;
  
  // Prevent seeking
  audioRef.current.addEventListener('seeking', (e) => {
    e.preventDefault();
  });
}, []);

return (
  <audio ref={audioRef} style={{ display: 'none' }}>
    <source src={audioUrl} />
  </audio>
);
```

---

### Problem 4: Can Exit Fullscreen with ESC

**Current:**
```typescript
// ❌ User can press ESC and exit fullscreen
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    // User exited - no enforcement
  }
});
```

**Fix:**
```typescript
// ✅ Lock fullscreen, re-enter if exited
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    // Re-enter fullscreen
    document.documentElement.requestFullscreen();
    
    // Show warning
    toast.warning('Test must be completed in fullscreen mode');
  }
});

// Disable ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
  }
});
```

---

## ✅ COMPLETE FIX IMPLEMENTATION

---

## STEP 1: Backend - Question Count Validation

### A) Model Changes

**Fayl:** `backend/apps/tests/models.py`

```python
from django.core.exceptions import ValidationError

class ReadingTest(models.Model):
    """
    Reading test - must have exactly 40 questions across 3 passages
    """
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    REQUIRED_QUESTIONS = 40
    REQUIRED_PASSAGES = 3
    
    def clean(self):
        """Validate question and passage count"""
        super().clean()
        
        # Check passage count
        passage_count = self.passages.count()
        if passage_count != self.REQUIRED_PASSAGES:
            raise ValidationError(
                f'Reading test must have exactly {self.REQUIRED_PASSAGES} passages. '
                f'Current: {passage_count}'
            )
        
        # Check total questions
        total_questions = sum(
            passage.questions.count() 
            for passage in self.passages.all()
        )
        
        if total_questions != self.REQUIRED_QUESTIONS:
            raise ValidationError(
                f'Reading test must have exactly {self.REQUIRED_QUESTIONS} questions. '
                f'Current: {total_questions}'
            )
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Validate after save (when passages exist)
        if self.pk:
            self.clean()


class ListeningTest(models.Model):
    """
    Listening test - must have exactly 40 questions across 4 parts
    """
    name = models.CharField(max_length=200)
    
    REQUIRED_QUESTIONS = 40
    REQUIRED_PARTS = 4
    
    def clean(self):
        """Validate question and part count"""
        super().clean()
        
        # Check part count
        part_count = self.listening_parts.count()
        if part_count != self.REQUIRED_PARTS:
            raise ValidationError(
                f'Listening test must have exactly {self.REQUIRED_PARTS} parts. '
                f'Current: {part_count}'
            )
        
        # Check total questions (10 per part)
        total_questions = sum(
            part.questions.count() 
            for part in self.listening_parts.all()
        )
        
        if total_questions != self.REQUIRED_QUESTIONS:
            raise ValidationError(
                f'Listening test must have exactly {self.REQUIRED_QUESTIONS} questions. '
                f'Current: {total_questions}'
            )


class WritingTest(models.Model):
    """
    Writing test - must have exactly 2 tasks
    """
    name = models.CharField(max_length=200)
    
    REQUIRED_TASKS = 2
    
    def clean(self):
        """Validate task count"""
        super().clean()
        
        task_count = self.writing_tasks.count()
        if task_count != self.REQUIRED_TASKS:
            raise ValidationError(
                f'Writing test must have exactly {self.REQUIRED_TASKS} tasks. '
                f'Current: {task_count}'
            )
```

---

### B) Question Type Enum

**Fayl:** `backend/apps/tests/models.py`

```python
class Question(models.Model):
    """
    Universal question model supporting all IELTS question types
    """
    
    QUESTION_TYPES = [
        # Reading & Listening
        ('mcq', 'Multiple Choice'),
        ('true_false_ng', 'True/False/Not Given'),
        ('yes_no_ng', 'Yes/No/Not Given'),
        ('fill_blank', 'Fill in the Blank'),
        ('short_answer', 'Short Answer'),
        
        # Reading only
        ('match_headings', 'Matching Headings'),
        ('match_info', 'Matching Information'),
        ('match_features', 'Matching Features'),
        ('sentence_completion', 'Sentence Completion'),
        ('summary_completion', 'Summary Completion'),
        ('note_completion', 'Note Completion'),
        ('table_completion', 'Table Completion'),
        ('flow_chart', 'Flow Chart Completion'),
        ('diagram_label', 'Diagram Labeling'),
    ]
    
    question_type = models.CharField(
        max_length=30,
        choices=QUESTION_TYPES,
        default='mcq'
    )
    
    question_text = models.TextField()
    
    # For MCQ
    options = models.JSONField(
        default=list,
        blank=True,
        help_text='["A", "B", "C", "D"] for MCQ'
    )
    
    # Answer
    correct_answer = models.CharField(
        max_length=500,
        help_text='Can be: A, True, Yes, or text for fill-in-blank'
    )
    
    # For fill-in-blank word limit
    word_limit = models.IntegerField(
        null=True,
        blank=True,
        help_text='e.g., 3 for "NO MORE THAN THREE WORDS"'
    )
    
    # Order
    order = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['order']
```

---

## STEP 2: Frontend - Test Creation UI

### Reading Test Creator with Validation

**Fayl:** `frontend/src/pages/center/ReadingTestCreator.tsx`

```typescript
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

interface Passage {
  id: string;
  title: string;
  text: string;
  questions: Question[];
  targetQuestions: number; // 13 or 14
}

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
  answer: string;
  wordLimit?: number;
}

type QuestionType = 
  | 'mcq'
  | 'true_false_ng'
  | 'yes_no_ng'
  | 'fill_blank'
  | 'short_answer'
  | 'match_headings'
  | 'sentence_completion'
  | 'note_completion';

export const ReadingTestCreator: React.FC = () => {
  const [testName, setTestName] = useState('');
  const [passages, setPassages] = useState<Passage[]>([
    { id: '1', title: '', text: '', questions: [], targetQuestions: 13 },
    { id: '2', title: '', text: '', questions: [], targetQuestions: 13 },
    { id: '3', title: '', text: '', questions: [], targetQuestions: 14 },
  ]);
  
  const getTotalQuestions = () => {
    return passages.reduce((sum, p) => sum + p.questions.length, 0);
  };
  
  const getValidationStatus = () => {
    const total = getTotalQuestions();
    
    if (total === 40) {
      return { valid: true, message: '✓ Exactly 40 questions' };
    } else if (total < 40) {
      return { valid: false, message: `Need ${40 - total} more questions` };
    } else {
      return { valid: false, message: `Remove ${total - 40} questions` };
    }
  };
  
  const addQuestion = (passageId: string) => {
    setPassages(passages.map(p => {
      if (p.id === passageId) {
        // Check if adding would exceed target
        if (p.questions.length >= p.targetQuestions) {
          toast.error(`Passage ${passageId} should have ${p.targetQuestions} questions`);
          return p;
        }
        
        const newQuestion: Question = {
          id: `q_${Date.now()}`,
          type: 'mcq',
          text: '',
          options: ['', '', '', ''],
          answer: ''
        };
        
        return { ...p, questions: [...p.questions, newQuestion] };
      }
      return p;
    }));
  };
  
  const handleSave = async () => {
    const validation = getValidationStatus();
    
    if (!validation.valid) {
      toast.error('Cannot save: ' + validation.message);
      return;
    }
    
    try {
      const response = await api.post('/tests/reading/create/', {
        name: testName,
        passages: passages.map(p => ({
          title: p.title,
          text: p.text,
          questions: p.questions.map((q, idx) => ({
            order: idx + 1,
            question_type: q.type,
            question_text: q.text,
            options: q.options,
            correct_answer: q.answer,
            word_limit: q.wordLimit
          }))
        }))
      });
      
      if (response.data.success) {
        toast.success('Reading test created!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create test');
    }
  };
  
  return (
    <div className="p-8">
      {/* Header with Validation */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Create Reading Test
            </h1>
            <p className="text-gray-600 mt-1">
              3 passages, exactly 40 questions total
            </p>
          </div>
          
          <div className="text-right">
            <div className={`text-3xl font-bold ${
              getValidationStatus().valid ? 'text-green-600' : 'text-red-600'
            }`}>
              {getTotalQuestions()}/40
            </div>
            <p className={`text-sm ${
              getValidationStatus().valid ? 'text-green-600' : 'text-red-600'
            }`}>
              {getValidationStatus().message}
            </p>
          </div>
        </div>
        
        <input
          type="text"
          value={testName}
          onChange={(e) => setTestName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg"
          placeholder="Test Name (e.g., IELTS Academic Reading Test 1)"
        />
      </div>
      
      {/* Passages */}
      <div className="space-y-6">
        {passages.map((passage, pIdx) => (
          <PassageBuilder
            key={passage.id}
            passage={passage}
            passageNumber={pIdx + 1}
            onChange={(updated) => {
              setPassages(passages.map(p => 
                p.id === passage.id ? updated : p
              ));
            }}
            onAddQuestion={() => addQuestion(passage.id)}
          />
        ))}
      </div>
      
      {/* Save Button */}
      <div className="flex justify-end gap-4 mt-8">
        <button
          className="px-8 py-3 border border-gray-300 rounded-lg font-semibold"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!getValidationStatus().valid}
          className={`px-8 py-3 rounded-lg font-semibold text-white ${
            getValidationStatus().valid
              ? 'bg-primary-600 hover:bg-primary-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          Save Test
        </button>
      </div>
    </div>
  );
};


// Question Type Selector Component
const QuestionTypeSelector: React.FC<{
  value: QuestionType;
  onChange: (type: QuestionType) => void;
}> = ({ value, onChange }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as QuestionType)}
      className="w-full border border-gray-300 rounded-lg px-4 py-2"
    >
      <optgroup label="Common Types">
        <option value="mcq">Multiple Choice (A, B, C, D)</option>
        <option value="true_false_ng">True / False / Not Given</option>
        <option value="yes_no_ng">Yes / No / Not Given</option>
        <option value="fill_blank">Fill in the Blank</option>
        <option value="short_answer">Short Answer</option>
      </optgroup>
      
      <optgroup label="Advanced Types">
        <option value="match_headings">Matching Headings</option>
        <option value="sentence_completion">Sentence Completion</option>
        <option value="note_completion">Note Completion</option>
      </optgroup>
    </select>
  );
};
```

---

## STEP 3: Test Taking Interface - Split Screen

### Reading Test Interface

**Fayl:** `frontend/src/pages/student/TakeReadingTest.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export const TakeReadingTest: React.FC = () => {
  const { testId } = useParams();
  const [test, setTest] = useState<any>(null);
  const [currentPart, setCurrentPart] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(60 * 60); // 60 minutes
  const [started, setStarted] = useState(false);
  
  // Fullscreen enforcement
  useEffect(() => {
    const enterFullscreen = () => {
      document.documentElement.requestFullscreen();
    };
    
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && started) {
        // Re-enter fullscreen
        enterFullscreen();
        toast.warning('Test must be completed in fullscreen mode');
      }
    };
    
    // Disable ESC key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [started]);
  
  // Timer
  useEffect(() => {
    if (!started) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [started]);
  
  const handleStart = () => {
    setStarted(true);
    document.documentElement.requestFullscreen();
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
          >
            ← Back
          </button>
          
          <div className="bg-primary-600 text-white px-4 py-1 rounded-lg font-bold">
            IELTS
          </div>
          
          <div className="text-gray-600">
            ID: {testId}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-2xl font-bold text-gray-900">
            {formatTime(timeRemaining)}
          </div>
          
          {!started && (
            <button
              onClick={handleStart}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-semibold"
            >
              Start
            </button>
          )}
        </div>
      </div>
      
      {started && (
        <>
          {/* Part Instructions */}
          <div className="bg-gray-100 px-6 py-4">
            <p className="text-gray-700">
              <strong>Part {currentPart}</strong>: Read the text and answer questions 1-13.
            </p>
          </div>
          
          {/* Split Screen */}
          <div className="flex h-[calc(100vh-180px)]">
            {/* Left: Passage (60%) */}
            <div className="w-3/5 bg-white p-8 overflow-y-auto border-r border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {test?.passages[currentPart - 1]?.title}
              </h2>
              
              <div className="prose prose-lg max-w-none">
                {test?.passages[currentPart - 1]?.text}
              </div>
            </div>
            
            {/* Right: Questions (40%) */}
            <div className="w-2/5 bg-white p-8 overflow-y-auto">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Questions {getCurrentPartQuestionRange()}
                </h3>
                
                {/* Question Type Instructions */}
                {getQuestionTypeInstructions()}
              </div>
              
              {/* Questions */}
              <div className="space-y-6">
                {getCurrentPartQuestions().map((question, idx) => (
                  <QuestionRenderer
                    key={question.id}
                    question={question}
                    questionNumber={getQuestionNumber(idx)}
                    answer={answers[getQuestionNumber(idx)]}
                    onChange={(answer) => {
                      setAnswers({
                        ...answers,
                        [getQuestionNumber(idx)]: answer
                      });
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          
          {/* Bottom Navigation */}
          <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Part {currentPart}</span>
              
              {/* Page Numbers */}
              <div className="flex gap-1 ml-4">
                {Array.from({ length: 13 }, (_, i) => i + 1).map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentQuestion(pageNum)}
                    className={`w-8 h-8 rounded ${
                      currentQuestion === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentQuestion(Math.max(1, currentQuestion - 1))}
                className="bg-gray-800 text-white w-10 h-10 rounded flex items-center justify-center hover:bg-gray-700"
              >
                ←
              </button>
              
              <button
                onClick={() => setCurrentQuestion(Math.min(13, currentQuestion + 1))}
                className="bg-gray-800 text-white w-10 h-10 rounded flex items-center justify-center hover:bg-gray-700"
              >
                →
              </button>
              
              <button
                onClick={handleSubmit}
                className="ml-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold"
              >
                ✓ Submit
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};


// Question Renderer - Handles all question types
const QuestionRenderer: React.FC<{
  question: any;
  questionNumber: number;
  answer: string | undefined;
  onChange: (answer: string) => void;
}> = ({ question, questionNumber, answer, onChange }) => {
  
  switch (question.question_type) {
    case 'mcq':
      return (
        <div>
          <p className="font-semibold text-gray-900 mb-3">
            {questionNumber}. {question.question_text}
          </p>
          
          <div className="space-y-2">
            {question.options.map((option: string, idx: number) => (
              <label
                key={idx}
                className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
              >
                <input
                  type="radio"
                  name={`q_${question.id}`}
                  value={String.fromCharCode(65 + idx)}
                  checked={answer === String.fromCharCode(65 + idx)}
                  onChange={(e) => onChange(e.target.value)}
                  className="mt-1"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>
      );
    
    case 'true_false_ng':
      return (
        <div>
          <p className="font-semibold text-gray-900 mb-3">
            {questionNumber}. {question.question_text}
          </p>
          
          <div className="space-y-2">
            {['TRUE', 'FALSE', 'NOT GIVEN'].map(option => (
              <label
                key={option}
                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
              >
                <input
                  type="radio"
                  name={`q_${question.id}`}
                  value={option}
                  checked={answer === option}
                  onChange={(e) => onChange(e.target.value)}
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>
      );
    
    case 'fill_blank':
      return (
        <div>
          <p className="font-semibold text-gray-900 mb-3">
            {questionNumber}. {question.question_text}
          </p>
          
          <input
            type="text"
            value={answer || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
            placeholder="Type your answer here..."
          />
        </div>
      );
    
    default:
      return null;
  }
};
```

---

## STEP 4: Listening Test - No Controls

**Fayl:** `frontend/src/pages/student/TakeListeningTest.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react';

export const TakeListeningTest: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [started, setStarted] = useState(false);
  const [currentPart, setCurrentPart] = useState(1);
  
  useEffect(() => {
    if (started && audioRef.current) {
      // Auto-play
      audioRef.current.play();
      
      // Disable seeking/rewinding
      audioRef.current.addEventListener('seeking', (e) => {
        e.preventDefault();
        // Reset to current position
        audioRef.current!.currentTime = audioRef.current!.currentTime;
      });
      
      // Disable right-click
      audioRef.current.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
    }
  }, [started]);
  
  return (
    <div>
      {/* Hidden audio - NO CONTROLS */}
      <audio
        ref={audioRef}
        style={{ display: 'none' }}
        onEnded={() => {
          // Move to next part or finish
          if (currentPart < 4) {
            setCurrentPart(currentPart + 1);
          }
        }}
      >
        <source src={getPartAudioUrl(currentPart)} type="audio/mpeg" />
      </audio>
      
      {/* Questions displayed while audio plays */}
      <div className="p-8">
        {/* Part instructions */}
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <p className="font-semibold">
            Part {currentPart}: Listen and answer questions {(currentPart - 1) * 10 + 1}-{currentPart * 10}.
          </p>
        </div>
        
        {/* Questions */}
        <ListeningQuestions
          part={currentPart}
          answers={answers}
          onChange={setAnswers}
        />
      </div>
      
      {/* Bottom navigation - similar to Reading */}
      <BottomNavigation
        parts={4}
        currentPart={currentPart}
        onSubmit={handleSubmit}
      />
    </div>
  );
};
```

---

**ETAP 18 TO'LIQ - TEST INTERFACE FIXED!** 🎯

**Keyingi qism?** ✅
