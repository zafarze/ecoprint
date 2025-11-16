# D:\Projects\EcoPrint\orders\serializers.py (ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД)

from rest_framework import serializers
from rest_framework.serializers import SerializerMethodField
from .models import Order, Item, Product
from django.contrib.auth.models import User

# === Сериализаторы для каталогов (Users & Products) ===
class UserSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name']

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'category', 'icon']

# === Сериализатор Товара (Item) ДЛЯ ЧТЕНИЯ (GET) ===
class ItemSerializer(serializers.ModelSerializer):
    
    # Включает объект пользователя при чтении
    responsible_user = UserSimpleSerializer(read_only=True)
    
    # Поле для записи (если нужно обновить один Item через отдельный API)
    responsible_user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        source='responsible_user', 
        write_only=True,
        allow_null=True 
    )

    class Meta:
        model = Item
        fields = [
            'id', 
            'name', 
            'quantity', 
            'status', 
            'deadline', 
            'comment',
            'responsible_user',
            'responsible_user_id',
            'is_archived', # Для фильтрации
            'ready_at'     # Дата завершения
        ] 

# === Сериализатор Товара (Item) ТОЛЬКО ДЛЯ ЗАПИСИ (POST/PUT в Order) ===
class ItemWriteSerializer(serializers.ModelSerializer):
    # Используем 'responsible_user_id', чтобы принимать только PK пользователя
    responsible_user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        source='responsible_user', 
        allow_null=True,
        required=False 
    )
    
    class Meta:
        model = Item
        fields = [
            'name', 
            'quantity', 
            'status', 
            'deadline', 
            'comment', 
            'responsible_user_id'
        ]

# === ГЛАВНЫЙ СЕРИАЛИЗАТОР ЗАКАЗА (Order) ===
class OrderSerializer(serializers.ModelSerializer):
    
    # Поле №1: ДЛЯ ЧТЕНИЯ (GET): Возвращает товары
    items = serializers.SerializerMethodField()
    
    # Поле №2: ДЛЯ ЗАПИСИ (POST/PUT): Принимает массив товаров
    items_write = ItemWriteSerializer(
        many=True, 
        write_only=True, 
        required=False
    )
    
    class Meta:
        model = Order
        fields = [
            'id', 
            'client', 
            'status', 
            'created_at', 
            'items',         
            'items_write'    
        ]

    # --- 👇 ГЛАВНОЕ ИЗМЕНЕНИЕ ---
    # Метод для получения списка товаров для чтения
    def get_items(self, obj):
        
        # 1. Проверяем 'context', который передал OrderViewSet
        #    По умолчанию - показываем НЕ-архивные
        show_archived = self.context.get('show_archived', False)
        
        if show_archived:
            # Если context['show_archived'] == True,
            # Показываем только АРХИВНЫЕ товары
            items_to_show = obj.items.filter(is_archived=True)
        else:
            # Иначе (по умолчанию),
            # Показываем только АКТИВНЫЕ (НЕ-архивные) товары
            items_to_show = obj.items.filter(is_archived=False)
            
        # 2. Сериализуем отфильтрованный список
        serializer = ItemSerializer(items_to_show, many=True)
        return serializer.data
    # --- 👆 КОНЕЦ ИЗМЕНЕНИЯ ---

    # Логика создания нового заказа (POST)
    def create(self, validated_data):
        items_data = validated_data.pop('items_write', []) 
        order = Order.objects.create(**validated_data)
        for item_data in items_data:
            Item.objects.create(order=order, **item_data)
        return order
        
    # Логика обновления существующего заказа (PUT/PATCH)
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items_write', None) 

        # 1. Обновляем поля Order
        instance.client = validated_data.get('client', instance.client)
        instance.save() 
        
        # 2. Обновляем Items
        if items_data is not None:
            # Удаляем старые, не-архивированные товары
            instance.items.filter(is_archived=False).delete()
            
            # Создаем новые Items
            for item_data in items_data:
                Item.objects.create(order=instance, **item_data)
        
        # 3. Обновляем общий статус Order
        instance.update_status() 
        return instance