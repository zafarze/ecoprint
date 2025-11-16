// static/js/api.js
// (ИСПРАВЛЕННЫЙ)

import { csrftoken } from './utils.js';

// --- Функции кэширования ---

/**
 * Очищает ВЕСЬ кэш данных.
 * Вызывается, когда мы (C)reate, (U)pdate, (D)elete что-либо.
 */
export function invalidateCache() {
    console.log("Кэш API очищен.");
    localStorage.removeItem('ecoPrint-orders');
    localStorage.removeItem('ecoPrint-productCatalog');
    localStorage.removeItem('ecoPrint-userCatalog');
}

/**
 * Пытается получить данные из кэша. Если их нет -
 * выполняет fetch, кэширует и возвращает результат.
 */
async function getCachedOrFetch(key, fetchUrl) {
    const cachedData = localStorage.getItem(key);
    
    if (cachedData) {
        console.log(`Загружено из кэша: ${key}`);
        return JSON.parse(cachedData);
    } 
    
    // Если в кэше нет
    console.log(`Запрос на сервер: ${key}`);
    const response = await fetch(fetchUrl);
    if (!response.ok) {
        throw new Error(`Ошибка загрузки: ${key}`);
    }
    const data = await response.json();
    
    localStorage.setItem(key, JSON.stringify(data));
    return data;
}

// --- Функции API ---

/**
 * Загружает каталоги (Товары и Пользователи).
 */
export async function fetchCatalogs() {
    const products = await getCachedOrFetch('ecoPrint-productCatalog', '/api/products/');
    const users = await getCachedOrFetch('ecoPrint-userCatalog', '/api/users/');
    return { products, users };
}

/**
 * Загружает список Заказов.
 */
export async function fetchOrders() {
    // 👇 Мы добавили фильтр, чтобы не загружать
    // архивированные заказы на главную страницу
    return await getCachedOrFetch('ecoPrint-orders', '/api/orders/?is_archived=false');
}

/**
 * Сохраняет (Создает или Обновляет) заказ.
 */
export async function saveOrder(orderData, orderId = null) {
    let url = '/api/orders/';
    let method = 'POST';
    
    if (orderId) {
        url = `/api/orders/${orderId}/`;
        method = 'PUT';
    }
    
    // Очищаем кэш ПЕРЕД запросом
    invalidateCache();

    const response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify(orderData)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Ошибка сохранения:', errorData);
        throw new Error('Ошибка сохранения на сервере');
    }
    return await response.json();
}

/**
 * Удаляет заказ.
 */
export async function deleteOrder(orderId) {
    // Очищаем кэш ПЕРЕД запросом
    invalidateCache();
    
    const response = await fetch(`/api/orders/${orderId}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': csrftoken
        }
    });

    if (!response.ok && response.status !== 204) {
        throw new Error('Ошибка удаления на сервере');
    }
    // При успехе (204 No Content) ничего не возвращаем
}

/**
 * Отправляет команду архивации заказа.
 */
export async function archiveOrder(orderId) {
    // Очищаем кэш ПЕРЕД запросом
    invalidateCache();
    
    const response = await fetch(`/api/orders/${orderId}/archive/`, {
        method: 'POST', // Используем POST, как указано в @action
        headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/json',
        }
    });

    if (!response.ok) {
        throw new Error('Ошибка архивации на сервере');
    }
    return await response.json();
}

// --- 👇 ВОТ ИСПРАВЛЕНИЕ (НОВАЯ ФУНКЦИЯ) ---
/**
 * Отправляет команду РАЗАРХИВАЦИИ заказа.
 */
export async function unarchiveOrder(orderId) {
    // Очищаем кэш (если заказ вернется, он должен появиться на главной)
    invalidateCache(); 
    
    const response = await fetch(`/api/orders/${orderId}/unarchive/`, {
        method: 'POST', // Используем POST, как указано в @action
        headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/json',
        }
    });

    if (!response.ok) {
        throw new Error('Ошибка разархивации на сервере');
    }
    return await response.json();
}
// --- 👆 КОНЕЦ ИСПРАВЛЕНИЯ ---