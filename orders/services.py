# orders/services.py

from django.db import transaction
from django.contrib.auth.models import User
from typing import List, Dict, Any, Optional

from .models import Order, Item, OrderHistory

class OrderService:
    """
    Сервис для управления бизнес-логикой Заказов.
    Изолирует сложную логику от API (Views/Serializers).
    """

    @staticmethod
    def _log_history(order: Order, user: User, message: str) -> None:
        """Внутренний метод для записи в историю."""
        OrderHistory.objects.create(order=order, user=user, message=message)

    @classmethod
    def update_order(cls, order: Order, validated_data: Dict[str, Any], user: User) -> Order:
        """
        Главный метод обновления заказа.
        Принимает:
        - order: текущий объект заказа
        - validated_data: чистые данные от сериализатора
        - user: пользователь, инициировавший изменение
        """
        # Извлекаем данные о товарах, так как их нужно обрабатывать отдельно
        items_data = validated_data.pop('items_write', None)

        with transaction.atomic():
            # 1. Обновляем поля самого Заказа
            cls._update_order_fields(order, validated_data, user)

            # 2. Если пришли данные о товарах, запускаем логику синхронизации
            if items_data is not None:
                cls._sync_items(order, items_data, user)
            
            # 3. Пересчитываем общий статус заказа (на всякий случай)
            order.update_status()

        return order

    @classmethod
    def _update_order_fields(cls, order: Order, data: Dict[str, Any], user: User) -> None:
        """Обновляет поля заказа и пишет историю изменений клиента."""
        new_client = data.get('client')
        
        if new_client and order.client != new_client:
            cls._log_history(
                order, user, 
                f"Изменил клиента: {order.client} -> {new_client}"
            )
            order.client = new_client

        if 'status' in data:
            order.status = data['status']
        
        order.save()

    @classmethod
    def _sync_items(cls, order: Order, items_data: List[Dict[str, Any]], user: User) -> None:
        """
        Синхронизирует список товаров: создает новые, обновляет старые, удаляет лишние.
        """
        keep_ids = []

        for item_data in items_data:
            item_id = item_data.get('id')

            if item_id:
                # --- UPDATE ---
                # Ищем товар, принадлежащий именно этому заказу
                item_obj = Item.objects.filter(id=item_id, order=order).first()
                if item_obj:
                    cls._update_single_item(order, item_obj, item_data, user)
                    keep_ids.append(item_obj.id)
            else:
                # --- CREATE ---
                # Удаляем 'id' если он пришел None, чтобы не сломать создание
                if 'id' in item_data:
                    del item_data['id']
                
                new_item = Item.objects.create(order=order, **item_data)
                keep_ids.append(new_item.id)
                
                cls._log_history(order, user, f"Добавил товар: {new_item.name}")

        # --- DELETE ---
        # Удаляем товары, ID которых не пришли в запросе (и они не в архиве)
        items_to_delete = order.items.filter(is_archived=False).exclude(id__in=keep_ids)
        for del_item in items_to_delete:
            cls._log_history(order, user, f"Удалил товар: {del_item.name}")
        
        items_to_delete.delete()

    @classmethod
    def _update_single_item(cls, order: Order, item: Item, new_data: Dict[str, Any], user: User) -> None:
        """
        Обновляет один товар и генерирует детальное сообщение об изменениях.
        """
        changes = []

        # Сравниваем важные поля для истории
        if 'status' in new_data and item.status != new_data['status']:
            # Получаем человекочитаемое название статуса
            # (Note: get_status_display работает для сохраненных значений, 
            # поэтому берем display от старого значения вручную или просто raw value)
            changes.append(f"статус '{item.name}' ({item.status} -> {new_data['status']})")
        
        if 'quantity' in new_data and item.quantity != new_data['quantity']:
            changes.append(f"кол-во '{item.name}' ({item.quantity} -> {new_data['quantity']})")
            
        if 'deadline' in new_data and str(item.deadline) != str(new_data['deadline']):
            changes.append(f"срок '{item.name}'")

        # Если были изменения, пишем в историю одной строкой
        if changes:
            msg = "Изменил: " + ", ".join(changes)
            cls._log_history(order, user, msg)

        # Применяем изменения
        for attr, value in new_data.items():
            if attr != 'id':
                setattr(item, attr, value)
        item.save()