from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from accounts.views import landing_page
from django.http import JsonResponse
from django.shortcuts import redirect
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from django.shortcuts import redirect
from django.http import JsonResponse
def favicon_redirect(request):
    return redirect(static('favicon.svg'))


def chrome_devtools_config(request):
    return JsonResponse({})
urlpatterns = [
    path('', landing_page, name='landing_page'),
    path('django-admin/', admin.site.urls),
    path('', include('accounts.urls')),
    path('complaints/', include('complaints.urls')),
    path('staff/', include('staff.urls')),
    path('notifications/', include('notifications.urls')),
    path('favicon.ico', favicon_redirect),
path(
    '.well-known/appspecific/com.chrome-devtools.json',
    chrome_devtools_config
),
]


if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )