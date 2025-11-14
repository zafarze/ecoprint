# D:\Projects\EcoPrint\orders\urls.py (ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД)

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# 1. Создаем роутер
router = DefaultRouter()

# 2. Регистрируем наши ViewSet'ы
router.register(r'orders', views.OrderViewSet, basename='order')
router.register(r'items', views.ItemViewSet, basename='item')
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'users', views.UserViewSet, basename='user')

# 3. В urlpatterns мы включаем роутер И наш новый API
urlpatterns = [
    # URL'ы от роутера (/api/orders/, /api/users/, ...)
    path('', include(router.urls)),
    
    # 👇 ВОТ ИЗМЕНЕНИЕ: Наш новый API для статистики
    path('statistics-data/', 
         views.statistics_data_view, 
         name='api-statistics-data'),
]