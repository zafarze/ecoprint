# D:\Projects\EcoPrint\orders\forms.py

from django import forms
from django.contrib.auth.models import User
from .models import Profile
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import (Profile, CompanySettings, 
                     TelegramSettings, Product)



class UserUpdateForm(forms.ModelForm):
    """
    Форма для обновления данных пользователя (Имя, Email, Username).
    """
    email = forms.EmailField()
    
    class Meta:
        model = User
        # 👇 Добавили 'username'
        fields = ['username', 'first_name', 'last_name', 'email']

class ProfileUpdateForm(forms.ModelForm):
    """
    Форма для обновления аватара.
    """
    class Meta:
        model = Profile
        fields = ['avatar']

class AdminUserCreationForm(UserCreationForm):
    """
    Форма для СОЗДАНИЯ нового пользователя админом.
    Включает создание пароля.
    """
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username", "first_name", "last_name", "email", "is_staff", "is_superuser")

class AdminUserUpdateForm(forms.ModelForm):
    """
    Форма для РЕДАКТИРОВАНИЯ пользователя админом.
    НЕ включает пароль.
    """
    class Meta:
        model = User
        fields = ("username", "first_name", "last_name", "email", "is_staff", "is_active", "is_superuser")

class NotificationSettingsForm(forms.ModelForm):
    """
    Форма для редактирования ТОЛЬКО настроек уведомлений.
    """
    class Meta:
        model = Profile
        fields = ['sound_notifications', 
                  'popup_notifications', 
                  'day_before_notifications']

class CompanySettingsForm(forms.ModelForm):
    """
    Форма для редактирования данных компании.
    """
    class Meta:
        model = CompanySettings
        fields = ['company_name', 'address', 'phone', 'company_logo']
    
class TelegramSettingsForm(forms.ModelForm):
    """
    Форма для редактирования настроек Telegram-бота.
    """
    bot_token = forms.CharField(
        widget=forms.PasswordInput(render_value=True), 
        label="Token Telegram-бота",
        help_text="Токен будет сохранен в базе данных. Будьте осторожны."
    )
    
    class Meta:
        model = TelegramSettings
        fields = ['bot_token', 'chat_id']
    

class ProductForm(forms.ModelForm):
    """
    Форма для создания/редактирования товара в ассортименте.
    """
    class Meta:
        model = Product
        fields = ['name', 'category', 'icon']
        help_texts = {
            'icon': "Например: 'fas fa-print' (для визиток) или 'fas fa-book' (для буклетов). Искать на FontAwesome."
        }