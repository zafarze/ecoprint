// static/js/ui.js
// (Новый файл)

import { getProductCatalog, getUserCatalog, getCurrentEditingOrderId } from './state.js';
import { formatDate, getDaysUntilDeadline, getStatusText } from './utils.js';

// --- Поиск DOM-элементов ---
// Мы экспортируем их, чтобы app.js мог навесить на них события
export const ordersTableBody = document.getElementById('ordersTableBody');
export const emptyState = document.getElementById('emptyState');
export const orderModal = document.getElementById('orderModal');
export const modalTitle = document.getElementById('modalTitle');
export const orderForm = document.getElementById('orderForm');
export const itemsFormContainer = document.getElementById('itemsFormContainer');
export const notification = document.getElementById('notification');
export const notificationTitle = document.getElementById('notificationTitle');
export const notificationMessage = document.getElementById('notificationMessage');
export const notificationCloseBtn = document.getElementById('notificationCloseBtn');
export const itemsCount = document.getElementById('itemsCount');
export const readyCount = document.getElementById('readyCount');
export const addOrderBtn = document.getElementById('addOrderBtn');
export const closeModalBtn = document.getElementById('closeModalBtn');
export const cancelBtn = document.getElementById('cancelBtn');
export const saveBtn = document.getElementById('saveBtn');
export const addItemBtn = document.getElementById('addItemBtn');
export const syncBtn = document.getElementById('syncBtn');
export const showReadyBtn = document.getElementById('showReadyBtn');
export const showNotReadyBtn = document.getElementById('showNotReadyBtn');
export const resetFiltersBtn = document.getElementById('resetFiltersBtn');
export const searchInput = document.getElementById('searchInput');
export const statusFilter = document.getElementById('statusFilter');
export const urgencyFilter = document.getElementById('urgencyFilter');
export const avatarBtn = document.getElementById('avatarBtn');
export const profileDropdownMenu = document.getElementById('profileDropdownMenu');
export const menuToggleBtn = document.getElementById("menuToggleBtn");
export const sidebar = document.querySelector(".sidebar");
export const pageContainer = document.querySelector(".page-container");
export const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');

// --- Функции UI ---

/**
 * Главная функция отрисовки. "Рисует" таблицу заказов.
 */
export function renderOrders(filteredOrders) {
    
    // 1. Очистка таблицы
    ordersTableBody.innerHTML = '';
    
    if (filteredOrders.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    // 2. Рендеринг строк
    filteredOrders.forEach(order => {
        const itemCount = order.items.length;
        if (itemCount === 0) return; 

        // Сортировка
        const sortedItems = [...order.items].sort((a, b) => {
            const statusOrder = { 'not-ready': 0, 'in-progress': 1, 'ready': 2 };
            return statusOrder[a.status] - statusOrder[b.status];
        });

        // Ячейки
        const orderStatusHtml = `<span class="status-badge status-${order.status}">${getStatusText(order.status)}</span>`;
        
        // --- 👇 ИЗМЕНЕНИЕ: Добавлена кнопка Архива ---
        const actionsHtml = `
            <div class="actions">
                <button class="icon-btn edit-btn" data-id="${order.id}" title="Редактировать">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="icon-btn archive-btn" data-id="${order.id}" title="Архивировать">
                    <i class="fas fa-archive"></i>
                </button>
                <button class="icon-btn delete delete-btn" data-id="${order.id}" title="Удалить">
                    <i class="fas fa-trash"></i>
                </button>
            </div>`;
        // --- 👆 КОНЕЦ ИЗМЕНЕНИЯ ---

        // Ячейка "Товары"
        let itemsContainerHtml = '<div class="items-container">';
        
        sortedItems.forEach((item, index) => {
            let urgencyClass = '';
            const daysLeft = getDaysUntilDeadline(item.deadline);
            if (item.status !== 'ready') {
                if (daysLeft === 0) urgencyClass = 'item-very-urgent';
                else if (daysLeft === 1) urgencyClass = 'item-urgent';
            }

            const responsibleUser = item.responsible_user;
            const respName = (responsibleUser) 
                ? (responsibleUser.first_name || responsibleUser.last_name ? `${responsibleUser.first_name} ${responsibleUser.last_name}`.trim() : responsibleUser.username) 
                : 'N/A';
            
            itemsContainerHtml += `
                <div class="item-row-card ${urgencyClass}">
                
                    <span class="item-number">${index + 1}</span>
                    
                    <div class="item-content-row">
                        <span class="item-name">${item.name}</span>
                        <span class="item-quantity">${item.quantity} шт.</span>
                        <div class="item-deadline">
                            <i class="fas fa-calendar-alt"></i>
                            ${formatDate(item.deadline)}
                        </div>
                        <div class="item-creator">
                            <i class="fas fa-user"></i>
                            <span>${respName}</span>
                        </div>
                    </div>
                    
                    <span class="item-status ${item.status}" 
                          data-order-id="${order.id}"
                          data-item-id="${item.id}" 
                          data-item-name="${item.name}" 
                          data-item-quantity="${item.quantity}">
                        ${getStatusText(item.status)}
                    </span>
                    
                    ${item.comment ? `<div class="item-comment-display"><i class="fas fa-comment-alt"></i><div>${item.comment}</div></div>` : ''}
                    
                </div>
            `;
        });
        
        itemsContainerHtml += '</div>';

        // Собираем ГЛАВНУЮ строку `<tr>`
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${order.id}</td>
            <td><strong>${order.client}</strong></td>
            <td class="items-cell">${itemsContainerHtml}</td>
            <td>${orderStatusHtml}</td>
            <td>${actionsHtml}</td>
        `;
        ordersTableBody.appendChild(row);
    });
}

/**
 * Обновляет активную быструю кнопку фильтра.
 */
export function updateQuickFilterButtons(activeFilter) {
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (activeFilter === 'ready') {
        if (showReadyBtn) showReadyBtn.classList.add('active');
    } else if (activeFilter === 'not-ready') {
        if (showNotReadyBtn) showNotReadyBtn.classList.add('active');
    } else if (activeFilter === 'all') {
        if (resetFiltersBtn) resetFiltersBtn.classList.add('active');
    }
}

/**
 * Открывает модальное окно (для создания или редактирования).
 */
export function openOrderModal(orderToEdit = null) {
    const today = new Date().toISOString().split('T')[0];
    
    if (orderToEdit) {
        // Редактирование
        modalTitle.textContent = 'Редактировать заказ';
        document.getElementById('clientName').value = orderToEdit.client;
        
        itemsFormContainer.innerHTML = '';
        orderToEdit.items.forEach((item, index) => {
            const respId = item.responsible_user ? item.responsible_user.id : null;
            
            const itemCard = createItemFormCard(
                item.name, item.quantity, item.status, item.deadline, 
                index + 1, respId, item.comment
            );
            itemsFormContainer.appendChild(itemCard);
        });
    } else {
        // Создание
        modalTitle.textContent = 'Новый заказ';
        orderForm.reset();
        itemsFormContainer.innerHTML = '';
        
        const currentUserId = (typeof CURRENT_USER_ID !== 'undefined') ? CURRENT_USER_ID : null;
        
        const firstItem = createItemFormCard(
            '', 1, 'not-ready', today, 1,
            currentUserId, // Автоматически ставим создателя
            '' 
        );
        itemsFormContainer.appendChild(firstItem);
    }
    
    updateOrderSummary();
    orderModal.classList.add('active');
}

/**
 * Закрывает модальное окно.
 */
export function closeOrderModal() {
    orderModal.classList.remove('active');
}

/**
 * Добавляет новую карточку товара в модальное окно.
 */
export function addItemRow() {
    const itemCount = itemsFormContainer.children.length + 1;
    const today = new Date().toISOString().split('T')[0];
    const currentUserId = (typeof CURRENT_USER_ID !== 'undefined') ? CURRENT_USER_ID : null;
    
    const itemCard = createItemFormCard(
        '', 1, 'not-ready', today, itemCount,
        currentUserId, // Автоматически ставим создателя
        '' 
    );
    itemsFormContainer.appendChild(itemCard);
    updateOrderSummary();
}

/**
 * Создает HTML-узел (карточку) для одного товара в модальном окне.
 */
function createItemFormCard(name, quantity, status, deadline, itemNumber, responsibleUserId, comment = '') {
    const template = document.getElementById('itemFormTemplate');
    const itemCard = template.content.cloneNode(true).firstElementChild;
    
    // Находим элементы
    const badge = itemCard.querySelector('.item-number');
    const productInput = itemCard.querySelector('.product-name-input');
    const productTypeBtn = itemCard.querySelector('.product-type-btn');
    const productSuggestions = itemCard.querySelector('.product-suggestions');
    const quantityInput = itemCard.querySelector('.item-quantity');
    const deadlineInput = itemCard.querySelector('.item-deadline-input');
    const statusSelect = itemCard.querySelector('.item-status-select');
    const removeBtn = itemCard.querySelector('.remove-item-btn');
    const itemResponsibleSelect = itemCard.querySelector('.item-responsible-user');
    const commentInput = itemCard.querySelector('.item-comment'); 

    badge.textContent = itemNumber;
    productInput.value = name;

    // Заполняем список подсказок
    const productCatalog = getProductCatalog();
    productCatalog.forEach(product => {
        const suggestion = document.createElement('div');
        suggestion.className = 'product-suggestion';
        suggestion.innerHTML = `<i class="${product.icon || 'fas fa-box'}"></i><span>${product.name}</span>`;
        
        suggestion.addEventListener('click', () => {
            productInput.value = product.name;
            productSuggestions.style.display = 'none';
            productTypeBtn.innerHTML = '<i class="fas fa-list"></i> Выбрать из списка';
        });
        productSuggestions.appendChild(suggestion);
    });

    // Кнопка "Выбрать из списка"
    productTypeBtn.addEventListener('click', () => {
        if (productSuggestions.style.display === 'none') {
            productSuggestions.style.display = 'grid';
            productTypeBtn.innerHTML = '<i class="fas fa-times"></i> Скрыть список';
        } else {
            productSuggestions.style.display = 'none';
            productTypeBtn.innerHTML = '<i class="fas fa-list"></i> Выбрать из списка';
        }
    });

    // Заполняем "Создателя"
    const userCatalog = getUserCatalog();
    itemResponsibleSelect.innerHTML = ''; // Очищаем "-- Загрузка... --"
    userCatalog.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        
        const displayName = (user.first_name || user.last_name) 
            ? `${user.first_name} ${user.last_name}`.trim() 
            : user.username;
        option.textContent = displayName;
        
        if (user.id === responsibleUserId) {
            option.selected = true;
        }
        itemResponsibleSelect.appendChild(option);
    });
    
    itemResponsibleSelect.value = responsibleUserId;
    itemResponsibleSelect.disabled = true; 
    
    // Заполняем остальные поля
    quantityInput.value = quantity;
    deadlineInput.value = deadline;
    statusSelect.value = status;
    commentInput.value = comment; 
    
    const today = new Date().toISOString().split('T')[0];
    deadlineInput.setAttribute('min', today);

    if (itemNumber > 1) {
        removeBtn.style.display = 'block';
    }

    // Вешаем обработчики (только для модального окна)
    statusSelect.addEventListener('change', updateOrderSummary);
    
    removeBtn.addEventListener('click', () => {
        if (itemsFormContainer.children.length > 1) {
            itemCard.remove();
            updateItemNumbers();
            updateOrderSummary();
        } else {
            showNotification('Ошибка', 'Нужно добавить хотя бы один товар', 'error');
        }
    });
    
    return itemCard;
}

/**
 * Обновляет номера товаров (1, 2, 3...) в модальном окне.
 */
export function updateItemNumbers() {
    const itemCards = itemsFormContainer.querySelectorAll('.item-form-card');
    itemCards.forEach((card, index) => {
        const badge = card.querySelector('.item-number');
        badge.textContent = index + 1;
    });
}

/**
 * Обновляет счетчики "Товаров: X" / "Готово: Y" в модальном окне.
 */
export function updateOrderSummary() {
    const itemCards = itemsFormContainer.querySelectorAll('.item-form-card');
    const totalItems = itemCards.length;
    let readyItems = 0;
    
    itemCards.forEach(card => {
        const status = card.querySelector('.item-status-select').value;
        if (status === 'ready') {
            readyItems++;
        }
    });
    
    itemsCount.textContent = totalItems;
    readyCount.textContent = readyItems;
}

/**
 * Показывает всплывающее уведомление.
 */
export function showNotification(title, message, type = 'info') {
    if (!notificationTitle || !notification) return; 
    
    notificationTitle.textContent = title;
    notificationMessage.textContent = message;
    notification.className = 'notification show ' + type;
    const icon = notification.querySelector('.notification-icon i');
    if (icon) {
        icon.className = type === 'success' ? 'fas fa-check-circle' : 
                       type === 'warning' ? 'fas fa-exclamation-triangle' : 
                       type === 'error' ? 'fas fa-times-circle' : 
                       'fas fa-info-circle';
    }
}

/**
 * Закрывает всплывающее уведомление.
 */
export function closeNotification() {
    if (notification) { 
        notification.classList.remove('show');
    }
}