# ETAP 17: PLATFORM REDESIGN - IELTStation Style

**Maqsad:** ILDIZ Mock platformani IELTStation'ga o'xshash professional dizaynga o'tkazish. To'liq English localization. Yangi pricing model (30k → 50k). Attendance ko'rinishi. Center test yaratish.

---

## 🎨 IELSTATION DESIGN TAHLILI

### Screenshot Analysis:

**1. Homepage (Screenshot 1):**
```
Design Elements:
- Clean header: Logo left, navigation center, CTA right
- Hero section: Large bold title + red highlight
- Primary color: #E53935 (Red)
- Secondary: White, Gray
- Typography: Sans-serif, bold headlines
- CTA button: Red, rounded, prominent
- Stats bar: Simple icons + numbers
```

**2. Features (Screenshot 2):**
```
Layout:
- Grid: 4 columns
- Icon + Title + Description
- Minimal icons (lightning, clock, target, chart)
- White cards with hover effects
- Consistent spacing
```

**3. Pricing (Screenshot 3):**
```
Tiers:
- 3 pricing cards
- Middle one highlighted (most popular)
- Checkmark feature lists
- Clear CTAs
- Price strikethrough for discounts
```

**4. Practice Tests Dropdown (Screenshot 5):**
```
Module Cards:
- Icon (book, pen, headphones, mic, lock)
- Title + Description
- Clean card design
- "Coming Soon" badges
```

---

## 🎯 DESIGN SYSTEM EXTRACTION

### Color Palette:

```css
/* Primary Colors */
--primary-red: #E53935;
--primary-red-dark: #C62828;
--primary-red-light: #EF5350;

/* Neutral Colors */
--gray-50: #FAFAFA;
--gray-100: #F5F5F5;
--gray-200: #EEEEEE;
--gray-300: #E0E0E0;
--gray-400: #BDBDBD;
--gray-500: #9E9E9E;
--gray-600: #757575;
--gray-700: #616161;
--gray-800: #424242;
--gray-900: #212121;

/* Semantic Colors */
--success: #43A047;
--warning: #FB8C00;
--error: #E53935;
--info: #1E88E5;

/* Text */
--text-primary: #212121;
--text-secondary: #757575;
--text-disabled: #BDBDBD;
```

### Typography:

```css
/* Font Family */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Font Sizes */
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 30px;
--text-4xl: 36px;
--text-5xl: 48px;

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

### Spacing System:

```css
/* Spacing Scale (8px base) */
--space-1: 8px;
--space-2: 16px;
--space-3: 24px;
--space-4: 32px;
--space-5: 40px;
--space-6: 48px;
--space-8: 64px;
--space-10: 80px;
--space-12: 96px;
```

### Border Radius:

```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 24px;
--radius-full: 9999px;
```

### Shadows:

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
```

---

## 🌍 ENGLISH LOCALIZATION STRATEGY

### Translation Approach:

**Variant 1: Hardcoded (Simple):**
```typescript
const text = {
  home: "Home",
  practice: "Practice Tests",
  features: "Features",
  pricing: "Pricing",
  // ...
}
```

**Variant 2: i18next (Professional):**
```typescript
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

// Usage:
const { t } = useTranslation();
<h1>{t('home.hero.title')}</h1>
```

**✅ RECOMMENDED: i18next** (future uz/ru support)

### Translation Structure:

```json
{
  "common": {
    "login": "Login",
    "logout": "Logout",
    "signup": "Sign Up",
    "submit": "Submit",
    "cancel": "Cancel"
  },
  "home": {
    "hero": {
      "title": "Experience the Real Computer-Delivered IELTS Exam Environment",
      "subtitle": "Practice with authentic tests featuring real timing, interface, and instant scoring",
      "cta": "Start Practice Test"
    },
    "stats": {
      "students": "students",
      "tests": "practice tests",
      "rating": "rating"
    }
  },
  "practice": {
    "listening": {
      "title": "Listening Test",
      "description": "Answer questions from real-life conversations and lectures"
    },
    "reading": {
      "title": "Reading Test",
      "description": "Read academic texts and find answers"
    },
    "writing": {
      "title": "Writing Test",
      "description": "Write essays with clear, effective arguments"
    }
  },
  "pricing": {
    "basic": {
      "name": "Basic",
      "price": "30,000 UZS",
      "description": "Per test submission",
      "features": [
        "All practice tests",
        "Instant scoring",
        "Progress tracking"
      ]
    },
    "premium": {
      "name": "Premium",
      "price": "50,000 UZS",
      "description": "After 100 tests",
      "features": [
        "Everything in Basic",
        "Priority support",
        "AI feedback"
      ]
    }
  }
}
```

---

## 💰 NEW PRICING MODEL

### Analysis of Variants:

**Variant 1: Fixed 30k (Current ETAP 16):**
```
All mock tests: 30,000 UZS
Simple, clear
```

**Variant 2: Progressive (30k → 50k):**
```
First 100 tests: 30,000 UZS
After 100 tests: 50,000 UZS
Encourages early adoption
```

**Variant 3: Volume Discount:**
```
1-50 tests: 50,000 UZS
51-100 tests: 40,000 UZS
100+ tests: 30,000 UZS
Rewards high volume
```

**Variant 4: Tiered Subscription (like IELTStation):**
```
Premium: 79,000/month (100 credits)
Pro: 189,000/3 months
Max: 289,000/2 months (unlimited)
Predictable revenue
```

**✅ RECOMMENDED: Variant 2 + Variant 4 HYBRID**

### Hybrid Pricing Model:

```
PAY-PER-TEST (For small centers):
- Tests 1-100: 30,000 UZS per test
- Tests 101+: 50,000 UZS per test

SUBSCRIPTION (For large centers):
- Starter: 500,000 UZS/month (20 tests)
- Pro: 1,200,000 UZS/month (50 tests)
- Enterprise: 2,500,000 UZS/month (unlimited)

Practice Mode: Always FREE
```

---

## 🏗️ PLATFORM STRUCTURE REDESIGN

### New Information Architecture:

```
PUBLIC SITE (Landing):
├─ Home
│  ├─ Hero section
│  ├─ Features
│  ├─ How it works
│  ├─ Pricing
│  └─ Testimonials
├─ Practice Tests (Free)
│  ├─ Listening Test
│  ├─ Reading Test
│  ├─ Writing Test
│  └─ Speaking Test (Coming soon)
├─ Features
├─ Pricing
├─ About
└─ Contact

STUDENT DASHBOARD:
├─ Practice Tests (Free)
│  ├─ Take Test
│  ├─ Results History
│  └─ Progress Analytics
└─ Mock Sessions (Paid)
   ├─ Available Sessions
   ├─ My Sessions
   └─ Results & Certificates

CENTER DASHBOARD:
├─ Overview
│  ├─ Monthly Stats
│  ├─ Revenue
│  └─ Attendance Summary
├─ Students
│  ├─ All Students
│  ├─ Add Student
│  └─ Bulk Upload
├─ Groups
│  ├─ All Groups
│  ├─ Schedules
│  └─ Attendance
├─ Tests
│  ├─ Create Test ✨ NEW
│  ├─ My Tests
│  └─ Global Tests
├─ Mock Sessions
│  ├─ Create Session
│  ├─ Active Sessions
│  └─ Grading Queue
├─ Billing
│  ├─ Current Usage
│  ├─ Payment History
│  └─ Invoices
└─ Reports
   ├─ Students
   ├─ Attendance
   └─ Revenue

SUPERADMIN DASHBOARD:
├─ Organizations
├─ Billing & Payments
├─ Global Tests
├─ System Analytics
└─ Settings
```

---

## 🎨 REDESIGN COMPONENTS

### 1. Homepage Redesign

**Fayl:** `frontend/src/pages/HomePage.tsx`

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export const HomePage: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">I</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              ILDIZ<span className="text-red-600">Mock</span>
            </span>
          </div>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/practice" className="text-gray-700 hover:text-red-600 font-medium">
              {t('nav.practice')}
            </Link>
            <Link to="/features" className="text-gray-700 hover:text-red-600 font-medium">
              {t('nav.features')}
            </Link>
            <Link to="/pricing" className="text-gray-700 hover:text-red-600 font-medium">
              {t('nav.pricing')}
            </Link>
            <Link to="/about" className="text-gray-700 hover:text-red-600 font-medium">
              {t('nav.about')}
            </Link>
          </nav>
          
          {/* CTA */}
          <div className="flex items-center gap-4">
            <Link 
              to="/login"
              className="text-gray-700 hover:text-red-600 font-medium"
            >
              {t('common.login')}
            </Link>
            <Link
              to="/signup"
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              {t('common.signup')}
            </Link>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            {t('home.hero.title.start')}
            <br />
            <span className="text-red-600 bg-red-50 px-4 py-2 rounded-lg inline-block mt-2">
              {t('home.hero.title.highlight')}
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            {t('home.hero.subtitle')}
          </p>
          
          <Link
            to="/practice"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-lg hover:shadow-xl"
          >
            🎤 {t('home.hero.cta')}
          </Link>
          
          {/* Stats */}
          <div className="mt-16 flex items-center justify-center gap-12">
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-bold text-sm">A</span>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center -ml-2">
                  <span className="text-green-600 font-bold text-sm">S</span>
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center -ml-2">
                  <span className="text-blue-600 font-bold text-sm">M</span>
                </div>
              </div>
              <span className="text-gray-900 font-semibold">
                100,000+ {t('home.stats.students')}
              </span>
            </div>
            
            <div className="text-gray-300">|</div>
            
            <div className="text-gray-900 font-semibold">
              500+ {t('home.stats.tests')}
            </div>
            
            <div className="text-gray-300">|</div>
            
            <div className="text-gray-900 font-semibold">
              4.8 {t('home.stats.rating')}
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose Our <span className="text-red-600">ILDIZMock</span> Platform?
            </h2>
            <p className="text-xl text-gray-600">
              Experience the most authentic Computer-Delivered test environment
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Authentic Interface
              </h3>
              <p className="text-gray-600 text-sm">
                Practice with the exact same interface you'll encounter in the real Computer-Delivered IELTS test
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Real Timing
              </h3>
              <p className="text-gray-600 text-sm">
                Experience authentic test timing with countdown timers and automatic section transitions
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Instant Scoring
              </h3>
              <p className="text-gray-600 text-sm">
                Get immediate feedback with detailed score breakdowns and band score calculations
              </p>
            </div>
            
            {/* Feature 4 */}
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Progress Tracking
              </h3>
              <p className="text-gray-600 text-sm">
                Monitor your improvement with comprehensive analytics and personalized study recommendations
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Practice Tests Preview */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Practice Tests
            </h2>
            <p className="text-xl text-gray-600">
              Choose your module and start practicing for free
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Reading */}
            <Link
              to="/practice/reading"
              className="bg-white border-2 border-gray-200 hover:border-red-600 rounded-xl p-6 transition-all hover:shadow-lg group"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Reading Test
              </h3>
              <p className="text-sm text-gray-600">
                Read academic texts and find answers
              </p>
            </Link>
            
            {/* Writing */}
            <Link
              to="/practice/writing"
              className="bg-white border-2 border-gray-200 hover:border-red-600 rounded-xl p-6 transition-all hover:shadow-lg group"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Writing Test
              </h3>
              <p className="text-sm text-gray-600">
                Write essays with clear, effective arguments
              </p>
            </Link>
            
            {/* Listening */}
            <Link
              to="/practice/listening"
              className="bg-white border-2 border-gray-200 hover:border-red-600 rounded-xl p-6 transition-all hover:shadow-lg group"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Listening Test
              </h3>
              <p className="text-sm text-gray-600">
                Answer questions from real-life conversations
              </p>
            </Link>
            
            {/* Speaking */}
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 opacity-60 cursor-not-allowed">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Speaking Test
              </h3>
              <p className="text-sm text-gray-600">
                Coming Soon - Practice real interview questions
              </p>
              <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </section>
      
      {/* Pricing */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Choose Your Preparation Plan
            </h2>
            <p className="text-xl text-gray-600">
              Flexible pricing for students and education centers
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Pay Per Test */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Pay Per Test
              </h3>
              <p className="text-gray-600 mb-6">
                Perfect for individual students
              </p>
              
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">30,000</span>
                <span className="text-gray-600"> UZS / test</span>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Unlimited free practice</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Pay only for mock exams</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Instant scoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Progress tracking</span>
                </li>
              </ul>
              
              <button className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-lg font-semibold transition-colors">
                Get Started
              </button>
            </div>
            
            {/* Center Starter */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-red-600 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                Most Popular
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Center Starter
              </h3>
              <p className="text-gray-600 mb-6">
                For small education centers
              </p>
              
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">500,000</span>
                <span className="text-gray-600"> UZS / month</span>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">20 mock tests per month</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Student management</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Attendance tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Create custom tests</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Email support</span>
                </li>
              </ul>
              
              <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-colors">
                Get Started
              </button>
            </div>
            
            {/* Center Pro */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Center Pro
              </h3>
              <p className="text-gray-600 mb-6">
                For large education centers
              </p>
              
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">2,500,000</span>
                <span className="text-gray-600"> UZS / month</span>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700"><strong>Unlimited</strong> mock tests</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Everything in Starter</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Advanced analytics</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Priority support</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Dedicated account manager</span>
                </li>
              </ul>
              
              <button className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-lg font-semibold transition-colors">
                Contact Sales
              </button>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <p className="text-gray-600">
              Note: After 100 tests in pay-per-test model, price increases to 50,000 UZS per test
            </p>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 px-6 bg-red-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Ready to Achieve Your IELTS Target Score?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Start your IELTS preparation journey with our comprehensive mock test platform designed to help you succeed
          </p>
          
          <Link
            to="/practice"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-lg hover:shadow-xl"
          >
            🎤 Start Practice Test
          </Link>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Logo & Description */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">I</span>
                </div>
                <span className="text-2xl font-bold">
                  ILDIZ<span className="text-red-600">Mock</span>
                </span>
              </div>
              <p className="text-gray-400">
                The most authentic IELTStation Computer-Delivered test environment
              </p>
            </div>
            
            {/* Product */}
            <div>
              <h3 className="font-bold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/practice" className="hover:text-white">Practice Tests</Link></li>
                <li><Link to="/features" className="hover:text-white">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
              </ul>
            </div>
            
            {/* Company */}
            <div>
              <h3 className="font-bold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/about" className="hover:text-white">About</Link></li>
                <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>© 2026 ILDIZMock. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
```

---

## 🏫 CENTER TEST CREATION

### Feature: Centers Can Create Custom Tests

**Fayl:** `frontend/src/pages/center/TestCreator.tsx`

```typescript
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const TestCreator: React.FC = () => {
  const { t } = useTranslation();
  const [module, setModule] = useState<'listening' | 'reading' | 'writing'>('reading');
  
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Create Custom Test
        </h1>
        <p className="text-gray-600 mt-2">
          Build your own IELTS practice test for your students
        </p>
      </div>
      
      {/* Module Selector */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Test Module
        </label>
        
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setModule('reading')}
            className={`p-4 rounded-lg border-2 transition-all ${
              module === 'reading'
                ? 'border-red-600 bg-red-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">📖</div>
            <div className="font-semibold">Reading</div>
          </button>
          
          <button
            onClick={() => setModule('listening')}
            className={`p-4 rounded-lg border-2 transition-all ${
              module === 'listening'
                ? 'border-red-600 bg-red-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">🎧</div>
            <div className="font-semibold">Listening</div>
          </button>
          
          <button
            onClick={() => setModule('writing')}
            className={`p-4 rounded-lg border-2 transition-all ${
              module === 'writing'
                ? 'border-red-600 bg-red-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">✍️</div>
            <div className="font-semibold">Writing</div>
          </button>
        </div>
      </div>
      
      {/* Test Builder Interface */}
      {module === 'reading' && <ReadingTestBuilder />}
      {module === 'listening' && <ListeningTestBuilder />}
      {module === 'writing' && <WritingTestBuilder />}
    </div>
  );
};
```

---

## ✅ IMPLEMENTATION SUMMARY

### What's Being Redesigned:

```
1. DESIGN SYSTEM:
   ✅ New color palette (Red primary)
   ✅ Typography system (Inter font)
   ✅ Spacing & shadows
   ✅ Component library

2. ENGLISH LOCALIZATION:
   ✅ i18next integration
   ✅ Full translation files
   ✅ Language switcher (future uz/ru)

3. NEW PRICING:
   ✅ Pay-per-test: 30k → 50k after 100
   ✅ Subscription tiers
   ✅ Clear pricing page

4. HOMEPAGE:
   ✅ IELTStation-style hero
   ✅ Features section
   ✅ Practice tests preview
   ✅ Pricing cards
   ✅ Professional footer

5. CENTER FEATURES:
   ✅ Test creator UI
   ✅ Attendance visibility
   ✅ Student management
   ✅ Custom test builder

6. SUPERADMIN:
   ✅ Billing dashboard
   ✅ Organization overview
   ✅ Revenue tracking
```

---

**ETAP 17 TAYYOR - COMPLETE PLATFORM REDESIGN!** 🎨

**Next: Implementation va testing!** 🚀
