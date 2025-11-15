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

    def __str__(self):
        return f"Заказ №{self.id} от {self.client}"

    def update_status(self):
        items = self.items.all()
        if not items.exists():
            self.status = 'not-ready'
        elif all(item.status == 'ready' for item in items):
            self.status = 'ready'
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
    comment = models.TextField(
        blank=True,
        verbose_name="Комментарий к товару"
    )
    name = models.CharField(max_length=255, verbose_name="Название товара")
    quantity = models.PositiveIntegerField(default=1, verbose_name="Количество")
    
    deadline = models.DateField(
        verbose_name="Срок сдачи товара", 
        null=True, 
        blank=True
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='not-ready',
        verbose_name="Статус товара"
    )

    responsible_user = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL,
        null=True, 
        blank=True,
        related_name="items",
        verbose_name="Ответственный"
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

    def __str__(self):
        return f"{self.name} ({self.quantity} шт.)"

    def save(self, *args, **kwargs):
        # Если статус МЕНЯЕТСЯ на "Готово" и даты еще нет
        if self.status == 'ready' and self.ready_at is None:
            self.ready_at = timezone.now()
        
        # Если статус "Готово" снимают, сбрасываем дату
        elif self.status != 'ready':
            self.ready_at = None
            
        super().save(*args, **kwargs)
        
        # Затем обновляем Order
        if hasattr(self, 'order') and self.order:
            self.order.update_status()

# === Модель Профиля ===
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    avatar = models.ImageField(
        upload_to='avatars/',
        default='avatars/default.jpg',
        verbose_name="Аватар"
    )
    sound_notifications = models.BooleanField(
        default=True, 
        verbose_name="Звуковые уведомления"
    )
    popup_notifications = models.BooleanField(
        default=True, 
        verbose_name="Всплывающие уведомления"
    )
    day_before_notifications = models.BooleanField(
        default=True, 
        verbose_name="Уведомления за день до срока"
    )

    def __str__(self):
        return f'Профиль: {self.user.username}'

# === Сигналы для Профиля ===
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()
    else:
        Profile.objects.create(user=instance)

# === Модель Настроек Компании ===
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
        verbose_name="Логотип компании (для счетов)"
    )

    def __str__(self):
        return "Настройки компании"

    def save(self, *args, **kwargs):
        self.pk = 1 
        super(CompanySettings, self).save(*args, **kwargs)
    
    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj
        
    class Meta:
        verbose_name = "Настройки компании"
        verbose_name_plural = "Настройки компании"

# === Модель Настроек Telegram ===
class TelegramSettings(models.Model):
    bot_token = models.CharField(
        max_length=255, 
        blank=True, 
        verbose_name="Token Telegram-бота"
    )
    chat_id = models.CharField(
        max_length=255, 
        blank=True, 
        verbose_name="Chat ID (куда отправлять уведомления)"
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

# === Модель Ассортимента ===
class Product(models.Model):
    CATEGORY_CHOICES = [
        ('polygraphy', 'Полиграфия'),
        ('packaging', 'Упаковка'),
        ('souvenirs', 'Сувениры'),
        ('large-format', 'Широкоформатная печать'),
    ]

    name = models.CharField(
        max_length=100, 
        verbose_name="Название товара"
    )
    category = models.CharField(
        max_length=50, 
        choices=CATEGORY_CHOICES, 
        verbose_name="Категория"
    )
    icon = models.CharField(
        max_length=50, 
        blank=True, 
        verbose_name="Класс иконки (напр. 'fas fa-print')"
    )

    class Meta:
        verbose_name = "Товар (ассортимент)"
        verbose_name_plural = "Товары (ассортимент)"
        ordering = ['category', 'name']

    def __str__(self):
        return self.name