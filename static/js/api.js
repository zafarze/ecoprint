// static/js/api.js
// (REFACTORED VERSION: Service Class Pattern)

import { csrftoken } from './utils.js';

class ApiService {
    constructor() {
        // Базовый префикс. Если бэкенд изменится, меняем только здесь.
        this.baseUrl = '/api';
    }

    /**
     * Центральный метод для выполнения запросов.
     * Автоматически добавляет CSRF токен и заголовки JSON.
     */
    async _request(endpoint, method = 'GET', body = null) {
        const headers = {
            'X-CSRFToken': csrftoken
        };

        if (body && !(body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const config = {
            method: method,
            headers: headers,
        };

        if (body) {
            config.body = (body instanceof FormData) ? body : JSON.stringify(body);
        }

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, config);
            
            // Если статус 204 No Content, возвращаем null (удаление прошло успешно)
            if (response.status === 204) {
                return null;
            }

            if (!response.ok) {
                // Пытаемся прочитать ошибку из JSON, если сервер её прислал
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { error: response.statusText };
                }
                
                throw new Error(errorData.error || `Ошибка сервера (${response.status})`);
            }

            return await response.json();

        } catch (error) {
            console.error(`API Request failed [${method} ${endpoint}]:`, error);
            throw error; // Пробрасываем ошибку дальше, чтобы UI мог показать уведомление
        }
    }

    // --- КЭШИРОВАНИЕ ---

    invalidateCache() {
        localStorage.removeItem('ecoPrint-productCatalog');
        localStorage.removeItem('ecoPrint-userCatalog');
    }

    // --- БИЗНЕС МЕТОДЫ ---

    async getCatalogs() {
        // Выполняем запросы параллельно для скорости
        const [products, users] = await Promise.all([
            this._request('/products/'),
            this._request('/users/')
        ]);

        // Очищаем старый кэш
        this.invalidateCache();
        
        return { products, users };
    }

    async getOrders(isArchived = false) {
        return this._request(`/orders/?is_archived=${isArchived}`);
    }

    async saveOrder(orderData, orderId = null) {
        if (orderId) {
            return this._request(`/orders/${orderId}/`, 'PUT', orderData);
        } else {
            return this._request('/orders/', 'POST', orderData);
        }
    }

    async deleteOrder(orderId) {
        return this._request(`/orders/${orderId}/`, 'DELETE');
    }

    async archiveOrder(orderId) {
        return this._request(`/orders/${orderId}/archive/`, 'POST');
    }

    async unarchiveOrder(orderId) {
        return this._request(`/orders/${orderId}/unarchive/`, 'POST');
    }

    async syncGoogleSheets() {
        return this._request('/sync-sheets/', 'POST');
    }
}

// Создаем единственный экземпляр сервиса (Singleton)
const apiService = new ApiService();

// --- EXPORTS ---
// Экспортируем функции-обертки, чтобы сохранить совместимость 
// с текущим кодом в app.js и archive.js без изменений.

export const invalidateCache = () => apiService.invalidateCache();
export const fetchCatalogs = () => apiService.getCatalogs();
export const fetchOrders = () => apiService.getOrders(false); // Активные
export const fetchArchivedOrders = () => apiService.getOrders(true); // Архивные (если понадобится отдельно)
export const saveOrder = (data, id) => apiService.saveOrder(data, id);
export const deleteOrder = (id) => apiService.deleteOrder(id);
export const archiveOrder = (id) => apiService.archiveOrder(id);
export const unarchiveOrder = (id) => apiService.unarchiveOrder(id);
export const syncGoogleSheets = () => apiService.syncGoogleSheets();

// Если нужно получить доступ к "чистому" запросу в будущем
export default apiService;