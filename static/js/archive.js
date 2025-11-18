// D:\Projects\EcoPrint\static\js\archive.js
// (ПОЛНЫЙ ОБНОВЛЕННЫЙ КОД)

// Импортируем утилиты и API
import { formatDate, getStatusText } from './utils.js';
import { unarchiveOrder, deleteOrder } from './api.js'; // Добавили deleteOrder
import { showNotification } from './ui.js'; // Импортируем уведомления, вместо дублирования

document.addEventListener('DOMContentLoaded', () => {
    // Настраиваем слушатели
    setupEventListeners();
    // Загружаем заказы
    loadArchivedOrders();
});

function setupEventListeners() {
    const tableBody = document.getElementById('archiveTableBody');
    tableBody?.addEventListener('click', handleTableClick);
    
    // Слушатель закрытия уведомлений уже есть в ui.js, 
    // но если на странице архива он не срабатывает, можно добавить здесь:
    const notificationCloseBtn = document.getElementById('notificationCloseBtn');
    if (notificationCloseBtn) {
        notificationCloseBtn.addEventListener('click', () => {
             const notification = document.getElementById('notification');
             if (notification) notification.classList.remove('show');
        });
    }
}

/**
 * Обрабатывает клики в таблице архива (Восстановить / Удалить)
 */
function handleTableClick(e) {
    // 1. Клик на "Восстановить"
    const unarchiveBtn = e.target.closest('.unarchive-btn');
    if (unarchiveBtn) {
        const orderId = parseInt(unarchiveBtn.dataset.id);
        handleUnarchiveOrder(orderId);
        return;
    }
    
    // 2. Клик на "Удалить"
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        const orderId = parseInt(deleteBtn.dataset.id);
        handleDeleteOrder(orderId);
        return;
    }
}

/**
 * Загружает список архивных заказов
 */
async function loadArchivedOrders() {
    const tableBody = document.getElementById('archiveTableBody');
    const emptyState = document.getElementById('archiveEmptyState');
    if (!tableBody || !emptyState) return;

    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px;">Загрузка архива...</td></tr>';

    try {
        const response = await fetch('/api/orders/?is_archived=true');
        if (!response.ok) {
            throw new Error('Ошибка сети при загрузке архива');
        }
        const orders = await response.json();

        if (orders.length === 0) {
            emptyState.style.display = 'block';
            tableBody.innerHTML = '';
            return;
        }

        emptyState.style.display = 'none';
        tableBody.innerHTML = '';

        orders.forEach(order => {
            renderArchiveRow(order, tableBody);
        });

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--danger-color);">Не удалось загрузить архив.</td></tr>';
    }
}

/**
 * Отрисовка одной строки таблицы
 */
function renderArchiveRow(order, tableBody) {
    const archivedItems = order.items; 
    if (archivedItems.length === 0) return; 

    const orderStatusHtml = `<span class="status-badge status-${order.status}">${getStatusText(order.status)}</span>`;
    
    // Кнопки действий
    const actionsHtml = `
        <div class="actions">
            <button class="icon-btn unarchive-btn" title="Восстановить из архива" data-id="${order.id}">
                <i class="fas fa-undo"></i>
            </button>
            <button class="icon-btn delete delete-btn" title="Удалить навсегда" data-id="${order.id}">
                <i class="fas fa-trash"></i>
            </button>
        </div>`;

    let itemsContainerHtml = '<div class="items-container">';
    archivedItems.forEach((item, index) => {
        itemsContainerHtml += `
            <div class="item-row-card item-archived">
                <span class="item-number">${index + 1}</span>
                <div class="item-content-row">
                    <span class="item-name">${item.name}</span>
                    <span class="item-quantity">${item.quantity} шт.</span>
                    <div class="item-deadline">
                        <i class="fas fa-calendar-alt"></i>
                        ${formatDate(item.deadline)}
                    </div>
                </div>
            </div>
        `;
    });
    itemsContainerHtml += '</div>';

    const row = document.createElement('tr');
    row.id = `archive-row-${order.id}`; 
    row.innerHTML = `
        <td>${order.id}</td>
        <td><strong>${order.client}</strong></td>
        <td class="items-cell">${itemsContainerHtml}</td>
        <td>${orderStatusHtml}</td>
        <td>${actionsHtml}</td>
    `;
    tableBody.appendChild(row);
}

/**
 * Логика ВОССТАНОВЛЕНИЯ заказа
 */
async function handleUnarchiveOrder(orderId) {
    if (!confirm('Восстановить этот заказ из архива?\n\nОн вернется на главную страницу.')) {
        return;
    }
    
    try {
        await unarchiveOrder(orderId); 
        
        showNotification('Успешно', 'Заказ восстановлен.', 'success');
        
        // Удаляем строку из UI
        const row = document.getElementById(`archive-row-${orderId}`);
        if (row) row.remove();
        
        checkEmptyState();

    } catch (error) {
        console.error(error);
        showNotification('Ошибка', 'Не удалось восстановить заказ.', 'error');
    }
}

/**
 * Логика УДАЛЕНИЯ заказа (Реализована)
 */
async function handleDeleteOrder(orderId) {
    if (!confirm('ВНИМАНИЕ: Вы уверены, что хотите удалить этот заказ НАВСЕГДА?\n\nЭто действие нельзя отменить.')) {
        return;
    }

    try {
        await deleteOrder(orderId); // Вызов API
        
        showNotification('Удалено', 'Заказ успешно удален.', 'success');
        
        // Удаляем строку из UI
        const row = document.getElementById(`archive-row-${orderId}`);
        if (row) row.remove();

        checkEmptyState();

    } catch (error) {
        console.error(error);
        showNotification('Ошибка', 'Не удалось удалить заказ.', 'error');
    }
}

/**
 * Проверяет, пуста ли таблица, и показывает Empty State если нужно
 */
function checkEmptyState() {
    const tableBody = document.getElementById('archiveTableBody');
    if (tableBody && tableBody.children.length === 0) {
        document.getElementById('archiveEmptyState').style.display = 'block';
    }
}