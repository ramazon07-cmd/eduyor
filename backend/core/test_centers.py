import tempfile
from io import BytesIO
from PIL import Image
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from .models import User, MentorProfile, LearningCenter

ONLINE = {'name': 'Algebra Hub', 'kind': 'online', 'description': 'Two mentors teach algebra together.'}
OFFLINE = {'name': 'Bilim Markazi', 'kind': 'offline', 'description': 'Chilonzordagi o‘quv markazi.', 'city': 'Toshkent', 'address': 'Chilonzor 7'}


def make_user(email, name, account_type='student', mentor=None):
    user = User.objects.create_user(email, None)
    user.profile.full_name = name
    user.profile.account_type = account_type
    user.profile.save()
    if mentor:
        MentorProfile.objects.create(user=user, headline='Math', bio='Math', hourly_price=30000, approval=mentor)
    return user


class CenterTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = make_user('owner@center.test', 'Owner Mentor', mentor='approved')
        self.colleague = make_user('colleague@center.test', 'Colleague Mentor', mentor='approved')
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def open_center(self, user=None, **data):
        result = self.as_user(user or self.owner).post('/api/centers/mine/', {**ONLINE, **data}, format='json')
        self.assertEqual(result.status_code, 201, result.content)
        return result.json()

    def join(self, user, code):
        return self.as_user(user).post('/api/centers/join/', {'code': code}, format='json')

    def approve(self, data):
        LearningCenter.objects.filter(pk=data['center']['id']).update(approval='approved')

    def test_opening_a_center_waits_for_approval_and_mentor_owner_joins_it(self):
        data = self.open_center()
        self.assertEqual((data['role'], data['center']['approval']), ('owner', 'pending'))
        self.assertEqual(len(data['center']['invite_code']), 8)
        self.assertEqual([m['full_name'] for m in data['center']['members']], ['Owner Mentor'])
        self.assertEqual(self.client.get('/api/centers/').json()['count'], 0)

    def test_parent_account_cannot_open_a_center(self):
        parent = make_user('parent@center.test', 'Parent', 'parent')
        self.assertEqual(self.as_user(parent).post('/api/centers/mine/', ONLINE, format='json').status_code, 403)

    def test_offline_center_needs_city_and_address(self):
        director = make_user('director@center.test', 'Director')
        self.assertEqual(self.as_user(director).post('/api/centers/mine/', {**OFFLINE, 'address': ''}, format='json').status_code, 400)
        data = self.open_center(director, **OFFLINE)
        self.assertEqual((data['center']['kind'], data['center']['members']), ('offline', []))

    def test_one_center_per_person_and_names_are_unique_ignoring_case(self):
        code = self.open_center()['center']['invite_code']
        self.assertEqual(self.client.post('/api/centers/mine/', {**ONLINE, 'name': 'Second Hub'}, format='json').status_code, 400)
        self.join(self.colleague, code)
        self.assertEqual(self.as_user(self.colleague).post('/api/centers/mine/', {**ONLINE, 'name': 'Colleague Hub'}, format='json').status_code, 400)
        self.assertEqual(MentorProfile.objects.get(user=self.colleague).center.name, 'Algebra Hub')
        other = make_user('other@center.test', 'Other')
        self.assertEqual(self.as_user(other).post('/api/centers/mine/', {**ONLINE, 'name': 'ALGEBRA HUB'}, format='json').status_code, 400)

    def test_mentor_joins_with_code_and_is_listed_under_the_approved_center(self):
        data = self.open_center()
        code = data['center']['invite_code']
        self.assertEqual(self.join(self.colleague, f'{code[:4].lower()}-{code[4:]}').status_code, 201)
        self.approve(data)
        center_id = data['center']['id']
        listed = APIClient().get(f'/api/mentors/?center={center_id}').json()['results']
        self.assertEqual(sorted(m['full_name'] for m in listed), ['Colleague Mentor', 'Owner Mentor'])
        self.assertEqual(APIClient().get(f'/api/mentors/{self.colleague.pk}/').json()['center'], {'id': center_id, **ONLINE, 'city': '', 'address': '', 'logo': None})

    def test_joining_needs_a_mentor_profile_a_valid_code_and_no_other_center(self):
        code = self.open_center()['center']['invite_code']
        learner = make_user('learner@center.test', 'Learner')
        self.assertEqual(self.join(learner, code).status_code, 400)
        self.assertEqual(self.join(self.colleague, 'ZZZZ9999').status_code, 400)
        rival = make_user('rival@center.test', 'Rival Mentor', mentor='approved')
        self.open_center(rival, name='Rival Hub')
        self.assertEqual(self.join(rival, code).status_code, 400)

    def test_public_list_counts_only_public_mentors_and_hides_unapproved_centers(self):
        data = self.open_center()
        pending_mentor = make_user('pending@center.test', 'Pending Mentor', mentor='pending')
        self.join(pending_mentor, data['center']['invite_code'])
        self.open_center(make_user('director@center.test', 'Director'), **OFFLINE)
        self.approve(data)
        rows = APIClient().get('/api/centers/').json()['results']
        self.assertEqual([(r['name'], r['mentor_count']) for r in rows], [('Algebra Hub', 1)])
        hidden = LearningCenter.objects.get(name='Bilim Markazi').pk
        self.assertEqual(APIClient().get(f'/api/centers/{hidden}/').status_code, 404)
        self.assertEqual(APIClient().get(f'/api/mentors/?center={hidden}').json()['count'], 0)

    def test_unapproved_center_is_not_shown_on_mentor_profile_or_directory(self):
        center_id = self.open_center()['center']['id']
        self.assertIsNone(APIClient().get(f'/api/mentors/{self.owner.pk}/').json()['center'])
        self.assertEqual(APIClient().get(f'/api/mentors/?center={center_id}').json()['count'], 0)

    def test_editing_details_needs_new_approval_and_only_owner_sees_code(self):
        data = self.open_center()
        self.join(self.colleague, data['center']['invite_code'])
        self.approve(data)
        result = self.as_user(self.owner).put('/api/centers/mine/', {**ONLINE, 'description': 'New programme.'}, format='json')
        self.assertEqual(result.json()['center']['approval'], 'pending')
        member_view = self.as_user(self.colleague).get('/api/centers/mine/').json()
        self.assertEqual(member_view['role'], 'member')
        self.assertNotIn('invite_code', member_view['center'])
        self.assertEqual(self.as_user(self.colleague).put('/api/centers/mine/', ONLINE, format='json').status_code, 404)

    def test_owner_removes_member_rotating_code_and_member_can_leave(self):
        data = self.open_center()
        old_code = data['center']['invite_code']
        self.join(self.colleague, old_code)
        third = make_user('third@center.test', 'Third Mentor', mentor='approved')
        self.join(third, old_code)
        self.assertEqual(self.as_user(self.colleague).delete(f'/api/centers/members/{third.pk}/').status_code, 404)
        self.assertEqual(self.as_user(self.owner).delete(f'/api/centers/members/{self.colleague.pk}/').status_code, 204)
        self.assertIsNone(MentorProfile.objects.get(user=self.colleague).center)
        self.assertEqual(self.join(self.colleague, old_code).status_code, 400)
        self.assertEqual(self.as_user(third).delete(f'/api/centers/members/{third.pk}/').status_code, 204)
        self.assertEqual(self.as_user(third).get('/api/centers/mine/').json(), {'role': None, 'center': None})

    def test_mentor_exposes_approved_center_details_without_private_invite_data(self):
        data = self.open_center(**OFFLINE)
        self.approve(data)
        for endpoint in [f'/api/mentors/{self.owner.pk}/', f"/api/mentors/?center={data['center']['id']}"]:
            response = APIClient().get(endpoint).json()
            row = response['results'][0] if 'results' in response else response
            self.assertEqual(row['center'], {'id': data['center']['id'], **OFFLINE, 'logo': None})
            self.assertNotIn(data['center']['invite_code'], str(row))
        self.assertEqual(self.as_user(self.owner).get('/api/centers/mine/').json()['center']['invite_code'], data['center']['invite_code'])
        LearningCenter.objects.filter(pk=data['center']['id']).update(approval='rejected')
        self.assertIsNone(APIClient().get(f'/api/mentors/{self.owner.pk}/').json()['center'])

    def test_invite_code_is_owner_only_even_on_approved_center(self):
        data = self.open_center()
        code = data['center']['invite_code']
        self.join(self.colleague, code)
        self.approve(data)
        for endpoint in ['/api/centers/', f"/api/centers/{data['center']['id']}/"]:
            response = APIClient().get(endpoint)
            self.assertEqual(response.status_code, 200)
            self.assertNotIn(code, str(response.json()))
        self.assertNotIn('invite_code', self.as_user(self.colleague).get('/api/centers/mine/').json()['center'])
        outsider = make_user('outsider@center.test', 'Outsider')
        self.assertIsNone(self.as_user(outsider).get('/api/centers/mine/').json()['center'])


class CenterLogoTests(TestCase):
    def setUp(self):
        cache.clear()
        media = tempfile.TemporaryDirectory()
        self.addCleanup(media.cleanup)
        settings = override_settings(MEDIA_ROOT=media.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.owner = make_user('logo-owner@center.test', 'Logo Owner', mentor='approved')
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.center_id = self.client.post('/api/centers/mine/', ONLINE, format='json').json()['center']['id']
        LearningCenter.objects.filter(pk=self.center_id).update(approval='approved')

    def png(self, size=(900, 300)):
        output = BytesIO()
        Image.new('RGBA', size, (84, 33, 139, 0)).save(output, 'PNG')
        return SimpleUploadedFile('logo.png', output.getvalue(), content_type='image/png')

    def upload(self, file):
        return self.client.post('/api/centers/mine/logo/', {'logo': file})

    def test_owner_uploads_a_transparent_logo_shown_on_public_pages(self):
        response = self.upload(self.png())
        self.assertEqual(response.status_code, 200, response.content)
        logo = response.json()['center']['logo']
        self.assertTrue(logo.startswith('/media/centers/') and logo.endswith('.webp'))
        center = LearningCenter.objects.get(pk=self.center_id)
        with Image.open(center.logo) as image:
            self.assertEqual((image.mode, image.size), ('RGBA', (512, 171)))
        # Swapping the logo keeps the center approved.
        self.assertEqual(center.approval, 'approved')
        self.assertEqual(APIClient().get(f'/api/centers/{self.center_id}/').json()['logo'], logo)
        self.assertEqual(APIClient().get(f'/api/mentors/{self.owner.pk}/').json()['center']['logo'], logo)

    def test_replacing_or_removing_the_logo_deletes_the_old_file(self):
        self.upload(self.png())
        first = LearningCenter.objects.get(pk=self.center_id).logo
        storage, first_name = first.storage, first.name
        self.upload(self.png((200, 200)))
        second = LearningCenter.objects.get(pk=self.center_id).logo.name
        self.assertFalse(storage.exists(first_name))
        response = self.client.delete('/api/centers/mine/logo/')
        self.assertEqual((response.status_code, response.json()['center']['logo']), (200, None))
        self.assertFalse(storage.exists(second))

    def test_logo_must_be_a_small_real_image(self):
        self.assertEqual(self.client.post('/api/centers/mine/logo/', {}).status_code, 400)
        self.assertEqual(self.upload(SimpleUploadedFile('fake.png', b'not an image')).status_code, 400)
        big = SimpleUploadedFile('big.png', b'0' * (2 * 1024 * 1024 + 1), content_type='image/png')
        self.assertEqual(self.upload(big).status_code, 400)
        self.assertFalse(LearningCenter.objects.get(pk=self.center_id).logo)

    def test_only_the_owner_can_change_the_logo(self):
        member = make_user('logo-member@center.test', 'Logo Member', mentor='approved')
        code = self.client.get('/api/centers/mine/').json()['center']['invite_code']
        member_client = APIClient()
        member_client.force_authenticate(member)
        member_client.post('/api/centers/join/', {'code': code}, format='json')
        self.assertEqual(member_client.post('/api/centers/mine/logo/', {'logo': self.png()}).status_code, 404)
        self.assertEqual(member_client.delete('/api/centers/mine/logo/').status_code, 404)
        self.assertEqual(APIClient().post('/api/centers/mine/logo/', {'logo': self.png()}).status_code, 403)
