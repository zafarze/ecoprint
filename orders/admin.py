# D:\Projects\EcoPrint\orders\admin.py (ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД)

from django.contrib import admin
from .models import Order, Item, Profile, Product, CompanySettings, TelegramSettings

# --- Настройка отображения товаров внутри заказа ---
class ItemInline(admin.TabularInline):
    model = Item
    extra = 0 # Ставим 0, чтобы не висела пустая строка, если она не нужна (можно нажать "Добавить")
    
    # Поля, которые видны в таблице товаров внутри заказа
    fields = ('name', 'quantity', 'deadline', 'status', 'responsible_user', 'is_archived')
    
    # Включает выпадающий список с поиском для выбора ответственного.
    # ВАЖНО: Работает, так как стандартная модель User имеет search_fields.
    autocomplete_fields = ['responsible_user'] 

# --- Админка для Заказов ---
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'client', 'status', 'created_at')
    list_filter = ('status', 'created_at') 
    
    # Добавили поиск по ID заказа, это очень удобно
    search_fields = ('client', 'id')
    
    # Подключаем товары внутрь страницы заказа
    inlines = [ItemInline] 

# --- Админка для Товаров (Ассортимента) ---
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'icon')
    list_filter = ('category',)
    search_fields = ('name',)

# --- Админка для Профилей ---
@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    # Теперь мы видим, чей это профиль и есть ли аватар
    list_display = ('user', 'avatar_preview')
    search_fields = ('user__username', 'user__email')

    # Небольшой метод для отображения текста, есть ли аватар
    def avatar_preview(self, obj):
        if obj.avatar:
            return "Да"
        return "Нет"
    avatar_preview.short_description = "Аватар"

# --- Базовый класс для "Одиночных" настроек ---
class SingletonAdmin(admin.ModelAdmin):
    """
    Скрывает кнопку 'Добавить', если объект уже существует.
    Нужно для настроек компании и Telegram, чтобы не создавать дубли.
    """
    def has_add_permission(self, request):
        if self.model.objects.exists():
            return False
        return super().has_add_permission(request)

# --- Админка Настроек Компании ---
@admin.register(CompanySettings)
class CompanySettingsAdmin(SingletonAdmin):
    pass

# --- Админка Настроек Telegram ---
@admin.register(TelegramSettings)
class TelegramSettingsAdmin(SingletonAdmin):
    # Скрываем токен в списке, показываем только Chat ID для безопасности
    list_display = ('chat_id', 'bot_token_masked')

    def bot_token_masked(self, obj):
        if obj.bot_token:
            return "******" + obj.bot_token[-4:]
        return "Не задан"
    bot_token_masked.short_description = "Токен"