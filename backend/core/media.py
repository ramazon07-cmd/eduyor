"""Serve avatar images on hosts without a separate media server."""
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
        content_types = {'.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp'}
        if not path.startswith('avatars/') or filename.suffix not in content_types:
            raise Http404
        # Curated portraits ship with the release and survive ephemeral hosting restarts.
        if not filename.is_file() and path.startswith('avatars/curated/'):
            from .peer_mentors import ASSET_DIR
            filename = Path(safe_join(ASSET_DIR, path.removeprefix('avatars/curated/')))
        response = FileResponse(filename.open('rb'), content_type=content_types[filename.suffix])
    except (SuspiciousFileOperation, OSError):
        raise Http404
    response['X-Content-Type-Options'] = 'nosniff'
    response['Cache-Control'] = 'public, max-age=3600'
    return response
