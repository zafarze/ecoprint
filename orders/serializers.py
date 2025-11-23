# D:\Projects\EcoPrint\orders\serializers.py

from rest_framework import serializers
from rest_framework.serializers import SerializerMethodField
from django.db import transaction  # 👈 Добавлено для безопасного сохранения
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
    # 👇 Добавили поле id, чтобы фронтенд мог присылать ID существующего товара
    id = serializers.IntegerField(required=False)

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
            'id', # 👈 Важно: добавили id в список полей
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

    # Логика создания нового заказа (POST)
    def create(self, validated_data):
        items_data = validated_data.pop('items_write', []) 
        
        with transaction.atomic():  # 👈 Транзакция: Все или ничего
            order = Order.objects.create(**validated_data)
            for item_data in items_data:
                # При создании id в item_data игнорируется, создаются новые
                if 'id' in item_data:
                    del item_data['id']
                Item.objects.create(order=order, **item_data)
                
        return order
        
    # Логика обновления существующего заказа (PUT/PATCH)
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items_write', None) 

        # 👈 Открываем транзакцию
        with transaction.atomic():
            
            # 1. Обновляем поля Order
            instance.client = validated_data.get('client', instance.client)
            # Если статус передан явно, обновляем его
            if 'status' in validated_data:
                 instance.status = validated_data['status']
            instance.save() 
            
            # 2. Обновляем Items (Умное обновление)
            if items_data is not None:
                keep_ids = [] # Список ID, которые нужно оставить (не удалять)

                for item_data in items_data:
                    item_id = item_data.get('id', None)

                    if item_id:
                        # А) Если ID есть -> Ищем существующий товар в этом заказе
                        item_obj = Item.objects.filter(id=item_id, order=instance).first()
                        if item_obj:
                            # Обновляем поля найденного товара
                            for attr, value in item_data.items():
                                if attr != 'id': # ID менять нельзя
                                    setattr(item_obj, attr, value)
                            item_obj.save()
                            keep_ids.append(item_obj.id)
                        else:
                            # Если ID пришел, но товара такого нет (или он не от этого заказа),
                            # создаем новый, убрав ошибочный ID.
                            if 'id' in item_data:
                                del item_data['id']
                            new_item = Item.objects.create(order=instance, **item_data)
                            keep_ids.append(new_item.id)
                    else:
                        # Б) Если ID нет -> Создаем новый товар
                        new_item = Item.objects.create(order=instance, **item_data)
                        keep_ids.append(new_item.id)
                
                # 3. Удаляем товары, которых нет в новом списке
                # Удаляем только НЕ архивные товары, которые не попали в keep_ids.
                # Архивные товары не трогаем, чтобы они не исчезли, если фронтенд их не прислал.
                instance.items.filter(is_archived=False).exclude(id__in=keep_ids).delete()
            
            # 4. Обновляем общий статус Order (на всякий случай)
            instance.update_status()
            
        # 👈 Конец транзакции (автоматический commit)
        return instance