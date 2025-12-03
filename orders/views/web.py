from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash, logout
from django.contrib import messages
from django.contrib.auth.forms import PasswordChangeForm

from ..models import Profile
from ..forms import UserUpdateForm, ProfileUpdateForm

@login_required
def index(request):
    return render(request, 'index.html', {})

def logout_view(request):
    logout(request)
    messages.success(request, 'Вы успешно вышли из системы.')
    return redirect('index')

@login_required
def statistics_page(request):
    return render(request, 'statistics.html')

@login_required
def archive_page_view(request):
    return render(request, 'archive.html', {})

@login_required
def profile_view(request):
    try:
        profile = request.user.profile
    except Profile.DoesNotExist:
        profile = Profile.objects.create(user=request.user)

    if request.method == 'POST':
        if 'save_profile' in request.POST:
            user_form = UserUpdateForm(request.POST, instance=request.user)
            profile_form = ProfileUpdateForm(request.POST, request.FILES, instance=profile)
            if user_form.is_valid() and profile_form.is_valid():
                user_form.save()
                profile_form.save()
                messages.success(request, 'Ваши данные профиля успешно обновлены!')
                return redirect('profile_page')
        elif 'change_password' in request.POST:
            password_form = PasswordChangeForm(request.user, request.POST)
            if password_form.is_valid():
                user = password_form.save()
                update_session_auth_hash(request, user)
                messages.success(request, 'Ваш пароль успешно изменен!')
                return redirect('profile_page')
    
    user_form = UserUpdateForm(instance=request.user)
    profile_form = ProfileUpdateForm(instance=profile)
    password_form = PasswordChangeForm(request.user)

    return render(request, 'profile/profile_page.html', {
        'user_form': user_form,
        'profile_form': profile_form,
        'password_form': password_form
    })