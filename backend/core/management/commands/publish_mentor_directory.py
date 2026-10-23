from types import SimpleNamespace

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from core.directory_publication import publish_directory
from core.models import DirectoryPublication


class Command(BaseCommand):
    help = 'Publish the approved v1 directory once; preserve subsequent admin edits.'

    @transaction.atomic
    def handle(self, *args, **options):
        _, created = DirectoryPublication.objects.get_or_create(version='v1')
        if not created:
            self.stdout.write('Mentor directory v1 already published; preserving admin edits.')
            return
        publish_directory(apps, SimpleNamespace(connection=connection))
        self.stdout.write(self.style.SUCCESS('Published all seven mentors and bundled portraits.'))
