# ETAP 22: CRITICAL FIXES - PRICING & ROUTING

**Maqsad:** Narx ko'rsatish xatosini to'g'rilash va 404 error'ni fix qilish.

---

## 🚨 IDENTIFIED PROBLEMS

### Problem 1: Wrong Price Display (Screenshot 1)

```
Current Display:
HOZIRGI NARX: 20,000 so'm

Expected:
HOZIRGI NARX: 30,000 so'm
```

**Root Cause:**
- Old hardcoded price in billing dashboard
- Not updated after pricing changes
- Shows 20k instead of 30k

---

### Problem 2: 404 Error (Screenshot 2)

```
URL: localhost:5173/super/org/dashboard
Error: 404 Page not found
```

**Root Cause:**
- Route not defined
- Component missing
- Routing configuration error

---

## ✅ FIX 1: UPDATE PRICING DISPLAY

### A) Backend - Ensure Correct Price

**Fayl:** `backend/apps/billing/models.py`

```python
class MockSessionCharge(models.Model):
    """
    Mock session charge
    CURRENT PRICING:
    - Tests 1-100: 30,000 UZS
    - Tests 101+: 50,000 UZS
    """
    
    # Default amount
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=30000.00,  # ✅ NOT 20000!
        verbose_name='Summa (so\'m)'
    )
    
    def calculate_amount(self):
        """
        Calculate amount based on test count
        """
        if not self.participant or not self.participant.student:
            return 30000.00
        
        student = self.participant.student
        
        # Count previous charged tests
        previous_tests = MockSessionCharge.objects.filter(
            participant__student=student,
            is_charged=True,
            id__lt=self.id  # Only count earlier tests
        ).count()
        
        # Pricing logic
        if previous_tests < 100:
            return 30000.00  # ✅ First 100 tests
        else:
            return 50000.00  # ✅ After 100 tests
    
    def save(self, *args, **kwargs):
        # Auto-calculate amount on save
        if self.is_charged:
            self.amount = self.calculate_amount()
        
        super().save(*args, **kwargs)
```

---

### B) Frontend - Update Billing Dashboard Display

**Fayl:** `frontend/src/pages/superadmin/BillingDashboard.tsx`

```typescript
// ❌ REMOVE hardcoded 20,000
const MOCK_TEST_PRICE = 20000; // OLD

// ✅ USE correct pricing
const PRICING = {
  BASIC: 30000,      // First 100 tests
  PREMIUM: 50000,    // After 100 tests
};

// Update display
<div className="stats-card">
  <p className="text-sm text-gray-600">HOZIRGI NARX</p>
  <p className="text-3xl font-bold text-gray-900">
    {PRICING.BASIC.toLocaleString()} so'm
  </p>
  <p className="text-xs text-gray-500 mt-1">
    (100 ta testdan keyin: {PRICING.PREMIUM.toLocaleString()} so'm)
  </p>
</div>
```

---

### C) Update Constants File

**Fayl:** `frontend/src/constants/pricing.ts`

```typescript
// Create pricing constants file
export const PRICING = {
  // Mock test pricing
  MOCK_TEST_BASIC: 30000,      // Tests 1-100
  MOCK_TEST_PREMIUM: 50000,    // Tests 101+
  
  // Threshold
  PREMIUM_THRESHOLD: 100,
  
  // Display helpers
  formatPrice: (amount: number) => {
    return `${amount.toLocaleString()} so'm`;
  },
  
  getCurrentPrice: (testCount: number) => {
    return testCount < PRICING.PREMIUM_THRESHOLD
      ? PRICING.MOCK_TEST_BASIC
      : PRICING.MOCK_TEST_PREMIUM;
  }
};
```

**Usage:**
```typescript
import { PRICING } from '@/constants/pricing';

// In component
<div>
  <p>Price: {PRICING.formatPrice(PRICING.MOCK_TEST_BASIC)}</p>
  <p>After 100 tests: {PRICING.formatPrice(PRICING.MOCK_TEST_PREMIUM)}</p>
</div>
```

---

## ✅ FIX 2: RESOLVE 404 ERROR

### A) Identify Missing Route

**Problem URL:**
```
localhost:5173/super/org/dashboard
```

**Expected:**
- SuperAdmin views organization dashboard
- Shows organization details, stats, students

---

### B) Add Route Definition

**Fayl:** `frontend/src/routes/superadmin.routes.tsx`

```typescript
import { RouteObject } from 'react-router-dom';
import SuperAdminLayout from '@/layouts/SuperAdminLayout';
import BillingDashboard from '@/pages/superadmin/BillingDashboard';
import OrganizationDashboard from '@/pages/superadmin/OrganizationDashboard';
import OrganizationsList from '@/pages/superadmin/OrganizationsList';

export const superAdminRoutes: RouteObject[] = [
  {
    path: '/super',
    element: <SuperAdminLayout />,
    children: [
      {
        path: 'dashboard',
        element: <SuperAdminDashboard />
      },
      {
        path: 'payments',
        element: <BillingDashboard />
      },
      {
        path: 'organizations',
        element: <OrganizationsList />
      },
      {
        path: 'org/:orgId/dashboard',  // ✅ ADD THIS
        element: <OrganizationDashboard />
      },
      // ... other routes
    ]
  }
];
```

---

### C) Create OrganizationDashboard Component

**Fayl:** `frontend/src/pages/superadmin/OrganizationDashboard.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

export const OrganizationDashboard: React.FC = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  
  const [organization, setOrganization] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchOrganizationData();
  }, [orgId]);
  
  const fetchOrganizationData = async () => {
    try {
      // Fetch organization details
      const orgResponse = await api.get(`/organizations/${orgId}/`);
      setOrganization(orgResponse.data);
      
      // Fetch organization stats
      const statsResponse = await api.get(`/organizations/${orgId}/stats/`);
      setStats(statsResponse.data);
      
    } catch (error) {
      console.error('Failed to fetch organization:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }
  
  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Organization Not Found
        </h1>
        <button
          onClick={() => navigate('/super/organizations')}
          className="mt-4 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-semibold"
        >
          Back to Organizations
        </button>
      </div>
    );
  }
  
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/super/organizations')}
          className="text-gray-600 hover:text-gray-900 mb-4"
        >
          ← Back to Organizations
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {organization.name}
            </h1>
            <p className="text-gray-600 mt-1">
              {organization.email}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
              organization.status === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {organization.status}
            </span>
          </div>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <p className="text-sm text-gray-600 mb-2">Total Students</p>
          <p className="text-3xl font-bold text-gray-900">
            {stats?.total_students || 0}
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <p className="text-sm text-gray-600 mb-2">Mock Sessions</p>
          <p className="text-3xl font-bold text-gray-900">
            {stats?.total_sessions || 0}
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <p className="text-sm text-gray-600 mb-2">Total Revenue</p>
          <p className="text-3xl font-bold text-green-600">
            {(stats?.total_revenue || 0).toLocaleString()} so'm
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg p-6">
          <p className="text-sm text-gray-600 mb-2">Unpaid Amount</p>
          <p className="text-3xl font-bold text-red-600">
            {(stats?.unpaid_amount || 0).toLocaleString()} so'm
          </p>
        </div>
      </div>
      
      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Recent Mock Sessions
        </h2>
        
        {stats?.recent_sessions?.length > 0 ? (
          <div className="space-y-3">
            {stats.recent_sessions.map((session: any) => (
              <div
                key={session.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-primary-500 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {session.group_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(session.date).toLocaleDateString()} • 
                      {session.participants_count} students
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      {session.revenue.toLocaleString()} so'm
                    </p>
                    <p className="text-xs text-gray-600">
                      {session.status}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-600 py-8">
            No recent sessions
          </p>
        )}
      </div>
    </div>
  );
};

export default OrganizationDashboard;
```

---

### D) Add Backend Endpoint (if missing)

**Fayl:** `backend/apps/organizations/views.py`

```python
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def organization_stats(request, org_id):
    """
    Get organization statistics
    SuperAdmin only
    """
    
    if request.user.role != 'superadmin':
        return Response({'error': 'Permission denied'}, status=403)
    
    org = get_object_or_404(Organization, pk=org_id)
    
    # Get students
    total_students = StudentProfile.objects.filter(
        organization=org
    ).count()
    
    # Get mock sessions
    from apps.mock.models import MockSession, MockSessionCharge
    
    sessions = MockSession.objects.filter(organization=org)
    total_sessions = sessions.count()
    
    # Calculate revenue
    charges = MockSessionCharge.objects.filter(
        session__organization=org,
        is_charged=True
    )
    
    total_revenue = charges.aggregate(
        total=Sum('amount')
    )['total'] or 0
    
    # Unpaid amount
    unpaid_cycles = BillingCycle.objects.filter(
        organization=org,
        status__in=['pending', 'overdue']
    )
    
    unpaid_amount = unpaid_cycles.aggregate(
        total=Sum('total_amount')
    )['total'] or 0
    
    # Recent sessions
    recent_sessions = sessions.order_by('-created_at')[:5]
    recent_sessions_data = []
    
    for session in recent_sessions:
        session_charges = charges.filter(session=session)
        
        recent_sessions_data.append({
            'id': session.id,
            'group_name': session.group.name,
            'date': session.scheduled_time,
            'participants_count': session.participants.count(),
            'revenue': session_charges.aggregate(
                total=Sum('amount')
            )['total'] or 0,
            'status': session.status
        })
    
    return Response({
        'total_students': total_students,
        'total_sessions': total_sessions,
        'total_revenue': float(total_revenue),
        'unpaid_amount': float(unpaid_amount),
        'recent_sessions': recent_sessions_data
    })
```

**Fayl:** `backend/apps/organizations/urls.py`

```python
from django.urls import path
from . import views

urlpatterns = [
    # ... existing urls ...
    path('<int:org_id>/stats/', views.organization_stats, name='organization_stats'),
]
```

---

## ✅ VERIFICATION CHECKLIST

### After Fixes:

**1. Check Pricing Display:**
```
✅ SuperAdmin Billing page shows 30,000 so'm
✅ Not 20,000 so'm
✅ Shows "After 100 tests: 50,000 so'm"
```

**2. Check Routing:**
```
✅ /super/org/1/dashboard loads without error
✅ Shows organization details
✅ Shows stats (students, sessions, revenue)
✅ Shows recent activity
```

**3. Check Backend:**
```
✅ MockSessionCharge.amount defaults to 30,000
✅ calculate_amount() returns correct price
✅ API endpoint /organizations/{id}/stats/ works
```

**4. Check Frontend:**
```
✅ Route defined in router config
✅ Component exists and renders
✅ API calls work
✅ Error handling works
```

---

## 📋 TESTING STEPS

### Test 1: Pricing Display

```bash
# Navigate to SuperAdmin Billing
http://localhost:5173/super/payments

# Verify:
✓ "HOZIRGI NARX: 30,000 so'm" displayed
✓ Correct pricing in all cards
✓ Correct calculations
```

### Test 2: Organization Dashboard

```bash
# Navigate to organization dashboard
http://localhost:5173/super/org/1/dashboard

# Verify:
✓ Page loads (no 404)
✓ Organization name displays
✓ Stats show correctly
✓ Recent sessions listed
```

### Test 3: Create Mock Session

```bash
# Create a new mock session
# Complete it
# Check billing

# Verify:
✓ Charge created with 30,000 amount
✓ Not 20,000
✓ Displays correctly in dashboard
```

---

## 🔧 QUICK FIX COMMANDS

### Update Existing Charges (if needed):

```python
# Django shell
python manage.py shell

from apps.billing.models import MockSessionCharge

# Update all charges to correct price
charges = MockSessionCharge.objects.filter(amount=20000.00)
for charge in charges:
    charge.amount = 30000.00
    charge.save()

print(f"Updated {charges.count()} charges")
```

---

## 📊 SUMMARY

**Fixed Issues:**

```
✅ Issue 1: Pricing Display
   Before: 20,000 so'm
   After:  30,000 so'm

✅ Issue 2: 404 Error
   Before: Page not found
   After:  Organization dashboard loads correctly
```

**Files Changed:**

```
Backend:
- apps/billing/models.py (amount default)
- apps/organizations/views.py (stats endpoint)
- apps/organizations/urls.py (route)

Frontend:
- src/constants/pricing.ts (new file)
- src/pages/superadmin/BillingDashboard.tsx (price display)
- src/pages/superadmin/OrganizationDashboard.tsx (new file)
- src/routes/superadmin.routes.tsx (route config)
```

---

**ETAP 22 TO'LIQ - CRITICAL FIXES READY!** 🔧✅
