# D:\Projects\EcoPrint\orders\serializers.py

from rest_framework import serializers
from django.db import transaction
from .models import Order, Item, Product, OrderHistory # 👈 Добавили OrderHistory
from django.contrib.auth.models import User

# === Сериализаторы для каталогов ===
class UserSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name']

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'category', 'icon']

# === Сериализатор Истории (НОВЫЙ) ===
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
    items_write = ItemWriteSerializer(many=True, write_only=True, required=False)
    history = OrderHistorySerializer(many=True, read_only=True) # 👈 Читаем историю

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
        user = self.context['request'].user # Текущий юзер

        with transaction.atomic():
            order = Order.objects.create(**validated_data)
            
            # Записываем в историю создание
            OrderHistory.objects.create(
                order=order, user=user, message="Создал заказ"
            )

            for item_data in items_data:
                if 'id' in item_data: del item_data['id']
                Item.objects.create(order=order, **item_data)
                
        return order
        
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items_write', None) 
        user = self.context['request'].user # Текущий юзер

        with transaction.atomic():
            # 1. Проверяем изменения в самом Заказе
            if 'client' in validated_data and instance.client != validated_data['client']:
                OrderHistory.objects.create(
                    order=instance, user=user, 
                    message=f"Изменил клиента: {instance.client} -> {validated_data['client']}"
                )
            
            instance.client = validated_data.get('client', instance.client)
            if 'status' in validated_data:
                instance.status = validated_data['status']
            instance.save() 
            
            # 2. Обновляем Товары и пишем историю
            if items_data is not None:
                keep_ids = []

                for item_data in items_data:
                    item_id = item_data.get('id', None)

                    if item_id:
                        # --- ОБНОВЛЕНИЕ ТОВАРА ---
                        item_obj = Item.objects.filter(id=item_id, order=instance).first()
                        if item_obj:
                            changes = []
                            # Сравниваем поля для истории
                            if 'status' in item_data and item_obj.status != item_data['status']:
                                changes.append(f"статус '{item_obj.name}' ({item_obj.get_status_display()} -> {item_data['status']})")
                            
                            if 'quantity' in item_data and item_obj.quantity != item_data['quantity']:
                                changes.append(f"кол-во '{item_obj.name}' ({item_obj.quantity} -> {item_data['quantity']})")
                                
                            if 'deadline' in item_data and str(item_obj.deadline) != str(item_data['deadline']):
                                changes.append(f"срок '{item_obj.name}'")

                            if changes:
                                msg = "Изменил: " + ", ".join(changes)
                                OrderHistory.objects.create(order=instance, user=user, message=msg)

                            # Сохраняем данные
                            for attr, value in item_data.items():
                                if attr != 'id': setattr(item_obj, attr, value)
                            item_obj.save()
                            keep_ids.append(item_obj.id)
                    else:
                        # --- ДОБАВЛЕНИЕ НОВОГО ТОВАРА ---
                        new_item = Item.objects.create(order=instance, **item_data)
                        keep_ids.append(new_item.id)
                        OrderHistory.objects.create(
                            order=instance, user=user, 
                            message=f"Добавил товар: {new_item.name}"
                        )
                
                # --- УДАЛЕНИЕ ТОВАРА ---
                # Находим товары, которые были удалены
                items_to_delete = instance.items.filter(is_archived=False).exclude(id__in=keep_ids)
                for del_item in items_to_delete:
                    OrderHistory.objects.create(
                        order=instance, user=user, 
                        message=f"Удалил товар: {del_item.name}"
                    )
                items_to_delete.delete()
            
            instance.update_status()
            
        return instance