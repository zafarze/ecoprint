// D:\Projects\EcoPrint\static\js\archive.js
// (ОБНОВЛЕННЫЙ КОД)

// Импортируем 'utils.js' и 'api.js'
import { formatDate, getStatusText } from './utils.js';
import { unarchiveOrder } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    // Настраиваем слушатели
    setupEventListeners();
    // Загружаем заказы
    loadArchivedOrders();
});

function setupEventListeners() {
    const tableBody = document.getElementById('archiveTableBody');
    tableBody?.addEventListener('click', handleTableClick);

    // Уведомление
    const notificationCloseBtn = document.getElementById('notificationCloseBtn');
    notificationCloseBtn?.addEventListener('click', closeNotification);
}

/**
 * Обрабатывает клики в таблице архива
 */
function handleTableClick(e) {
    const unarchiveBtn = e.target.closest('.unarchive-btn');
    if (unarchiveBtn) {
        const orderId = parseInt(unarchiveBtn.dataset.id);
        handleUnarchiveOrder(orderId);
        return;
    }
    
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        // TODO: Добавить логику для удаления
        alert('Функция удаления еще не реализована.');
        return;
    }
}

/**
 * Главная функция загрузки
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
 * Отрисовка строки
 */
function renderArchiveRow(order, tableBody) {
    const archivedItems = order.items; 
    if (archivedItems.length === 0) return; 

    const orderStatusHtml = `<span class="status-badge status-${order.status}">${getStatusText(order.status)}</span>`;
    
    // --- 👇 ИЗМЕНЕНИЕ: Добавлена кнопка "unarchive-btn" ---
    const actionsHtml = `
        <div class="actions">
            <button class="icon-btn unarchive-btn" title="Восстановить из архива" data-id="${order.id}">
                <i class="fas fa-undo"></i>
            </button>
            <button class="icon-btn delete" title="Удалить навсегда" data-id="${order.id}">
                <i class="fas fa-trash"></i>
            </button>
        </div>`;
    // --- 👆 КОНЕЦ ИЗМЕНЕНИЯ ---

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
    row.id = `archive-row-${order.id}`; // Даем строке ID
    row.innerHTML = `
        <td>${order.id}</td>
        <td><strong>${order.client}</strong></td>
        <td class="items-cell">${itemsContainerHtml}</td>
        <td>${orderStatusHtml}</td>
        <td>${actionsHtml}</td>
    `;
    tableBody.appendChild(row);
}

// --- 👇 НОВАЯ ФУНКЦИЯ: Обработчик разархивации ---
async function handleUnarchiveOrder(orderId) {
    if (!confirm('Восстановить этот заказ из архива?\n\nОн вернется на главную страницу.')) {
        return;
    }
    
    try {
        await unarchiveOrder(orderId); // Вызываем функцию из api.js
        
        // Показываем уведомление
        showNotification('Успешно', 'Заказ восстановлен и возвращен на главную.', 'success');
        
        // Удаляем строку из таблицы архива
        const row = document.getElementById(`archive-row-${orderId}`);
        if (row) {
            row.remove();
        }
        
        // Проверяем, не пуста ли таблица
        const tableBody = document.getElementById('archiveTableBody');
        if (tableBody.children.length === 0) {
            document.getElementById('archiveEmptyState').style.display = 'block';
        }

    } catch (error) {
        console.error(error);
        showNotification('Ошибка', 'Не удалось восстановить заказ.', 'error');
    }
}

// --- 👇 НОВЫЕ ФУНКЦИИ: Уведомления (копия из ui.js) ---
function showNotification(title, message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationTitle = document.getElementById('notificationTitle');
    const notificationMessage = document.getElementById('notificationMessage');
    if (!notification || !notificationTitle || !notificationMessage) return; 
    
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

function closeNotification() {
    const notification = document.getElementById('notification');
    if (notification) { 
        notification.classList.remove('show');
    }
}