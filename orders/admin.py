# D:\Projects\EcoPrint\orders\admin.py (ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД)

from django.contrib import admin
from .models import Order, Item, Profile, Product, CompanySettings, TelegramSettings

# Эта строка "показывает" вашу модель Item внутри страницы заказа
class ItemInline(admin.TabularInline):
    model = Item
    extra = 1 # Показывает 1 пустой слот для нового товара
    
    # --- 👇 ИЗМЕНЕНИЕ: Добавляем 'responsible_user' сюда ---
    # Позволяет быстро назначить ответственного прямо в заказе
    fields = ('name', 'quantity', 'deadline', 'status', 'responsible_user')
    autocomplete_fields = ['responsible_user'] # Удобный поиск пользователя

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    # --- 👇 ИЗМЕНЕНИЕ: Убрали 'responsible_user' отсюда ---
    list_display = ('id', 'client', 'status', 'created_at')
    
    # --- 👇 ИЗМЕНЕНИЕ: Убрали 'responsible_user' отсюда ---
    list_filter = ('status', 'created_at') 
    
    search_fields = ('client',)
    inlines = [ItemInline] # Добавляет товары прямо на страницу заказа

# --- (Мы также должны зарегистрировать наши новые модели, чтобы видеть их в админке) ---

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'icon')
    list_filter = ('category',)
    search_fields = ('name',)

# (Регистрируем Profile, чтобы он отображался)
admin.site.register(Profile)

# (Регистрируем Singleton-модели, чтобы их можно было редактировать)
admin.site.register(CompanySettings)
admin.site.register(TelegramSettings)