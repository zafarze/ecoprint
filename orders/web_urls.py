# D:\Projects\EcoPrint\orders\web_urls.py

from django.urls import path
from . import views as order_views 
from django.contrib.auth import views as auth_views

urlpatterns = [
    # --- Главная и Профиль ---
    path('', order_views.index, name='index'), 
    path('profile/', order_views.profile_view, name='profile_page'),
    
    # --- Статистика и Архив ---
    path('statistics/', order_views.statistics_page, name='statistics_page'),
    path('archive/', order_views.archive_page_view, name='archive_page'),
    
    # --- Настройки ---
    path('settings/', order_views.settings_page_view, name='settings_page'),
    path('settings/users/', 
         order_views.user_list_view, 
         name='user_list'),
    path('settings/users/create/', 
         order_views.user_create_view, 
         name='user_create'),
    path('settings/users/<int:pk>/edit/', 
         order_views.user_update_view, 
         name='user_update'),
    path('settings/users/<int:pk>/delete/', 
         order_views.user_delete_view, 
         name='user_delete'),
    path('settings/notifications/', 
         order_views.notification_settings_view, 
         name='notification_settings'),
    path('settings/company/', 
         order_views.company_settings_view, 
         name='company_settings'),
    path('settings/integrations/', 
         order_views.settings_integrations_view, 
         name='settings_integrations'),
         
    # --- Управление Товарами (Products) ---
    path('products/', 
         order_views.product_list_view, 
         name='product_list'),
    path('products/create/', 
         order_views.product_create_view, 
         name='product_create'),
    path('products/<int:pk>/edit/', 
         order_views.product_update_view, 
         name='product_update'),
    path('products/<int:pk>/delete/', 
         order_views.product_delete_view, 
         name='product_delete'),
    
    # --- Авторизация (Вход / Выход) ---
    path('login/', auth_views.LoginView.as_view(template_name='login.html'), name='login'),
    path('logout/', order_views.logout_view, name='logout'), 
]