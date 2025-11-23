from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# 1. Создаем роутер и регистрируем стандартные ViewSets
router = DefaultRouter()
router.register(r'orders', views.OrderViewSet, basename='order')
router.register(r'items', views.ItemViewSet, basename='item')
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'users', views.UserViewSet, basename='user')

# 2. Определяем urlpatterns
urlpatterns = [
    # --- ВАЖНО: Сначала идут специальные пути ---
    # Если их поставить после роутера, они могут не сработать (ошибка 404)
    
    path('statistics-data/', 
         views.statistics_data_view, 
         name='api-statistics-data'),
         
    path('sync-sheets/', 
         views.sync_to_google_sheets, 
         name='api-sync-sheets'),

    # 3. В самом конце подключаем все пути роутера (orders/, products/ и т.д.)
    path('', include(router.urls)),
]