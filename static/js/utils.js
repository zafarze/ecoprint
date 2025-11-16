// static/js/utils.js
// (Новый файл)

/**
 * Получает CSRF-токен из cookie.
 */
export function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

/**
 * Генерирует CSRF-токен для использования в API.
 */
export const csrftoken = getCookie('csrftoken');

/**
 * Форматирует строку даты (напр. "2025-11-16") в "16.11.2025".
 */
export function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return date.toLocaleDateString('ru-RU', options);
}

/**
 * Возвращает количество дней до дедлайна.
 */
export function getDaysUntilDeadline(deadline) {
    if (!deadline) return 999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    const diffTime = deadlineDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Возвращает русский текст для статуса.
 */
export function getStatusText(status) {
    switch (status) {
        case 'ready': return 'Готово';
        case 'in-progress': return 'В процессе';
        case 'not-ready': return 'Не готов';
        default: return status;
    }
}

/**
 * Воспроизводит простой звук уведомления.
 */
export function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.warn("Не удалось воспроизвести звук:", e);
    }
}