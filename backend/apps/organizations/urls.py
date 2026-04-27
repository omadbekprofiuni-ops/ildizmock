from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    PublicOrganizationView,
    PublicPlanListView,
    PublicStudentRegisterView,
    SuperAdminOrganizationViewSet,
    SuperAdminPaymentViewSet,
    SuperAdminPlanViewSet,
    SuperAdminStatsView,
)

super_router = DefaultRouter()
super_router.register(r'organizations', SuperAdminOrganizationViewSet, basename='super-orgs')
super_router.register(r'plans', SuperAdminPlanViewSet, basename='super-plans')
super_router.register(r'payments', SuperAdminPaymentViewSet, basename='super-payments')

urlpatterns = [
    path('superadmin/stats/', SuperAdminStatsView.as_view()),
    path('superadmin/', include(super_router.urls)),
    # Alias used by ETAP-1 prompt
    path('super/', include(super_router.urls)),
    path('public/organizations/<slug:slug>/', PublicOrganizationView.as_view()),
    # Alias for prompt's curl examples
    path('public/orgs/<slug:slug>/', PublicOrganizationView.as_view()),
    path('public/plans/', PublicPlanListView.as_view()),
    path('public/register/', PublicStudentRegisterView.as_view()),
]
