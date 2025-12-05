from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import web_urls  # <--- Импортируем твои WEB-пути

# 1. Настройка API Роутера
router = DefaultRouter()
router.register(r'orders', views.OrderViewSet, basename='order')
router.register(r'items', views.ItemViewSet, basename='item')
router.register(r'products', views.ProductViewSet, basename='product')
router.register(r'users', views.UserViewSet, basename='user')

urlpatterns = [
    # ==============================
    # 1. API Endpoints (префикс api/)
    # ==============================
    
    # Специфичные API пути (ставим перед роутером!)
    path('api/statistics-data/', views.statistics_data_view, name='api-statistics-data'),
    path('api/sync-sheets/', views.sync_to_google_sheets, name='api-sync-sheets'),
    path('api/ai-chat/', views.chat_with_ai, name='api-ai-chat'), # Исправлено: views.chat_with_ai

    # Подключаем стандартные CRUD пути (orders, items...)
    path('api/', include(router.urls)),
    

    # ==============================
    # 2. WEB Страницы (HTML)
    # ==============================
    # Подключаем файл web_urls.py. 
    # Так как там пути начинаются с '' (пустой строки), они будут работать от корня сайта.
    path('', include(web_urls)),
]