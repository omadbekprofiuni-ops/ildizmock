# CURSOR AGENT - IELTS LISTENING TEST WITH PLAY-ONCE AUDIO

**REQUIREMENT:** Real IELTS format listening test
- User clicks PLAY to start audio
- Once playing, CANNOT pause or stop
- No rewind, no seeking
- Audio plays ONCE only
- Auto-advances to next part when finished

---

## 🎯 IMPLEMENTATION SPEC

### User Flow:

```
1. Mock session START → Student enters test
2. Listening Test page opens
3. Shows: Part 1 with ▶️ PLAY button
4. User clicks PLAY
5. Audio starts playing
6. Controls DISAPPEAR or become disabled
7. Audio plays to completion (cannot pause)
8. When Part 1 ends → Auto-advance to Part 2
9. Part 2 shows ▶️ PLAY button
10. Repeat for all 4 parts
11. After Part 4 → Test complete
```

---

## 🚀 FRONTEND IMPLEMENTATION

### File: Find and update Listening Test component

**Likely locations:**
- `frontend/src/pages/student/ListeningTestPage.tsx`
- `frontend/src/pages/student/TestTakingPage.tsx`
- `frontend/src/components/ListeningTest.tsx`

**Complete implementation:**

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';

interface ListeningPart {
  id: number;
  part_number: number;
  audio_url: string;
  duration: number;
  questions: any[];
}

export const ListeningTestPage: React.FC = () => {
  const { testId, sessionId } = useParams();
  const navigate = useNavigate();
  
  const [testData, setTestData] = useState<any>(null);
  const [currentPart, setCurrentPart] = useState(1);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [audioEnded, setAudioEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Load test data
  useEffect(() => {
    loadTest();
  }, []);
  
  const loadTest = async () => {
    try {
      const response = await api.get(`/student/listening-test/${testId}/`);
      setTestData(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load test');
      setLoading(false);
    }
  };
  
  // Get current part data
  const getCurrentPart = (): ListeningPart | null => {
    if (!testData || !testData.parts) return null;
    return testData.parts.find((p: ListeningPart) => p.part_number === currentPart);
  };
  
  const part = getCurrentPart();
  
  // Handle PLAY button click
  const handlePlayAudio = () => {
    if (!audioRef.current || !part) return;
    
    // Start playing
    audioRef.current.play()
      .then(() => {
        setAudioStarted(true);
        setAudioPlaying(true);
        toast.success(`Part ${currentPart} audio started`, {
          icon: '🎧',
          duration: 2000
        });
      })
      .catch(error => {
        console.error('Play error:', error);
        toast.error('Failed to play audio');
      });
  };
  
  // Audio event handlers
  const handleAudioPlay = () => {
    setAudioPlaying(true);
  };
  
  const handleAudioPause = () => {
    // If user tries to pause, auto-resume
    if (audioStarted && !audioEnded && audioRef.current) {
      console.log('Pause blocked - auto-resuming');
      audioRef.current.play();
    }
  };
  
  const handleAudioEnded = () => {
    console.log(`Part ${currentPart} audio ended`);
    setAudioPlaying(false);
    setAudioEnded(true);
    
    toast.success(`Part ${currentPart} completed!`, {
      icon: '✅',
      duration: 3000
    });
    
    // Auto-advance to next part after 2 seconds
    setTimeout(() => {
      if (currentPart < 4) {
        setCurrentPart(currentPart + 1);
        setAudioStarted(false);
        setAudioEnded(false);
      } else {
        // Test complete
        toast.success('Listening test completed!');
        // Navigate to next section or complete
      }
    }, 2000);
  };
  
  const handleAudioError = (e: any) => {
    console.error('Audio error:', e);
    toast.error('Audio failed to load. Please contact administrator.');
  };
  
  // Prevent seeking
  const handleSeeking = () => {
    if (audioRef.current && audioStarted) {
      // Block seeking by resetting to current time
      audioRef.current.currentTime = audioRef.current.currentTime;
      console.log('Seeking blocked');
    }
  };
  
  // Reset audio when part changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [currentPart]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">🎧</div>
          <p className="text-xl text-gray-600">Loading test...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Listening Test
            </h1>
            <p className="text-sm text-gray-600">{testData?.name}</p>
          </div>
          
          {/* Timer (if needed) */}
          <div className="text-3xl font-bold text-gray-900">
            {/* Timer component */}
          </div>
        </div>
      </div>
      
      {/* Audio Player Section */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Part indicator */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {[1, 2, 3, 4].map(partNum => (
              <div
                key={partNum}
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                  partNum === currentPart
                    ? 'bg-primary-600 text-white'
                    : partNum < currentPart
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {partNum}
              </div>
            ))}
          </div>
          
          {/* Audio status */}
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">
              {!audioStarted ? '🎧' : audioPlaying ? '🔊' : '✅'}
            </div>
            
            {!audioStarted && (
              <p className="text-lg text-gray-700">
                Ready to play Part {currentPart}
              </p>
            )}
            
            {audioStarted && audioPlaying && (
              <p className="text-lg text-green-700 font-semibold">
                Playing Part {currentPart}...
              </p>
            )}
            
            {audioEnded && (
              <p className="text-lg text-green-700 font-semibold">
                Part {currentPart} complete! {currentPart < 4 ? 'Moving to next part...' : 'Test complete!'}
              </p>
            )}
          </div>
          
          {/* PLAY button - only show before audio starts */}
          {!audioStarted && part && (
            <div className="flex justify-center mb-6">
              <button
                onClick={handlePlayAudio}
                className="bg-green-600 hover:bg-green-700 text-white px-12 py-4 rounded-full text-xl font-bold shadow-lg hover:shadow-xl transition flex items-center gap-3"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                START Part {currentPart}
              </button>
            </div>
          )}
          
          {/* Playing indicator */}
          {audioStarted && !audioEnded && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <p className="text-yellow-800 font-semibold">
                ⚠️ Audio is playing. You cannot pause or rewind.
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Real IELTS format: Audio plays once only
              </p>
            </div>
          )}
          
          {/* Hidden audio element - NO CONTROLS SHOWN */}
          <audio
            ref={audioRef}
            src={part?.audio_url}
            onPlay={handleAudioPlay}
            onPause={handleAudioPause}
            onEnded={handleAudioEnded}
            onError={handleAudioError}
            onSeeking={handleSeeking}
            className="hidden"
            // Disable context menu (right-click)
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      </div>
      
      {/* Questions Section */}
      <div className="px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Part {currentPart} Questions
            </h2>
            
            {part?.questions.map((question: any, index: number) => (
              <div key={question.id} className="mb-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold flex-shrink-0">
                    {question.order}
                  </div>
                  
                  <div className="flex-1">
                    <p className="text-gray-900 mb-3">{question.text}</p>
                    
                    {/* Question input based on type */}
                    {question.question_type === 'fill' && (
                      <input
                        type="text"
                        placeholder="Type your answer..."
                        className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2"
                        disabled={!audioStarted}
                      />
                    )}
                    
                    {question.question_type === 'mcq' && question.options && (
                      <div className="space-y-2">
                        {question.options.map((option: string, idx: number) => (
                          <label key={idx} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name={`q${question.id}`}
                              value={option}
                              disabled={!audioStarted}
                              className="w-5 h-5"
                            />
                            <span className="text-gray-700">{option}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Instructions footer */}
      <div className="bg-blue-50 border-t border-blue-200 px-8 py-4">
        <div className="max-w-4xl mx-auto text-center text-sm text-blue-800">
          <p className="font-semibold">📝 Instructions:</p>
          <p>Click PLAY to start the audio. Once playing, you cannot pause or rewind. Answer questions while listening.</p>
        </div>
      </div>
    </div>
  );
};
```

---

## 🎯 KEY FEATURES IMPLEMENTED

### 1. Play-Once Control
```typescript
// User clicks PLAY button
handlePlayAudio() {
  audio.play();
  setAudioStarted(true);
}

// If user tries to pause, auto-resume
handleAudioPause() {
  if (audioStarted && !audioEnded) {
    audio.play(); // Force continue
  }
}

// Prevent seeking
handleSeeking() {
  audio.currentTime = audio.currentTime; // Block
}
```

### 2. Auto-Advance Between Parts
```typescript
handleAudioEnded() {
  if (currentPart < 4) {
    setTimeout(() => {
      setCurrentPart(currentPart + 1);
      setAudioStarted(false);
    }, 2000);
  }
}
```

### 3. Visual States
```typescript
State 1: Before play → Show ▶️ PLAY button
State 2: Playing → Hide button, show "Playing..."
State 3: Ended → Show "Complete!", auto-advance
```

### 4. No Audio Controls Visible
```typescript
<audio 
  className="hidden"  // Completely hidden
  // No controls attribute
/>
```

---

## 🚨 ADDITIONAL SECURITY

### Prevent right-click download:
```typescript
<audio
  onContextMenu={(e) => e.preventDefault()}
/>
```

### Prevent keyboard shortcuts:
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Block space (pause), arrow keys (seek)
    if (audioPlaying && ['Space', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [audioPlaying]);
```

---

## ✅ TESTING CHECKLIST

After implementation:

```
✅ PLAY button visible before audio starts
✅ Clicking PLAY starts audio
✅ PLAY button disappears after starting
✅ Cannot pause (auto-resumes if paused)
✅ Cannot seek/rewind
✅ Cannot control with keyboard
✅ Auto-advances to Part 2 when Part 1 ends
✅ All 4 parts work sequentially
✅ Questions are answerable while audio plays
✅ Clean professional UI
```

---

## 🎯 EXPECTED USER EXPERIENCE

```
User clicks PLAY for Part 1
↓
Audio starts playing
↓
PLAY button disappears
↓
Warning: "Audio is playing. Cannot pause or rewind."
↓
User answers questions while listening
↓
Part 1 ends
↓
"Part 1 complete! Moving to Part 2..."
↓
2 seconds later → Part 2 PLAY button appears
↓
Repeat for Parts 2, 3, 4
↓
"Test complete!"
```

---

## 🚀 IMPLEMENTATION STEPS

**CURSOR AGENT - EXECUTE:**

1. Find ListeningTestPage component
2. Replace with implementation above
3. Add keyboard block handlers
4. Test all 4 parts
5. Verify play-once functionality
6. Verify auto-advance
7. Polish UI/UX

**File location likely:**
- `frontend/src/pages/student/ListeningTestPage.tsx`
- Or create new if doesn't exist

---

**START IMPLEMENTATION NOW. CREATE PROFESSIONAL IELTS LISTENING EXPERIENCE.**
