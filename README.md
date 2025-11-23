# EcoPrint

CRM-система для типографии EcoPrint. Проект разработан на Django с использованием REST API для взаимодействия с фронтендом и интеграцией с Google Sheets.

## Технологический стек

- **Backend:** Django, Django REST Framework
- **База данных:** PostgreSQL
- **Интеграции:** Google Sheets API (gspread)
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

4.  **Настройка переменных окружения (.env):**
    Создайте файл `.env` в корне проекта и добавьте следующие настройки:
    ```env
    DEBUG=True
    SECRET_KEY=ваш_секретный_ключ
    ALLOWED_HOSTS=127.0.0.1,localhost
    
    # База данных
    DB_NAME=ecoprint_db
    DB_USER=ecoprint_user
    DB_PASSWORD=EcoPrint2025
    DB_HOST=localhost
    DB_PORT=5433

    # Google Sheets (ID таблицы из URL)
    GOOGLE_SHEET_ID=12kFdT5CGFUT9SoLm-vljKY0ii1l-TPTqHy6dY_NJ0Ok
    ```

5.  **Настройка Google API:**
    * Поместите файл ключа сервисного аккаунта `service_account.json` в корень проекта (рядом с `manage.py`).
    * **Важно:** Не добавляйте этот файл в Git!

6.  **Выполните миграции базы данных:**
    ```bash
    python manage.py makemigrations
    python manage.py migrate
    ```

7.  **Создайте суперпользователя:**
    ```bash
    python manage.py createsuperuser
    ```

8.  **Соберите статику (для production):**
    ```bash
    python manage.py collectstatic
    ```

## Запуск проекта

Для запуска сервера разработки:
```bash
python manage.py runserver