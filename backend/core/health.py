from django.db import connection, DatabaseError
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health(request):
    """Readiness probe; no server, account or credential information is exposed."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
        response = JsonResponse({'status':'ok'})
    except DatabaseError:
        response = JsonResponse({'status':'unavailable'},status=503)
    response['Cache-Control'] = 'no-store'
    return response
