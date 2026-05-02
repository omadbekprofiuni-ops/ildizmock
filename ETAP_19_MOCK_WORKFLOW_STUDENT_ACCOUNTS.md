# ETAP 19: MOCK SESSION WORKFLOW & STUDENT ACCOUNTS

**Maqsad:** Professional mock session workflow - teacher link tashaydi, student o'z ismini tanlaydi, persistent account bilan results tracking.

---

## 🔄 WORKFLOW TAHLILI

### Current vs Required Workflow:

**❌ CURRENT (Wrong):**
```
1. Student manually registers
2. Student searches for test
3. Student starts test
4. Results lost after session
5. No teacher control
```

**✅ REQUIRED (IELTStation Style):**
```
1. Teacher creates mock session
2. Teacher adds students to session (pre-register)
3. Teacher starts session → Gets shareable link
4. Teacher shares link (Telegram/WhatsApp)
5. Student clicks link → Sees name list
6. Student selects their name → Test starts
7. Results saved to student account
8. Student logs in later → Views all results
```

---

## 🎯 ARCHITECTURE

### 3-Tier System:

```
┌─────────────────────────────────────────────┐
│  TIER 1: Guest Access (One-time)            │
│  - Click link → Select name → Take test     │
│  - No login required                        │
│  - Results visible only during session      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  TIER 2: Student Account (Persistent)       │
│  - Teacher creates account + credentials    │
│  - Student logs in with username/password   │
│  - Results history saved permanently        │
│  - Progress tracking                        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  TIER 3: Auto-Linking (Best Experience)     │
│  - Guest test result auto-links to account  │
│  - Student logs in → Sees ALL tests         │
│  - Seamless experience                      │
└─────────────────────────────────────────────┘
```

---

## 📋 DATABASE MODELS

### A) MockSession Updates

**Fayl:** `backend/apps/mock/models.py`

```python
import secrets
import string

class MockSession(models.Model):
    """
    Mock session with shareable link and pre-registered participants
    """
    
    # ... existing fields ...
    
    # Shareable Link
    session_code = models.CharField(
        max_length=12,
        unique=True,
        blank=True,
        verbose_name='Session Code',
        help_text='Unique code for shareable link (e.g., ABC123XYZ)'
    )
    
    link_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Link Expiry',
        help_text='When the join link expires'
    )
    
    # Access Control
    allow_late_join = models.BooleanField(
        default=True,
        verbose_name='Allow Late Join',
        help_text='Can students join after session started?'
    )
    
    require_account = models.BooleanField(
        default=False,
        verbose_name='Require Student Account',
        help_text='Must students have an account to join?'
    )
    
    def save(self, *args, **kwargs):
        # Generate session code if not exists
        if not self.session_code:
            self.session_code = self.generate_session_code()
        
        super().save(*args, **kwargs)
    
    @staticmethod
    def generate_session_code():
        """Generate unique 12-character session code"""
        chars = string.ascii_uppercase + string.digits
        while True:
            code = ''.join(secrets.choice(chars) for _ in range(12))
            if not MockSession.objects.filter(session_code=code).exists():
                return code
    
    def get_join_url(self):
        """Get full join URL for students"""
        from django.conf import settings
        base_url = settings.FRONTEND_URL
        return f"{base_url}/join/{self.session_code}"
    
    def is_join_allowed(self):
        """Check if students can still join"""
        from django.utils import timezone
        
        # Check expiry
        if self.link_expires_at and timezone.now() > self.link_expires_at:
            return False
        
        # Check status
        if self.status == 'finished':
            return False
        
        # Check late join
        if self.status == 'in_progress' and not self.allow_late_join:
            return False
        
        return True


class MockParticipant(models.Model):
    """
    Pre-registered participant for a mock session
    Can be:
    1. Guest (no account) - one-time access
    2. Student (with account) - persistent results
    """
    
    session = models.ForeignKey(
        MockSession,
        on_delete=models.CASCADE,
        related_name='participants',
        verbose_name='Session'
    )
    
    # Identity
    student = models.ForeignKey(
        'students.StudentProfile',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='mock_participants',
        verbose_name='Student Account'
    )
    
    # For guests (no account)
    guest_name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Guest Name',
        help_text='Name for one-time participants'
    )
    
    guest_email = models.EmailField(
        blank=True,
        verbose_name='Guest Email'
    )
    
    # Status
    has_joined = models.BooleanField(
        default=False,
        verbose_name='Has Joined',
        help_text='Did participant join the session?'
    )
    
    joined_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Joined At'
    )
    
    # One-time access token (for guests)
    access_token = models.CharField(
        max_length=64,
        unique=True,
        blank=True,
        verbose_name='Access Token'
    )
    
    def save(self, *args, **kwargs):
        # Generate access token for guests
        if not self.student and not self.access_token:
            self.access_token = secrets.token_urlsafe(32)
        
        super().save(*args, **kwargs)
    
    def get_display_name(self):
        """Get participant display name"""
        if self.student:
            return self.student.user.get_full_name()
        return self.guest_name
    
    @property
    def is_guest(self):
        """Check if participant is guest"""
        return self.student is None
    
    class Meta:
        unique_together = ['session', 'student']
```

---

### B) Student Account Model

**Fayl:** `backend/apps/students/models.py`

```python
from django.contrib.auth import get_user_model

User = get_user_model()


class StudentProfile(models.Model):
    """
    Student profile for persistent results and progress tracking
    """
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='student_profile',
        verbose_name='User Account'
    )
    
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='students',
        verbose_name='Organization'
    )
    
    # Student Info
    student_id = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Student ID',
        help_text='Internal student ID'
    )
    
    date_of_birth = models.DateField(
        null=True,
        blank=True,
        verbose_name='Date of Birth'
    )
    
    phone = models.CharField(
        max_length=20,
        blank=True,
        verbose_name='Phone Number'
    )
    
    # Target Score
    target_band = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        null=True,
        blank=True,
        verbose_name='Target Band Score',
        help_text='e.g., 7.0'
    )
    
    # Status
    is_active = models.BooleanField(
        default=True,
        verbose_name='Active'
    )
    
    enrollment_date = models.DateField(
        auto_now_add=True,
        verbose_name='Enrollment Date'
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'student_profiles'
        verbose_name = 'Student Profile'
        verbose_name_plural = 'Student Profiles'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.organization.name}"
    
    def get_overall_progress(self):
        """Calculate overall progress"""
        attempts = self.user.attempts.filter(
            is_submitted=True
        )
        
        if not attempts.exists():
            return None
        
        # Calculate average band score
        avg_band = attempts.aggregate(
            avg=models.Avg('overall_band_score')
        )['avg']
        
        return {
            'total_tests': attempts.count(),
            'average_band': round(avg_band, 1) if avg_band else None,
            'target_band': self.target_band,
            'progress_percentage': self._calculate_progress_percentage(avg_band)
        }
    
    def _calculate_progress_percentage(self, current_band):
        """Calculate progress towards target"""
        if not self.target_band or not current_band:
            return 0
        
        # Assume starting from band 4.0
        starting_band = 4.0
        
        progress = ((current_band - starting_band) / 
                   (float(self.target_band) - starting_band)) * 100
        
        return min(100, max(0, round(progress)))


class StudentResult(models.Model):
    """
    Individual test result for a student
    Links mock attempts to student account
    """
    
    student = models.ForeignKey(
        StudentProfile,
        on_delete=models.CASCADE,
        related_name='results',
        verbose_name='Student'
    )
    
    attempt = models.OneToOneField(
        'tests.Attempt',
        on_delete=models.CASCADE,
        related_name='student_result',
        verbose_name='Test Attempt'
    )
    
    # Session info (if from mock)
    mock_session = models.ForeignKey(
        'mock.MockSession',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='student_results',
        verbose_name='Mock Session'
    )
    
    # Metadata
    taken_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'student_results'
        ordering = ['-taken_at']
    
    def __str__(self):
        return f"{self.student.user.get_full_name()} - {self.attempt.test.name}"
```

---

## 🔧 IMPLEMENTATION

### STEP 1: Teacher Creates Mock Session with Pre-registered Students

**Fayl:** `backend/apps/mock/views.py`

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from datetime import timedelta
from django.utils import timezone


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_mock_session_with_participants(request):
    """
    Teacher creates mock session and adds students
    """
    
    # Permission check
    if request.user.role not in ['teacher', 'admin']:
        return Response({'error': 'Permission denied'}, status=403)
    
    # Get data
    group_id = request.data.get('group_id')
    scheduled_time = request.data.get('scheduled_time')
    participant_ids = request.data.get('participant_ids', [])  # List of student IDs
    
    # Create session
    session = MockSession.objects.create(
        organization=request.user.library,
        group_id=group_id,
        teacher=request.user,
        scheduled_time=scheduled_time,
        status='scheduled',
        allow_late_join=True,
        link_expires_at=timezone.now() + timedelta(days=7)
    )
    
    # Add participants
    from apps.students.models import StudentProfile
    
    participants_added = []
    for student_id in participant_ids:
        student = StudentProfile.objects.get(pk=student_id)
        
        participant = MockParticipant.objects.create(
            session=session,
            student=student
        )
        
        participants_added.append({
            'id': participant.id,
            'name': student.user.get_full_name(),
            'email': student.user.email
        })
    
    # Generate join URL
    join_url = session.get_join_url()
    
    return Response({
        'success': True,
        'session': {
            'id': session.id,
            'code': session.session_code,
            'join_url': join_url,
            'participants': participants_added,
            'expires_at': session.link_expires_at
        }
    })


@api_view(['GET'])
def get_session_participants(request, session_code):
    """
    Public endpoint - get list of participants for join page
    """
    
    session = get_object_or_404(MockSession, session_code=session_code)
    
    # Check if join allowed
    if not session.is_join_allowed():
        return Response({
            'error': 'Session is no longer accepting participants',
            'status': session.status
        }, status=403)
    
    # Get participants
    participants = session.participants.all()
    
    participant_list = []
    for p in participants:
        participant_list.append({
            'id': p.id,
            'name': p.get_display_name(),
            'has_joined': p.has_joined,
            'is_guest': p.is_guest
        })
    
    return Response({
        'session': {
            'id': session.id,
            'code': session.session_code,
            'group': session.group.name,
            'status': session.status
        },
        'participants': participant_list
    })


@api_view(['POST'])
def join_session(request, session_code):
    """
    Student joins session by selecting their name
    """
    
    session = get_object_or_404(MockSession, session_code=session_code)
    
    # Check if join allowed
    if not session.is_join_allowed():
        return Response({
            'error': 'Cannot join session'
        }, status=403)
    
    # Get participant ID
    participant_id = request.data.get('participant_id')
    
    participant = get_object_or_404(
        MockParticipant,
        pk=participant_id,
        session=session
    )
    
    # Check if already joined
    if participant.has_joined:
        return Response({
            'error': 'Already joined this session'
        }, status=400)
    
    # Mark as joined
    participant.has_joined = True
    participant.joined_at = timezone.now()
    participant.save()
    
    # Generate access token for test
    access_token = participant.access_token
    
    return Response({
        'success': True,
        'access_token': access_token,
        'participant': {
            'id': participant.id,
            'name': participant.get_display_name(),
            'is_guest': participant.is_guest
        },
        'session': {
            'id': session.id,
            'status': session.status,
            'tests': session.get_test_list()
        }
    })
```

---

### STEP 2: Frontend - Join Session Page

**Fayl:** `frontend/src/pages/JoinSessionPage.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

interface Participant {
  id: number;
  name: string;
  has_joined: boolean;
  is_guest: boolean;
}

export const JoinSessionPage: React.FC = () => {
  const { sessionCode } = useParams();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    fetchSessionInfo();
  }, [sessionCode]);
  
  const fetchSessionInfo = async () => {
    try {
      const response = await api.get(`/mock/join/${sessionCode}/participants/`);
      
      setSession(response.data.session);
      setParticipants(response.data.participants);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Session not found');
    } finally {
      setLoading(false);
    }
  };
  
  const handleJoin = async () => {
    if (!selectedParticipant) {
      return;
    }
    
    try {
      const response = await api.post(`/mock/join/${sessionCode}/`, {
        participant_id: selectedParticipant
      });
      
      // Store access token
      localStorage.setItem('mock_access_token', response.data.access_token);
      
      // Redirect to test
      navigate(`/mock/session/${session.id}/test`);
      
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to join');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
          <div className="text-red-600 text-xl font-bold mb-4">
            ❌ {error}
          </div>
          <p className="text-gray-600">
            This session may have expired or been cancelled.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="text-center">
            <div className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg font-bold text-xl mb-4">
              IELTS
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Join Mock Exam Session
            </h1>
            
            <p className="text-gray-600">
              {session.group} • Session Code: {session.code}
            </p>
            
            <div className="mt-4 inline-block">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                session.status === 'scheduled'
                  ? 'bg-blue-100 text-blue-700'
                  : session.status === 'in_progress'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {session.status === 'scheduled' ? '⏰ Scheduled' :
                 session.status === 'in_progress' ? '▶️ In Progress' :
                 'Finished'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Participant Selection */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Select Your Name
          </h2>
          
          <p className="text-gray-600 mb-6">
            Click on your name to join the session. If your name is not listed, please contact your teacher.
          </p>
          
          <div className="space-y-3">
            {participants.map(participant => (
              <button
                key={participant.id}
                onClick={() => setSelectedParticipant(participant.id)}
                disabled={participant.has_joined}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  participant.has_joined
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    : selectedParticipant === participant.id
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      participant.has_joined
                        ? 'bg-gray-200 text-gray-500'
                        : selectedParticipant === participant.id
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-300 text-gray-700'
                    }`}>
                      {participant.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div>
                      <div className="font-semibold text-gray-900">
                        {participant.name}
                      </div>
                      {participant.is_guest && (
                        <div className="text-xs text-gray-500">
                          Guest
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {participant.has_joined && (
                    <span className="text-green-600 font-semibold">
                      ✓ Joined
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
          
          {/* Join Button */}
          <button
            onClick={handleJoin}
            disabled={!selectedParticipant}
            className={`w-full mt-6 py-4 rounded-lg font-semibold text-lg transition-all ${
              selectedParticipant
                ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {selectedParticipant ? '→ Start Test' : 'Select Your Name First'}
          </button>
        </div>
        
        {/* Info */}
        <div className="mt-6 text-center text-gray-600 text-sm">
          <p>
            ⚠️ Make sure you select the correct name. 
            You will not be able to change it after joining.
          </p>
        </div>
      </div>
    </div>
  );
};
```

---

### STEP 3: Teacher Creates Student Accounts

**Fayl:** `frontend/src/pages/center/CreateStudentAccount.tsx`

```typescript
import React, { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';

export const CreateStudentAccount: React.FC = () => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    target_band: '',
  });
  
  const [credentials, setCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await api.post('/students/create/', formData);
      
      setCredentials({
        username: response.data.username,
        password: response.data.password
      });
      
      toast.success('Student account created!');
      
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create account');
    }
  };
  
  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Create Student Account
        </h1>
        
        {!credentials ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-3"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-3"
                placeholder="+998 90 123 45 67"
                required
              />
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Target Band Score
                </label>
                <select
                  value={formData.target_band}
                  onChange={(e) => setFormData({...formData, target_band: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3"
                >
                  <option value="">Select target...</option>
                  <option value="6.0">6.0</option>
                  <option value="6.5">6.5</option>
                  <option value="7.0">7.0</option>
                  <option value="7.5">7.5</option>
                  <option value="8.0">8.0</option>
                  <option value="8.5">8.5</option>
                  <option value="9.0">9.0</option>
                </select>
              </div>
            </div>
            
            <button
              type="submit"
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-semibold text-lg"
            >
              Create Account
            </button>
          </form>
        ) : (
          <div className="bg-green-50 border-2 border-green-600 rounded-xl p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Account Created Successfully!
              </h2>
              
              <div className="bg-white rounded-lg p-6 mb-6">
                <p className="text-gray-600 mb-4">
                  Give these credentials to the student:
                </p>
                
                <div className="space-y-3 text-left">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Username:
                    </label>
                    <div className="bg-gray-100 px-4 py-3 rounded-lg font-mono text-lg font-bold">
                      {credentials.username}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Password:
                    </label>
                    <div className="bg-gray-100 px-4 py-3 rounded-lg font-mono text-lg font-bold">
                      {credentials.password}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Username: ${credentials.username}\nPassword: ${credentials.password}`
                    );
                    toast.success('Copied to clipboard!');
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold"
                >
                  📋 Copy Credentials
                </button>
                
                <button
                  onClick={() => {
                    setCredentials(null);
                    setFormData({
                      first_name: '',
                      last_name: '',
                      email: '',
                      phone: '',
                      date_of_birth: '',
                      target_band: '',
                    });
                  }}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-semibold"
                >
                  Create Another
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

## ✅ COMPLETE WORKFLOW

### Teacher Side:

```
1. Create Student Accounts:
   - Teacher → Students → [+ Create Account]
   - Fill form → Submit
   - Get credentials (username + password)
   - Give to student (print, SMS, Telegram)

2. Create Mock Session:
   - Teacher → Mock Sessions → [+ Create]
   - Select group → Select students
   - Schedule time → Create
   - Get shareable link

3. Share Link:
   - Copy link: https://ildizmock.uz/join/ABC123XYZ
   - Send to students (Telegram group, WhatsApp)

4. Monitor Participants:
   - See who joined
   - See test progress
   - Grade Writing/Speaking
```

### Student Side:

```
1. Join via Link (Guest):
   - Click link → See name list
   - Select name → Start test
   - Complete test → See results
   - Results visible during session only

2. Login with Account (Persistent):
   - Go to ildizmock.uz
   - Login with credentials
   - Dashboard shows:
     - All test results
     - Progress chart
     - Target vs Current band
     - Strengths/Weaknesses
   
3. Join Mock + Auto-link:
   - Click link → Select name → Test
   - Later login with account
   - System links guest result to account
   - All results in one place!
```

---

**ETAP 19 TO'LIQ - PROFESSIONAL WORKFLOW!** 🎓
