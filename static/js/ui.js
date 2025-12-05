// D:\Projects\EcoPrint\static\js\ui.js
// (ВЕРСИЯ С XSS ЗАЩИТОЙ)

import { getProductCatalog, getUserCatalog } from './state.js';
// 👇 Импортируем новую функцию
import { formatDate, getDaysUntilDeadline, getStatusText, escapeHtml } from './utils.js';


// --- 1. Поиск DOM-элементов ---
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
export const showInProgressBtn = document.getElementById('showInProgressBtn');
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

export function renderOrders(filteredOrders) {
    if (!ordersTableBody) return;

    ordersTableBody.innerHTML = '';
    
    if (filteredOrders.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';

    // Получаем права доступа из глобальной переменной (из HTML)
    const canDelete = window.USER_PERMISSIONS && window.USER_PERMISSIONS.is_superuser;
    
    // Добавили index вторым аргументом для нумерации 1, 2, 3...
    filteredOrders.forEach((order, index) => {
        const itemCount = order.items.length;
        if (itemCount === 0) return; 

        // Считаем порядковый номер строки
        const rowNumber = index + 1;

        const sortedItems = [...order.items].sort((a, b) => {
            const statusOrder = { 'not-ready': 0, 'in-progress': 1, 'ready': 2 };
            return statusOrder[a.status] - statusOrder[b.status];
        });

        const orderStatusHtml = `<span class="status-badge status-${order.status}">${getStatusText(order.status)}</span>`;
        
        // Логика кнопки удаления: Рисуем только Админу
        let deleteBtnHtml = '';
        if (canDelete) {
            deleteBtnHtml = `<button class="icon-btn delete delete-btn" data-id="${order.id}" title="Удалить"><i class="fas fa-trash"></i></button>`;
        }

        const actionsHtml = `
            <div class="actions">
                <button class="icon-btn edit-btn" data-id="${order.id}" title="Редактировать"><i class="fas fa-edit"></i></button>
                <button class="icon-btn archive-btn" data-id="${order.id}" title="Архивировать"><i class="fas fa-archive"></i></button>
                ${deleteBtnHtml}
            </div>`;

        let itemsContainerHtml = '<div class="items-container">';
        
        sortedItems.forEach((item, index) => {
            let urgencyClass = '';
            const daysLeft = getDaysUntilDeadline(item.deadline);
            
            if (item.status !== 'ready') {
                if (daysLeft <= 0) urgencyClass = 'item-very-urgent';
                else if (daysLeft === 1) urgencyClass = 'item-urgent';
            }

            // Имя ответственного тоже лучше экранировать на всякий случай
            const responsibleUser = item.responsible_user;
            const respName = (responsibleUser) 
                ? (responsibleUser.first_name || responsibleUser.last_name ? `${responsibleUser.first_name} ${responsibleUser.last_name}`.trim() : responsibleUser.username) 
                : 'Не назначен';
            
            const startDate = formatDate(order.created_at);
            const endDate = formatDate(item.deadline);

            // 👇 ЗДЕСЬ ПРИМЕНЯЕМ escapeHtml К ДАННЫМ ПОЛЬЗОВАТЕЛЯ
            itemsContainerHtml += `
                <div class="item-row-card ${urgencyClass}">
                    <span class="item-number">${index + 1}</span>
                    
                    <div class="item-content-row">
                        <span class="item-name">${escapeHtml(item.name)}</span>
                        <span class="item-quantity">${item.quantity} шт.</span>
                        
                        <div class="item-dates-wrapper" style="display: flex; flex-direction: column; font-size: 0.85rem; line-height: 1.2; color: #555;">
                            <div title="Дата создания">
                                <i class="fas fa-play-circle" style="color: #9ca3af; font-size: 0.8em;"></i> ${startDate}
                            </div>
                            <div title="Срок сдачи" style="font-weight: 500;">
                                <i class="fas fa-flag-checkered" style="color: #ef4444; font-size: 0.8em;"></i> ${endDate}
                            </div>
                        </div>
                        <div class="item-creator">
                            <i class="fas fa-user"></i>
                            <span>${escapeHtml(respName)}</span>
                        </div>
                    </div>
                    
                    <span class="item-status ${item.status}" 
                          data-order-id="${order.id}"
                          data-item-id="${item.id}" 
                          data-item-name="${escapeHtml(item.name)}" 
                          data-item-quantity="${item.quantity}"
                          title="Нажмите, чтобы изменить статус">
                        ${getStatusText(item.status)}
                    </span>
                    
                    ${item.comment ? `<div class="item-comment-display"><i class="fas fa-comment-alt"></i><div>${escapeHtml(item.comment)}</div></div>` : ''}
                </div>
            `;
        });
        
        itemsContainerHtml += '</div>';

        // 👇 ФОРМИРУЕМ СТРОКУ ТАБЛИЦЫ
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <span style="font-weight:bold; color:#6b7280;">#${rowNumber}</span>
                <div style="font-size:10px; color:#9ca3af;">ID:${order.id}</div>
            </td>
            <td>
                <strong class="copy-client" 
                        data-text="${escapeHtml(order.client)}" 
                        style="cursor: pointer; border-bottom: 1px dashed #ccc;" 
                        title="Нажмите, чтобы скопировать">
                    ${escapeHtml(order.client)}
                </strong>
            </td>
            <td class="items-cell">${itemsContainerHtml}</td>
            <td>${orderStatusHtml}</td>
            <td>${actionsHtml}</td>
        `;
        ordersTableBody.appendChild(row);
    });
}
// --- 3. Функции Модального окна ---

/**
 * Открывает модальное окно (для создания или редактирования).
 */
export function openOrderModal(orderToEdit = null) {
    const today = new Date().toISOString().split('T')[0];
    const historyContainer = document.getElementById('historyContainer'); 
    
    if (orderToEdit) {
        // --- РЕЖИМ РЕДАКТИРОВАНИЯ ---
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

        // Заполнение истории
        if (historyContainer) {
            historyContainer.innerHTML = ''; 
            
            if (orderToEdit.history && orderToEdit.history.length > 0) {
                orderToEdit.history.forEach(record => {
                    const row = document.createElement('div');
                    row.style.marginBottom = '8px';
                    row.style.borderBottom = '1px solid #e0e0e0';
                    row.style.paddingBottom = '4px';
                    
                    // Сообщение истории и имя юзера тоже экранируем
                    row.innerHTML = `
                        <div style="color: #6b7280; font-size: 0.75rem; margin-bottom: 2px;">
                            <i class="far fa-clock"></i> ${record.created_at_formatted} • <strong>${escapeHtml(record.user_name)}</strong>
                        </div>
                        <div style="color: #374151;">${escapeHtml(record.message)}</div>
                    `;
                    historyContainer.appendChild(row);
                });
            } else {
                historyContainer.innerHTML = '<div style="color: #9ca3af; font-style: italic; text-align: center;">История изменений пуста</div>';
            }
        }

    } else {
        // --- РЕЖИМ СОЗДАНИЯ ---
        modalTitle.textContent = 'Новый заказ';
        orderForm.reset();
        itemsFormContainer.innerHTML = '';
        
        const currentUserId = (typeof CURRENT_USER_ID !== 'undefined') ? CURRENT_USER_ID : null;
        
        const firstItem = createItemFormCard(
            '', 1, 'not-ready', today, 1,
            currentUserId, 
            '' 
        );
        itemsFormContainer.appendChild(firstItem);

        if (historyContainer) {
            historyContainer.innerHTML = '<div style="color: #9ca3af; text-align: center;">Новый заказ (история появится после сохранения)</div>';
        }
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
 * Добавляет новую пустую строку товара.
 */
export function addItemRow() {
    const itemCount = itemsFormContainer.children.length + 1;
    const today = new Date().toISOString().split('T')[0];
    const currentUserId = (typeof CURRENT_USER_ID !== 'undefined') ? CURRENT_USER_ID : null;
    
    const itemCard = createItemFormCard(
        '', 1, 'not-ready', today, itemCount,
        currentUserId, 
        '' 
    );
    itemsFormContainer.appendChild(itemCard);
    updateOrderSummary();
    updateItemNumbers(); 
}

/**
 * Создает DOM-элемент карточки товара для формы.
 */
function createItemFormCard(name, quantity, status, deadline, itemNumber, responsibleUserId, comment = '') {
    const template = document.getElementById('itemFormTemplate');
    const itemCard = template.content.cloneNode(true).firstElementChild;
    
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

    // 1. Автозаполнение (Товары)
    const productCatalog = getProductCatalog();
    if (productCatalog && productCatalog.length > 0) {
        productCatalog.forEach(product => {
            const suggestion = document.createElement('div');
            suggestion.className = 'product-suggestion';
            // 👇 И ЗДЕСЬ ТОЖЕ ЗАЩИТА (Название товара из справочника)
            suggestion.innerHTML = `<i class="${escapeHtml(product.icon) || 'fas fa-box'}"></i><span>${escapeHtml(product.name)}</span>`;
            
            suggestion.addEventListener('click', () => {
                productInput.value = product.name;
                productSuggestions.style.display = 'none';
                productTypeBtn.innerHTML = '<i class="fas fa-list"></i> Выбрать из списка';
            });
            productSuggestions.appendChild(suggestion);
        });
    } else {
        productTypeBtn.style.display = 'none';
    }

    productTypeBtn.addEventListener('click', () => {
        if (productSuggestions.style.display === 'none' || !productSuggestions.style.display) {
            productSuggestions.style.display = 'grid';
            productTypeBtn.innerHTML = '<i class="fas fa-times"></i> Скрыть список';
        } else {
            productSuggestions.style.display = 'none';
            productTypeBtn.innerHTML = '<i class="fas fa-list"></i> Выбрать из списка';
        }
    });

    // 2. Выбор ответственного (Users)
    const userCatalog = getUserCatalog();
    itemResponsibleSelect.innerHTML = ''; 
    
    if (userCatalog && userCatalog.length > 0) {
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
    } else {
        const option = document.createElement('option');
        option.textContent = "Нет пользователей";
        itemResponsibleSelect.appendChild(option);
    }
    
    if (responsibleUserId) {
        itemResponsibleSelect.value = responsibleUserId;
    }
    
    itemResponsibleSelect.disabled = true; 
    
    quantityInput.value = quantity;
    deadlineInput.value = deadline;
    statusSelect.value = status;
    commentInput.value = comment; 
    
    const today = new Date().toISOString().split('T')[0];
    deadlineInput.setAttribute('min', today);

    if (itemNumber > 1) {
        removeBtn.style.display = 'block';
    }

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
 * Пересчитывает порядковые номера товаров.
 */
export function updateItemNumbers() {
    const itemCards = itemsFormContainer.querySelectorAll('.item-form-card');
    itemCards.forEach((card, index) => {
        const badge = card.querySelector('.item-number');
        badge.textContent = index + 1;
    });
}

/**
 * Обновляет сводку (Всего / Готово).
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

// --- 4. Уведомления (Toast) ---

export function showNotification(title, message, type = 'info') {
    if (!notificationTitle || !notification) return; 
    
    notificationTitle.textContent = title;
    // Здесь message может содержать HTML, но уведомления обычно системные.
    // Если message может прийти от юзера, его тоже надо экранировать.
    // Пока оставим textContent для безопасности (он сам экранирует).
    notificationMessage.textContent = message; 
    
    notification.className = 'notification show ' + type;
    
    const icon = notification.querySelector('.notification-icon i');
    if (icon) {
        icon.className = type === 'success' ? 'fas fa-check-circle' : 
                       type === 'warning' ? 'fas fa-exclamation-triangle' : 
                       type === 'error' ? 'fas fa-times-circle' : 
                       'fas fa-info-circle';
    }
    
    setTimeout(() => {
        closeNotification();
    }, 5000);
}

export function closeNotification() {
    if (notification) { 
        notification.classList.remove('show');
    }
}