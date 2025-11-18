// static/js/app.js
// (ВЕРСИЯ С МГНОВЕННЫМ ОБНОВЛЕНИЕМ - 1 сек)

import * as state from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { getDaysUntilDeadline, playNotificationSound } from './utils.js';

const soundEnabled = window.USER_SETTINGS.soundEnabled;
const popupEnabled = window.USER_SETTINGS.popupEnabled;
const dayBeforeEnabled = window.USER_SETTINGS.dayBeforeEnabled;

// Флаг: если открыто окно, мы не обновляем таблицу, чтобы не сбить фокус ввода
let isModalOpen = false;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    
    // 👇 ЗАПУСКАЕМ БЫСТРЫЙ ЦИКЛ ОБНОВЛЕНИЯ
    startAutoRefreshLoop();
});

/**
 * Умный цикл обновления.
 * Используем setTimeout вместо setInterval, чтобы запросы не наслаивались друг на друга
 * при медленном интернете.
 */
async function startAutoRefreshLoop() {
    // 1. Если модальное окно закрыто - обновляем данные
    if (!isModalOpen) {
        try {
            // Загружаем заказы "тихо" (без блокировки экрана)
            const orders = await api.fetchOrders();
            
            // Сравниваем данные (упрощенно): если длина изменилась или статусы
            // Для простоты просто обновляем состояние.
            // React делает это эффективнее, но для JS так тоже нормально.
            state.setOrders(orders);
            handleRenderOrders();
            
        } catch (e) {
            // Ошибки в консоль, чтобы не пугать юзера
            console.warn("Auto-refresh skipped:", e);
        }
    }

    // 2. Запускаем следующий цикл через 1 секунду (1000 мс)
    // Это создаст эффект "реального времени"
    setTimeout(startAutoRefreshLoop, 1000);
}

async function initApp() {
    try {
        const [orders, catalogs] = await Promise.all([
            api.fetchOrders(),
            api.fetchCatalogs()
        ]);
        
        state.setOrders(orders);
        state.setProductCatalog(catalogs.products);
        state.setUserCatalog(catalogs.users);
        
        handleRenderOrders();
        checkUrgentOrders();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        ui.showNotification('Ошибка', 'Не удалось загрузить данные', 'error');
    }
    
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.setAttribute('min', today);
    });
    
    resetNotificationTracking();
}

function setupEventListeners() {
    ui.addOrderBtn?.addEventListener('click', () => {
        state.setCurrentEditingOrderId(null);
        ui.openOrderModal();
        isModalOpen = true; // БЛОКИРУЕМ обновление
    });
    
    ui.closeModalBtn?.addEventListener('click', () => {
        ui.closeOrderModal();
        isModalOpen = false; // РАЗРЕШАЕМ обновление
    });
    ui.cancelBtn?.addEventListener('click', () => {
        ui.closeOrderModal();
        isModalOpen = false;
    });
    
    ui.saveBtn?.addEventListener('click', handleSaveOrder);
    ui.orderForm?.addEventListener('submit', (e) => { e.preventDefault(); handleSaveOrder(); });
    ui.addItemBtn?.addEventListener('click', ui.addItemRow);

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

    ui.notificationCloseBtn?.addEventListener('click', ui.closeNotification);
    
    // Используем один обработчик на таблицу (делегирование)
    ui.ordersTableBody?.addEventListener('click', handleTableClick);

    // Проверка сроков каждые 5 минут (не путать с обновлением таблицы)
    setInterval(checkUrgentOrders, 300000); 
}

function handleRenderOrders() {
    const orders = state.getOrders();
    // Если orders еще не загрузились (null/undefined), выходим
    if (!orders) return;

    const searchTerm = ui.searchInput.value.toLowerCase();
    const statusValue = ui.statusFilter.value;
    const urgencyValue = ui.urgencyFilter.value;
    
    const filteredOrders = orders.filter(order => {
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

function handleTableClick(e) {
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
        const orderId = parseInt(editBtn.dataset.id);
        handleEditOrder(orderId);
        return;
    }
    
    const archiveBtn = e.target.closest('.archive-btn');
    if (archiveBtn) {
        const orderId = parseInt(archiveBtn.dataset.id);
        handleArchiveOrder(orderId);
        return;
    }

    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        const orderId = parseInt(deleteBtn.dataset.id);
        handleDeleteOrder(orderId);
        return;
    }

    const statusSpan = e.target.closest('.item-status');
    if (statusSpan) {
        // Блокируем повторные клики, если нужно, или просто обрабатываем
        const orderId = parseInt(statusSpan.dataset.orderId);
        const itemId = statusSpan.dataset.itemId ? parseInt(statusSpan.dataset.itemId) : null;
        const itemName = statusSpan.dataset.itemName;
        const itemQuantity = parseInt(statusSpan.dataset.itemQuantity);
        
        handleToggleItemStatus(orderId, itemId, itemName, itemQuantity);
        return;
    }
}

async function handleSync() {
    ui.showNotification('Синхронизация', 'Данные обновляются...', 'info');
    await initApp();
    ui.showNotification('Успешно', 'Данные обновлены', 'success');
}

async function handleSaveOrder() {
    const clientName = document.getElementById('clientName').value;
    if (!clientName) {
        ui.showNotification('Ошибка', 'Укажите клиента', 'error');
        return;
    }
    
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

    try {
        // Отправляем на сервер
        await api.saveOrder(orderData, orderId);
        
        ui.closeOrderModal();
        isModalOpen = false; 
        
        // Сразу же обновляем данные, чтобы увидеть свой результат
        await initApp();
        
        ui.showNotification('Успешно', orderId ? 'Заказ обновлен' : 'Заказ создан', 'success');
    } catch (error) {
        ui.showNotification('Ошибка', 'Не удалось сохранить заказ.', 'error');
    }
}

function handleEditOrder(orderId) {
    const order = state.getOrders().find(o => o.id === orderId);
    if (order) {
        state.setCurrentEditingOrderId(orderId);
        ui.openOrderModal(order);
        isModalOpen = true;
    }
}

async function handleDeleteOrder(orderId) {
    if (confirm('Вы уверены, что хотите удалить этот заказ?')) {
        try {
            await api.deleteOrder(orderId);
            await initApp(); 
            ui.showNotification('Успешно', 'Заказ удален', 'success');
        } catch (error) {
            ui.showNotification('Ошибка', 'Не удалось удалить заказ.', 'error');
        }
    }
}

async function handleArchiveOrder(orderId) {
    if (confirm('Вы уверены, что хотите архивировать этот заказ?')) {
        try {
            await api.archiveOrder(orderId);
            await initApp(); 
            ui.showNotification('Успешно', 'Заказ отправлен в архив', 'success');
        } catch (error) {
            ui.showNotification('Ошибка', 'Не удалось архивировать заказ.', 'error');
        }
    }
}

async function handleToggleItemStatus(orderId, itemId, itemName, itemQuantity) {
    const order = state.getOrders().find(o => o.id === orderId);
    if (!order) return;

    const item = itemId 
        ? order.items.find(i => i.id === itemId)
        : order.items.find(i => i.name === itemName && i.quantity === itemQuantity);
    
    if (!item) return;
    
    // 1. Оптимистичное обновление (меняем в UI сразу для скорости)
    const oldStatus = item.status;
    if (item.status === 'not-ready') item.status = 'in-progress';
    else if (item.status === 'in-progress') item.status = 'ready';
    else item.status = 'not-ready';

    // Перерисовываем таблицу с новым статусом немедленно
    handleRenderOrders();

    if (soundEnabled) playNotificationSound();

    // 2. Готовим данные для отправки
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

    try {
        // 3. Отправляем на сервер
        await api.saveOrder(orderData, orderId);
        
        // На этом этапе другие компьютеры (через 1 сек) уже увидят это изменение,
        // потому что мы сохранили его в БД.
        
    } catch (error) {
        // Если ошибка - откатываем назад
        item.status = oldStatus;
        handleRenderOrders();
        ui.showNotification('Ошибка', 'Не удалось обновить статус', 'error');
    }
}

function checkUrgentOrders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let urgentOrders = [];
    const notificationSet = state.getNotificationSet();
    const orders = state.getOrders();
    if (!orders) return;
    
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

function resetNotificationTracking() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow - now;
    
    setTimeout(() => {
        state.clearNotificationSet();
        resetNotificationTracking(); 
    }, msUntilMidnight);
}