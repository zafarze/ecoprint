# D:\Projects\EcoPrint\orders\views.py (ПОЛНЫЙ ОБНОВЛЕННЫЙ КОД)

from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from rest_framework import viewsets
from rest_framework import permissions # 👈 1. ДОБАВЛЕН ИМПОРТ
from .serializers import OrderSerializer, ProductSerializer, UserSimpleSerializer
from rest_framework.decorators import api_view
# Все импорты моделей
from .models import (Order, Item, Profile, CompanySettings, 
                     TelegramSettings, Product) 
from django.contrib.auth.models import User # 👈 2. УБЕДИТЕСЬ, ЧТО USER ИМПОРТИРОВАН

from django.db.models import Count
from rest_framework.response import Response
from datetime import date, timedelta

# Все импорты сериализаторов
from .serializers import (OrderSerializer, ItemSerializer, 
                          ProductSerializer, UserSimpleSerializer) # 👈 3. ДОБАВЛЕН UserSimpleSerializer

# Все импорты форм
from .forms import (UserUpdateForm, ProfileUpdateForm, 
                    AdminUserCreationForm, AdminUserUpdateForm, 
                    NotificationSettingsForm, CompanySettingsForm,
                    TelegramSettingsForm, ProductForm)

# Другие импорты
from .telegram_bot import send_telegram_notification
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth import update_session_auth_hash
from django.contrib import messages 
from django.contrib.auth.decorators import user_passes_test
from django.shortcuts import get_object_or_404


# --- 👇 ИЗМЕНЕНИЕ ЗДЕСЬ (ШАГ 2 из плана) ---
@login_required
def index(request):
    """
    Отображает главный дашборд (SPA).
    Больше не передает 'all_users' в контекст.
    """
    # ❗️ 'all_users' отсюда удалены.
    context = {} # Контекст теперь пустой
    return render(request, 'index.html', context)
# --- 👆 КОНЕЦ ИЗМЕНЕНИЯ ---

# --- Наши API ViewSets ---
class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all().order_by('-created_at')
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated] # (Рекомендую добавить)

    def perform_create(self, serializer):
        order = serializer.save()
        try:
            send_telegram_notification(order)
        except Exception as e:
            print(f"Ошибка при вызове telegram_bot: {e}")

class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    permission_classes = [permissions.IsAuthenticated] # (Рекомендую добавить)

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated] # (Рекомендую добавить)
    pagination_class = None 

# --- 👇 НОВЫЙ VIEWSET (ШАГ 1 из плана) ---
class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API, который отдает список всех активных пользователей.
    Только для чтения (ReadOnly).
    """
    queryset = User.objects.filter(is_active=True).order_by('first_name')
    serializer_class = UserSimpleSerializer
    permission_classes = [permissions.IsAuthenticated] # Только для вошедших
    pagination_class = None # Отключаем пагинацию, нам нужен полный список
# --- 👆 КОНЕЦ НОВОГО VIEWSET ---


# --- (Все остальные views: profile_view, settings_page_view, 
#      user_list_view, product_list_view и т.д. остаются без изменений) ---
# ... (весь остальной код в views.py) ...
# (Я не буду повторять все остальные функции, они остаются такими же, как 
# в файле 'views.py', который вы загружали ранее)
@login_required
def profile_view(request):
    try:
        profile = request.user.profile
    except Profile.DoesNotExist:
        profile = Profile.objects.create(user=request.user)

    if request.method == 'POST':
        if 'save_profile' in request.POST:
            user_form = UserUpdateForm(request.POST, instance=request.user)
            profile_form = ProfileUpdateForm(request.POST, 
                                             request.FILES, 
                                             instance=profile)
            
            if user_form.is_valid() and profile_form.is_valid():
                user_form.save()
                profile_form.save()
                messages.success(request, 'Ваши данные профиля успешно обновлены!')
                return redirect('profile_page')
            else:
                password_form = PasswordChangeForm(request.user)

        elif 'change_password' in request.POST:
            password_form = PasswordChangeForm(request.user, request.POST)
            
            if password_form.is_valid():
                user = password_form.save()
                update_session_auth_hash(request, user) 
                messages.success(request, 'Ваш пароль успешно изменен!')
                return redirect('profile_page')
            else:
                user_form = UserUpdateForm(instance=request.user)
                profile_form = ProfileUpdateForm(instance=profile)
        
    else:
        user_form = UserUpdateForm(instance=request.user)
        profile_form = ProfileUpdateForm(instance=profile)
        password_form = PasswordChangeForm(request.user)

    context = {
        'user_form': user_form,
        'profile_form': profile_form,
        'password_form': password_form
    }
    
    return render(request, 'profile/profile_page.html', context)

@login_required
def settings_page_view(request):
    context = {}
    return render(request, 'settings_page.html', context)

def is_superuser(user):
    return user.is_authenticated and user.is_superuser

@user_passes_test(is_superuser) 
def user_list_view(request):
    users = User.objects.all().order_by('username')
    context = {
        'users': users
    }
    return render(request, 'settings/user_list.html', context)

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
    
    context = {
        'form': form,
        'form_title': 'Создать нового пользователя'
    }
    return render(request, 'settings/user_form.html', context)

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
    
    context = {
        'form': form,
        'form_title': f'Редактировать: {user.username}'
    }
    return render(request, 'settings/user_form.html', context)

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
    
    context = {
        'user_to_delete': user
    }
    return render(request, 'settings/user_confirm_delete.html', context)

@login_required
def notification_settings_view(request):
    try:
        profile = request.user.profile
    except Profile.DoesNotExist:
        profile = Profile.objects.create(user=request.user)

    if request.method == 'POST':
        form = NotificationSettingsForm(request.POST, instance=profile)
        if form.is_valid():
            form.save()
            messages.success(request, 'Настройки уведомлений сохранены!')
            return redirect('notification_settings')
    else:
        form = NotificationSettingsForm(instance=profile)
    
    context = {
        'form': form
    }
    return render(request, 'settings/notification_settings.html', context)

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
    
    context = {
        'form': form
    }
    return render(request, 'settings/company_settings.html', context)

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
    
    context = {
        'form': form
    }
    return render(request, 'settings/integrations.html', context)

@login_required 
def product_list_view(request):
    products = Product.objects.all()
    context = {
        'products': products
    }
    return render(request, 'settings/product_list.html', context)

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
    
    context = {
        'form': form,
        'form_title': 'Создать новый товар'
    }
    return render(request, 'settings/user_form.html', context) 

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
    
    context = {
        'form': form,
        'form_title': f'Редактировать: {product.name}'
    }
    return render(request, 'settings/user_form.html', context) 

@login_required 
def product_delete_view(request, pk):
    product = get_object_or_404(Product, pk=pk)
    
    if request.method == 'POST':
        product_name = product.name
        product.delete()
        messages.success(request, f'Товар {product_name} был удален.')
        return redirect('product_list')
    
    context = {
        'product_to_delete': product 
    }
    return render(request, 'settings/product_confirm_delete.html', context)

@login_required
def statistics_page(request):
    # Пока просто отображаем шаблон.
    # Позже сюда можно будет добавить передачу данных.
    return render(request, 'statistics.html')

@api_view(['GET', 'POST'])
def order_list_create(request):
    """
    GET: Получить список всех заказов.
    POST: Создать новый заказ.
    """
    if request.method == 'GET':
        orders = Order.objects.all().order_by('-created_at')
        # 👇 Используем ваш OrderSerializer
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        # 👇 Используем ваш OrderSerializer
        serializer = OrderSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
def order_detail(request, pk):
    """
    GET: Получить один заказ.
    PUT: Обновить один заказ.
    DELETE: Удалить один заказ.
    """
    try:
        order = Order.objects.get(pk=pk)
    except Order.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = OrderSerializer(order)
        return Response(serializer.data)

    elif request.method == 'PUT':
        # 👇 Используем ваш OrderSerializer для обновления
        serializer = OrderSerializer(order, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        order.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# --- API для каталогов (нужны для модального окна) ---

@api_view(['GET'])
def product_catalog(request):
    """ API-endpoint для списка продуктов в модальном окне """
    products = Product.objects.all()
    # 👇 Используем ваш ProductSerializer
    serializer = ProductSerializer(products, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def user_catalog(request):
    """ API-endpoint для списка пользователей в модальном окне """
    users = User.objects.filter(is_active=True)
    # 👇 Используем ваш UserSimpleSerializer
    serializer = UserSimpleSerializer(users, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def statistics_data_view(request):
    """
    API-endpoint, который отдает все данные для
    страницы "Статистика".
    """
    
    # --- 1. Считаем KPI ---
    total_orders = Order.objects.count()
    pending_orders = Order.objects.filter(status='in-progress').count()
    
    # Считаем "Создано сегодня" (вместо "Готово сегодня")
    today = date.today()
    created_today = Order.objects.filter(created_at__date=today).count()
    
    # Ищем самый популярный товар
    top_product_query = Item.objects.values('name') \
                            .annotate(name_count=Count('name')) \
                            .order_by('-name_count') \
                            .first()
    top_product_name = top_product_query['name'] if top_product_query else "Нет"

    # --- 2. Данные для Pie Chart (Статусы) ---
    status_counts_query = Order.objects.values('status') \
                                 .annotate(count=Count('status')) \
                                 .order_by('status')
    
    # Форматируем для Chart.js
    status_data = {
        'labels': [item['status'] for item in status_counts_query],
        'counts': [item['count'] for item in status_counts_query],
    }

    # --- 3. Данные для Line Chart (Активность за 7 дней) ---
    seven_days_ago = today - timedelta(days=6) # 6 дней назад + сегодня = 7 дней
    
    # Группируем заказы по дате создания
    activity_query = Order.objects.filter(created_at__date__gte=seven_days_ago) \
                            .values('created_at__date') \
                            .annotate(count=Count('id')) \
                            .order_by('created_at__date')
    
    # Создаем словарь "дата:_количество" для всех дней, даже с 0 заказами
    activity_data_dict = { (today - timedelta(days=i)): 0 for i in range(7) }
    for item in activity_query:
        activity_data_dict[item['created_at__date']] = item['count']
        
    # Сортируем и форматируем для Chart.js
    sorted_activity = sorted(activity_data_dict.items())
    activity_data = {
        'labels': [day.strftime('%d.%m') for day, count in sorted_activity],
        'counts': [count for day, count in sorted_activity],
    }

    # --- 4. Собираем финальный JSON-ответ ---
    data = {
        # KPI
        'total_orders': total_orders,
        'pending_orders': pending_orders,
        'created_today': created_today,
        'top_product': top_product_name,
        
        # Chart data
        'status_counts': status_data,
        'activity_last_7_days': activity_data,
    }
    
    return Response(data)


@login_required
def archive_page_view(request):
    """
    Отображает страницу "Архив заказов".
    (Пока просто отображает шаблон, 
    позже мы добавим сюда API для загрузки данных)
    """
    context = {}
    return render(request, 'archive.html', context)