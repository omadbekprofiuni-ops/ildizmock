# CURSOR AGENT - COMPLETE TEST SYSTEM FIX

**Copy this ENTIRE prompt to Cursor Agent and let it analyze and fix all issues.**

---

## 🎯 TASK OVERVIEW

Fix ALL test-related bugs in ILDIZ Mock platform:

1. Test save/edit persistence issues
2. 404 errors on test edit routes
3. Add Matching Headings question type
4. Fix data loss on page refresh
5. Ensure all question types work correctly

---

## 🚨 REPORTED PROBLEMS

### Problem 1: Test Not Saving
```
User creates/edits test → clicks Save → appears to save
User refreshes page → all changes lost (404 or data gone)
```

**Root causes to investigate:**
- Backend save endpoint not working
- Frontend not sending data correctly
- Database transaction not committing
- Route redirect failing
- State management issue

---

### Problem 2: 404 Error on Edit
```
URL: ildiz-testing.uz/uniqueacademy/admin/tests/{uuid}/edit/tests
Error: 404 Page not found
```

**Root causes to investigate:**
- Route definition missing
- Incorrect URL pattern
- UUID parameter not passed correctly
- Component not registered

---

### Problem 3: Missing Question Type
```
IELTS Reading has "Matching Headings" question type
Platform does not support this type
Need to add it to question_type choices
```

**Required:**
- Add 'matching_headings' to Question.QUESTION_TYPES
- Add UI for creating this question type
- Support in test interface

---

## 📋 DIAGNOSTIC STEPS

### Step 1: Analyze Test Save Flow

**Backend - Check these files:**
```
backend/apps/tests/models.py
backend/apps/tests/views.py
backend/apps/tests/serializers.py
```

**Look for:**
```python
# Test model
class Test(models.Model):
    def save(self, *args, **kwargs):
        # Check if actually saving to DB
        super().save(*args, **kwargs)

# Test ViewSet
class TestViewSet(viewsets.ModelViewSet):
    def create(self, request):
        # Check if returning correct response
        
    def update(self, request, pk=None):
        # Check if saving edits
```

**Common issues:**
```python
# ❌ Not committing transaction
@transaction.atomic  # Missing decorator

# ❌ Not saving related objects
test.save()  # Saved
passages.save()  # NOT saved - missing!

# ❌ Wrong response format
return Response({'test': test})  # Wrong
return Response({'id': test.id, 'success': True})  # Correct
```

---

### Step 2: Analyze Routes

**Frontend - Check these files:**
```
frontend/src/routes/center.routes.tsx
frontend/src/routes/admin.routes.tsx
```

**Look for:**
```typescript
// Route pattern should match URL
{
  path: ':orgSlug/admin/tests/:testId/edit',  // Correct
  element: <TestEdit />
}

// NOT:
{
  path: 'tests/:testId/edit/tests',  // Wrong - extra /tests
  element: <TestEdit />
}
```

**Common issues:**
```typescript
// ❌ Wrong parameter name
<Route path=":id/edit" />  // URL has :testId

// ❌ Missing parent route
<Route path="/admin">  // Missing :orgSlug

// ❌ Component not imported
element: <TestEdit />  // But import missing
```

---

### Step 3: Analyze State Management

**Frontend - Check these files:**
```
frontend/src/pages/admin/TestEdit.tsx
frontend/src/pages/admin/TestCreate.tsx
```

**Look for:**
```typescript
// State persistence
const [test, setTest] = useState<Test | null>(null);

useEffect(() => {
  // Does it fetch existing test data?
  fetchTest(testId);
}, [testId]);

const handleSave = async () => {
  // Does it actually send to backend?
  const response = await api.post('/tests/', test);
  
  // Does it handle response?
  if (response.data.id) {
    navigate(`/tests/${response.data.id}`);
  }
};
```

**Common issues:**
```typescript
// ❌ Not fetching existing data
useEffect(() => {
  // Empty - no data load!
}, []);

// ❌ Not sending all fields
const payload = { name: test.name };  // Missing passages, questions!

// ❌ Not waiting for save
handleSave();  // No await
navigate('/tests');  // Navigates before save completes!
```

---

## ✅ REQUIRED FIXES

### Fix 1: Add Matching Headings Question Type

**File:** `backend/apps/tests/models.py`

```python
class Question(models.Model):
    QUESTION_TYPES = [
        ('mcq', 'Multiple Choice'),
        ('tfng', 'True/False/Not Given'),
        ('ynng', 'Yes/No/Not Given'),
        ('fill', 'Fill in the Blank'),
        ('gap_fill', 'Gap Fill'),
        ('matching', 'Matching'),
        ('matching_headings', 'Matching Headings'),  # ✅ ADD THIS
        ('short_answer', 'Short Answer'),
        ('form_completion', 'Form Completion'),
        ('map_labeling', 'Map Labeling'),
        ('summary_completion', 'Summary Completion'),
        ('sentence_completion', 'Sentence Completion'),
        ('diagram_labeling', 'Diagram Labeling'),
    ]
    
    question_type = models.CharField(
        max_length=50,
        choices=QUESTION_TYPES,
        default='mcq'
    )
    
    # For matching headings - store options as JSON
    options = models.JSONField(
        null=True,
        blank=True,
        help_text='For MCQ, Matching, Matching Headings - list of options'
    )
    
    # Correct answer - can be single or list
    correct_answer = models.CharField(max_length=500)
```

**Migration:**
```bash
python manage.py makemigrations
python manage.py migrate
```

---

### Fix 2: Correct Test Save Backend

**File:** `backend/apps/tests/views.py`

```python
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

class TestViewSet(viewsets.ModelViewSet):
    queryset = Test.objects.all()
    serializer_class = TestSerializer
    
    @transaction.atomic  # ✅ Ensure atomic transaction
    def create(self, request):
        """Create new test with passages and questions"""
        
        # Validate data
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Save test
        test = serializer.save()
        
        # Save passages (if Reading)
        if request.data.get('passages'):
            for passage_data in request.data['passages']:
                passage = Passage.objects.create(
                    test=test,
                    title=passage_data['title'],
                    content=passage_data['content'],
                    order=passage_data.get('order', 1)
                )
                
                # Save questions for this passage
                if passage_data.get('questions'):
                    for q_data in passage_data['questions']:
                        Question.objects.create(
                            passage=passage,
                            question_type=q_data['question_type'],
                            text=q_data['text'],
                            options=q_data.get('options'),
                            correct_answer=q_data['correct_answer'],
                            order=q_data.get('order', 1)
                        )
        
        # Return complete data
        return Response({
            'id': str(test.id),
            'success': True,
            'message': 'Test created successfully',
            'test': TestSerializer(test).data
        }, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def update(self, request, pk=None):
        """Update existing test"""
        
        test = self.get_object()
        
        # Update test fields
        serializer = self.get_serializer(test, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        # Update passages if provided
        if 'passages' in request.data:
            # Delete old passages
            test.passages.all().delete()
            
            # Create new passages
            for passage_data in request.data['passages']:
                passage = Passage.objects.create(
                    test=test,
                    title=passage_data['title'],
                    content=passage_data['content'],
                    order=passage_data.get('order', 1)
                )
                
                # Create questions
                if passage_data.get('questions'):
                    for q_data in passage_data['questions']:
                        Question.objects.create(
                            passage=passage,
                            question_type=q_data['question_type'],
                            text=q_data['text'],
                            options=q_data.get('options'),
                            correct_answer=q_data['correct_answer'],
                            order=q_data.get('order', 1)
                        )
        
        return Response({
            'id': str(test.id),
            'success': True,
            'message': 'Test updated successfully',
            'test': TestSerializer(test).data
        })
```

---

### Fix 3: Correct Frontend Routes

**File:** `frontend/src/routes/admin.routes.tsx`

```typescript
import { RouteObject } from 'react-router-dom';
import AdminLayout from '@/layouts/AdminLayout';
import TestsList from '@/pages/admin/TestsList';
import TestCreate from '@/pages/admin/TestCreate';
import TestEdit from '@/pages/admin/TestEdit';

export const adminRoutes: RouteObject[] = [
  {
    path: '/:orgSlug/admin',
    element: <AdminLayout />,
    children: [
      {
        path: 'tests',
        element: <TestsList />
      },
      {
        path: 'tests/create',
        element: <TestCreate />
      },
      {
        path: 'tests/:testId/edit',  // ✅ Correct route
        element: <TestEdit />
      },
    ]
  }
];
```

---

### Fix 4: Test Edit Component

**File:** `frontend/src/pages/admin/TestEdit.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

export const TestEdit: React.FC = () => {
  const { orgSlug, testId } = useParams();
  const navigate = useNavigate();
  
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // ✅ Fetch existing test data
  useEffect(() => {
    fetchTest();
  }, [testId]);
  
  const fetchTest = async () => {
    try {
      const response = await api.get(`/tests/${testId}/`);
      setTest(response.data);
    } catch (error) {
      console.error('Failed to fetch test:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // ✅ Save changes
  const handleSave = async () => {
    setSaving(true);
    
    try {
      const response = await api.put(`/tests/${testId}/`, test);
      
      if (response.data.success) {
        alert('Test saved successfully!');
        navigate(`/${orgSlug}/admin/tests`);
      }
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save test');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Edit Test</h1>
      
      {/* Test form */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Test Name
          </label>
          <input
            type="text"
            value={test?.name || ''}
            onChange={(e) => setTest({ ...test, name: e.target.value })}
            className="w-full border rounded-lg px-4 py-2"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Module
          </label>
          <select
            value={test?.module || 'reading'}
            onChange={(e) => setTest({ ...test, module: e.target.value })}
            className="w-full border rounded-lg px-4 py-2"
          >
            <option value="reading">Reading</option>
            <option value="listening">Listening</option>
            <option value="writing">Writing</option>
            <option value="speaking">Speaking</option>
          </select>
        </div>
        
        {/* Passages editor */}
        {test?.module === 'reading' && (
          <div className="mb-4">
            <h2 className="text-xl font-bold mb-4">Passages</h2>
            {/* Passage editor component */}
          </div>
        )}
        
        {/* Save button */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          
          <button
            onClick={() => navigate(`/${orgSlug}/admin/tests`)}
            className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-6 py-2 rounded-lg font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

### Fix 5: Add Matching Headings UI

**File:** `frontend/src/components/QuestionTypeSelector.tsx`

```typescript
export const QuestionTypeSelector: React.FC = ({ value, onChange }) => {
  const questionTypes = [
    { value: 'mcq', label: 'Multiple Choice' },
    { value: 'tfng', label: 'True/False/Not Given' },
    { value: 'ynng', label: 'Yes/No/Not Given' },
    { value: 'fill', label: 'Fill in the Blank' },
    { value: 'matching_headings', label: 'Matching Headings' },  // ✅ ADD
    { value: 'short_answer', label: 'Short Answer' },
  ];
  
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {questionTypes.map(type => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </select>
  );
};
```

---

## 🔍 TESTING CHECKLIST

After implementing fixes, test:

```bash
# 1. Create new test
✓ Navigate to /admin/tests/create
✓ Fill in test name, module
✓ Add passages and questions
✓ Click Save
✓ Verify redirect to test list
✓ Verify test appears in list

# 2. Edit existing test
✓ Navigate to /admin/tests/{id}/edit
✓ Verify existing data loads
✓ Make changes
✓ Click Save
✓ Refresh page
✓ Verify changes persisted

# 3. Matching Headings question
✓ Create Reading test
✓ Add passage
✓ Add question, select "Matching Headings"
✓ Add options (heading list)
✓ Set correct answer
✓ Save
✓ Verify in database

# 4. No 404 errors
✓ All routes work
✓ No console errors
✓ Data loads correctly
```

---

## 📊 EXPECTED RESULTS

**Before:**
```
❌ Test edit → 404 error
❌ Test save → data lost on refresh
❌ Matching Headings → not available
```

**After:**
```
✅ Test edit → loads correctly
✅ Test save → persists in database
✅ Matching Headings → available and working
✅ All routes work
✅ No data loss
```

---

## 🚀 IMPLEMENTATION INSTRUCTIONS

**CURSOR AGENT - DO THIS:**

1. **Analyze current codebase:**
   - Check backend/apps/tests/models.py
   - Check backend/apps/tests/views.py
   - Check frontend/src/routes/
   - Check frontend/src/pages/admin/

2. **Identify root causes:**
   - Why tests not saving?
   - Why 404 on edit?
   - What's missing for Matching Headings?

3. **Implement all fixes above:**
   - Add question type
   - Fix save transactions
   - Fix routes
   - Fix state management

4. **Test everything:**
   - Create test
   - Edit test
   - Save test
   - Verify persistence

5. **Report results:**
   - List all files changed
   - List all fixes applied
   - Confirm all tests pass

---

**START ANALYSIS AND IMPLEMENTATION NOW.**

DO NOT just acknowledge - actually implement all fixes and test them.
