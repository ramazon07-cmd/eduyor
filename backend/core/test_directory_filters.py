from django.test import TestCase
from rest_framework.test import APIClient
from .models import User, Subject, MentorProfile


class MentorDirectoryFilterTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.sat=Subject.objects.create(name='SAT')
        cls.ielts=Subject.objects.create(name='IELTS')
        cls.mentors={}
        for name,price,languages,subjects,approval,paused,active in [
            ('Amy',30000,'O‘zbekcha, English',['SAT'],'approved',False,True),
            ('Bob',45000,'Ingliz tili, Ruscha',['IELTS'],'approved',False,True),
            ('Caro',60000,'Русский',['SAT'],'approved',False,True),
            ('Dil',40000,'Uzbek, English',['SAT','IELTS'],'approved',False,True),
            ('Eli',50000,'French',['SAT'],'approved',False,True),
            ('Hidden',35000,'English',['SAT'],'pending',False,True),
            ('Paused',35000,'English',['SAT'],'approved',True,True),
            ('Inactive',35000,'English',['SAT'],'approved',False,False),
        ]:
            user=User.objects.create_user(name.lower()+'@example.invalid',None,is_active=active)
            user.profile.full_name=name;user.profile.save()
            mentor=MentorProfile.objects.create(user=user,headline='EduYor mentor',bio='Demo',experience='Demo',hourly_price=price,teaching_languages=languages,approval=approval,is_paused=paused)
            mentor.subjects.set([cls.sat if subject=='SAT' else cls.ielts for subject in subjects])
            cls.mentors[name]=user

    def setUp(self):self.client=APIClient()

    def names(self,**params):
        response=self.client.get('/api/mentors/',params)
        self.assertEqual(response.status_code,200,response.content)
        return [row['full_name'] for row in response.json()['results']]

    def test_combined_filters_are_intersection(self):
        self.assertEqual(self.names(subject=self.sat.pk,language='en',min_price=35000,max_price=50000),['Dil'])

    def test_price_bounds_are_inclusive(self):
        self.assertEqual(self.names(min_price=30000,max_price=30000),['Amy'])
        self.assertEqual(self.names(min_price=60000,max_price=60000),['Caro'])

    def test_language_aliases_and_token_boundaries(self):
        self.assertEqual(self.names(language='uz'),['Amy','Dil'])
        self.assertEqual(self.names(language='en'),['Amy','Bob','Dil'])
        self.assertEqual(self.names(language='ru'),['Bob','Caro'])
        mentor=self.mentors['Amy'].mentor
        mentor.teaching_languages="O'zbek tili";mentor.save()
        self.assertIn('Amy',self.names(language='uz'))

    def test_search_matches_name_headline_and_subject_without_duplicates(self):
        self.assertEqual(self.names(search='aMy'),['Amy'])
        self.assertEqual(self.names(search='IELTS'),['Bob','Dil'])
        rows=self.names(search='EduYor mentor')
        self.assertEqual(len(rows),len(set(rows)))
        self.assertEqual(len(rows),5)

    def test_ascending_and_descending_prices(self):
        self.assertEqual(self.names(ordering='price_asc'),['Amy','Dil','Bob','Eli','Caro'])
        self.assertEqual(self.names(ordering='price_desc'),['Caro','Eli','Bob','Dil','Amy'])

    def test_invalid_filters_have_field_errors(self):
        for params,key in [({'subject':'bad'},'subject'),({'subject':'99999999999999999'},'subject'),({'language':'xx'},'language'),({'ordering':'payment_reference'},'ordering'),({'min_price':'-1'},'min_price'),({'max_price':'NaN'},'max_price'),({'min_price':50000,'max_price':40000},'max_price')]:
            with self.subTest(params=params):
                response=self.client.get('/api/mentors/',params)
                self.assertEqual(response.status_code,400)
                self.assertIn(key,str(response.json()))

    def test_empty_fields_and_no_matches(self):
        self.assertEqual(len(self.names(subject='',language='',min_price='',max_price='',ordering='')),5)
        self.assertEqual(self.names(subject=self.ielts.pk,language='uz',min_price=50000),[])

    def test_filters_never_expose_private_or_unapproved_profiles(self):
        response=self.client.get('/api/mentors/',{'language':'en'})
        for row in response.json()['results']:
            self.assertNotIn(row['full_name'],['Hidden','Paused','Inactive'])
            for private in ['email','learning_goals','payment_reference','meeting_url','mentor_net']:
                self.assertNotIn(private,row)
        self.client.force_authenticate(self.mentors['Amy'])
        self.assertNotIn('Amy',self.names(language='en',exclude_self='1'))
        own=self.client.get('/api/me/').json()['mentor_listing']
        self.assertEqual(own['full_name'],'Amy')

    def test_filtering_precedes_pagination_and_sort_is_stable(self):
        for n in range(15):
            user=User.objects.create_user(f'page{n}@example.invalid',None)
            user.profile.full_name=f'Pagination {n:02}';user.profile.save()
            mentor=MentorProfile.objects.create(user=user,headline='Demo',bio='Demo',experience='Demo',hourly_price=35000,teaching_languages='English',approval='approved')
            mentor.subjects.add(self.ielts)
        params={'subject':self.ielts.pk,'language':'en','max_price':40000,'ordering':'price_asc'}
        first=self.client.get('/api/mentors/',params).json()
        second=self.client.get('/api/mentors/',{**params,'page':2}).json()
        self.assertEqual(first['count'],16)
        self.assertEqual(len(first['results']),9)
        self.assertEqual(len(second['results']),7)
        self.assertIn('language=en',first['next'])
        first_ids={row['id'] for row in first['results']}
        self.assertFalse(first_ids&{row['id'] for row in second['results']})
        self.assertEqual(self.client.get('/api/mentors/',params).json()['results'],first['results'])
