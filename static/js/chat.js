// static/js/chat.js
// (ВЕРСИЯ С ЗАЩИТОЙ XSS)

// 👇 Добавляем импорт escapeHtml
import { csrftoken, escapeHtml } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('chatToggleBtn');
    const widget = document.getElementById('chatWidget');
    const sendBtn = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');
    const body = document.getElementById('chatBody');
    const typing = document.getElementById('typingIndicator');

    // 1. Открытие/Закрытие
    toggleBtn?.addEventListener('click', () => {
        widget.classList.toggle('active');
        if (widget.classList.contains('active')) {
            input.focus();
            body.scrollTop = body.scrollHeight;
        }
    });

    // 2. Отправка сообщения
    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // 👇 БЕЗОПАСНОСТЬ: Экранируем сообщение пользователя
        addMessage(text, 'user', true); 
        input.value = '';

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
            
            typing.style.display = 'none';

            if (data.answer) {
                // Бот присылает Markdown (**bold**), нам нужно превратить его в HTML теги,
                // НО сам текст бота мы считаем условно безопасным.
                const formattedAnswer = data.answer.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                // Сообщения бота не экранируем полностью, чтобы работали strong теги
                addMessage(formattedAnswer, 'bot', false);
            } else {
                addMessage('Ошибка: ' + (data.error || 'Неизвестная ошибка'), 'bot', true);
            }

        } catch (error) {
            typing.style.display = 'none';
            addMessage('Ошибка сети. Попробуйте позже.', 'bot', true);
            console.error(error);
        }
    }

    sendBtn?.addEventListener('click', sendMessage);
    input?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    /**
     * Добавляет сообщение в чат.
     * @param {string} text - Текст сообщения
     * @param {string} sender - 'user' или 'bot'
     * @param {boolean} shouldEscape - Нужно ли экранировать HTML (True для юзера)
     */
    function addMessage(text, sender, shouldEscape) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        
        // 👇 ГЛАВНОЕ ИСПРАВЛЕНИЕ:
        if (shouldEscape) {
            msgDiv.innerHTML = escapeHtml(text);
        } else {
            msgDiv.innerHTML = text;
        }
        
        body.insertBefore(msgDiv, typing);
        body.scrollTop = body.scrollHeight;
    }
});