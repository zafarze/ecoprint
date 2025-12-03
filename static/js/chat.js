// static/js/chat.js
import { csrftoken } from './utils.js'; // Используем твой utils

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('chatToggleBtn');
    const widget = document.getElementById('chatWidget');
    const sendBtn = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');
    const body = document.getElementById('chatBody');
    const typing = document.getElementById('typingIndicator');

    // 1. Открытие/Закрытие
    toggleBtn.addEventListener('click', () => {
        widget.classList.toggle('active');
        if (widget.classList.contains('active')) {
            input.focus();
            // Скролл вниз
            body.scrollTop = body.scrollHeight;
        }
    });

    // 2. Отправка сообщения
    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // Добавляем сообщение юзера
        addMessage(text, 'user');
        input.value = '';

        // Показываем "печатает..."
        typing.style.display = 'flex';
        body.scrollTop = body.scrollHeight;

        try {
            const response = await fetch('/api/ai-chat/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({ message: text })
            });

            const data = await response.json();
            
            // Скрываем "печатает..."
            typing.style.display = 'none';

            if (data.answer) {
                // Преобразуем **text** в жирный шрифт для красоты
                const formattedAnswer = data.answer.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                addMessage(formattedAnswer, 'bot');
            } else {
                addMessage('Ошибка: ' + (data.error || 'Неизвестная ошибка'), 'bot');
            }

        } catch (error) {
            typing.style.display = 'none';
            addMessage('Ошибка сети. Попробуйте позже.', 'bot');
            console.error(error);
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        msgDiv.innerHTML = text; // Используем innerHTML для поддержки тегов <strong>
        
        // Вставляем ПЕРЕД индикатором печати
        body.insertBefore(msgDiv, typing);
        body.scrollTop = body.scrollHeight;
    }
});