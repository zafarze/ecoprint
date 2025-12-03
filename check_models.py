import os
import django
import google.generativeai as genai

# 1. Настройка окружения Django, чтобы достать API ключ из settings.py
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ecoprint.settings')
django.setup()
from django.conf import settings

def check_available_models():
    api_key = getattr(settings, 'GEMINI_API_KEY', None)
    
    if not api_key:
        print("❌ ОШИБКА: API ключ не найден в настройках!")
        return

    try:
        genai.configure(api_key=api_key)
        
        print(f"🔑 Ключ найден. Проверяем доступные модели...\n")
        print(f"{'MOДЕЛЬ':<30} | {'ОПИСАНИЕ'}")
        print("-" * 60)
        
        found = False
        for m in genai.list_models():
            # Нам интересны только модели, которые умеют генерировать текст (generateContent)
            if 'generateContent' in m.supported_generation_methods:
                print(f"{m.name:<30} | {m.display_name}")
                found = True
        
        if not found:
            print("⚠ Модели найдены, но среди них нет тех, что генерируют текст.")
            
    except Exception as e:
        print(f"❌ Ошибка соединения с Google API: {e}")

if __name__ == "__main__":
    check_available_models()