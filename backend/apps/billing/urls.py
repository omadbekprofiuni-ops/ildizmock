from django.urls import path

from . import views

urlpatterns = [
    # ETAP 17 — Center subscription
    path('subscription/', views.CenterSubscriptionView.as_view(), name='billing-subscription'),
    path('overview/', views.BillingOverviewView.as_view(), name='billing-overview'),
    path(
        'organizations/<int:org_id>/',
        views.BillingOrganizationDetailView.as_view(),
        name='billing-org-detail',
    ),
    path(
        'organizations/<int:org_id>/pricing/',
        views.PricingTierUpdateView.as_view(),
        name='billing-pricing-update',
    ),
    path(
        'cycles/generate/',
        views.GenerateBillingCycleView.as_view(),
        name='billing-cycle-generate',
    ),
    path(
        'cycles/<int:cycle_id>/mark-paid/',
        views.MarkBillingPaidView.as_view(),
        name='billing-mark-paid',
    ),
    # ETAP 16
    path(
        'organizations/<int:org_id>/payments/',
        views.PaymentHistoryView.as_view(),
        name='billing-payment-history',
    ),
]
