from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
urlpatterns = [path('admin/',admin.site.urls),path('api/',include('core.urls'))]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,document_root=settings.MEDIA_ROOT)
elif getattr(settings, 'SERVE_AVATAR_MEDIA', False):
    from core.media import avatar_media
    urlpatterns += [re_path(r'^media/(?P<path>avatars/.*\.jpg)$', avatar_media)]
