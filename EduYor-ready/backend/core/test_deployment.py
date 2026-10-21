import os
import secrets
import re
import subprocess
import sys
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch
from django.db import DatabaseError
from django.test import TestCase, SimpleTestCase
from rest_framework.test import APIClient


class HealthTests(TestCase):
    def test_private_api_responses_are_never_cached(self):
        response = APIClient().get('/api/me/')
        self.assertEqual(response.status_code,403)
        self.assertEqual(response['Cache-Control'],'private, no-store')

    def test_anonymous_readiness_is_minimal_and_not_cached(self):
        response = APIClient().get('/api/health/')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json(),{'status':'ok'})
        self.assertEqual(response['Cache-Control'],'no-store')

    def test_database_failure_returns_safe_unavailable_status(self):
        with patch('core.health.connection.cursor',side_effect=DatabaseError('private connection details')):
            response = APIClient().get('/api/health/')
        self.assertEqual(response.status_code,503)
        self.assertEqual(response.json(),{'status':'unavailable'})
        self.assertNotIn(b'private',response.content)


class DeploymentSettingsTests(SimpleTestCase):
    def test_local_setup_handles_blank_secret_and_is_idempotent(self):
        source=Path(__file__).resolve().parents[2]/'scripts/setup_local.py'
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for folder in ['scripts','backend','frontend']:(root/folder).mkdir()
            shutil.copy2(source,root/'scripts/setup_local.py')
            (root/'backend/.env.example').write_text('DJANGO_SECRET_KEY=\nDJANGO_DEBUG=1\nKEEP_VALUE=unchanged\n')
            (root/'frontend/.env.local.example').write_text('DJANGO_API_ORIGIN=http://127.0.0.1:8000\n')
            database=root/'backend/db.sqlite3';database.write_bytes(b'Existing data')
            for _ in range(2):
                result=subprocess.run([sys.executable,str(root/'scripts/setup_local.py')],capture_output=True,text=True,timeout=10)
                self.assertEqual(result.returncode,0,result.stderr)
                content=(root/'backend/.env').read_text()
                key=re.search(r'^DJANGO_SECRET_KEY=(.+)$',content,re.MULTILINE).group(1)
                self.assertGreaterEqual(len(key),50)
                self.assertIn('DJANGO_DEBUG=1',content)
                self.assertIn('KEEP_VALUE=unchanged',content)
                self.assertNotIn(key,result.stdout)
                if _==0:original=content
                else:self.assertEqual(content,original)
                self.assertEqual(database.read_bytes(),b'Existing data')

    def production_env(self):
        env = {**os.environ,'DJANGO_SETTINGS_MODULE':'config.settings_production','DJANGO_SECRET_KEY':secrets.token_urlsafe(64),
            'DJANGO_ALLOWED_HOSTS':'eduyor.example','CSRF_TRUSTED_ORIGINS':'https://eduyor.example',
            'POSTGRES_DB':'eduyor','POSTGRES_USER':'eduyor','POSTGRES_PASSWORD':'test-only-password',
            'POSTGRES_HOST':'127.0.0.1','TRUST_PROXY_HTTPS':'1','DJANGO_DEBUG':'0'}
        env.pop('TEST_SQLITE',None)
        return env

    def check_settings(self,env):
        manage=Path(__file__).resolve().parents[1]/'manage.py'
        return subprocess.run([sys.executable,str(manage),'check','--deploy','--fail-level','ERROR'],env=env,capture_output=True,text=True,timeout=30)

    def test_production_passes_deployment_checks_with_explicit_secure_configuration(self):
        result=self.check_settings(self.production_env())
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        # Do not opt an unknown domain/subdomains into HSTS preload. These two
        # optional warnings are documented; no other security warning is allowed.
        warnings=set(re.findall(r'\(security\.(W\d+)\)',result.stdout+result.stderr))
        self.assertEqual(warnings,{'W005','W021'})

    def test_production_refuses_weak_secrets_and_wildcard_hosts(self):
        for field,value in [('DJANGO_SECRET_KEY','weak'),('DJANGO_ALLOWED_HOSTS','*'),('CSRF_TRUSTED_ORIGINS','http://eduyor.example')]:
            env=self.production_env();env[field]=value
            self.assertNotEqual(self.check_settings(env).returncode,0,field)

    def test_local_profile_uses_sqlite_and_http_cookies(self):
        env=self.production_env();env['DJANGO_SETTINGS_MODULE']='config.settings_local'
        script="from django.conf import settings as s; assert s.DATABASES['default']['ENGINE']=='django.db.backends.sqlite3'; assert not s.CSRF_COOKIE_SECURE; assert not s.SESSION_COOKIE_SECURE; assert not s.SECURE_SSL_REDIRECT"
        result=subprocess.run([sys.executable,'-c',script],cwd=Path(__file__).resolve().parents[1],env=env,capture_output=True,text=True,timeout=30)
        self.assertEqual(result.returncode,0,result.stderr)
