# D:\Projects\EcoPrint\orders\telegram_bot.py (ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД)

import requests
from .models import TelegramSettings

def send_telegram_notification(order):
    """
    Отправляет уведомление о НОВОМ заказе в Telegram.
    """
    
    # 1. Загружаем наши настройки (токен и ID) из базы
    try:
        settings = TelegramSettings.load()
        bot_token = settings.bot_token
        chat_id = settings.chat_id
        
        # 2. Если токен или ID не заданы, ничего не делаем
        if not bot_token or not chat_id:
            print("Telegram-бот не настроен. Уведомление не отправлено.")
            return

        # 3. Собираем красивое сообщение
        items_list = ""
        for item in order.items.all():
            items_list += f"  - {item.name} ({item.quantity} шт.)\n"
            
        # --- 👇 ВОТ ИСПРАВЛЕНИЕ ---
        # У заказа больше нет 'deadline', он есть у 'item'.
        # Возьмем дедлайн у первого товара, если он есть.
        first_item = order.items.first()
        deadline_str = "Не указан"
        if first_item and first_item.deadline:
            deadline_str = first_item.deadline.strftime('%d.%m.%Y')
        # --- 👆 КОНЕЦ ИСПРАВЛЕНИЯ ---
            
        message_text = (
            f"<b>🎉 Новый заказ! (№{order.id})</b>\n\n"
            f"<b>Клиент:</b> {order.client}\n"
            f"<b>Срок сдачи:</b> {deadline_str}\n\n" # 👈 Используем нашу новую 'deadline_str'
            f"<b>Состав заказа:</b>\n"
            f"{items_list}\n"
            f"<i>(Сообщение от EcoPrint CRM)</i>"
        )
        
        # 4. Собираем URL для API
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        
        # 5. Собираем данные для отправки
        payload = {
            'chat_id': chat_id,
            'text': message_text,
            'parse_mode': 'HTML' # Используем HTML для форматирования
        }

        # 6. Отправляем запрос!
        response = requests.post(url, data=payload, timeout=5)
        
        if response.status_code == 200:
            print(f"Уведомление для заказа №{order.id} успешно отправлено.")
        else:
            print(f"Ошибка отправки уведомления: {response.text}")

    except Exception as e:
        # Ловим любую ошибку (например, нет интернета)
        print(f"Критическая ошибка при отправке Telegram-уведомления: {e}")