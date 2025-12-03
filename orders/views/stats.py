from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import Count
from django.db.models.functions import TruncDate, TruncMonth
from datetime import date, timedelta

from ..models import Order, Item

@api_view(['GET'])
def statistics_data_view(request):
    # 1. Получаем период из запроса (по умолчанию 'week')
    period = request.query_params.get('period', 'week')
    
    today = date.today()
    start_date = today
    
    # 2. Определяем дату начала выборки
    if period == 'month':
        start_date = today - timedelta(days=30)
    elif period == 'year':
        start_date = today - timedelta(days=365)
    else: # 'week'
        start_date = today - timedelta(days=7)

    # 3. Фильтруем заказы за этот период
    orders_in_period = Order.objects.filter(created_at__date__gte=start_date)
    
    # KPI 1: Всего заказов (ЗА ВЫБРАННЫЙ ПЕРИОД)
    total_orders = orders_in_period.count()
    
    # KPI 2: В процессе (Текущее состояние, не зависит от времени, но можно фильтровать)
    pending_orders = Order.objects.filter(status='in-progress').count()
    
    # KPI 3: Создано сегодня (Всегда за сегодня)
    created_today = Order.objects.filter(created_at__date=today).count()
    
    # KPI 4: Топ товар (За выбранный период)
    # Ищем товары только в заказах этого периода
    top_product_query = Item.objects.filter(order__in=orders_in_period) \
                            .values('name') \
                            .annotate(name_count=Count('name')) \
                            .order_by('-name_count') \
                            .first()
    top_product_name = top_product_query['name'] if top_product_query else "Нет данных"

    # График 1: Статусы (За выбранный период)
    status_counts_query = orders_in_period.values('status') \
                                 .annotate(count=Count('status')) \
                                 .order_by('status')
    
    status_data = {
        'labels': [item['status'] for item in status_counts_query],
        'counts': [item['count'] for item in status_counts_query],
    }

    # График 2: Активность (Динамика)
    activity_data = {'labels': [], 'counts': []}

    if period == 'year':
        # ДЛЯ ГОДА: Группируем по МЕСЯЦАМ
        activity_query = orders_in_period \
            .annotate(period=TruncMonth('created_at')) \
            .values('period') \
            .annotate(count=Count('id')) \
            .order_by('period')
            
        for item in activity_query:
            # Формат: "Янв 2025"
            label = item['period'].strftime('%b %Y') 
            activity_data['labels'].append(label)
            activity_data['counts'].append(item['count'])
            
    else:
        # ДЛЯ НЕДЕЛИ И МЕСЯЦА: Группируем по ДНЯМ
        activity_query = orders_in_period \
            .annotate(period=TruncDate('created_at')) \
            .values('period') \
            .annotate(count=Count('id')) \
            .order_by('period')
        
        # Превращаем QuerySet в словарь для удобства {дата: кол-во}
        data_dict = {item['period']: item['count'] for item in activity_query}
        
        # Генерируем все дни (вдруг в какой-то день было 0 заказов)
        delta_days = (today - start_date).days
        for i in range(delta_days + 1):
            day = start_date + timedelta(days=i)
            # Если это datetime.date, используем его, если datetime - приводим к date
            d_key = day if isinstance(day, date) else day.date()
            
            count = data_dict.get(d_key, 0)
            activity_data['labels'].append(d_key.strftime('%d.%m'))
            activity_data['counts'].append(count)

    data = {
        'total_orders': total_orders,
        'pending_orders': pending_orders,
        'created_today': created_today,
        'top_product': top_product_name,
        'status_counts': status_data,
        'activity_data': activity_data,
    }
    
    return Response(data)