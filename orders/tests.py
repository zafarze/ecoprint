# D:\Projects\EcoPrint\orders\tests.py (ПОЛНЫЙ КОД)

from django.test import TestCase
from django.contrib.auth.models import User
from .models import Order, Item

class OrderStatusTests(TestCase):
    
    def setUp(self):
        # Создаем "тестового" пользователя, который будет 
        # ответственным за заказы в наших тестах.
        self.test_user = User.objects.create_user(
            username='testuser', 
            password='123'
        )

    def test_order_status_logic(self):
        """
        Проверяет, что статус Заказа (Order) правильно обновляется
        в зависимости от статусов его Товаров (Item).
        """
        
        # 1. Создаем заказ
        order = Order.objects.create(
            client="Тестовый Клиент"
            # Поле 'responsible_user' отсюда убрано
        )
        
        # 2. Проверка: по умолчанию (и без товаров) 
        #    статус должен быть 'not-ready'.
        self.assertEqual(order.status, 'not-ready')

        # 3. Создаем первый товар для этого заказа
        item1 = Item.objects.create(
            order=order,
            name="Визитки",
            quantity=100,
            status='not-ready',
            responsible_user=self.test_user # 👈 ✅ ВОТ ТАК ПРАВИЛЬНО
        )
        
        # 4. Проверка: Заказ [not-ready]
        #    (т.к. у него 1 товар и тот 'not-ready')
        order.refresh_from_db() # Обновляем заказ из БД
        self.assertEqual(order.status, 'not-ready')

        # 5. Создаем второй товар
        item2 = Item.objects.create(
            order=order,
            name="Буклеты",
            quantity=50,
            status='not-ready' # 👈 статус 'not-ready'
        )
        
        # 6. Проверка: Заказ [not-ready]
        #    (Товары: [not-ready], [not-ready])
        order.refresh_from_db()
        self.assertEqual(order.status, 'not-ready')

        # 7. Начинаем работу над первым товаром
        item1.status = 'in-progress'
        item1.save() # 👈 .save() автоматически вызовет order.update_status()
        
        # 8. Проверка: Заказ [in-progress]
        #    (Товары: [in-progress], [not-ready])
        order.refresh_from_db()
        self.assertEqual(order.status, 'in-progress')

        # 9. Заканчиваем работу над вторым товаром
        item2.status = 'ready'
        item2.save()
        
        # 10. Проверка: Заказ [in-progress]
        #     (Товары: [in-progress], [ready])
        order.refresh_from_db()
        self.assertEqual(order.status, 'in-progress')

        # 11. Заканчиваем работу над первым товаром
        item1.status = 'ready'
        item1.save()
        
        # 12. Проверка: Заказ [ready]
        #     (Товары: [ready], [ready])
        order.refresh_from_db()
        self.assertEqual(order.status, 'ready')

        # 13. Обнаружили ошибку во втором товаре, возвращаем в 'not-ready'
        item2.status = 'not-ready'
        item2.save()
        
        # 14. Проверка: Заказ [in-progress]
        #     (Товары: [ready], [not-ready])
        #     Это считается 'in-progress' по вашей логике
        order.refresh_from_db()
        self.assertEqual(order.status, 'in-progress')