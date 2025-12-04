# orders/views/integrations.py

import os
import gspread
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework import permissions
from rest_framework.response import Response
from ..models import Order

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def sync_to_google_sheets(request):
    try:
        service_account_path = os.path.join(settings.BASE_DIR, 'service_account.json')
        
        if not os.path.exists(service_account_path):
            return Response({'error': 'Файл service_account.json не найден!'}, status=400)

        # 1. Подключение (лучше кэшировать клиент, но пока ок)
        gc = gspread.service_account(filename=service_account_path)
        
        sheet_id = os.environ.get('GOOGLE_SHEET_ID')
        # ... (логика открытия таблицы остается той же) ...
        # Допустим, мы нашли worksheet
        if not sheet_id:
             sheet_name = os.environ.get('GOOGLE_SHEET_NAME', 'EcoPrint Orders')
             try:
                 sh = gc.open(sheet_name)
             except gspread.SpreadsheetNotFound:
                 return Response({'error': f'Таблица "{sheet_name}" не найдена.'}, status=404)
        else:
             sh = gc.open_by_key(sheet_id)
        
        worksheet = sh.sheet1 

        # 2. ОПТИМИЗАЦИЯ: Выгружаем только за последние 90 дней (квартал)
        # Если нужно выгружать всё, это нужно делать фоновой задачей (Celery).
        cutoff_date = timezone.now() - timedelta(days=90)
        
        # Используем select_related/prefetch_related, чтобы избежать N+1 запросов при переборе items
        orders = Order.objects.filter(created_at__gte=cutoff_date)\
                              .prefetch_related('items__responsible_user')\
                              .order_by('-created_at')
        
        data = [['ID', 'Клиент', 'Дата', 'Статус заказа', 
                 'Товар', 'Кол-во', 'Дедлайн', 'Статус товара', 'Ответственный', 'Комментарий']]

        for order in orders:
            created_date = order.created_at.strftime("%d.%m.%Y %H:%M")
            
            # Если товаров нет, добавляем строку с прочерками
            if not order.items.exists():
                data.append([
                    order.id, order.client, created_date, order.get_status_display(), 
                    "-", "-", "-", "-", "-", "-"
                ])
                continue

            # Если товары есть
            for item in order.items.all():
                resp_user = "Нет"
                if item.responsible_user:
                    resp_user = item.responsible_user.first_name or item.responsible_user.username

                deadline = item.deadline.strftime("%d.%m.%Y") if item.deadline else "-"
                
                row = [
                    order.id, 
                    order.client, 
                    created_date, 
                    order.get_status_display(),
                    item.name, 
                    item.quantity, 
                    deadline, 
                    item.get_status_display(),
                    resp_user, 
                    item.comment
                ]
                data.append(row)

        # 3. Запись данных
        worksheet.clear()
        
        # При большом объеме gspread может падать. 
        # Если строк > 5000, лучше использовать append_rows пачками, но clear() удаляет все.
        worksheet.update(data)

        return Response({
            'status': 'success', 
            'message': f'Выгружены заказы за 90 дней. Строк: {len(data)-1}'
        })

    except Exception as e:
        print(f"Google Sheet Error: {e}")
        return Response({'error': str(e)}, status=500)