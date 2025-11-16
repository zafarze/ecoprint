// static/js/app.js
// (ОБНОВЛЕННЫЙ)

// --- Импорты Модулей ---
import * as state from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { getDaysUntilDeadline, playNotificationSound } from './utils.js';

// --- Глобальные настройки (из base.html) ---
const soundEnabled = window.USER_SETTINGS.soundEnabled;
const popupEnabled = window.USER_SETTINGS.popupEnabled;
const dayBeforeEnabled = window.USER_SETTINGS.dayBeforeEnabled;


// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

/**
 * Главная функция инициализации.
 * Загружает данные (из кэша или API) и отрисовывает UI.
 */
async function initApp() {
    try {
        // 1. Загружаем данные
        const [orders, catalogs] = await Promise.all([
            api.fetchOrders(),
            api.fetchCatalogs()
        ]);
        
        // 2. Сохраняем в состояние
        state.setOrders(orders);
        state.setProductCatalog(catalogs.products);
        state.setUserCatalog(catalogs.users);
        
        // 3. Отрисовываем
        handleRenderOrders(); // Отрисовываем на основе фильтров
        checkUrgentOrders();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        ui.showNotification('Ошибка', 'Не удалось загрузить данные с сервера', 'error');
        api.invalidateCache(); // Очищаем "плохой" кэш
    }
    
    // Установка 'min' для даты
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.setAttribute('min', today);
    });
    
    resetNotificationTracking();
}

/**
 * Настраивает обработчики событий ТОЛЬКО для app.js (главная страница).
 */
function setupEventListeners() {
    // Модальное окно
    ui.addOrderBtn?.addEventListener('click', () => {
        state.setCurrentEditingOrderId(null);
        ui.openOrderModal();
    });
    ui.closeModalBtn?.addEventListener('click', ui.closeOrderModal);
    ui.cancelBtn?.addEventListener('click', ui.closeOrderModal);
    ui.saveBtn?.addEventListener('click', handleSaveOrder);
    ui.orderForm?.addEventListener('submit', (e) => { e.preventDefault(); handleSaveOrder(); });
    ui.addItemBtn?.addEventListener('click', ui.addItemRow);

    // Фильтры
    ui.syncBtn?.addEventListener('click', handleSync);
    ui.showReadyBtn?.addEventListener('click', () => {
        ui.statusFilter.value = 'ready';
        handleRenderOrders();
        ui.updateQuickFilterButtons('ready');
    });
    ui.showNotReadyBtn?.addEventListener('click', () => {
        ui.statusFilter.value = 'not-ready';
        handleRenderOrders();
        ui.updateQuickFilterButtons('not-ready');
    });
    ui.resetFiltersBtn?.addEventListener('click', () => {
        ui.searchInput.value = '';
        ui.statusFilter.value = 'all';
        ui.urgencyFilter.value = 'all';
        handleRenderOrders();
        ui.updateQuickFilterButtons('all');
    });
    ui.searchInput?.addEventListener('input', handleRenderOrders);
    ui.statusFilter?.addEventListener('change', () => {
        handleRenderOrders();
        ui.updateQuickFilterButtons('');
    });
    ui.urgencyFilter?.addEventListener('change', handleRenderOrders);

    // Уведомления
    ui.notificationCloseBtn?.addEventListener('click', ui.closeNotification);

    // --- (ВАЖНО) Event Delegation для таблицы ---
    // Один обработчик на всю таблицу
    ui.ordersTableBody?.addEventListener('click', handleTableClick);

    // Периодическая проверка сроков
    setInterval(checkUrgentOrders, 300000); // Каждые 5 минут
}


// --- Обработчики (Handlers) ---

/**
 * Собирает данные из фильтров и вызывает отрисовку.
 */
function handleRenderOrders() {
    const orders = state.getOrders();
    const searchTerm = ui.searchInput.value.toLowerCase();
    const statusValue = ui.statusFilter.value;
    const urgencyValue = ui.urgencyFilter.value;
    
    const filteredOrders = orders.filter(order => {
        // Логика фильтрации
        const matchesSearch = searchTerm === '' || 
            order.client.toLowerCase().includes(searchTerm) ||
            order.items.some(item => item.name.toLowerCase().includes(searchTerm));
        
        const matchesStatus = statusValue === 'all' || order.status === statusValue;
        
        let matchesUrgency = urgencyValue === 'all';
        if (urgencyValue !== 'all') {
            matchesUrgency = order.items.some(item => {
                if (item.status === 'ready') return false;
                const daysUntilDeadline = getDaysUntilDeadline(item.deadline);
                if (urgencyValue === 'urgent') {
                    return daysUntilDeadline <= 1 && daysUntilDeadline >= 0;
                } else if (urgencyValue === 'very-urgent') {
                    return daysUntilDeadline === 0;
                }
                return false;
            });
        }
        
        return matchesSearch && matchesStatus && matchesUrgency;
    });
    
    ui.renderOrders(filteredOrders);
}

/**
 * Обрабатывает клики внутри таблицы (Редакт., Удалить, Статус).
 */
function handleTableClick(e) {
    // 1. Клик на Редактирование
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
        const orderId = parseInt(editBtn.dataset.id);
        handleEditOrder(orderId);
        return;
    }
    
    // --- 👇 НОВЫЙ БЛОК: Клик на Архив ---
    const archiveBtn = e.target.closest('.archive-btn');
    if (archiveBtn) {
        const orderId = parseInt(archiveBtn.dataset.id);
        handleArchiveOrder(orderId);
        return;
    }
    // --- 👆 КОНЕЦ НОВОГО БЛОКА ---

    // 2. Клик на Удаление
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        const orderId = parseInt(deleteBtn.dataset.id);
        handleDeleteOrder(orderId);
        return;
    }

    // 3. Клик на Статус
    const statusSpan = e.target.closest('.item-status');
    if (statusSpan) {
        const orderId = parseInt(statusSpan.dataset.orderId);
        const itemId = statusSpan.dataset.itemId ? parseInt(statusSpan.dataset.itemId) : null;
        const itemName = statusSpan.dataset.itemName;
        const itemQuantity = parseInt(statusSpan.dataset.itemQuantity);
        
        handleToggleItemStatus(orderId, itemId, itemName, itemQuantity);
        return;
    }
}

/**
 * Принудительная синхронизация (кнопка "Обновить").
 */
async function handleSync() {
    api.invalidateCache();
    ui.showNotification('Синхронизация', 'Данные обновляются с сервера...', 'info');
    await initApp();
    ui.showNotification('Успешно', 'Данные обновлены', 'success');
}

/**
 * Сохранение (Создание/Редактирование)
 */
async function handleSaveOrder() {
    // 1. Валидация
    const clientName = document.getElementById('clientName').value;
    if (!clientName) {
        ui.showNotification('Ошибка', 'Укажите клиента', 'error');
        return;
    }
    
    // 2. Сборка данных
    const items = [];
    const itemCards = ui.itemsFormContainer.querySelectorAll('.item-form-card');
    let allFieldsValid = true;
    
    itemCards.forEach(card => {
        const productName = card.querySelector('.product-name-input').value;
        const quantity = parseInt(card.querySelector('.item-quantity').value);
        const status = card.querySelector('.item-status-select').value;
        const deadline = card.querySelector('.item-deadline-input').value;
        const responsibleUserId = card.querySelector('.item-responsible-user').value;
        const comment = card.querySelector('.item-comment').value; 
        
        if (!productName || !deadline) {
            allFieldsValid = false;
        }
        
        items.push({ 
            name: productName, quantity, status, deadline, comment,
            responsible_user_id: responsibleUserId ? parseInt(responsibleUserId) : null
        });
    });
    
    if (items.length === 0 || !allFieldsValid) {
        ui.showNotification('Ошибка', 'Добавьте товар и заполните все поля (*)', 'error');
        return;
    }
    
    const orderData = {
        client: clientName,
        items_write: items
    };
    
    const orderId = state.getCurrentEditingOrderId();

    // 3. Отправка в API
    try {
        await api.saveOrder(orderData, orderId);
        
        // 4. Обновление UI
        ui.closeOrderModal();
        await initApp(); // Перезагружаем все (т.к. кэш был очищен)
        
        ui.showNotification('Успешно', orderId ? 'Заказ обновлен' : 'Заказ создан', 'success');
        
    } catch (error) {
        ui.showNotification('Ошибка', 'Не удалось сохранить заказ.', 'error');
    }
}

/**
 * Редактирование
 */
function handleEditOrder(orderId) {
    const order = state.getOrders().find(o => o.id === orderId);
    if (order) {
        state.setCurrentEditingOrderId(orderId);
        ui.openOrderModal(order);
    }
}

/**
 * Удаление
 */
async function handleDeleteOrder(orderId) {
    if (confirm('Вы уверены, что хотите удалить этот заказ?')) {
        try {
            await api.deleteOrder(orderId);
            
            // Обновляем UI (initApp перезагрузит данные)
            await initApp(); 
            ui.showNotification('Успешно', 'Заказ удален', 'success');
        } catch (error) {
            ui.showNotification('Ошибка', 'Не удалось удалить заказ.', 'error');
        }
    }
}

// --- 👇 НОВАЯ ФУНКЦИЯ ---
/**
 * Архивация (по клику на кнопку)
 */
async function handleArchiveOrder(orderId) {
    if (confirm('Вы уверены, что хотите архивировать этот заказ?\n\nОн исчезнет с главной страницы и переместится в "Архив".')) {
        try {
            await api.archiveOrder(orderId);
            
            // Обновляем UI (initApp перезагрузит данные, и заказ исчезнет)
            await initApp(); 
            ui.showNotification('Успешно', 'Заказ отправлен в архив', 'success');
        } catch (error) {
            ui.showNotification('Ошибка', 'Не удалось архивировать заказ.', 'error');
        }
    }
}
// --- 👆 КОНЕЦ НОВОЙ ФУНКЦИИ ---

/**
 * Смена статуса товара (по клику)
 */
async function handleToggleItemStatus(orderId, itemId, itemName, itemQuantity) {
    const order = state.getOrders().find(o => o.id === orderId);
    if (!order) return;

    // Ищем товар (по ID если есть, иначе по связке имя+кол-во)
    const item = itemId 
        ? order.items.find(i => i.id === itemId)
        : order.items.find(i => i.name === itemName && i.quantity === itemQuantity);
    
    if (!item) return;
    
    // 1. Логика смены статуса
    if (item.status === 'not-ready') item.status = 'in-progress';
    else if (item.status === 'in-progress') item.status = 'ready';
    else item.status = 'not-ready';
    
    if (soundEnabled) playNotificationSound();

    // 2. Собираем данные для API
    const itemsForApi = order.items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        status: i.status,
        deadline: i.deadline,
        comment: i.comment, 
        responsible_user_id: i.responsible_user ? i.responsible_user.id : null
    }));
    
    const orderData = {
        client: order.client,
        items_write: itemsForApi
    };

    // 3. Отправка в API
    try {
        await api.saveOrder(orderData, orderId);
        await initApp(); // Перезагрузит и перерисует
        
    } catch (error) {
        ui.showNotification('Ошибка', 'Не удалось обновить статус', 'error');
        await initApp();
    }
}


// --- Уведомления о сроках ---

function checkUrgentOrders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let urgentOrders = [];
    const notificationSet = state.getNotificationSet();
    const orders = state.getOrders();
    
    orders.forEach(order => {
        order.items.forEach(item => {
            if (item.status === 'ready') return;
            
            const deadlineDate = new Date(item.deadline);
            deadlineDate.setHours(0, 0, 0, 0);
            
            if (deadlineDate.getTime() === today.getTime()) {
                if (!notificationSet.has(`today-${order.id}-${item.name}`)) {
                    urgentOrders.push({ order, item, type: 'today' });
                    notificationSet.add(`today-${order.id}-${item.name}`);
                }
            } else if (deadlineDate.getTime() === tomorrow.getTime() && dayBeforeEnabled) {
                if (!notificationSet.has(`tomorrow-${order.id}-${item.name}`)) {
                    urgentOrders.push({ order, item, type: 'tomorrow' });
                    notificationSet.add(`tomorrow-${order.id}-${item.name}`);
                }
            }
        });
    });
    
    if (urgentOrders.length > 0 && popupEnabled) {
        let message = '';
        urgentOrders.forEach(({ order, item, type }) => {
            const deadlineText = type === 'today' ? 'сегодня' : 'завтра';
            message += `Заказ №${order.id} (${order.client}) - "${item.name}" - ${deadlineText}\n`;
        });
        ui.showNotification('Внимание! Срок сдачи товаров', message.trim(), 'warning');
        if (soundEnabled) playNotificationSound();
    }
}

/**
 * Сбрасывает список "уже показанных" уведомлений в полночь.
 */
function resetNotificationTracking() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow - now;
    
    setTimeout(() => {
        state.clearNotificationSet();
        resetNotificationTracking(); // Запускаем рекурсивно
    }, msUntilMidnight);
}