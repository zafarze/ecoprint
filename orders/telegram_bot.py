import requests
import threading
from .models import TelegramSettings

def _send_telegram_task(order_id, client_name, items_details):
    """
    Внутренняя функция отправки.
    """
    try:
        settings = TelegramSettings.load()
        bot_token = settings.bot_token
        chat_id = settings.chat_id
        
        if not bot_token or not chat_id:
            return

        # Формируем красивое сообщение
        message_text = (
            f"<b>🔔 Новый заказ №{order_id}</b>\n"
            f"👤 <b>Клиент:</b> {client_name}\n"
            f"➖➖➖➖➖➖➖➖➖➖\n\n"
            f"{items_details}"
            f"➖➖➖➖➖➖➖➖➖➖\n"
            f"<i>🤖 Сообщение от EcoPrint CRM</i>"
        )
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {'chat_id': chat_id, 'text': message_text, 'parse_mode': 'HTML'}
        requests.post(url, data=payload, timeout=10)
        
    except Exception as e:
        print(f"Ошибка отправки в Telegram: {e}")

def send_telegram_notification(order):
    """
    Подготавливает данные и запускает отправку.
    """
    items_details = ""
    
    # 1. Получаем дату создания заказа (общая для всех товаров)
    created_str = order.created_at.strftime('%d.%m')
    
    # Перебираем товары
    for i, item in enumerate(order.items.all(), 1):
        # 2. Получаем Дедлайн
        deadline_str = item.deadline.strftime('%d.%m') if item.deadline else "?"
        
        # 3. Ответственный
        resp_name = "Не назначен"
        if item.responsible_user:
            u = item.responsible_user
            resp_name = f"{u.first_name} {u.last_name}".strip() or u.username

        # 4. Комментарий (добавляем, только если он есть)
        comment_text = ""
        if item.comment:
            comment_text = f"\n   💬 <i>{item.comment}</i>"

        # 5. Собираем блок. Строка с датами выглядит как "23.11 - 25.11"
        items_details += (
            f"<b>{i}. {item.name}</b>\n"
            f"   📦 Кол-во: {item.quantity} шт.\n"
            f"   🗓 Даты: <b>{created_str} - {deadline_str}</b>\n" 
            f"   👷 Исполнитель: {resp_name}"
            f"{comment_text}\n\n"
        )

    # Запускаем поток
    thread = threading.Thread(
        target=_send_telegram_task,
        args=(order.id, order.client, items_details)
    )
    thread.start()