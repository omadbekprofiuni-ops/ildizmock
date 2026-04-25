from .models import Organization


class OrganizationContextMiddleware:
    """Har request da request.organization aniqlanadi.

    - Superadmin: header `X-Org-Context: <id>` orqali boshqa markazga "kirish"
      mumkin. Header bo'lmasa request.organization=None (Asosiy panel).
    - Boshqa rollar: avto user.organization.
    - Anonymous user: None.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.organization = None

        user = getattr(request, 'user', None)
        if user is None or not user.is_authenticated:
            return self.get_response(request)

        if user.role == 'superadmin':
            org_id = request.headers.get('X-Org-Context')
            if org_id:
                try:
                    request.organization = Organization.objects.get(id=int(org_id))
                except (Organization.DoesNotExist, ValueError, TypeError):
                    request.organization = None
        else:
            request.organization = user.organization

        return self.get_response(request)
