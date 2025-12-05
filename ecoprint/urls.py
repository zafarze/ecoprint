# D:\Projects\EcoPrint\ecoprint\urls.py

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Мы убираем лишние импорты auth_views, так как вход/выход 
# уже настроен внутри orders/web_urls.py

urlpatterns = [
    # 1. Админка
    path('admin/', admin.site.urls),

    # 2. ГЛАВНОЕ ПОДКЛЮЧЕНИЕ:
    # Мы подключаем orders.urls к корню сайта ('').
    # Внутри orders.urls уже настроено разделение:
    # - пути, начинающиеся с api/ -> идут в API
    # - остальные пути -> идут на веб-страницы
    path('', include('orders.urls')), 
]

# 3. Раздача медиа-файлов (аватарки) в режиме разработки
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)