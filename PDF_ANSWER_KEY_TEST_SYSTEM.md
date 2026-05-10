# CURSOR AGENT - PDF + AUDIO + ANSWER KEY TEST CREATION

**TASK:** Implement simple test creation by uploading PDF, audio files, and answer key.

**USER FLOW:**
- Teacher uploads PDF (Cambridge IELTS test)
- Teacher uploads audio files (Listening parts 1-4)
- Teacher pastes answer key in simple format
- System auto-grades based on answer key
- Takes 2 minutes to create test ✅

**NO AI NEEDED - Simple file upload system**

---

## 🎯 REQUIREMENTS

### Teacher Workflow:
```
1. Click "Create Test from PDF"
2. Upload PDF file (Reading passage)
3. Upload audio files (4 files for Listening)
4. Paste answer key:
   1|C
   2|B
   3|NOT GIVEN
   4|TRUE
   5|library
   ...
5. Click Save → Test published!

Time: 2 minutes ⚡
```

### Student Workflow:
```
1. Open test
2. See PDF on left side (embedded viewer)
3. See 40 numbered input boxes on right
4. Listen to audio (plays once)
5. Fill in answers
6. Submit → Auto-graded ✅
```

---

## 📋 IMPLEMENTATION SPEC

### PART 1: Database Models

**File:** `backend/apps/tests/models.py`

**Add new model:**

```python
class PDFTest(models.Model):
    """
    Test created from PDF + audio + answer key
    Simpler alternative to full question creation
    """
    
    # Basic info
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='pdf_tests'
    )
    name = models.CharField(max_length=200)
    module = models.CharField(
        max_length=20,
        choices=[
            ('reading', 'Reading'),
            ('listening', 'Listening')
        ]
    )
    difficulty = models.CharField(
        max_length=20,
        choices=[
            ('easy', 'Easy'),
            ('medium', 'Medium'),
            ('hard', 'Hard')
        ],
        default='medium'
    )
    
    # Files
    pdf_file = models.FileField(
        upload_to='test_pdfs/',
        help_text='PDF file containing test passages/questions'
    )
    
    # Audio files (for Listening module)
    audio_part1 = models.FileField(
        upload_to='listening_audios/',
        null=True,
        blank=True,
        help_text='Audio for Part 1'
    )
    audio_part2 = models.FileField(
        upload_to='listening_audios/',
        null=True,
        blank=True,
        help_text='Audio for Part 2'
    )
    audio_part3 = models.FileField(
        upload_to='listening_audios/',
        null=True,
        blank=True,
        help_text='Audio for Part 3'
    )
    audio_part4 = models.FileField(
        upload_to='listening_audios/',
        null=True,
        blank=True,
        help_text='Audio for Part 4'
    )
    
    # Answer key stored as JSON
    # Format: {"1": "C", "2": "B", "3": "NOT GIVEN", "4": "TRUE", ...}
    answer_key = models.JSONField(
        help_text='Answer key in JSON format'
    )
    
    # Test settings
    total_questions = models.IntegerField(default=40)
    duration_minutes = models.IntegerField(default=60)
    
    # Publishing
    status = models.CharField(
        max_length=20,
        default='published',
        choices=[
            ('draft', 'Draft'),
            ('published', 'Published')
        ]
    )
    is_published = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'tests_pdftest'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name


class PDFTestAttempt(models.Model):
    """
    Student's attempt at a PDF test
    """
    
    test = models.ForeignKey(
        PDFTest,
        on_delete=models.CASCADE,
        related_name='attempts'
    )
    student = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE
    )
    
    # Student's answers stored as JSON
    # Format: {"1": "C", "2": "B", "3": "not given", ...}
    answers = models.JSONField(default=dict)
    
    # Grading results
    score = models.IntegerField(null=True, blank=True)
    total_questions = models.IntegerField()
    percentage = models.FloatField(null=True, blank=True)
    
    # Detailed results per question
    # Format: {"1": true, "2": false, "3": true, ...}
    results = models.JSONField(default=dict)
    
    # Timing
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    time_taken_seconds = models.IntegerField(null=True, blank=True)
    
    class Meta:
        db_table = 'tests_pdfattempt'
        ordering = ['-started_at']
    
    def auto_grade(self):
        """
        Auto-grade the attempt based on answer key
        """
        correct_count = 0
        results = {}
        
        for q_num, correct_answer in self.test.answer_key.items():
            student_answer = self.answers.get(str(q_num), '').strip()
            correct_answer_clean = str(correct_answer).strip()
            
            # Case-insensitive comparison
            is_correct = student_answer.upper() == correct_answer_clean.upper()
            
            if is_correct:
                correct_count += 1
            
            results[str(q_num)] = is_correct
        
        self.score = correct_count
        self.total_questions = len(self.test.answer_key)
        self.percentage = (correct_count / self.total_questions) * 100 if self.total_questions > 0 else 0
        self.results = results
        self.save()
        
        return self.score
    
    def __str__(self):
        return f"{self.student.get_full_name()} - {self.test.name}"
```

---

### PART 2: Backend Views

**File:** `backend/apps/tests/pdf_views.py`

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from .models import PDFTest, PDFTestAttempt
import json

def parse_answer_key(text):
    """
    Parse answer key from text format:
    1|C
    2|B
    3|NOT GIVEN
    
    Returns: {"1": "C", "2": "B", "3": "NOT GIVEN"}
    """
    answer_key = {}
    
    for line in text.strip().split('\n'):
        line = line.strip()
        if not line or '|' not in line:
            continue
        
        parts = line.split('|', 1)
        if len(parts) != 2:
            continue
        
        q_num = parts[0].strip()
        answer = parts[1].strip()
        
        answer_key[q_num] = answer
    
    return answer_key


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_pdf_test(request):
    """
    Create test from PDF + audio + answer key
    
    POST data:
    - name: Test name
    - module: reading or listening
    - difficulty: easy/medium/hard
    - pdf_file: PDF file
    - audio_part1, audio_part2, audio_part3, audio_part4: Audio files (optional)
    - answer_key: Answer key in text format
    - duration_minutes: Test duration
    """
    
    organization = request.user.library
    
    try:
        # Parse answer key
        answer_key_text = request.data.get('answer_key', '')
        answer_key = parse_answer_key(answer_key_text)
        
        if not answer_key:
            return Response({
                'error': 'Answer key is required'
            }, status=400)
        
        with transaction.atomic():
            # Create test
            test = PDFTest.objects.create(
                organization=organization,
                name=request.data['name'],
                module=request.data['module'],
                difficulty=request.data.get('difficulty', 'medium'),
                pdf_file=request.FILES['pdf_file'],
                answer_key=answer_key,
                total_questions=len(answer_key),
                duration_minutes=int(request.data.get('duration_minutes', 60)),
                status='published',
                is_published=True
            )
            
            # Upload audio files if listening test
            if request.data['module'] == 'listening':
                if 'audio_part1' in request.FILES:
                    test.audio_part1 = request.FILES['audio_part1']
                if 'audio_part2' in request.FILES:
                    test.audio_part2 = request.FILES['audio_part2']
                if 'audio_part3' in request.FILES:
                    test.audio_part3 = request.FILES['audio_part3']
                if 'audio_part4' in request.FILES:
                    test.audio_part4 = request.FILES['audio_part4']
                
                test.save()
            
            return Response({
                'success': True,
                'test_id': test.id,
                'message': f'Test created: {test.name}',
                'total_questions': len(answer_key)
            })
    
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=400)


@api_view(['GET'])
def list_pdf_tests(request):
    """List all PDF tests for organization"""
    
    organization = request.user.library
    
    tests = PDFTest.objects.filter(
        organization=organization,
        status='published'
    )
    
    data = []
    for test in tests:
        data.append({
            'id': test.id,
            'name': test.name,
            'module': test.module,
            'difficulty': test.difficulty,
            'total_questions': test.total_questions,
            'duration_minutes': test.duration_minutes,
            'created_at': test.created_at.isoformat()
        })
    
    return Response({
        'success': True,
        'tests': data
    })


@api_view(['GET'])
def get_pdf_test(request, test_id):
    """Get PDF test details for taking test"""
    
    try:
        test = PDFTest.objects.get(id=test_id)
        
        # Build audio URLs
        audio_urls = {}
        if test.audio_part1:
            audio_urls['part1'] = request.build_absolute_uri(test.audio_part1.url)
        if test.audio_part2:
            audio_urls['part2'] = request.build_absolute_uri(test.audio_part2.url)
        if test.audio_part3:
            audio_urls['part3'] = request.build_absolute_uri(test.audio_part3.url)
        if test.audio_part4:
            audio_urls['part4'] = request.build_absolute_uri(test.audio_part4.url)
        
        return Response({
            'success': True,
            'test': {
                'id': test.id,
                'name': test.name,
                'module': test.module,
                'total_questions': test.total_questions,
                'duration_minutes': test.duration_minutes,
                'pdf_url': request.build_absolute_uri(test.pdf_file.url),
                'audio_urls': audio_urls
            }
        })
    
    except PDFTest.DoesNotExist:
        return Response({
            'error': 'Test not found'
        }, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_pdf_test(request, test_id):
    """
    Submit PDF test attempt and auto-grade
    
    POST data:
    - answers: {"1": "C", "2": "B", ...}
    - time_taken_seconds: Time taken
    """
    
    try:
        test = PDFTest.objects.get(id=test_id)
        
        # Create attempt
        attempt = PDFTestAttempt.objects.create(
            test=test,
            student=request.user,
            answers=request.data['answers'],
            total_questions=test.total_questions,
            time_taken_seconds=request.data.get('time_taken_seconds'),
            submitted_at=timezone.now()
        )
        
        # Auto-grade
        score = attempt.auto_grade()
        
        return Response({
            'success': True,
            'attempt_id': attempt.id,
            'score': score,
            'total_questions': attempt.total_questions,
            'percentage': attempt.percentage,
            'results': attempt.results
        })
    
    except PDFTest.DoesNotExist:
        return Response({
            'error': 'Test not found'
        }, status=404)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=400)
```

**Add URLs:**

```python
# backend/apps/tests/urls.py
from .pdf_views import (
    create_pdf_test,
    list_pdf_tests,
    get_pdf_test,
    submit_pdf_test
)

urlpatterns = [
    # ... existing patterns
    
    # PDF Tests
    path('pdf-tests/create/', create_pdf_test, name='create-pdf-test'),
    path('pdf-tests/', list_pdf_tests, name='list-pdf-tests'),
    path('pdf-tests/<int:test_id>/', get_pdf_test, name='get-pdf-test'),
    path('pdf-tests/<int:test_id>/submit/', submit_pdf_test, name='submit-pdf-test'),
]
```

---

### PART 3: Frontend - Create Test Page

**File:** `frontend/src/pages/center/PDFTestCreate.tsx`

```typescript
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';

export const PDFTestCreate: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    name: '',
    module: 'reading',
    difficulty: 'medium',
    duration_minutes: 60,
    answer_key: ''
  });
  
  const [files, setFiles] = useState({
    pdf: null as File | null,
    audio_part1: null as File | null,
    audio_part2: null as File | null,
    audio_part3: null as File | null,
    audio_part4: null as File | null
  });
  
  const [creating, setCreating] = useState(false);
  
  const handleSubmit = async () => {
    // Validation
    if (!form.name.trim()) {
      toast.error('Please enter test name');
      return;
    }
    
    if (!files.pdf) {
      toast.error('Please upload PDF file');
      return;
    }
    
    if (!form.answer_key.trim()) {
      toast.error('Please paste answer key');
      return;
    }
    
    if (form.module === 'listening' && !files.audio_part1) {
      toast.error('Please upload at least Part 1 audio for Listening test');
      return;
    }
    
    setCreating(true);
    
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('module', form.module);
      formData.append('difficulty', form.difficulty);
      formData.append('duration_minutes', form.duration_minutes.toString());
      formData.append('answer_key', form.answer_key);
      formData.append('pdf_file', files.pdf);
      
      // Add audio files if listening
      if (form.module === 'listening') {
        if (files.audio_part1) formData.append('audio_part1', files.audio_part1);
        if (files.audio_part2) formData.append('audio_part2', files.audio_part2);
        if (files.audio_part3) formData.append('audio_part3', files.audio_part3);
        if (files.audio_part4) formData.append('audio_part4', files.audio_part4);
      }
      
      const response = await api.post('/tests/pdf-tests/create/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      toast.success(response.data.message);
      navigate(`/center/${slug}/tests`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to create test');
    } finally {
      setCreating(false);
    }
  };
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        ⚡ Quick Test Creation - PDF Upload
      </h1>
      <p className="text-gray-600 mb-8">
        Upload PDF, audio files, and answer key. Test ready in 2 minutes!
      </p>
      
      {/* Test Info */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Test Information</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Cambridge IELTS 19 - Reading Test 1"
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            />
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Module
              </label>
              <select
                value={form.module}
                onChange={(e) => setForm({ ...form, module: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="reading">Reading</option>
                <option value="listening">Listening</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty
              </label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (min)
              </label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* PDF Upload */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          📄 PDF File <span className="text-red-600">*</span>
        </h2>
        
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setFiles({ ...files, pdf: e.target.files?.[0] || null })}
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
        />
        
        {files.pdf && (
          <p className="text-sm text-gray-600 mt-2">
            ✅ {files.pdf.name} ({(files.pdf.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
      </div>
      
      {/* Audio Files (for Listening) */}
      {form.module === 'listening' && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            🎧 Audio Files <span className="text-red-600">*</span>
          </h2>
          
          <div className="space-y-4">
            {[1, 2, 3, 4].map(partNum => (
              <div key={partNum}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Part {partNum} Audio {partNum === 1 && <span className="text-red-600">*</span>}
                </label>
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a"
                  onChange={(e) => setFiles({ 
                    ...files, 
                    [`audio_part${partNum}` as keyof typeof files]: e.target.files?.[0] || null 
                  })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
                {files[`audio_part${partNum}` as keyof typeof files] && (
                  <p className="text-sm text-gray-600 mt-1">
                    ✅ {(files[`audio_part${partNum}` as keyof typeof files] as File).name}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Answer Key */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          ✍️ Answer Key <span className="text-red-600">*</span>
        </h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
          <p className="text-sm font-semibold text-blue-900 mb-2">
            📝 Format: QuestionNumber|Answer
          </p>
          <div className="text-xs text-blue-800 space-y-1 font-mono">
            <div>1|C</div>
            <div>2|B</div>
            <div>3|NOT GIVEN</div>
            <div>4|TRUE</div>
            <div>5|library</div>
            <div>6|Tuesday</div>
          </div>
        </div>
        
        <textarea
          value={form.answer_key}
          onChange={(e) => setForm({ ...form, answer_key: e.target.value })}
          placeholder="Paste answer key here (one answer per line)..."
          rows={15}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 font-mono text-sm"
        />
        
        <p className="text-xs text-gray-500 mt-2">
          Each line: question number, pipe (|), correct answer
        </p>
      </div>
      
      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/center/${slug}/tests`)}
          className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold"
        >
          Cancel
        </button>
        
        <button
          onClick={handleSubmit}
          disabled={creating}
          className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {creating ? (
            <>Creating...</>
          ) : (
            <>
              <span>✅</span>
              Create Test
            </>
          )}
        </button>
      </div>
      
      {/* Help */}
      <div className="mt-8 bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-3">
          💡 Quick Guide
        </h3>
        
        <div className="space-y-2 text-sm text-gray-700">
          <p><strong>Step 1:</strong> Enter test name and settings</p>
          <p><strong>Step 2:</strong> Upload PDF file (test passages)</p>
          <p><strong>Step 3:</strong> Upload audio files (if Listening test)</p>
          <p><strong>Step 4:</strong> Paste answer key in format: 1|C, 2|B, etc.</p>
          <p><strong>Step 5:</strong> Click Create Test</p>
          <p className="text-green-600 font-semibold">⏱️ Total time: 2 minutes!</p>
        </div>
      </div>
    </div>
  );
};
```

---

### PART 4: Frontend - Student Test Page

**File:** `frontend/src/pages/student/PDFTestTaking.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';

export const PDFTestTaking: React.FC = () => {
  const { testId } = useParams();
  
  const [test, setTest] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  
  // Audio states
  const [currentPart, setCurrentPart] = useState(1);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  
  useEffect(() => {
    loadTest();
  }, []);
  
  const loadTest = async () => {
    try {
      const response = await api.get(`/tests/pdf-tests/${testId}/`);
      setTest(response.data.test);
      
      // Initialize answers object
      const initialAnswers: Record<string, string> = {};
      for (let i = 1; i <= response.data.test.total_questions; i++) {
        initialAnswers[i.toString()] = '';
      }
      setAnswers(initialAnswers);
      
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load test');
      setLoading(false);
    }
  };
  
  const handleAnswerChange = (questionNum: string, value: string) => {
    setAnswers({
      ...answers,
      [questionNum]: value
    });
  };
  
  const handleSubmit = async () => {
    if (!confirm('Are you sure you want to submit?')) return;
    
    setSubmitting(true);
    
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    
    try {
      const response = await api.post(`/tests/pdf-tests/${testId}/submit/`, {
        answers,
        time_taken_seconds: timeTaken
      });
      
      toast.success(`Test submitted! Score: ${response.data.score}/${response.data.total_questions}`);
      
      // Show results
      alert(`Your Score: ${response.data.score}/${response.data.total_questions} (${response.data.percentage.toFixed(1)}%)`);
      
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to submit test');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handlePlayAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setAudioStarted(true);
      setAudioPlaying(true);
      toast.success(`Part ${currentPart} audio started`);
    }
  };
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">{test.name}</h1>
      </div>
      
      {/* Audio Player (for Listening) */}
      {test.module === 'listening' && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {[1, 2, 3, 4].map(part => (
                <div
                  key={part}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    part === currentPart ? 'bg-primary-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {part}
                </div>
              ))}
            </div>
            
            {!audioStarted && test.audio_urls[`part${currentPart}`] && (
              <button
                onClick={handlePlayAudio}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold"
              >
                ▶️ Play Part {currentPart}
              </button>
            )}
          </div>
          
          <audio
            ref={audioRef}
            src={test.audio_urls[`part${currentPart}`]}
            onEnded={() => {
              setAudioPlaying(false);
              if (currentPart < 4) {
                setTimeout(() => {
                  setCurrentPart(currentPart + 1);
                  setAudioStarted(false);
                }, 2000);
              }
            }}
            className="hidden"
          />
        </div>
      )}
      
      {/* Main Content - Split Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: PDF Viewer (60%) */}
        <div className="w-[60%] border-r border-gray-200 overflow-auto">
          <iframe
            src={test.pdf_url}
            className="w-full h-full"
            title="Test PDF"
          />
        </div>
        
        {/* Right: Answer Inputs (40%) */}
        <div className="w-[40%] overflow-auto p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Your Answers</h2>
          
          <div className="space-y-3">
            {Object.keys(answers).map(qNum => (
              <div key={qNum} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold flex-shrink-0">
                  {qNum}
                </div>
                
                <input
                  type="text"
                  value={answers[qNum]}
                  onChange={(e) => handleAnswerChange(qNum, e.target.value)}
                  placeholder="Your answer..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
                  disabled={submitting}
                />
              </div>
            ))}
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full mt-8 bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-bold text-lg disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : '✓ Submit Test'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

### PART 5: Add Routes

**File:** `frontend/src/routes/center.routes.tsx`

```typescript
import { PDFTestCreate } from '@/pages/center/PDFTestCreate';

// Add route:
{
  path: 'tests/pdf-create',
  element: <PDFTestCreate />
}
```

**File:** `frontend/src/routes/student.routes.tsx`

```typescript
import { PDFTestTaking } from '@/pages/student/PDFTestTaking';

// Add route:
{
  path: 'pdf-test/:testId',
  element: <PDFTestTaking />
}
```

---

### PART 6: Update Tests List - Add PDF Create Button

**File:** `frontend/src/pages/center/TestsList.tsx`

```typescript
// Add button next to existing buttons:
<button
  onClick={() => navigate(`/center/${slug}/tests/pdf-create`)}
  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
>
  📄 PDF Test (Quick)
</button>
```

---

## 🎯 TESTING CHECKLIST

After implementation:

```
✅ Teacher can create test:
  - Upload PDF
  - Upload audio files
  - Paste answer key
  - Test created in 2 minutes

✅ Student can take test:
  - See PDF on left
  - See input boxes on right
  - Fill in answers
  - Submit

✅ Auto-grading works:
  - Correct answers counted
  - Score calculated
  - Percentage shown

✅ Listening audio plays:
  - Play button works
  - Auto-advances between parts
  - Cannot pause/rewind
```

---

## 📊 EXPECTED RESULTS

**Teacher experience:**
```
Upload time: 2 minutes ⚡
Difficulty: Easy (just file upload + paste)
Happiness: Very High 😊
```

**Student experience:**
```
PDF readable: ✅
Audio playable: ✅
Easy to answer: ✅
Results immediate: ✅
```

---

## 🚀 IMPLEMENTATION STEPS

**CURSOR AGENT - EXECUTE:**

1. Create migrations:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

2. Create backend views and URLs

3. Create frontend pages

4. Add routes

5. Test full workflow:
   - Create PDF test
   - Student takes test
   - Auto-grading works

6. Polish UI/UX

---

**START IMPLEMENTATION NOW. BUILD SIMPLE PDF + ANSWER KEY SYSTEM.**
