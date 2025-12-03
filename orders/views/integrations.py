import os
import gspread
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

        gc = gspread.service_account(filename=service_account_path)
        
        sheet_id = os.environ.get('GOOGLE_SHEET_ID')
        if not sheet_id:
             sheet_name = os.environ.get('GOOGLE_SHEET_NAME', 'EcoPrint Orders')
             try:
                 sh = gc.open(sheet_name)
             except gspread.SpreadsheetNotFound:
                 return Response({'error': f'Таблица "{sheet_name}" не найдена. Дайте доступ боту!'}, status=404)
        else:
             try:
                 sh = gc.open_by_key(sheet_id)
             except gspread.SpreadsheetNotFound:
                 return Response({'error': f'Таблица с ID {sheet_id} не найдена.'}, status=404)

        worksheet = sh.sheet1 

        orders = Order.objects.all().order_by('-created_at')
        
        data = [['ID Заказа', 'Клиент', 'Дата создания', 'Статус заказа', 
                 'Товар', 'Кол-во', 'Дедлайн', 'Статус товара', 'Ответственный', 'Комментарий']]

        for order in orders:
            created_date = order.created_at.strftime("%d.%m.%Y %H:%M")
            if order.items.exists():
                for item in order.items.all():
                    resp_user = item.responsible_user.username if item.responsible_user else "Нет"
                    deadline = item.deadline.strftime("%d.%m.%Y") if item.deadline else "-"
                    row = [
                        order.id, order.client, created_date, order.get_status_display(),
                        item.name, item.quantity, deadline, item.get_status_display(),
                        resp_user, item.comment
                    ]
                    data.append(row)
            else:
                row = [order.id, order.client, created_date, order.get_status_display(), 
                       "-", "-", "-", "-", "-", "-"]
                data.append(row)

        worksheet.clear()
        worksheet.update(data)

        return Response({'status': 'success', 'message': f'Успешно выгружено {len(data)-1} строк.'})

    except Exception as e:
        print(f"Google Sheet Error: {e}")
        return Response({'error': str(e)}, status=500)