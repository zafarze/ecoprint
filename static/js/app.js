// D:\Projects\EcoPrint\static\js\app.js
// (ОПТИМИЗИРОВАННАЯ ВЕРСИЯ: ИНТЕРВАЛ ОБНОВЛЕНИЯ 10 СЕК)

import * as state from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { getDaysUntilDeadline, playNotificationSound, escapeHtml } from './utils.js';

const soundEnabled = window.USER_SETTINGS.soundEnabled;
const popupEnabled = window.USER_SETTINGS.popupEnabled;
const dayBeforeEnabled = window.USER_SETTINGS.dayBeforeEnabled;

// Флаг: если открыто окно, мы не обновляем таблицу
let isModalOpen = false;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    startAutoRefreshLoop();
});

/**
 * Автоматическое обновление данных.
 * ИНТЕРВАЛ: 10 секунд (10000 мс) вместо 1 сек, чтобы не перегружать сервер.
 */
async function startAutoRefreshLoop() {
    if (!isModalOpen) {
        try {
            // Загружаем только свежие данные, не блокируя интерфейс
            const orders = await api.fetchOrders();
            
            // Сравниваем длину массивов или хеши, чтобы лишний раз не перерисовывать DOM?
            // Пока для простоты обновляем всегда, но реже.
            state.setOrders(orders);
            handleRenderOrders();
        } catch (e) {
            console.warn("Auto-refresh skipped (network error or server busy):", e);
        }
    }
    // 👇 ВОТ ЗДЕСЬ ИЗМЕНЕНИЕ: 1000 -> 10000
    setTimeout(startAutoRefreshLoop, 10000);
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
        
        renderProductFilters(); 
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

// 2. Функция отрисовки кнопок продукции
function renderProductFilters() {
    const container = document.getElementById('productFilterContainer');
    const products = state.getProductCatalog();
    
    if (!container || !products) return;
    
    container.innerHTML = '';
    
    products.forEach(product => {
        const btn = document.createElement('div');
        btn.className = 'product-chip';
        // Если есть иконка, добавляем её
        const iconHtml = product.icon ? `<i class="${product.icon}"></i> ` : '';
        btn.innerHTML = `${iconHtml}${escapeHtml(product.name)}`;
        
        btn.addEventListener('click', () => {
            // Переключаем состояние
            state.toggleProductFilter(product.name);
            
            // Визуально меняем класс
            btn.classList.toggle('active');
            
            // Перерисовываем таблицу
            handleRenderOrders();
        });
        
        container.appendChild(btn);
    });
}

function setupEventListeners() {
    // --- Модальное окно ---
    ui.addOrderBtn?.addEventListener('click', () => {
        state.setCurrentEditingOrderId(null);
        ui.openOrderModal();
        isModalOpen = true; 
    });
    
    ui.closeModalBtn?.addEventListener('click', () => {
        ui.closeOrderModal();
        isModalOpen = false; 
    });
    ui.cancelBtn?.addEventListener('click', () => {
        ui.closeOrderModal();
        isModalOpen = false;
    });
    
    // Закрытие по ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isModalOpen) {
            ui.closeOrderModal();
            isModalOpen = false;
        }
    });

    ui.saveBtn?.addEventListener('click', handleSaveOrder);
    ui.orderForm?.addEventListener('submit', (e) => { e.preventDefault(); handleSaveOrder(); });
    ui.addItemBtn?.addEventListener('click', ui.addItemRow);

    ui.syncBtn?.addEventListener('click', handleSync);
    
    // --- Фильтры ---
    ui.showReadyBtn?.addEventListener('click', () => {
        ui.showReadyBtn.classList.toggle('active');
        if (ui.statusFilter) ui.statusFilter.value = 'all'; 
        handleRenderOrders();
    });

    ui.showInProgressBtn?.addEventListener('click', () => {
        ui.showInProgressBtn.classList.toggle('active');
        if (ui.statusFilter) ui.statusFilter.value = 'all';
        handleRenderOrders();
    });

    ui.showNotReadyBtn?.addEventListener('click', () => {
        ui.showNotReadyBtn.classList.toggle('active');
        if (ui.statusFilter) ui.statusFilter.value = 'all';
        handleRenderOrders();
    });

    ui.resetFiltersBtn?.addEventListener('click', () => {
    if (ui.searchInput) ui.searchInput.value = '';
    
    // Сброс кнопок статусов
    ui.showReadyBtn?.classList.remove('active');
    ui.showInProgressBtn?.classList.remove('active');
    ui.showNotReadyBtn?.classList.remove('active');
    
    // Сброс продукции
    state.clearProductFilters();
    // Визуальный сброс кнопок продукции
    document.querySelectorAll('.product-chip').forEach(chip => chip.classList.remove('active'));
    
    handleRenderOrders();
});

    ui.searchInput?.addEventListener('input', handleRenderOrders);
    ui.statusFilter?.addEventListener('change', () => {
        ui.showReadyBtn?.classList.remove('active');
        ui.showInProgressBtn?.classList.remove('active');
        ui.showNotReadyBtn?.classList.remove('active');
        handleRenderOrders();
    });
    ui.urgencyFilter?.addEventListener('change', handleRenderOrders);

    ui.notificationCloseBtn?.addEventListener('click', ui.closeNotification);
    
    // --- Делегирование кликов в таблице ---
    ui.ordersTableBody?.addEventListener('click', (e) => {
        handleTableClick(e);
        
        // Копирование имени клиента
        const copyTarget = e.target.closest('.copy-client');
        if (copyTarget) {
            const text = copyTarget.dataset.text;
            navigator.clipboard.writeText(text).then(() => {
                ui.showNotification('Скопировано', `Клиент "${text}" скопирован в буфер`, 'success');
            }).catch(err => {
                console.error('Ошибка копирования', err);
            });
        }
    });

    // Сортировка при клике на шапку
    const tableHead = document.querySelector('#ordersTable thead');
    tableHead?.addEventListener('click', (e) => {
        const th = e.target.closest('th.sortable');
        if (!th) return;

        const field = th.dataset.sort;
        const currentSort = state.getSortConfig();
        
        let newDirection = 'asc';
        if (currentSort.field === field && currentSort.direction === 'asc') {
            newDirection = 'desc';
        }

        state.setSortConfig(field, newDirection);
        updateSortIcons();
        handleRenderOrders();
    });

    setInterval(checkUrgentOrders, 300000); 
}

/**
 * Обновляет иконки стрелочек в шапке
 */
function updateSortIcons() {
    const currentSort = state.getSortConfig();
    const headers = document.querySelectorAll('th.sortable');
    
    headers.forEach(th => {
        const icon = th.querySelector('i');
        // Сброс всех иконок
        icon.className = 'fas fa-sort';
        icon.style.opacity = '0.3';
        
        if (th.dataset.sort === currentSort.field) {
            icon.style.opacity = '1';
            icon.className = currentSort.direction === 'asc' 
                ? 'fas fa-sort-up' 
                : 'fas fa-sort-down';
        }
    });
}

function handleRenderOrders() {
    const orders = state.getOrders();
    if (!orders) return;

    const searchTerm = ui.searchInput ? ui.searchInput.value.toLowerCase() : '';
    
    // Статусы
    const showReady = ui.showReadyBtn ? ui.showReadyBtn.classList.contains('active') : false;
    const showInProgress = ui.showInProgressBtn ? ui.showInProgressBtn.classList.contains('active') : false;
    const showNotReady = ui.showNotReadyBtn ? ui.showNotReadyBtn.classList.contains('active') : false;
    
    // Продукция (Множественный выбор)
    const selectedProducts = state.getSelectedProductFilters(); // ['Буклет', 'Китоб']
    
    let filteredOrders = orders.filter(order => {
        // 1. Поиск
        const matchesSearch = searchTerm === '' || 
            order.client.toLowerCase().includes(searchTerm) ||
            String(order.id).includes(searchTerm) || // Добавил поиск по ID
            order.items.some(item => item.name.toLowerCase().includes(searchTerm));
        
        // 2. Статус (Логика: Если ничего не выбрано = показываем всё. Если выбрано = фильтруем по ИЛИ)
        let matchesStatus = true;
        if (showReady || showInProgress || showNotReady) {
            matchesStatus = false;
            if (showReady && order.status === 'ready') matchesStatus = true;
            if (showInProgress && order.status === 'in-progress') matchesStatus = true;
            if (showNotReady && order.status === 'not-ready') matchesStatus = true;
        }

        // 3. Продукция (Логика: Если выбраны 'Буклет' и 'Китоб', показываем заказы, где ЕСТЬ ХОТЯ БЫ ОДИН из них)
        let matchesProduct = true;
        if (selectedProducts.length > 0) {
            // Проверяем, есть ли в заказе хоть один товар из списка выбранных
            matchesProduct = order.items.some(item => selectedProducts.includes(item.name));
        }
        
        return matchesSearch && matchesStatus && matchesProduct;
    });

    // 2. Сортировка
    const sortConfig = state.getSortConfig();
    
    filteredOrders.sort((a, b) => {
        let valA, valB;

        // Выбираем поле для сравнения
        if (sortConfig.field === 'id') {
            valA = a.id;
            valB = b.id;
        } else if (sortConfig.field === 'client') {
            valA = a.client.toLowerCase();
            valB = b.client.toLowerCase();
        } else if (sortConfig.field === 'status') {
            const statusWeight = { 'not-ready': 1, 'in-progress': 2, 'ready': 3 };
            valA = statusWeight[a.status] || 0;
            valB = statusWeight[b.status] || 0;
        } else {
            // По умолчанию (created_at)
            valA = new Date(a.created_at).getTime();
            valB = new Date(b.created_at).getTime();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
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
        const orderId = parseInt(statusSpan.dataset.orderId);
        const itemId = statusSpan.dataset.itemId ? parseInt(statusSpan.dataset.itemId) : null;
        const itemName = statusSpan.dataset.itemName;
        const itemQuantity = parseInt(statusSpan.dataset.itemQuantity);
        
        handleToggleItemStatus(orderId, itemId, itemName, itemQuantity);
        return;
    }
}

async function handleSync() {
    ui.showNotification('Синхронизация', 'Выгрузка данных в Google Таблицу...', 'info');
    try {
        await api.syncGoogleSheets();
        await initApp(); 
        ui.showNotification('Успешно', 'Данные сохранены в Google и обновлены!', 'success');
    } catch (error) {
        console.error(error);
        ui.showNotification('Ошибка', 'Не удалось выгрузить в Google. ' + error.message, 'error');
        await initApp();
    }
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
        
        const userIdToSend = responsibleUserId && responsibleUserId !== "" 
                             ? parseInt(responsibleUserId) 
                             : null;
        
        items.push({ 
            name: productName, 
            quantity, 
            status, 
            deadline, 
            comment,
            responsible_user_id: userIdToSend
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
        await api.saveOrder(orderData, orderId);
        ui.closeOrderModal();
        isModalOpen = false; 
        await initApp();
        ui.showNotification('Успешно', orderId ? 'Заказ обновлен' : 'Заказ создан', 'success');
    } catch (error) {
        console.error(error);
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
    
    const oldStatus = item.status;
    
    if (item.status === 'not-ready') item.status = 'in-progress';
    else if (item.status === 'in-progress') item.status = 'ready';
    else item.status = 'not-ready';

    handleRenderOrders();

    if (soundEnabled) playNotificationSound();

    const itemsForApi = order.items.map(i => ({
        id: i.id, 
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
        await api.saveOrder(orderData, orderId);
    } catch (error) {
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
            } 
            else if (deadlineDate.getTime() === tomorrow.getTime() && dayBeforeEnabled) {
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