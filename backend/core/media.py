"""Serve only normalized JPEG avatars on hosts without a separate media server."""
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.utils._os import safe_join
from django.core.exceptions import SuspiciousFileOperation
from django.views.decorators.http import require_safe


@require_safe
def avatar_media(request, path):
    try:
        filename = Path(safe_join(settings.MEDIA_ROOT, path))
        if not path.startswith('avatars/') or filename.suffix != '.jpg':
            raise Http404
        # Curated portraits ship with the release and survive ephemeral hosting restarts.
        if not filename.is_file() and path.startswith('avatars/curated/'):
            from .peer_mentors import ASSET_DIR
            filename = Path(safe_join(ASSET_DIR, path.removeprefix('avatars/curated/')))
        response = FileResponse(filename.open('rb'), content_type='image/jpeg')
    except (SuspiciousFileOperation, OSError):
        raise Http404
    response['X-Content-Type-Options'] = 'nosniff'
    response['Cache-Control'] = 'public, max-age=3600'
    return response
