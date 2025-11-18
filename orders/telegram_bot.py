import requests
import threading
from .models import TelegramSettings

def _send_telegram_task(order_id, client_name, items_summary, deadline_str):
    """
    Внутренняя функция, которая выполняется в фоне.
    Передаем простые данные, а не объекты моделей, чтобы избежать проблем с потоками и БД.
    """
    try:
        settings = TelegramSettings.load()
        bot_token = settings.bot_token
        chat_id = settings.chat_id
        
        if not bot_token or not chat_id:
            return

        message_text = (
            f"<b>🎉 Новый заказ! (№{order_id})</b>\n\n"
            f"<b>Клиент:</b> {client_name}\n"
            f"<b>Срок сдачи:</b> {deadline_str}\n\n"
            f"<b>Состав заказа:</b>\n"
            f"{items_summary}\n"
            f"<i>(Сообщение от EcoPrint CRM)</i>"
        )
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {'chat_id': chat_id, 'text': message_text, 'parse_mode': 'HTML'}
        requests.post(url, data=payload, timeout=10)
        
    except Exception as e:
        print(f"Ошибка отправки в Telegram: {e}")

def send_telegram_notification(order):
    """
    Запускает отправку в отдельном потоке.
    """
    # Подготавливаем данные до запуска потока
    items_list = ""
    for item in order.items.all():
        items_list += f"  - {item.name} ({item.quantity} шт.)\n"
        
    first_item = order.items.first()
    deadline_str = "Не указан"
    if first_item and first_item.deadline:
        deadline_str = first_item.deadline.strftime('%d.%m.%Y')

    # Запускаем поток
    thread = threading.Thread(
        target=_send_telegram_task,
        args=(order.id, order.client, items_list, deadline_str)
    )
    thread.start()