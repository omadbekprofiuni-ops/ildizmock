from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Test
from .serializers import TestDetailSerializer, TestListSerializer


class TestViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Test.objects.filter(is_published=True)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TestDetailSerializer
        return TestListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        module = self.request.query_params.get('module')
        if module:
            qs = qs.filter(module=module)
        return qs


class TestCountsView(APIView):
    """Public counts of published tests by module — used on HomePage cards."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            module: Test.objects.filter(is_published=True, module=module).count()
            for module, _ in Test.MODULE_CHOICES
        })
