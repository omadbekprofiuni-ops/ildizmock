from django.urls import path

from . import views

urlpatterns = [
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
]
