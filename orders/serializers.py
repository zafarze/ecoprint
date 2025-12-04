# D:\Projects\EcoPrint\orders\serializers.py

from rest_framework import serializers
from django.db import transaction
from .models import Order, Item, Product, OrderHistory
from django.contrib.auth.models import User
from .services import OrderService  # Импортируем наш сервис

# === Вспомогательные сериализаторы ===
class UserSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name']

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'category', 'icon']

class OrderHistorySerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    created_at_formatted = serializers.SerializerMethodField()

    class Meta:
        model = OrderHistory
        fields = ['user_name', 'message', 'created_at_formatted']

    def get_user_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        return "Система"

    def get_created_at_formatted(self, obj):
        return obj.created_at.strftime("%d.%m.%Y %H:%M")

# === Сериализатор Товара (Item) ДЛЯ ЧТЕНИЯ ===
class ItemSerializer(serializers.ModelSerializer):
    responsible_user = UserSimpleSerializer(read_only=True)
    responsible_user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='responsible_user', write_only=True, allow_null=True
    )

    class Meta:
        model = Item
        fields = ['id', 'name', 'quantity', 'status', 'deadline', 'comment',
                  'responsible_user', 'responsible_user_id', 'is_archived', 'ready_at']

# === Сериализатор Товара (Item) ДЛЯ ЗАПИСИ ===
# ВАЖНО: Этот класс должен быть ВЫШЕ, чем OrderSerializer!
class ItemWriteSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    responsible_user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='responsible_user', allow_null=True, required=False
    )
    
    class Meta:
        model = Item
        fields = ['id', 'name', 'quantity', 'status', 'deadline', 'comment', 'responsible_user_id']

# === ГЛАВНЫЙ СЕРИАЛИЗАТОР ЗАКАЗА ===
class OrderSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    # Теперь Python знает, что такое ItemWriteSerializer, т.к. он объявлен выше
    items_write = ItemWriteSerializer(many=True, write_only=True, required=False)
    history = OrderHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ['id', 'client', 'status', 'created_at', 'items', 'items_write', 'history']

    def get_items(self, obj):
        show_archived = self.context.get('show_archived', False)
        if show_archived:
            items_to_show = obj.items.filter(is_archived=True)
        else:
            items_to_show = obj.items.filter(is_archived=False)
        return ItemSerializer(items_to_show, many=True).data

    def create(self, validated_data):
        items_data = validated_data.pop('items_write', []) 
        user = self.context['request'].user 

        with transaction.atomic():
            order = Order.objects.create(**validated_data)
            
            OrderHistory.objects.create(
                order=order, user=user, message="Создал заказ"
            )

            for item_data in items_data:
                if 'id' in item_data: del item_data['id']
                Item.objects.create(order=order, **item_data)
                
        return order
        
    def update(self, instance, validated_data):
        user = self.context['request'].user
        
        # Используем наш новый сервис для обновления
        updated_order = OrderService.update_order(
            order=instance,
            validated_data=validated_data,
            user=user
        )
            
        return updated_order