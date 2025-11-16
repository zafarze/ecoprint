# EcoPrint

CRM-система для типографии EcoPrint. Проект разработан на Django с использованием REST API для взаимодействия с фронтендом.

## Технологический стек

- **Backend:** Django, Django REST Framework
- **База данных:** PostgreSQL
- **Развертывание:** Gunicorn, WhiteNoise
- **Управление окружением:** python-dotenv

## Установка и настройка

1.  **Клонируйте репозиторий:**
    ```bash
    git clone <URL-вашего-репозитория>
    cd EcoPrint
    ```

2.  **Создайте и активируйте виртуальное окружение:**
    ```bash
    python -m venv venv
    # Для Windows
    venv\Scripts\activate
    # Для macOS/Linux
    source venv/bin/activate
    ```

3.  **Установите зависимости:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Создайте файл `.env` в корневой директории проекта:**
    Скопируйте содержимое из файла `.env.example` (см. ниже) в ваш новый файл `.env` и заполните его актуальными данными.

5.  **Выполните миграции базы данных:**
    ```bash
    python manage.py makemigrations
    python manage.py migrate
    ```

6.  **Создайте суперпользователя (опционально):**
    ```bash
    python manage.py createsuperuser
    ```

7.  **Соберите статические файлы (для продакшена):**
    ```bash
    python manage.py collectstatic
    ```

## Запуск проекта

Для запуска сервера разработки выполните команду:

```bash
python manage.py runserver