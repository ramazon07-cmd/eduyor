from django import forms
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from django.db import transaction
from django.http import HttpResponseRedirect, HttpResponse
from django.template.response import TemplateResponse
from django.utils import timezone
from django.utils.html import format_html
from django.urls import path, reverse
from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from rest_framework.exceptions import APIException
from .models import User, Profile, MentorProfile, Subject, AvailabilityRule, BlockedDate, Booking, FamilyLink, LearningCenter
from . import services


class UserCreateForm(UserCreationForm):
    class Meta:
        model = User
        fields = ['email']

class UserEditForm(UserChangeForm):
    class Meta:
        model = User
        fields = '__all__'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserEditForm
    add_form = UserCreateForm
    ordering = ['email']
    list_display = ['email','is_staff','is_active']
    search_fields = ['email','profile__full_name']
    fieldsets = [(None,{'fields':['email','password']}),('Permissions',{'fields':['is_active','is_staff','is_superuser','groups','user_permissions']}),('Dates',{'fields':['last_login','date_joined']})]
    add_fieldsets = [(None,{'classes':['wide'],'fields':['email','password1','password2']})]


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['full_name','account_type','school','timezone']
    list_filter = ['account_type']
    search_fields = ['full_name','user__email']
    readonly_fields = ['user']
    def save_model(self,request,obj,form,change):
        with transaction.atomic():
            services.lock_users([obj.user_id])
            super().save_model(request,obj,form,change)


@admin.register(FamilyLink)
class FamilyLinkAdmin(admin.ModelAdmin):
    # Support can review and remove parent links; codes are created only by parents.
    list_display = ['parent','child','linked_at','created_at']
    search_fields = ['parent__email','child__email','parent__profile__full_name','child__profile__full_name']
    readonly_fields = ['parent','child','code','linked_at','created_at']


@admin.register(LearningCenter)
class LearningCenterAdmin(admin.ModelAdmin):
    list_display = ['name','kind','city','approval','owner','created_at']
    list_filter = ['approval','kind']
    search_fields = ['name','owner__email','owner__profile__full_name']
    readonly_fields = ['owner','invite_code','created_at']
    actions = ['approve','reject']
    @admin.action(description='Approve selected learning centers')
    def approve(self,request,queryset):
        queryset.update(approval='approved')
    @admin.action(description='Reject selected learning centers')
    def reject(self,request,queryset):
        queryset.update(approval='rejected')


@admin.register(MentorProfile)
class MentorAdmin(admin.ModelAdmin):
    list_display = ['__str__','headline','approval','hourly_price','is_paused']
    list_filter = ['approval','is_paused','subjects']
    search_fields = ['user__profile__full_name','headline']
    filter_horizontal = ['subjects']
    readonly_fields = ['user']
    exclude = ['experience']
    actions = ['approve','reject']
    def save_model(self,request,obj,form,change):
        with transaction.atomic():
            services.lock_users([obj.user_id])
            super().save_model(request,obj,form,change)
    @admin.action(description='Approve selected mentor applications')
    def approve(self,request,queryset):
        for pk in queryset.values_list('pk',flat=True):
            with transaction.atomic():
                obj = MentorProfile.objects.get(pk=pk)
                services.lock_users([obj.user_id])
                obj.approval = 'approved'
                obj.save(update_fields=['approval'])
    @admin.action(description='Reject selected mentor applications')
    def reject(self,request,queryset):
        for obj in queryset:
            with transaction.atomic():
                services.lock_users([obj.user_id])
                obj.approval = 'rejected'
                obj.save(update_fields=['approval'])


class PaymentVerificationForm(forms.Form):
    reference = forms.CharField(label='Bankda ko‘ringan tranzaksiya raqami', max_length=160, error_messages={'required':'Bankdagi haqiqiy tranzaksiya raqamini kiriting.'})
    receipt_checked = forms.BooleanField(label='Bank ilovasida aynan shu summaning tushganini tekshirdim', error_messages={'required':'Avval tushumni bank ilovasida tekshiring va belgilang.'})


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    change_form_template = 'admin/core/booking/change_form.html'
    change_list_template = 'admin/core/booking/change_list.html'
    list_display = ['id','student','mentor','starts_at','status','payment_status','total_price','payout_status','disputed','payment_review']
    list_filter = ['status','payment_status','payout_status','disputed']
    search_fields = ['student__email','mentor__email','payment_reference','receipt_reference','payout_reference']
    readonly_fields = [f.name for f in Booking._meta.fields]
    actions = None
    def has_add_permission(self,request):
        return False
    def has_delete_permission(self,request,obj=None):
        return False
    def get_urls(self):
        return [path('<int:pk>/payment-review/',self.admin_site.admin_view(self.review_payment),name='core_booking_payment_review'),path('<int:pk>/operate/',self.admin_site.admin_view(self.operate),name='core_booking_operate')] + super().get_urls()
    @admin.display(description='To‘lovni tekshirish')
    def payment_review(self, obj):
        return format_html('<a href="{}">{}</a>',reverse('admin:core_booking_payment_review',args=[obj.pk]),'Tekshirish' if obj.payment_status=='submitted' else 'To‘lov tafsiloti')

    def review_payment(self,request,pk):
        obj = self.get_object(request,str(pk))
        if obj is None or not self.has_change_permission(request,obj):
            raise PermissionDenied()
        if request.method not in ['GET','POST']:
            return HttpResponse(status=405)
        booking = services.refresh_booking(pk)
        form = PaymentVerificationForm(request.POST if request.method=='POST' else None)
        status = 200
        if request.method=='POST':
            status = 400
            if form.is_valid():
                try:
                    booking = services.verify_payment(pk,form.cleaned_data['reference'])
                    if booking.payment_status=='refund_required':
                        status = 409
                        self.message_user(request,'Pul tushumi qayd etildi. Bron faol emas: to‘liq summani qo‘lda qaytarish kerak.',messages.WARNING)
                    else:
                        self.message_user(request,'To‘lov va dars tasdiqlandi.' if booking.payment_status=='verified' else 'To‘lov oldin qaytarilgan.',messages.SUCCESS)
                        return HttpResponseRedirect(reverse('admin:core_booking_payment_review',args=[pk]))
                except (APIException,DjangoValidationError) as exc:
                    form.add_error(None,str(exc))
        context = {**self.admin_site.each_context(request),'title':f'To‘lovni tekshirish · #{pk}',
            'opts':self.model._meta,'booking':booking,'form':form,
            'payment_label':{'unpaid':'Xabar berilmagan','submitted':'Tekshiruv kutilmoqda','verified':'Tasdiqlangan','refund_required':'Qaytarish kerak','refunded':'Qaytarilgan'}.get(booking.payment_status,booking.payment_status),
            'can_record':booking.payment_status in ['unpaid','submitted'],
            'active_hold':booking.status=='pending_payment' and booking.expires_at>timezone.now(),
            'booking_url':reverse('admin:core_booking_change',args=[pk]),
            'queue_url':reverse('admin:core_booking_changelist')+'?payment_status__exact=submitted'}
        return TemplateResponse(request,'admin/core/booking/payment_review.html',context,status=status)

    def operate(self,request,pk):
        if request.method != 'POST':
            return HttpResponse(status=405)
        obj = self.get_object(request,str(pk))
        if obj is None or not self.has_change_permission(request,obj):
            raise PermissionDenied()
        operation = request.POST.get('operation')
        reference = request.POST.get('reference','').strip()[:160]
        note = request.POST.get('note','').strip()[:1500]
        try:
            if operation == 'verify':
                obj = services.verify_payment(pk,reference)
                if obj.payment_status == 'refund_required':
                    self.message_user(request,'Receipt recorded, but reservation is no longer valid. Manually refund the full amount.',messages.WARNING)
                    return HttpResponse('Receipt recorded; reservation expired/unavailable. Refund required. Return to the booking.',status=409)
            elif operation == 'complete':
                obj = services.complete(pk,request.user)
            elif operation == 'payout':
                obj = services.pay_out(pk,reference)
            elif operation == 'refund':
                obj = services.refund(pk,reference)
            elif operation == 'resolve_refund':
                obj = services.resolve_with_refund(pk,note)
            elif operation == 'resolve':
                obj = services.resolve_issue(pk,note)
            elif operation == 'cancel':
                obj = services.cancel(pk,request.user)
            elif operation == 'dispute':
                obj = services.report_issue(pk,request.user,note or 'Admin review')
            else:
                return HttpResponse(status=400)
            self.message_user(request,'Operation recorded. Repeating it will not duplicate a transfer or confirmation.',messages.SUCCESS)
        except (APIException,DjangoValidationError) as exc:
            self.message_user(request,str(exc),messages.ERROR)
        return HttpResponseRedirect(reverse('admin:core_booking_change',args=[pk]))

admin.site.register(Subject)
# Availability is managed via the locked API, not unlocked inline saves in Admin.
admin.site.site_header = 'EduYor · Boshqaruv'

admin.site.site_title = 'EduYor admin'
admin.site.index_title = 'Boshqaruv paneli'
