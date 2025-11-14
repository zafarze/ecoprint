# D:\Projects\EcoPrint\ecoprint\urls.py (УЛУЧШЕННЫЙ КОД)

from django.contrib import admin
from django.urls import path, include
from django.contrib.auth import views as auth_views
# ❗️ 'order_views' больше не импортируется здесь!

# Импорты для медиа-файлов
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # 1. API по-прежнему здесь (это нормально)
    path('api/', include('orders.urls')),
    
    # --- 👇 ВОТ ГЛАВНОЕ ИЗМЕНЕНИЕ ---
    # 2. Подключаем все URL-адреса веб-страниц из нашего нового файла
    path('', include('orders.web_urls')),

    # --- Вход / Выход (остаются здесь, т.к. это уровень проекта) ---
    path('login/', auth_views.LoginView.as_view(
        template_name='login.html'
    ), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    
    # ❗️ Все URL-адреса для профиля, настроек, пользователей и
    # ❗️ товаров были УДАЛЕНЫ отсюда и перенесены в 'orders.web_urls'
]

# "Включаем" раздачу /media/ файлов, пока DEBUG = True
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)