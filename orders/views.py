# D:\Projects\EcoPrint\orders\views.py (ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД)

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth import update_session_auth_hash, logout
from django.contrib import messages
from django.db.models import Min, F, Count
from django.db import transaction
from django.conf import settings
from django.views.decorators.cache import never_cache 
from django.utils.decorators import method_decorator

# --- Импорты DRF ---
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, action, permission_classes # 👈 ВОТ ЭТОГО НЕ ХВАТАЛО
from rest_framework.response import Response

# --- Импорты моделей и сериализаторов ---
from .models import Order, Item, Profile, CompanySettings, TelegramSettings, Product
from django.contrib.auth.models import User
from .serializers import OrderSerializer, ProductSerializer, UserSimpleSerializer, ItemSerializer

# --- Импорты форм ---
from .forms import (UserUpdateForm, ProfileUpdateForm, AdminUserCreationForm, 
                    AdminUserUpdateForm, NotificationSettingsForm, CompanySettingsForm,
                    TelegramSettingsForm, ProductForm)

# --- Вспомогательные импорты ---
from .telegram_bot import send_telegram_notification
from django.contrib.auth.forms import PasswordChangeForm
from datetime import date, timedelta
import os
import gspread # Для Google Sheets

# --- API VIEWS ---

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    # Фильтруем заказы
    def get_queryset(self):
        queryset = Order.objects.all()
        
        # Фильтрация по архиву
        is_archived = self.request.query_params.get('is_archived')
        if is_archived == 'true':
            queryset = queryset.filter(items__is_archived=True)
        elif is_archived == 'false':
            queryset = queryset.filter(items__is_archived=False)
        
        # Сортировка: Срочные наверх
        queryset = queryset.annotate(earliest_deadline=Min('items__deadline'))
        return queryset.distinct().order_by(F('earliest_deadline').asc(nulls_last=True), '-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context() 
        is_archived_param = self.request.query_params.get('is_archived')
        
        if is_archived_param == 'true':
            context['show_archived'] = True
        else:
            context['show_archived'] = False
            
        return context

    def perform_create(self, serializer):
        order = serializer.save()
        try:
            send_telegram_notification(order)
        except Exception as e:
            print(f"Ошибка при вызове telegram_bot: {e}")

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        try:
            order = self.get_object()
            updated_count = order.items.update(is_archived=True)
            return Response({'status': 'success', 'message': f'{updated_count} товаров архивировано.'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def unarchive(self, request, pk=None):
        try:
            order = self.get_object()
            updated_count = order.items.update(is_archived=False)
            return Response({'status': 'success', 'message': f'{updated_count} товаров восстановлено.'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    permission_classes = [permissions.IsAuthenticated]


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.all().order_by('name')
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None # Отключаем пагинацию для выпадающих списков

    # Отключаем кэширование, чтобы новые товары появлялись сразу
    @method_decorator(never_cache)
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.filter(is_active=True).order_by('first_name')
    serializer_class = UserSimpleSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None


@api_view(['GET'])
def statistics_data_view(request):
    total_orders = Order.objects.count()
    pending_orders = Order.objects.filter(status='in-progress').count()
    
    today = date.today()
    created_today = Order.objects.filter(created_at__date=today).count()
    
    top_product_query = Item.objects.values('name') \
                            .annotate(name_count=Count('name')) \
                            .order_by('-name_count') \
                            .first()
    top_product_name = top_product_query['name'] if top_product_query else "Нет"

    status_counts_query = Order.objects.values('status') \
                                 .annotate(count=Count('status')) \
                                 .order_by('status')
    
    status_data = {
        'labels': [item['status'] for item in status_counts_query],
        'counts': [item['count'] for item in status_counts_query],
    }

    seven_days_ago = today - timedelta(days=6)
    
    activity_query = Order.objects.filter(created_at__date__gte=seven_days_ago) \
                            .values('created_at__date') \
                            .annotate(count=Count('id')) \
                            .order_by('created_at__date')
    
    activity_data_dict = { (today - timedelta(days=i)): 0 for i in range(7) }
    for item in activity_query:
        activity_data_dict[item['created_at__date']] = item['count']
        
    sorted_activity = sorted(activity_data_dict.items())
    activity_data = {
        'labels': [day.strftime('%d.%m') for day, count in sorted_activity],
        'counts': [count for day, count in sorted_activity],
    }

    data = {
        'total_orders': total_orders,
        'pending_orders': pending_orders,
        'created_today': created_today,
        'top_product': top_product_name,
        'status_counts': status_data,
        'activity_last_7_days': activity_data,
    }
    
    return Response(data)


# 👇 НОВЫЙ МЕТОД ДЛЯ GOOGLE SHEETS 👇
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sync_to_google_sheets(request):
    """
    Выгружает все заказы в Google Таблицу по ID.
    """
    try:
        # 1. Подключаемся к Google API
        service_account_path = os.path.join(settings.BASE_DIR, 'service_account.json')
        
        if not os.path.exists(service_account_path):
            return Response({'error': 'Файл service_account.json не найден!'}, status=400)

        gc = gspread.service_account(filename=service_account_path)
        
        # 2. Открываем таблицу по ID из .env
        sheet_id = os.environ.get('GOOGLE_SHEET_ID')
        if not sheet_id:
             # Если ID не задан, пробуем старый метод по имени (резерв)
             sheet_name = os.environ.get('GOOGLE_SHEET_NAME', 'EcoPrint Orders')
             try:
                 sh = gc.open(sheet_name)
             except gspread.SpreadsheetNotFound:
                 return Response({'error': f'Таблица "{sheet_name}" не найдена. Дайте доступ боту!'}, status=404)
        else:
             # ОТКРЫВАЕМ ПО ID (Самый надежный способ)
             try:
                 sh = gc.open_by_key(sheet_id)
             except gspread.SpreadsheetNotFound:
                 return Response({'error': f'Таблица с ID {sheet_id} не найдена. Убедитесь, что вы добавили бота (email из json) в настройки доступа таблицы!'}, status=404)

        worksheet = sh.sheet1 

        # 3. Собираем данные из БД
        orders = Order.objects.all().order_by('-created_at')
        
        data = [['ID Заказа', 'Клиент', 'Дата создания', 'Статус заказа', 
                 'Товар', 'Кол-во', 'Дедлайн', 'Статус товара', 'Ответственный', 'Комментарий']]

        for order in orders:
            created_date = order.created_at.strftime("%d.%m.%Y %H:%M")
            if order.items.exists():
                for item in order.items.all():
                    resp_user = item.responsible_user.username if item.responsible_user else "Нет"
                    deadline = item.deadline.strftime("%d.%m.%Y") if item.deadline else "-"
                    row = [
                        order.id, order.client, created_date, order.get_status_display(),
                        item.name, item.quantity, deadline, item.get_status_display(),
                        resp_user, item.comment
                    ]
                    data.append(row)
            else:
                row = [order.id, order.client, created_date, order.get_status_display(), 
                       "-", "-", "-", "-", "-", "-"]
                data.append(row)

        # 4. Очищаем и записываем
        worksheet.clear()
        worksheet.update(data)

        return Response({'status': 'success', 'message': f'Успешно выгружено {len(data)-1} строк.'})

    except Exception as e:
        print(f"Google Sheet Error: {e}")
        return Response({'error': str(e)}, status=500)


# --- ОБЫЧНЫЕ VIEWS (HTML) ---

@login_required
def index(request):
    return render(request, 'index.html', {})

def logout_view(request):
    logout(request)
    messages.success(request, 'Вы успешно вышли из системы.')
    return redirect('index')

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

# --- Админские Views (Декораторы user_passes_test) ---
def is_superuser(user):
    return user.is_authenticated and user.is_superuser

@user_passes_test(is_superuser)
def user_list_view(request):
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
        username = user.username
        user.delete()
        messages.success(request, f'Пользователь {username} был удален.')
        return redirect('user_list')
    return render(request, 'settings/user_confirm_delete.html', {'user_to_delete': user})

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

# --- Управление Товарами (Products) ---
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

@login_required
def statistics_page(request):
    return render(request, 'statistics.html')

@login_required
def archive_page_view(request):
    return render(request, 'archive.html', {})