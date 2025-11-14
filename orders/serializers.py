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
            'is_archived', # Для фильтрации в API Заказов
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
    
    # Поле №1: ДЛЯ ЧТЕНИЯ (GET): Возвращает только НЕ-архивированные товары
    items = serializers.SerializerMethodField()
    
    # Поле №2: ДЛЯ ЗАПИСИ (POST/PUT): Принимает массив товаров для сохранения/обновления
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

    # Метод для получения списка товаров для чтения
    def get_items(self, obj):
        # Отдаем только активные (не-архивированные) товары
        active_items = obj.items.filter(is_archived=False)
        serializer = ItemSerializer(active_items, many=True)
        return serializer.data

    # Логика создания нового заказа (POST)
    def create(self, validated_data):
        # Удаляем items_write из validated_data, используя [] по умолчанию
        items_data = validated_data.pop('items_write', []) 
        
        # Создаем Order
        order = Order.objects.create(**validated_data)
        
        # Создаем связанные Items
        for item_data in items_data:
            Item.objects.create(order=order, **item_data)
        return order
        
    # Логика обновления существующего заказа (PUT/PATCH)
    def update(self, instance, validated_data):
        # Удаляем items_write из validated_data, используя None по умолчанию.
        # Это предотвращает KeyError, если items_write не был передан.
        items_data = validated_data.pop('items_write', None) 

        # 1. Обновляем поля Order
        instance.client = validated_data.get('client', instance.client)
        instance.save() 
        
        # 2. Обновляем Items, ТОЛЬКО если items_write был передан (items_data is not None)
        if items_data is not None:
            # Удаляем старые, не-архивированные товары
            instance.items.filter(is_archived=False).delete()
            
            # Создаем новые Items
            for item_data in items_data:
                Item.objects.create(order=instance, **item_data)
        
        # 3. Обновляем общий статус Order, исходя из новых/существующих Items
        instance.update_status() 
        return instance