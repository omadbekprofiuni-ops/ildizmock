from rest_framework import mixins, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Test
from .serializers import TestDetailSerializer, TestListSerializer


class TestViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Public read access — guests can browse tests."""

    permission_classes = [AllowAny]
    queryset = Test.objects.filter(is_published=True)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TestDetailSerializer
        return TestListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        module = self.request.query_params.get('module')
        difficulty = self.request.query_params.get('difficulty')
        if module:
            qs = qs.filter(module=module)
        if difficulty:
            qs = qs.filter(difficulty=difficulty)
        return qs


class TestCountsView(APIView):
    """Public counts of published tests by module — used on HomePage cards."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            module: Test.objects.filter(is_published=True, module=module).count()
            for module, _ in Test.MODULE_CHOICES
        })
