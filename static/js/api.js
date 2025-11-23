// static/js/api.js
// (ВЕРСИЯ БЕЗ КЭША ДЛЯ ЗАКАЗОВ)

import { csrftoken } from './utils.js';

// --- Функции кэширования ---

export function invalidateCache() {
    // Очищаем только каталоги, если нужно, 
    // но заказы мы теперь вообще не будем кэшировать.
    localStorage.removeItem('ecoPrint-productCatalog');
    localStorage.removeItem('ecoPrint-userCatalog');
}

/**
 * Используем ТОЛЬКО для справочников (Товары, Юзеры), 
 * которые меняются редко.
 */
async function getCachedOrFetch(key, fetchUrl) {
    const cachedData = localStorage.getItem(key);
    
    if (cachedData) {
        return JSON.parse(cachedData);
    } 
    
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
 * Загружает каталоги (кэширует их).
 */
export async function fetchCatalogs() {
    // 1. Загружаем товары напрямую с сервера
    const productsResponse = await fetch('/api/products/');
    if (!productsResponse.ok) throw new Error('Ошибка загрузки товаров');
    const products = await productsResponse.json();

    // 2. Загружаем пользователей напрямую
    const usersResponse = await fetch('/api/users/');
    if (!usersResponse.ok) throw new Error('Ошибка загрузки пользователей');
    const users = await usersResponse.json();

    // Очищаем старый кэш, чтобы он не занимал место (опционально)
    localStorage.removeItem('ecoPrint-productCatalog');
    localStorage.removeItem('ecoPrint-userCatalog');

    return { products, users };
}

/**
 * Загружает список Заказов.
 * 👇 ИЗМЕНЕНИЕ: Мы убрали кэширование. Теперь всегда свежие данные.
 */
export async function fetchOrders() {
    // Всегда делаем запрос к серверу
    const response = await fetch('/api/orders/?is_archived=false');
    if (!response.ok) {
        throw new Error('Ошибка загрузки заказов');
    }
    return await response.json();
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
    const response = await fetch(`/api/orders/${orderId}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': csrftoken
        }
    });

    if (!response.ok && response.status !== 204) {
        throw new Error('Ошибка удаления на сервере');
    }
}

/**
 * Архивирует заказ.
 */
export async function archiveOrder(orderId) {
    const response = await fetch(`/api/orders/${orderId}/archive/`, {
        method: 'POST',
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

/**
 * Разархивирует заказ.
 */
export async function unarchiveOrder(orderId) {
    const response = await fetch(`/api/orders/${orderId}/unarchive/`, {
        method: 'POST',
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

/**
 * Запускает процесс выгрузки в Google Sheets
 */
export async function syncGoogleSheets() {
    const response = await fetch('/api/sync-sheets/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        }
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Ошибка синхронизации с Google');
    }
    
    return await response.json();
}