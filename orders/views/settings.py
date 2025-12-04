from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from django.contrib.auth.models import User

from ..models import Profile, CompanySettings, TelegramSettings, Product
from ..forms import (
    NotificationSettingsForm, AdminUserCreationForm, AdminUserUpdateForm,
    CompanySettingsForm, TelegramSettingsForm, ProductForm
)

def is_superuser(user):
    return user.is_authenticated and user.is_superuser

@login_required
def settings_page_view(request):
    return render(request, 'settings_page.html', {})

@login_required
def notification_settings_view(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)
    if request.method == 'POST':
        form = NotificationSettingsForm(request.POST, instance=profile)
        if form.is_valid():
            form.save()
            messages.success(request, 'Настройки уведомлений сохранены!')
            return redirect('notification_settings')
    else:
        form = NotificationSettingsForm(instance=profile)
    return render(request, 'settings/notification_settings.html', {'form': form})

# --- Управление Пользователями ---

@user_passes_test(is_superuser)
def user_list_view(request):
    # Показываем всех, кроме удаленных (is_active=False), если хотите видеть всех - уберите filter
    # Но обычно в списке нужны активные. Если хотите видеть "архивных", уберите .filter(is_active=True)
    users = User.objects.all().order_by('username')
    return render(request, 'settings/user_list.html', {'users': users})

@user_passes_test(is_superuser)
def user_create_view(request):
    if request.method == 'POST':
        form = AdminUserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Пользователь успешно создан!')
            return redirect('user_list')
    else:
        form = AdminUserCreationForm()
    return render(request, 'settings/user_form.html', {'form': form, 'form_title': 'Создать нового пользователя'})

@user_passes_test(is_superuser)
def user_update_view(request, pk):
    user = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        form = AdminUserUpdateForm(request.POST, instance=user)
        if form.is_valid():
            form.save()
            messages.success(request, f'Данные пользователя {user.username} обновлены!')
            return redirect('user_list')
    else:
        form = AdminUserUpdateForm(instance=user)
    return render(request, 'settings/user_form.html', {'form': form, 'form_title': f'Редактировать: {user.username}'})

@user_passes_test(is_superuser)
def user_delete_view(request, pk):
    user = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        if request.user.pk == user.pk:
            messages.error(request, 'Вы не можете удалить свой собственный аккаунт.')
            return redirect('user_list')
        
        # --- Soft Delete (Деактивация вместо удаления) ---
        user.is_active = False
        user.save()
        messages.success(request, f'Пользователь {user.username} деактивирован (доступ закрыт).')
        
        return redirect('user_list')
    return render(request, 'settings/user_confirm_delete.html', {'user_to_delete': user})

# --- Настройки Компании и Интеграций ---

@user_passes_test(is_superuser)
def company_settings_view(request):
    settings_obj = CompanySettings.load()
    if request.method == 'POST':
        form = CompanySettingsForm(request.POST, request.FILES, instance=settings_obj)
        if form.is_valid():
            form.save()
            messages.success(request, 'Данные компании успешно сохранены!')
            return redirect('company_settings')
    else:
        form = CompanySettingsForm(instance=settings_obj)
    return render(request, 'settings/company_settings.html', {'form': form})

@user_passes_test(is_superuser)
def settings_integrations_view(request):
    settings_obj = TelegramSettings.load()
    if request.method == 'POST':
        form = TelegramSettingsForm(request.POST, instance=settings_obj)
        if form.is_valid():
            form.save()
            messages.success(request, 'Настройки Telegram сохранены!')
            return redirect('settings_integrations')
    else:
        form = TelegramSettingsForm(instance=settings_obj)
    return render(request, 'settings/integrations.html', {'form': form})

# --- Управление Товарами (Справочник) ---

@login_required
def product_list_view(request):
    products = Product.objects.all()
    return render(request, 'settings/product_list.html', {'products': products})

@login_required
def product_create_view(request):
    if request.method == 'POST':
        form = ProductForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Новый товар успешно создан!')
            return redirect('product_list')
    else:
        form = ProductForm()
    return render(request, 'settings/product_form.html', {'form': form, 'form_title': 'Создать новый товар'})

@login_required
def product_update_view(request, pk):
    product = get_object_or_404(Product, pk=pk)
    if request.method == 'POST':
        form = ProductForm(request.POST, instance=product)
        if form.is_valid():
            form.save()
            messages.success(request, f'Товар {product.name} обновлен!')
            return redirect('product_list')
    else:
        form = ProductForm(instance=product)
    return render(request, 'settings/product_form.html', {'form': form, 'form_title': f'Редактировать: {product.name}'})

@login_required
def product_delete_view(request, pk):
    product = get_object_or_404(Product, pk=pk)
    if request.method == 'POST':
        product_name = product.name
        product.delete()
        messages.success(request, f'Товар {product_name} был удален.')
        return redirect('product_list')
    return render(request, 'settings/product_confirm_delete.html', {'product_to_delete': product})