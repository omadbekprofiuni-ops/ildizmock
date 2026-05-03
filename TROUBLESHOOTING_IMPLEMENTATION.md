# ILDIZ MOCK - TROUBLESHOOTING & TEST INTERFACE IMPLEMENTATION

**Maqsad:** Barcha error'larni fix qilish va IELTStation-style split-screen test interface yaratish.

---

## 🚨 IDENTIFIED ERRORS

### Error 1: `t(...).map is not a function`

**Sabab:**
```typescript
// Wrong - data undefined yoki array emas
{data.map(item => ...)}

// Should be:
{data && Array.isArray(data) && data.map(item => ...)}
```

**Fix:**
```typescript
// Always check before mapping
{Array.isArray(organizations) && organizations.length > 0 ? (
  organizations.map(org => (
    <OrganizationCard key={org.id} data={org} />
  ))
) : (
  <p>No data</p>
)}
```

---

### Error 2: 404 - `/super/org/stats`

**Sabab:** Route missing

**Fix (ETAP 22'da bor):**
```typescript
// frontend/src/routes/superadmin.routes.tsx
{
  path: 'org/:orgId/dashboard',
  element: <OrganizationDashboard />
}
```

---

### Error 3: Test Interface Not Split-Screen

**Kerak:** IELTStation'dagi kabi split-screen (60% passage, 40% questions)

**Hozir:** Ehtimol bitta column layout

---

## ✅ COMPLETE FIX - CURSOR AGENT PROMPT

Copy this EXACT prompt to Cursor Agent:

```
TASK: Fix all errors and implement split-screen Reading test interface

ERRORS TO FIX:

1. TypeError: t(...).map is not a function
   - Location: Any component using .map()
   - Fix: Add Array.isArray() check before all .map() calls
   - Pattern:
     {Array.isArray(data) && data.map(item => ...)}

2. 404 Error: /super/org/stats
   - Add route in frontend/src/routes/superadmin.routes.tsx:
     {
       path: 'org/:orgId/stats',
       element: <OrganizationStats />
     }
   - Create component: frontend/src/pages/superadmin/OrganizationStats.tsx
   - Backend endpoint exists: GET /organizations/{id}/stats/

IMPLEMENTATION: Split-Screen Reading Test Interface

Reference: IELTStation (ielts.com/reading/3303)

Layout:
┌────────────────────────────────────────────────────┐
│  Header: [IELTS] ID: 31466    60:00    [Start]    │
├──────────────────────┬─────────────────────────────┤
│                      │                             │
│  LEFT (60%)          │  RIGHT (40%)                │
│  Passage Text        │  Questions                  │
│  (scrollable)        │  (scrollable)               │
│                      │                             │
│  The life and work   │  Questions 1-6              │
│  of Marie Curie      │                             │
│                      │  1. Marie Curie's husband..│
│  Marie Curie is      │     ○ TRUE                  │
│  probably the most   │     ○ FALSE                 │
│  famous woman...     │     ○ NOT GIVEN             │
│                      │                             │
│                      │  2. Marie became...         │
│  (content continues) │     ○ TRUE                  │
│                      │     ○ FALSE                 │
│                      │     ○ NOT GIVEN             │
│                      │                             │
├──────────────────────┴─────────────────────────────┤
│  Part 1  [1][2][3]...[13]  Part 2  Part 3  [✓]    │
└────────────────────────────────────────────────────┘

IMPLEMENTATION:

File: frontend/src/pages/student/ReadingTest.tsx

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';

interface Question {
  id: number;
  type: string;
  text: string;
  options?: string[];
  correct_answer: string;
}

interface Passage {
  id: number;
  title: string;
  content: string;
  questions: Question[];
}

export const ReadingTest: React.FC = () => {
  const { testId } = useParams();
  const [passages, setPassages] = useState<Passage[]>([]);
  const [currentPassageIndex, setCurrentPassageIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes
  
  useEffect(() => {
    fetchTest();
    startTimer();
  }, []);
  
  const fetchTest = async () => {
    const response = await api.get(`/tests/${testId}/`);
    setPassages(response.data.passages || []);
  };
  
  const startTimer = () => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };
  
  const handleSubmit = async () => {
    await api.post(`/attempts/submit/`, {
      test_id: testId,
      answers: answers
    });
    // Redirect to results
  };
  
  const currentPassage = passages[currentPassageIndex];
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-red-600 text-white px-4 py-2 font-bold rounded">
            IELTS
          </div>
          <span className="text-gray-600">ID: {testId}</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-2xl font-bold text-gray-900">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
          <button
            onClick={handleSubmit}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold"
          >
            Submit
          </button>
        </div>
      </div>
      
      {/* Split Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT - Passage (60%) */}
        <div className="w-[60%] bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-8">
            <div className="bg-gray-100 px-4 py-2 mb-6 rounded">
              <p className="text-sm font-semibold text-gray-700">
                Part {currentPassageIndex + 1}
              </p>
              <p className="text-sm text-gray-600">
                Read the text and answer questions {currentPassage?.questions[0]?.id}-
                {currentPassage?.questions[currentPassage.questions.length - 1]?.id}.
              </p>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {currentPassage?.title}
            </h2>
            
            <div className="prose prose-lg max-w-none">
              {currentPassage?.content.split('\n\n').map((para, idx) => (
                <p key={idx} className="mb-4 text-gray-800 leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          </div>
        </div>
        
        {/* RIGHT - Questions (40%) */}
        <div className="w-[40%] bg-gray-50 overflow-y-auto">
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">
              Questions {currentPassage?.questions[0]?.id}-
              {currentPassage?.questions[currentPassage.questions.length - 1]?.id}
            </h3>
            
            {currentPassage?.questions[0]?.type === 'tfng' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700">
                  Choose <strong>TRUE</strong> if the statement agrees with the information given in the text,
                  choose <strong>FALSE</strong> if the statement contradicts the information,
                  or choose <strong>NOT GIVEN</strong> if there is no information on this.
                </p>
              </div>
            )}
            
            <div className="space-y-6">
              {currentPassage?.questions.map((question, idx) => (
                <div key={question.id} className="bg-white rounded-lg border border-gray-200 p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="bg-gray-900 text-white w-8 h-8 rounded flex items-center justify-center font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <p className="text-gray-900 font-medium flex-1">
                      {question.text}
                    </p>
                  </div>
                  
                  {/* TRUE/FALSE/NOT GIVEN */}
                  {question.type === 'tfng' && (
                    <div className="space-y-2 pl-11">
                      {['TRUE', 'FALSE', 'NOT GIVEN'].map(option => (
                        <label
                          key={option}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option}
                            checked={answers[question.id] === option}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            className="w-5 h-5 text-red-600 cursor-pointer"
                          />
                          <span className="text-gray-700 group-hover:text-gray-900">
                            {option}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  {/* YES/NO/NOT GIVEN */}
                  {question.type === 'ynng' && (
                    <div className="space-y-2 pl-11">
                      {['YES', 'NO', 'NOT GIVEN'].map(option => (
                        <label key={option} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option}
                            checked={answers[question.id] === option}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            className="w-5 h-5 text-red-600 cursor-pointer"
                          />
                          <span className="text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  {/* MCQ */}
                  {question.type === 'mcq' && question.options && (
                    <div className="space-y-2 pl-11">
                      {question.options.map((option, optIdx) => (
                        <label key={optIdx} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option}
                            checked={answers[question.id] === option}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            className="w-5 h-5 text-red-600 cursor-pointer"
                          />
                          <span className="text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  {/* Fill in the blank */}
                  {(question.type === 'fill' || question.type === 'short_answer') && (
                    <div className="pl-11">
                      <input
                        type="text"
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Type your answer..."
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-600 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom Navigation */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Part Selector */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-gray-700">Part {currentPassageIndex + 1}</span>
            <div className="flex gap-1">
              {passages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPassageIndex(idx)}
                  className={`w-10 h-10 rounded ${
                    idx === currentPassageIndex
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } font-semibold`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
          
          {/* Navigation Arrows */}
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPassageIndex(prev => Math.max(0, prev - 1))}
              disabled={currentPassageIndex === 0}
              className="bg-gray-900 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              ←
            </button>
            <button
              onClick={() => setCurrentPassageIndex(prev => Math.min(passages.length - 1, prev + 1))}
              disabled={currentPassageIndex === passages.length - 1}
              className="bg-gray-900 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              →
            </button>
          </div>
          
          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded-lg font-semibold flex items-center gap-2"
          >
            <span>✓</span>
            Submit Test
          </button>
        </div>
      </div>
    </div>
  );
};

REQUIREMENTS:
- Split-screen layout (60/40)
- Support all question types: TRUE/FALSE/NOT GIVEN, YES/NO/NOT GIVEN, MCQ, Fill in blank
- Timer countdown
- Part navigation
- Answer state management
- Auto-submit when time expires
- Fullscreen mode
- Responsive scrolling

Run backend migration if needed:
python manage.py makemigrations
python manage.py migrate

Test endpoint:
GET /tests/{id}/ should return:
{
  "id": 1,
  "module": "reading",
  "title": "Reading Test",
  "passages": [
    {
      "id": 1,
      "title": "The life and work of Marie Curie",
      "content": "Marie Curie is probably...",
      "questions": [
        {
          "id": 1,
          "type": "tfng",
          "text": "Marie Curie's husband was a joint winner of both Marie's Nobel Prizes.",
          "correct_answer": "FALSE"
        }
      ]
    }
  ]
}

START IMPLEMENTATION NOW.
```

---

## 🎯 VERIFICATION STEPS

After Cursor Agent completes:

1. **Check Errors Fixed:**
```bash
# No .map() errors
# No 404 errors on /super/org/stats
```

2. **Check Split-Screen Interface:**
```bash
# Navigate to /practice/reading
# Should see:
✓ Left panel (60%) with passage
✓ Right panel (40%) with questions
✓ Bottom navigation with part selector
✓ Timer counting down
✓ All question types rendering correctly
```

3. **Test All Question Types:**
```
✓ TRUE/FALSE/NOT GIVEN radio buttons
✓ YES/NO/NOT GIVEN radio buttons
✓ MCQ with multiple options
✓ Fill in the blank text input
✓ Short answer text input
```

---

## 📊 FINAL RESULT

**Before:**
```
❌ Technical errors (.map not function)
❌ 404 errors (routes missing)
❌ Single column layout
```

**After:**
```
✅ No errors
✅ All routes working
✅ IELTStation-style split-screen
✅ Professional interface
✅ All question types supported
✅ Timer working
✅ Navigation working
```

---

**COPY THE CURSOR PROMPT ABOVE AND RUN IT!** 🚀
