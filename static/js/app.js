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
    // Берем полный справочник, чтобы знать иконки
    const fullCatalog = state.getProductCatalog();
    // Берем ВСЕ текущие загруженные заказы
    const allOrders = state.getOrders();
    
    if (!container || !fullCatalog || !allOrders) return;
    
    // 1. Собираем список имен товаров, которые ЕСТЬ в активных заказах
    const activeProductNames = new Set();
    allOrders.forEach(order => {
        // Проверяем, не в архиве ли (если нужно), но state.getOrders обычно возвращает активные
        order.items.forEach(item => {
            activeProductNames.add(item.name);
        });
    });

    // 2. Фильтруем каталог: оставляем только те, что нашли выше
    const visibleProducts = fullCatalog.filter(product => activeProductNames.has(product.name));
    
    // Очищаем контейнер
    container.innerHTML = '';
    
    if (visibleProducts.length === 0) {
        container.innerHTML = '<span style="color:#9ca3af; font-size:0.9em;">Нет активных категорий</span>';
        return;
    }

    // 3. Рисуем кнопки
    visibleProducts.forEach(product => {
        const btn = document.createElement('div');
        btn.className = 'product-chip';
        // Если этот фильтр уже был выбран ранее - подсвечиваем его
        if (state.getSelectedProductFilters().includes(product.name)) {
            btn.classList.add('active');
        }

        const iconHtml = product.icon ? `<i class="${product.icon}"></i> ` : '';
        btn.innerHTML = `${iconHtml}${escapeHtml(product.name)}`;
        
        btn.addEventListener('click', () => {
            state.toggleProductFilter(product.name);
            btn.classList.toggle('active');
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
    
    const selectedProducts = state.getSelectedProductFilters(); 
    
    // 1. ФИЛЬТРАЦИЯ
    let filteredOrders = orders.filter(order => {
        // Поиск
        const matchesSearch = searchTerm === '' || 
            order.client.toLowerCase().includes(searchTerm) ||
            String(order.id).includes(searchTerm) ||
            order.items.some(item => item.name.toLowerCase().includes(searchTerm));
        
        // Статус
        let matchesStatus = true;
        // Если хоть одна кнопка нажата, включаем фильтр. Если ни одной - показываем всё.
        if (showReady || showInProgress || showNotReady) {
            matchesStatus = false;
            if (showReady && order.status === 'ready') matchesStatus = true;
            if (showInProgress && order.status === 'in-progress') matchesStatus = true;
            if (showNotReady && order.status === 'not-ready') matchesStatus = true;
        }

        // Продукция
        let matchesProduct = true;
        if (selectedProducts.length > 0) {
            matchesProduct = order.items.some(item => selectedProducts.includes(item.name));
        }
        
        return matchesSearch && matchesStatus && matchesProduct;
    });

    // 2. СОРТИРОВКА (ИЗМЕНЕНО ПО ТВОЕЙ ПРОСЬБЕ)
    const sortConfig = state.getSortConfig();
    
    // Вспомогательная функция: найти самый ранний дедлайн в заказе
    const getEarliestDeadline = (order) => {
        if (!order.items || order.items.length === 0) return 9999999999999;
        // Берем минимальную дату из всех товаров заказа
        return Math.min(...order.items.map(i => i.deadline ? new Date(i.deadline).getTime() : 9999999999999));
    };

    filteredOrders.sort((a, b) => {
        // Если пользователь нажал сортировку в шапке таблицы (например, по ID или Клиенту)
        if (sortConfig.field !== 'default') {
            let valA = a[sortConfig.field];
            let valB = b[sortConfig.field];
            
            // Спец. обработка для статусов при ручной сортировке
            if (sortConfig.field === 'status') {
                // При ручной сортировке просто группируем, логика ниже важнее для дефолта
                const w = { 'in-progress': 1, 'not-ready': 2, 'ready': 3 };
                valA = w[a.status] || 99;
                valB = w[b.status] || 99;
            }

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        }

        // --- ДЕФОЛТНАЯ СОРТИРОВКА (УМНАЯ) ---
        
        // 1. Приоритет Статуса: В процессе -> Не готов -> Готов
        const statusWeight = { 
            'in-progress': 10,  // Самый важный (сверху)
            'not-ready': 20,    // Потом не готовые
            'ready': 30         // В самом низу готовые
        };
        
        const weightA = statusWeight[a.status] || 99;
        const weightB = statusWeight[b.status] || 99;

        if (weightA !== weightB) {
            return weightA - weightB; // Сортируем по весу (меньше вес = выше)
        }

        // 2. Внутри одного статуса сортируем по СРОЧНОСТИ (Deadline)
        // Чем меньше дата (ближе срок), тем выше заказ
        const deadlineA = getEarliestDeadline(a);
        const deadlineB = getEarliestDeadline(b);

        return deadlineA - deadlineB;
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