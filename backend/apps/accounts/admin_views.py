from django.contrib.auth import get_user_model
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsAdmin
from .serializers import _validate_username_format

User = get_user_model()


class _TeacherSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name',
                  'role', 'is_active', 'created_at', 'student_count']
        read_only_fields = ['id', 'username', 'role', 'created_at', 'student_count']

    def get_student_count(self, obj):
        return obj.students.filter(role='student').count()


class AdminTeacherListCreateView(APIView):
    """GET /admin/teachers/ — list teachers; POST creates a new teacher."""

    permission_classes = [IsAdmin]

    def get(self, request):
        admin = request.user
        qs = User.objects.filter(role='teacher')
        if admin.organization_id:
            qs = qs.filter(organization_id=admin.organization_id)
        qs = qs.order_by('first_name', 'last_name')
        return Response(_TeacherSerializer(qs, many=True).data)

    def post(self, request):
        username = (request.data.get('username') or '').strip().lower()
        password = request.data.get('password') or ''
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()

        try:
            username = _validate_username_format(username)
        except serializers.ValidationError as e:
            return Response({'username': e.detail}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 6:
            return Response({'password': 'Password must be at least 6 characters.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'username': 'Username already taken.'},
                            status=status.HTTP_400_BAD_REQUEST)

        u = User(
            username=username, role='teacher',
            first_name=first_name, last_name=last_name,
            organization_id=request.user.organization_id,
            is_staff=False, is_active=True,
        )
        u.set_password(password)
        u.save()
        return Response(_TeacherSerializer(u).data, status=status.HTTP_201_CREATED)


class AdminAssignTeacherView(APIView):
    """POST /admin/students/:id/assign-teacher/ — body {teacher_id} or null."""

    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            student = User.objects.get(pk=pk, role='student')
        except User.DoesNotExist:
            return Response({'detail': 'Student not found.'},
                            status=status.HTTP_404_NOT_FOUND)
        teacher_id = request.data.get('teacher_id')
        if teacher_id is None or teacher_id == '':
            student.teacher = None
        else:
            try:
                teacher = User.objects.get(pk=teacher_id, role='teacher')
            except User.DoesNotExist:
                return Response({'detail': 'Teacher not found.'},
                                status=status.HTTP_404_NOT_FOUND)
            student.teacher = teacher
        student.save(update_fields=['teacher'])
        return Response({
            'student_id': student.id,
            'teacher_id': student.teacher_id,
        })


class AdminStudentListView(APIView):
    """GET /admin/students/ — list students with their teacher (if any)."""

    permission_classes = [IsAdmin]

    def get(self, request):
        admin = request.user
        qs = User.objects.filter(role='student').select_related('teacher')
        if admin.organization_id:
            qs = qs.filter(organization_id=admin.organization_id)
        qs = qs.order_by('first_name', 'last_name')
        data = [{
            'id': s.id,
            'username': s.username,
            'name': f'{s.first_name} {s.last_name}'.strip() or s.username,
            'created_at': s.created_at.isoformat(),
            'teacher_id': s.teacher_id,
            'teacher_name': (
                f'{s.teacher.first_name} {s.teacher.last_name}'.strip()
                or s.teacher.username
            ) if s.teacher_id else None,
        } for s in qs]
        return Response(data)
