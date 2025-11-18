# D:\Projects\EcoPrint\orders\models.py (ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД)

from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

# === Модель Заказа ===
class Order(models.Model):
    STATUS_CHOICES = [
        ('not-ready', 'Не готов'),
        ('in-progress', 'В процессе'),
        ('ready', 'Готово')
    ]

    client = models.CharField(max_length=255, verbose_name="Клиент")
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='not-ready',
        verbose_name="Статус заказа"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создан")

    class Meta:
        verbose_name = "Заказ"
        verbose_name_plural = "Заказы"
        ordering = ['-created_at']  # Сортировка: новые сверху

    def __str__(self):
        return f"Заказ №{self.id} от {self.client}"

    def update_status(self):
        """
        Автоматически обновляет статус заказа на основе статусов его товаров.
        """
        items = self.items.all()
        
        if not items.exists():
            self.status = 'not-ready'
        elif all(item.status == 'ready' for item in items):
            self.status = 'ready'
        # Если хоть один 'in-progress' ИЛИ (есть готовые И есть неготовые) -> 'in-progress'
        elif any(item.status == 'in-progress' for item in items) or \
             (any(item.status == 'ready' for item in items) and \
              any(item.status == 'not-ready' for item in items)):
            self.status = 'in-progress'
        else:
            self.status = 'not-ready'
            
        self.save()


# === Модель Товара в Заказе ===
class Item(models.Model):
    STATUS_CHOICES = [
        ('not-ready', 'Не готов'),
        ('in-progress', 'В процессе'),
        ('ready', 'Готово')
    ]

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name="Заказ"
    )
    name = models.CharField(max_length=255, verbose_name="Название товара")
    quantity = models.PositiveIntegerField(default=1, verbose_name="Количество")
    
    deadline = models.DateField(
        verbose_name="Срок сдачи", 
        null=True, 
        blank=True
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='not-ready',
        verbose_name="Статус"
    )

    responsible_user = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL,
        null=True, 
        blank=True,
        related_name="items",
        verbose_name="Ответственный"
    )
    
    comment = models.TextField(
        blank=True,
        verbose_name="Комментарий"
    )
    
    ready_at = models.DateTimeField(
        null=True, 
        blank=True, 
        verbose_name="Дата готовности"
    )
    is_archived = models.BooleanField(
        default=False, 
        verbose_name="В архиве"
    )

    class Meta:
        verbose_name = "Товар заказа"
        verbose_name_plural = "Товары заказа"

    def __str__(self):
        return f"{self.name} ({self.quantity} шт.)"

    def save(self, *args, **kwargs):
        # Логика установки даты готовности
        if self.status == 'ready' and self.ready_at is None:
            self.ready_at = timezone.now()
        elif self.status != 'ready':
            self.ready_at = None
            
        super().save(*args, **kwargs)
        
        # Обновляем статус родительского заказа
        # Используем order_id, чтобы избежать лишнего запроса, если объект order не подгружен
        if self.order_id:
            self.order.update_status()


# === Модель Профиля ===
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, verbose_name="Пользователь")
    avatar = models.ImageField(
        upload_to='avatars/',
        default='avatars/default.jpg',
        verbose_name="Аватар"
    )
    # Настройки уведомлений
    sound_notifications = models.BooleanField(
        default=True, 
        verbose_name="Звук"
    )
    popup_notifications = models.BooleanField(
        default=True, 
        verbose_name="Всплывающие окна"
    )
    day_before_notifications = models.BooleanField(
        default=True, 
        verbose_name="Напоминание за день"
    )

    class Meta:
        verbose_name = "Профиль пользователя"
        verbose_name_plural = "Профили пользователей"

    def __str__(self):
        return f'Профиль: {self.user.username}'


# === 👇 ИСПРАВЛЕННЫЙ СИГНАЛ (Только один обработчик) ===
@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, **kwargs):
    """
    Создает профиль пользователя при создании User, 
    или получает существующий, если он уже есть.
    Предотвращает ошибку IntegrityError.
    """
    Profile.objects.get_or_create(user=instance)


# === Модель Настроек Компании (Singleton) ===
class CompanySettings(models.Model):
    company_name = models.CharField(
        max_length=255, 
        blank=True,
        verbose_name="Название компании"
    )
    address = models.CharField(
        max_length=500, 
        blank=True, 
        verbose_name="Адрес"
    )
    phone = models.CharField(
        max_length=50, 
        blank=True, 
        verbose_name="Телефон"
    )
    company_logo = models.ImageField(
        upload_to='company_logo/',
        blank=True,
        null=True,
        verbose_name="Логотип"
    )

    def __str__(self):
        return "Настройки компании"

    def save(self, *args, **kwargs):
        self.pk = 1  # Всегда ID=1
        super(CompanySettings, self).save(*args, **kwargs)
    
    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj
        
    class Meta:
        verbose_name = "Настройки компании"
        verbose_name_plural = "Настройки компании"


# === Модель Настроек Telegram (Singleton) ===
class TelegramSettings(models.Model):
    bot_token = models.CharField(
        max_length=255, 
        blank=True, 
        verbose_name="Token Telegram-бота"
    )
    chat_id = models.CharField(
        max_length=255, 
        blank=True, 
        verbose_name="Chat ID"
    )

    def __str__(self):
        return "Настройки Telegram"

    def save(self, *args, **kwargs):
        self.pk = 1 
        super(TelegramSettings, self).save(*args, **kwargs)
    
    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj
        
    class Meta:
        verbose_name = "Настройки Telegram"
        verbose_name_plural = "Настройки Telegram"


# === Модель Ассортимента (Справочник товаров) ===
class Product(models.Model):
    CATEGORY_CHOICES = [
        ('polygraphy', 'Полиграфия'),
        ('packaging', 'Упаковка'),
        ('souvenirs', 'Сувениры'),
        ('large-format', 'Широкоформатная печать'),
    ]

    name = models.CharField(
        max_length=100, 
        verbose_name="Название"
    )
    category = models.CharField(
        max_length=50, 
        choices=CATEGORY_CHOICES, 
        verbose_name="Категория"
    )
    icon = models.CharField(
        max_length=50, 
        blank=True, 
        verbose_name="Иконка (FontAwesome)"
    )

    class Meta:
        verbose_name = "Товар (шаблон)"
        verbose_name_plural = "Товары (шаблоны)"
        ordering = ['category', 'name']

    def __str__(self):
        return self.name