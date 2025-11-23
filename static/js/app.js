// D:\Projects\EcoPrint\static\js\app.js
// (ПОЛНАЯ ВЕРСИЯ С МУЛЬТИ-ФИЛЬТРАЦИЕЙ И МГНОВЕННЫМ ОБНОВЛЕНИЕМ)

import * as state from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { getDaysUntilDeadline, playNotificationSound } from './utils.js';

// Получаем настройки пользователя (передаются из HTML)
const soundEnabled = window.USER_SETTINGS.soundEnabled;
const popupEnabled = window.USER_SETTINGS.popupEnabled;
const dayBeforeEnabled = window.USER_SETTINGS.dayBeforeEnabled;

// Флаг: если открыто окно, мы не обновляем таблицу, чтобы не сбить фокус ввода
let isModalOpen = false;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    
    // 👇 ЗАПУСКАЕМ БЫСТРЫЙ ЦИКЛ ОБНОВЛЕНИЯ (каждую 1 сек)
    startAutoRefreshLoop();
});

/**
 * Умный цикл обновления.
 * Используем setTimeout вместо setInterval, чтобы запросы не наслаивались друг на друга.
 */
async function startAutoRefreshLoop() {
    // 1. Если модальное окно закрыто - обновляем данные
    if (!isModalOpen) {
        try {
            // Загружаем заказы "тихо" (без блокировки экрана)
            const orders = await api.fetchOrders();
            
            // Обновляем состояние
            state.setOrders(orders);
            // Перерисовываем таблицу (фильтры применятся автоматически)
            handleRenderOrders();
            
        } catch (e) {
            // Ошибки в консоль (тихо), чтобы не пугать юзера
            console.warn("Auto-refresh skipped:", e);
        }
    }

    // 2. Запускаем следующий цикл через 1 секунду (1000 мс)
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
    
    // Устанавливаем минимальную дату для полей ввода (сегодня)
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.setAttribute('min', today);
    });
    
    resetNotificationTracking();
}

function setupEventListeners() {
    // --- Модальное окно (Создание/Редактирование) ---
    ui.addOrderBtn?.addEventListener('click', () => {
        state.setCurrentEditingOrderId(null);
        ui.openOrderModal();
        isModalOpen = true; // БЛОКИРУЕМ авто-обновление
    });
    
    ui.closeModalBtn?.addEventListener('click', () => {
        ui.closeOrderModal();
        isModalOpen = false; // РАЗРЕШАЕМ авто-обновление
    });
    ui.cancelBtn?.addEventListener('click', () => {
        ui.closeOrderModal();
        isModalOpen = false;
    });
    
    ui.saveBtn?.addEventListener('click', handleSaveOrder);
    ui.orderForm?.addEventListener('submit', (e) => { e.preventDefault(); handleSaveOrder(); });
    ui.addItemBtn?.addEventListener('click', ui.addItemRow);

    // --- Кнопка Синхронизации ---
    ui.syncBtn?.addEventListener('click', handleSync);
    
    // --- 👇 ОБРАБОТЧИКИ КНОПОК ФИЛЬТРОВ (МУЛЬТИ-ВЫБОР) 👇 ---
    
    // Кнопка "Готово"
    ui.showReadyBtn?.addEventListener('click', () => {
        // Тогглим (переключаем) класс active
        ui.showReadyBtn.classList.toggle('active');
        // Сбрасываем старый выпадающий список в "Все"
        if (ui.statusFilter) ui.statusFilter.value = 'all'; 
        handleRenderOrders();
    });

    // Кнопка "В процессе"
    ui.showInProgressBtn?.addEventListener('click', () => {
        ui.showInProgressBtn.classList.toggle('active');
        if (ui.statusFilter) ui.statusFilter.value = 'all';
        handleRenderOrders();
    });

    // Кнопка "Не готово"
    ui.showNotReadyBtn?.addEventListener('click', () => {
        ui.showNotReadyBtn.classList.toggle('active');
        if (ui.statusFilter) ui.statusFilter.value = 'all';
        handleRenderOrders();
    });

    // Кнопка "Сбросить фильтры"
    ui.resetFiltersBtn?.addEventListener('click', () => {
        // Очищаем поиск и фильтры
        if (ui.searchInput) ui.searchInput.value = '';
        if (ui.statusFilter) ui.statusFilter.value = 'all';
        if (ui.urgencyFilter) ui.urgencyFilter.value = 'all';
        
        // Снимаем активность со всех кнопок
        ui.showReadyBtn?.classList.remove('active');
        ui.showInProgressBtn?.classList.remove('active');
        ui.showNotReadyBtn?.classList.remove('active');
        
        handleRenderOrders();
    });
    // --- 👆 КОНЕЦ БЛОКА ФИЛЬТРОВ 👆 ---

    // Остальные фильтры (Поиск, Выпадающие списки)
    ui.searchInput?.addEventListener('input', handleRenderOrders);
    
    // Если пользователь все-таки использует выпадающий список "Статус",
    // сбрасываем кнопки быстрого фильтра, чтобы не путать логику
    ui.statusFilter?.addEventListener('change', () => {
        ui.showReadyBtn?.classList.remove('active');
        ui.showInProgressBtn?.classList.remove('active');
        ui.showNotReadyBtn?.classList.remove('active');
        handleRenderOrders();
    });
    
    ui.urgencyFilter?.addEventListener('change', handleRenderOrders);

    // Уведомления
    ui.notificationCloseBtn?.addEventListener('click', ui.closeNotification);
    
    // Таблица (Делегирование событий клика на всю таблицу)
    ui.ordersTableBody?.addEventListener('click', handleTableClick);

    // Проверка сроков каждые 5 минут
    setInterval(checkUrgentOrders, 300000); 
}

/**
 * Главная функция фильтрации и отрисовки.
 * Реализует логику "Мульти-фильтра" (ИЛИ).
 */
function handleRenderOrders() {
    const orders = state.getOrders();
    // Если orders еще не загрузились (null/undefined), выходим
    if (!orders) return;

    const searchTerm = ui.searchInput ? ui.searchInput.value.toLowerCase() : '';
    
    // 1. Проверяем, какие кнопки фильтров нажаты (активны)
    const showReady = ui.showReadyBtn ? ui.showReadyBtn.classList.contains('active') : false;
    const showInProgress = ui.showInProgressBtn ? ui.showInProgressBtn.classList.contains('active') : false;
    const showNotReady = ui.showNotReadyBtn ? ui.showNotReadyBtn.classList.contains('active') : false;
    
    // 2. Собираем список разрешенных статусов
    let allowedStatuses = [];
    
    // Если хоть одна кнопка нажата, добавляем соответствующие статусы в "белый список"
    if (showReady || showInProgress || showNotReady) {
        if (showReady) allowedStatuses.push('ready');
        if (showInProgress) allowedStatuses.push('in-progress');
        if (showNotReady) allowedStatuses.push('not-ready');
    } else {
        // Если НИ ОДНА кнопка не нажата — разрешаем ВСЕ статусы (поведение по умолчанию)
        allowedStatuses = ['ready', 'in-progress', 'not-ready'];
    }

    // Учитываем выпадающий список, если кнопки не активны (резервный вариант)
    const statusSelectValue = ui.statusFilter ? ui.statusFilter.value : 'all';
    const urgencyValue = ui.urgencyFilter ? ui.urgencyFilter.value : 'all';
    
    const filteredOrders = orders.filter(order => {
        // А. Фильтр Поиска
        const matchesSearch = searchTerm === '' || 
            order.client.toLowerCase().includes(searchTerm) ||
            order.items.some(item => item.name.toLowerCase().includes(searchTerm));
        
        // Б. Фильтр Статуса
        // Логика: Либо статус входит в список кнопок, 
        // Либо (если кнопки не нажаты) он совпадает с выпадающим списком 'all'
        let matchesStatus = allowedStatuses.includes(order.status);
        
        // Если кнопки выключены, но выбран статус в <select>, проверяем его
        if (!showReady && !showInProgress && !showNotReady && statusSelectValue !== 'all') {
            matchesStatus = (order.status === statusSelectValue);
        }
        
        // В. Фильтр Срочности
        let matchesUrgency = urgencyValue === 'all';
        if (urgencyValue !== 'all') {
            matchesUrgency = order.items.some(item => {
                if (item.status === 'ready') return false; // Готовые не считаем срочными
                const daysUntilDeadline = getDaysUntilDeadline(item.deadline);
                
                if (urgencyValue === 'urgent') {
                    // Срочно: Сегодня (0) или Завтра (1) или Просрочено (<0)
                    return daysUntilDeadline <= 1;
                } else if (urgencyValue === 'very-urgent') {
                    // Очень срочно: Сегодня или Просрочено
                    return daysUntilDeadline <= 0;
                }
                return false;
            });
        }
        
        // ВСЕ условия должны совпасть
        return matchesSearch && matchesStatus && matchesUrgency;
    });
    
    ui.renderOrders(filteredOrders);
}

function handleTableClick(e) {
    // 1. Кнопка "Редактировать"
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
        const orderId = parseInt(editBtn.dataset.id);
        handleEditOrder(orderId);
        return;
    }
    
    // 2. Кнопка "Архив"
    const archiveBtn = e.target.closest('.archive-btn');
    if (archiveBtn) {
        const orderId = parseInt(archiveBtn.dataset.id);
        handleArchiveOrder(orderId);
        return;
    }

    // 3. Кнопка "Удалить"
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        const orderId = parseInt(deleteBtn.dataset.id);
        handleDeleteOrder(orderId);
        return;
    }

    // 4. Клик по статусу товара (быстрая смена)
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
    // 1. Показываем уведомление о начале
    ui.showNotification('Синхронизация', 'Выгрузка данных в Google Таблицу...', 'info');
    
    try {
        // 2. Сначала отправляем данные в Google
        await api.syncGoogleSheets();
        
        // 3. Затем обновляем данные на экране (как раньше)
        await initApp(); 
        
        ui.showNotification('Успешно', 'Данные сохранены в Google и обновлены!', 'success');
        
    } catch (error) {
        console.error(error);
        ui.showNotification('Ошибка', 'Не удалось выгрузить в Google. ' + error.message, 'error');
        
        // Даже если Google упал, попробуем обновить локальные данные
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
        
        // Если responsibleUserId пустой, отправляем null
        const userIdToSend = responsibleUserId && responsibleUserId !== "" 
                             ? parseInt(responsibleUserId) 
                             : null;
        
        // Получаем ID товара (если это редактирование старого товара)
        // Мы можем хранить ID товара в data-атрибуте карточки, но для простоты
        // бэкенд сам разберется по логике "обновления" в сериализаторе.
        // Если нужно точное обновление конкретного ID, его нужно передавать.
        
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
        // Отправляем на сервер
        await api.saveOrder(orderData, orderId);
        
        ui.closeOrderModal();
        isModalOpen = false; 
        
        // Сразу же обновляем данные
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
        isModalOpen = true; // Блокируем обновление фона
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

/**
 * Логика быстрого переключения статуса при клике на бейдж.
 */
async function handleToggleItemStatus(orderId, itemId, itemName, itemQuantity) {
    const order = state.getOrders().find(o => o.id === orderId);
    if (!order) return;

    // Ищем товар по ID или по имени (для совместимости)
    const item = itemId 
        ? order.items.find(i => i.id === itemId)
        : order.items.find(i => i.name === itemName && i.quantity === itemQuantity);
    
    if (!item) return;
    
    // 1. Оптимистичное обновление (меняем в UI сразу для скорости)
    const oldStatus = item.status;
    
    // Циклическое переключение: Not Ready -> In Progress -> Ready -> Not Ready
    if (item.status === 'not-ready') item.status = 'in-progress';
    else if (item.status === 'in-progress') item.status = 'ready';
    else item.status = 'not-ready';

    // Перерисовываем таблицу с новым статусом немедленно
    handleRenderOrders();

    if (soundEnabled) playNotificationSound();

    // 2. Готовим данные для отправки всего заказа
    // (Django требует отправки всего списка items_write при обновлении через Nested Serializer)
    const itemsForApi = order.items.map(i => ({
        id: i.id, // Важно передать ID, чтобы бэкенд обновил, а не создал дубль
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
        
        // Успех! Данные в базе обновлены.
        // Другие клиенты увидят это через 1 сек благодаря startAutoRefreshLoop.
        
    } catch (error) {
        // Если ошибка - откатываем статус назад
        item.status = oldStatus;
        handleRenderOrders();
        ui.showNotification('Ошибка', 'Не удалось обновить статус', 'error');
    }
}

/**
 * Проверка срочных заказов для показа всплывающих уведомлений.
 */
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

/**
 * Сброс трекера уведомлений в полночь (чтобы завтра снова показать уведомления).
 */
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