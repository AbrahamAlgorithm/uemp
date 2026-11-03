from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.accounts.urls import management_urlpatterns as account_management_urlpatterns
from core.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.academics.urls")),
    path("api/", include(account_management_urlpatterns)),
    path("api/", include("apps.courses.urls")),
    path("api/", include("apps.registrations.urls")),
    path("api/", include("apps.results.urls")),
    path("api/", include("apps.reports.urls")),
    path("api/", include("apps.audit.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
