// static/js/app.js (ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД v9 - с "карточками" и "создателем")

// --- Глобальные переменные ---
let orders = []; 
let productCatalog = []; 
let userCatalog = [];
let currentEditingOrderId = null;

// Настройки теперь загружаются из 'base.html' (window.USER_SETTINGS)
let soundEnabled = window.USER_SETTINGS.soundEnabled;
let popupEnabled = window.USER_SETTINGS.popupEnabled;
let dayBeforeEnabled = window.USER_SETTINGS.dayBeforeEnabled;
let notificationShownToday = new Set();


// --- Получение CSRF-токена ---
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
const csrftoken = getCookie('csrftoken');

// --- DOM Elements ---
const ordersTableBody = document.getElementById('ordersTableBody');
const emptyState = document.getElementById('emptyState');
const orderModal = document.getElementById('orderModal');
const modalTitle = document.getElementById('modalTitle');
const orderForm = document.getElementById('orderForm');
const itemsFormContainer = document.getElementById('itemsFormContainer');
const notification = document.getElementById('notification');
const notificationTitle = document.getElementById('notificationTitle');
const notificationMessage = document.getElementById('notificationMessage');
const notificationCloseBtn = document.getElementById('notificationCloseBtn');
const itemsCount = document.getElementById('itemsCount');
const readyCount = document.getElementById('readyCount');
const addOrderBtn = document.getElementById('addOrderBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const addItemBtn = document.getElementById('addItemBtn');
const syncBtn = document.getElementById('syncBtn');
const showReadyBtn = document.getElementById('showReadyBtn');
const showNotReadyBtn = document.getElementById('showNotReadyBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const urgencyFilter = document.getElementById('urgencyFilter');
const avatarBtn = document.getElementById('avatarBtn');
const profileDropdownMenu = document.getElementById('profileDropdownMenu');

// --- Инициализация приложения ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Запускаем инициализацию (загрузку данных)
    initApp();

    // --- НАЧАЛО: Все Event Listeners ---
    // (Они должны быть здесь, чтобы сработать после загрузки DOM)

    if (addOrderBtn) addOrderBtn.addEventListener('click', () => openOrderModal());
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => closeOrderModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => closeOrderModal());
    if (saveBtn) saveBtn.addEventListener('click', (e) => { e.preventDefault(); saveOrder(); });
    if (orderForm) orderForm.addEventListener('submit', (e) => { e.preventDefault(); saveOrder(); });
    if (addItemBtn) addItemBtn.addEventListener('click', () => addItemRow());
    if (syncBtn) syncBtn.addEventListener('click', () => {
        initApp();
        showNotification('Синхронизация', 'Данные обновлены', 'success');
    });
    if (showReadyBtn) showReadyBtn.addEventListener('click', () => {
        statusFilter.value = 'ready';
        renderOrders();
        updateQuickFilterButtons('ready');
    });
    if (showNotReadyBtn) showNotReadyBtn.addEventListener('click', () => {
        statusFilter.value = 'not-ready';
        renderOrders();
        updateQuickFilterButtons('not-ready');
    });
    if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        statusFilter.value = 'all';
        urgencyFilter.value = 'all';
        renderOrders();
        updateQuickFilterButtons('all');
    });
    if (searchInput) searchInput.addEventListener('input', renderOrders);
    if (statusFilter) statusFilter.addEventListener('change', () => {
        renderOrders();
        updateQuickFilterButtons('');
    });
    if (urgencyFilter) urgencyFilter.addEventListener('change', renderOrders);
    if (avatarBtn) avatarBtn.addEventListener('click', () => {
        profileDropdownMenu.style.display = profileDropdownMenu.style.display === 'block' ? 'none' : 'block';
    });
    if (notificationCloseBtn) notificationCloseBtn.addEventListener('click', closeNotification);
    window.addEventListener('click', (e) => {
        
        if (profileDropdownMenu && !e.target.closest('#avatarBtn') && !e.target.closest('#profileDropdownMenu')) {
            profileDropdownMenu.style.display = 'none';
        }
    });


    // --- НАЧАЛО: Код для "Гамбургер-меню" (Мобильная версия) ---
    const menuToggleBtn = document.getElementById("menuToggleBtn");
    const sidebar = document.querySelector(".sidebar");
    const pageContainer = document.querySelector(".page-container");

    if (menuToggleBtn && sidebar) {
        
        menuToggleBtn.addEventListener("click", (e) => {
            e.stopPropagation(); 
            sidebar.classList.toggle("show");
        });

        if (pageContainer) {
            pageContainer.addEventListener("click", () => {
                if (sidebar.classList.contains("show")) {
                    sidebar.classList.remove("show");
                }
            });
        }

        sidebar.addEventListener("click", (e) => {
            if (e.target.tagName === 'A' || e.target.closest('A')) {
                 sidebar.classList.remove("show");
            }
        });
    }
    // --- КОНЕЦ: Код для "Гамбургер-меню" ---


    // --- Код для складного сайдбара ---
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const body = document.body; // Будем вешать класс на <body>

    if (sidebarToggleBtn) {
        
        if (localStorage.getItem('sidebarCollapsed') === 'true') {
            body.classList.add('sidebar-collapsed');
        }

        sidebarToggleBtn.addEventListener('click', () => {
            body.classList.toggle('sidebar-collapsed');
            
            if (body.classList.contains('sidebar-collapsed')) {
                localStorage.setItem('sidebarCollapsed', 'true');
            } else {
                localStorage.setItem('sidebarCollapsed', 'false');
            }
        });
    }
    // --- КОНЕЦ Кода для складного сайдбара ---


    // Периодическая проверка срочных заказов
    setInterval(checkUrgentOrders, 300000); // Каждые 5 минут

}); // <-- Это закрывающая скобка для 'DOMContentLoaded'

async function initApp() {
    try {
        const [ordersData, productsData, usersData] = await Promise.all([
            fetch('/api/orders/'),
            fetch('/api/products/'),
            fetch('/api/users/') 
        ]);
        
        if (!ordersData.ok) throw new Error('Ошибка загрузки заказов');
        if (!productsData.ok) throw new Error('Ошибка загрузки товаров');
        if (!usersData.ok) throw new Error('Ошибка загрузки пользователей'); 
        
        orders = await ordersData.json();
        productCatalog = await productsData.json();
        userCatalog = await usersData.json(); 
        
        renderOrders();
        checkUrgentOrders();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showNotification('Ошибка', 'Не удалось загрузить данные с сервера', 'error');
    }
    
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.setAttribute('min', today);
    });
    resetNotificationTracking();
}


// --- Основные функции ---

function renderOrders() {
    if (!ordersTableBody) return; 

    const searchTerm = searchInput.value.toLowerCase();
    const statusValue = statusFilter.value;
    const urgencyValue = urgencyFilter.value;
    
    ordersTableBody.innerHTML = '';
    let hasVisibleRows = false; 
    
    orders.forEach(order => {
        
        // --- 1. СНАЧАЛА ФИЛЬТРУЕМ ТОВАРЫ ---
        const visibleItems = order.items.filter(item => {
            const matchesSearch = searchTerm === '' || 
                order.client.toLowerCase().includes(searchTerm) ||
                item.name.toLowerCase().includes(searchTerm);
                
            const matchesStatus = statusValue === 'all' || item.status === statusValue;
            
            const daysUntilDeadline = getDaysUntilDeadline(item.deadline);
            let matchesUrgency = urgencyValue === 'all';
            if (urgencyValue === 'urgent') matchesUrgency = daysUntilDeadline <= 2 && daysUntilDeadline >= 0;
            else if (urgencyValue === 'very-urgent') matchesUrgency = daysUntilDeadline <= 1 && daysUntilDeadline >= 0;
            
            return matchesSearch && matchesStatus && matchesUrgency;
        });

        // --- 2. РЕНДЕРИМ ВИДИМЫЕ ТОВАРЫ ---
        if (visibleItems.length > 0) {
            hasVisibleRows = true;
            const rowspan = visibleItems.length; // Количество ячеек для объединения

            visibleItems.forEach((item, index) => {
                const row = document.createElement('tr');
                
                // --- 3. ЛОГИКА СТИЛЕЙ ---
                
                // 👇👇👇 ИЗМЕНЕНИЕ №3: Добавляем классы для "карточек" 👇👇👇
                if (index === 0) {
                    row.classList.add('order-row-start');
                }
                if (index === visibleItems.length - 1) {
                    row.classList.add('order-row-end');
                }
                // 👆👆👆 КОНЕЦ ИЗМЕНЕНИЯ №3 👆👆👆


                const daysUntilDeadline = getDaysUntilDeadline(item.deadline);
                let urgencyClass = '';
                if (daysUntilDeadline === 0) urgencyClass = 'item-very-urgent'; 
                else if (daysUntilDeadline === 1) urgencyClass = 'item-urgent'; 
                
                const borderClass = (index === visibleItems.length - 1) ? '' : 'item-row-border';
                const cellClasses = `${urgencyClass} ${borderClass}`;
                
                const responsible = item.responsible_user 
                    ? (item.responsible_user.first_name || item.responsible_user.username) 
                    : 'Не назначен';

                const commentHtml = item.comment 
                    ? `<div class="item-comment-display">${item.comment}</div>` 
                    : '';
                
                // --- 4. HTML С НОВЫМИ КЛАССАМИ ДЛЯ <TD> ---
                const itemHtml = `
                    <td class="${cellClasses}">
                        <strong>${item.name}</strong>
                        ${commentHtml}
                    </td>
                    
                    <td class="${cellClasses}">${item.quantity} шт.</td>
                    <td class="${cellClasses}"><strong>${formatDate(item.deadline)}</strong></td>
                    <td class="${cellClasses}">
                        <span class="item-status ${item.status}" 
                              data-order-id="${order.id}" 
                              data-item-name="${item.name}" 
                              data-item-quantity="${item.quantity}">
                            ${getStatusText(item.status)}
                        </span>
                    </td>
                    <td class="${cellClasses}">
                        <div class="responsible-dropdown">
                            <button class_ ="responsible-current" 
                                    data-order-id="${order.id}" 
                                    data-item-name="${item.name}" 
                                    data-item-quantity="${item.quantity}">
                                <span>${responsible}</span>
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        </div>
                    </td>
                `;

                if (index === 0) {
                    row.innerHTML = `
                        <td rowspan="${rowspan}">${order.id}</td>
                        <td rowspan="${rowspan}"><strong>${order.client}</strong></td>
                        ${itemHtml}
                        <td rowspan="${rowspan}">
                            <div class="actions">
                                <button class="icon-btn edit-btn" data-id="${order.id}" title="Редактировать заказ">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="icon-btn delete delete-btn" data-id="${order.id}" title="Удалить заказ">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    `;
                } else {
                    row.innerHTML = itemHtml;
                }
                
                ordersTableBody.appendChild(row);
            });
        }
    });
    
    // --- 5. Показываем заглушку, если строк нет ---
    if (hasVisibleRows) {
        if (emptyState) emptyState.style.display = 'none';
    } else {
        if (emptyState) emptyState.style.display = 'block';
    }
    
    // --- 6. ОБРАБОТЧИКИ (ИСПРАВЛЕНО) ---
    document.querySelectorAll('.item-status').forEach(span => {
        span.addEventListener('click', function() {
            const orderId = parseInt(this.getAttribute('data-order-id'));
            const itemName = this.getAttribute('data-item-name');
            const itemQuantity = parseInt(this.getAttribute('data-item-quantity'));
            toggleItemStatus(orderId, itemName, itemQuantity); 
        });
    });
    
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = parseInt(this.getAttribute('data-id'));
            editOrder(orderId);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = parseInt(this.getAttribute('data-id'));
            deleteOrder(orderId);
        });
    });

    document.querySelectorAll('.responsible-current').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); 
            
            const orderId = parseInt(this.getAttribute('data-order-id'));
            const itemName = this.getAttribute('data-item-name');
            const itemQuantity = parseInt(this.getAttribute('data-item-quantity'));
            
            showResponsibleDropdown(this, orderId, itemName, itemQuantity);
        });
    });
} // --- КОНЕЦ ФУНКЦИИ RENDERORDERS ---

function updateQuickFilterButtons(activeFilter) {
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

function openOrderModal(orderId = null) {
    currentEditingOrderId = orderId;
    const today = new Date().toISOString().split('T')[0];
    
    if (orderId) {
        // Редактирование
        modalTitle.textContent = 'Редактировать заказ';
        const order = orders.find(o => o.id === orderId);
        
        document.getElementById('clientName').value = order.client;
        
        itemsFormContainer.innerHTML = '';
        order.items.forEach((item, index) => {
            const respId = item.responsible_user ? item.responsible_user.id : null;
            
            const itemCard = createItemFormCard(
                item.name, 
                item.quantity, 
                item.status, 
                item.deadline, 
                index + 1,
                respId,
                item.comment
            );
            itemsFormContainer.appendChild(itemCard);
        });
    } else {
        // Создание
        modalTitle.textContent = 'Новый заказ';
        orderForm.reset();
        
        itemsFormContainer.innerHTML = '';
        
        // CURRENT_USER_ID приходит из <script> в index.html
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

function closeOrderModal() {
    orderModal.classList.remove('active');
    currentEditingOrderId = null;
}

function addItemRow() {
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

// 
// 👇👇👇 ГЛАВНЫЕ ИЗМЕНЕНИЯ - в `createItemFormCard` 👇👇👇
//
function createItemFormCard(name, quantity, status, deadline, itemNumber, responsibleUserId, comment = '') {
    const template = document.getElementById('itemFormTemplate');
    const itemCard = template.content.cloneNode(true).firstElementChild;
    
    // Находим все нужные элементы внутри карточки
    const badge = itemCard.querySelector('.item-number');
    const productInput = itemCard.querySelector('.product-name-input'); // 👈 ИЗМЕНЕНО
    const productTypeBtn = itemCard.querySelector('.product-type-btn'); // 👈 НОВЫЙ
    const productSuggestions = itemCard.querySelector('.product-suggestions'); // 👈 НОВЫЙ
    const quantityInput = itemCard.querySelector('.item-quantity');
    const deadlineInput = itemCard.querySelector('.item-deadline-input');
    const statusSelect = itemCard.querySelector('.item-status-select');
    const removeBtn = itemCard.querySelector('.remove-item-btn');
    const itemResponsibleSelect = itemCard.querySelector('.item-responsible-user');
    const commentInput = itemCard.querySelector('.item-comment'); 

    badge.textContent = itemNumber;
    
    // ---
    // 👇👇👇 ИЗМЕНЕНИЕ №1: Логика для "Тип продукции" (как в index_first.html) 👇👇👇
    // ---
    productInput.value = name; // Заполняем инпут

    // Заполняем список подсказок из нашего API-каталога
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
    // --- 👆👆👆 Конец ИЗМЕНЕНИЯ №1 👆👆👆 ---


    // ---
    // 👇👇👇 ИЗМЕНЕНИЕ №2: Логика для "Создатель" (Автоматически и заблокировано) 👇👇👇
    // ---
    itemResponsibleSelect.innerHTML = ''; // Очищаем "-- Загрузка... --"
    userCatalog.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        
        const displayName = (user.first_name || user.last_name) 
            ? `${user.first_name} ${user.last_name}`.trim() 
            : user.username;
        option.textContent = displayName;
        
        // Выбираем текущего пользователя (из CURRENT_USER_ID)
        if (user.id === responsibleUserId) {
            option.selected = true;
        }
        itemResponsibleSelect.appendChild(option);
    });
    
    // Устанавливаем и БЛОКИРУЕМ поле
    itemResponsibleSelect.value = responsibleUserId;
    itemResponsibleSelect.disabled = true; 
    // --- 👆👆👆 Конец ИЗМЕНЕНИЯ №2 👆👆👆 ---

    
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

function updateItemNumbers() {
    const itemCards = itemsFormContainer.querySelectorAll('.item-form-card');
    itemCards.forEach((card, index) => {
        const badge = card.querySelector('.item-number');
        badge.textContent = index + 1;
    });
}

function updateOrderSummary() {
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
    readyCount.textContent = readyItems; // Исправлено (было totalItems)
}

async function saveOrder() {
    const clientName = document.getElementById('clientName').value;
    
    if (!clientName) {
        showNotification('Ошибка', 'Укажите клиента', 'error');
        return;
    }
    
    const items = [];
    const itemCards = itemsFormContainer.querySelectorAll('.item-form-card');
    
    let allFieldsValid = true;
    itemCards.forEach(card => {
        const productName = card.querySelector('.product-name-input').value; // 👈 ИЗМЕНЕНО
        const quantity = parseInt(card.querySelector('.item-quantity').value);
        const status = card.querySelector('.item-status-select').value;
        const deadline = card.querySelector('.item-deadline-input').value;
        const responsibleUserId = card.querySelector('.item-responsible-user').value; // 👈 Он 'disabled', но мы все равно берем 'value'
        const comment = card.querySelector('.item-comment').value; 
        
        if (!productName || !deadline) {
            allFieldsValid = false;
        }
        
        items.push({ 
            name: productName, 
            quantity, 
            status, 
            deadline,
            comment: comment, 
            responsible_user_id: responsibleUserId ? parseInt(responsibleUserId) : null
        });
    });
    
    if (items.length === 0) {
        showNotification('Ошибка', 'Добавьте хотя бы один товар', 'error');
        return;
    }
    
    if (!allFieldsValid) {
        showNotification('Ошибка', 'Укажите название и срок сдачи для каждого товара', 'error');
        return;
    }
    
    const orderData = {
        client: clientName,
        items_write: items
    };

    try {
        let url = '/api/orders/';
        let method = 'POST';
        
        if (currentEditingOrderId) {
            url = `/api/orders/${currentEditingOrderId}/`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Ошибка сохранения:', errorData);
            throw new Error('Ошибка сохранения на сервере');
        }

        const savedOrder = await response.json();
        
        if (currentEditingOrderId) {
            const orderIndex = orders.findIndex(o => o.id === currentEditingOrderId);
            orders[orderIndex] = savedOrder;
            showNotification('Успешно', 'Заказ обновлен', 'success');
        } else {
            orders.push(savedOrder);
            orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Сортируем
            showNotification('Успешно', 'Заказ добавлен', 'success');
        }
        
        renderOrders();
        closeOrderModal();
        checkUrgentOrders();

    } catch (error) {
        console.error(error);
        showNotification('Ошибка', 'Не удалось сохранить заказ.', 'error');
    }
}

function editOrder(orderId) {
    openOrderModal(orderId);
}

async function deleteOrder(orderId) {
    if (confirm('Вы уверены, что хотите удалить этот заказ?')) {
        try {
            const response = await fetch(`/api/orders/${orderId}/`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': csrftoken
                }
            });

            if (!response.ok && response.status !== 204) {
                throw new Error('Ошибка удаления на сервере');
            }

            orders = orders.filter(o => o.id !== orderId);
            renderOrders();
            showNotification('Успешно', 'Заказ удален', 'success');

        } catch (error) {
            console.error(error);
            showNotification('Ошибка', 'Не удалось удалить заказ.', 'error');
        }
    }
}

async function toggleItemStatus(orderId, itemName, itemQuantity) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Находим правильный товар (по имени и кол-ву, как раньше)
    const item = order.items.find(i => i.name === itemName && i.quantity === itemQuantity);
    if (!item) return;
    
    // Логика смены статуса
    if (item.status === 'not-ready') item.status = 'in-progress';
    else if (item.status === 'in-progress') item.status = 'ready';
    else item.status = 'not-ready';

    // Обновляем вид
    renderOrders();
            
    if (soundEnabled) playNotificationSound();

    // Отправляем изменения на сервер
    try {
        const itemsForApi = order.items.map(i => {
            return {
                name: i.name,
                quantity: i.quantity,
                status: i.status,
                deadline: i.deadline,
                comment: i.comment, 
                responsible_user_id: i.responsible_user ? i.responsible_user.id : null
            };
        });
    
        const response = await fetch(`/api/orders/${orderId}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({
                client: order.client,
                items_write: itemsForApi
            })
        });

        if (!response.ok) {
            throw new Error('Ошибка обновления статуса');
        }
        
        const updatedOrderFromServer = await response.json();
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
            orders[orderIndex] = updatedOrderFromServer;
        }
        renderOrders();

    } catch (error) {
        console.error(error);
        showNotification('Ошибка', 'Не удалось обновить статус на сервере', 'error');
    }
}

function showResponsibleDropdown(buttonElement, orderId, itemName, itemQuantity) {
    document.querySelectorAll('.responsible-menu').forEach(menu => menu.remove());

    const menu = document.createElement('div');
    menu.className = 'responsible-menu';

    userCatalog.forEach(user => {
        const userBtn = document.createElement('button');
        userBtn.className = 'responsible-option';
        
        const displayName = (user.first_name || user.last_name) 
            ? `${user.first_name} ${user.last_name}`.trim() 
            : user.username;
        userBtn.textContent = displayName;
        
        userBtn.onclick = (e) => {
            e.stopPropagation();
            updateResponsibleUser(orderId, itemName, itemQuantity, user.id);
            menu.remove();
        };
        menu.appendChild(userBtn);
    });

    document.body.appendChild(menu);
    const rect = buttonElement.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 5}px`; 
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.display = 'block';

    const closeMenuHandler = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            window.removeEventListener('click', closeMenuHandler);
        }
    };
    
    setTimeout(() => {
        window.addEventListener('click', closeMenuHandler);
    }, 0);
}


async function updateResponsibleUser(orderId, itemName, itemQuantity, newUserId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const item = order.items.find(i => i.name === itemName && i.quantity === itemQuantity);
    if (!item) return;

    const newUser = userCatalog.find(u => u.id === newUserId);
    if (!newUser) return

    item.responsible_user = {
        id: newUser.id,
        username: newUser.username,
        first_name: newUser.first_name,
        last_name: newUser.last_name
    };
    
    renderOrders(); // Сначала обновляем локально

    try {
        const itemsForApi = order.items.map(i => ({
            name: i.name,
            quantity: i.quantity,
            status: i.status,
            deadline: i.deadline,
            comment: i.comment, 
            responsible_user_id: i.responsible_user ? i.responsible_user.id : null
        }));

        const response = await fetch(`/api/orders/${orderId}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({
                client: order.client,
                items_write: itemsForApi
            })
        });

        if (!response.ok) throw new Error('Ошибка обновления ответственного');

        const updatedOrderFromServer = await response.json();
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
            orders[orderIndex] = updatedOrderFromServer;
        }
        renderOrders(); // Повторно рендерим с данными с сервера

    } catch (error) {
        console.error(error);
        showNotification('Ошибка', 'Не удалось обновить ответственного', 'error');
    }
}

// --- Вспомогательные функции ---

function closeNotification() {
    if (notification) { 
        notification.classList.remove('show');
    }
}

function getStatusText(status) {
    switch (status) {
        case 'ready': return 'Готово';
        case 'in-progress': return 'В процессе';
        case 'not-ready': return 'Не готов';
        default: return status;
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return date.toLocaleDateString('ru-RU', options);
}

function getDaysUntilDeadline(deadline) {
    if (!deadline) return 999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    const diffTime = deadlineDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function checkUrgentOrders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    let urgentOrders = [];
    
    orders.forEach(order => {
        order.items.forEach(item => {
            if (item.status === 'ready') return; // Игнорируем готовые
            
            const deadlineDate = new Date(item.deadline);
            deadlineDate.setHours(0, 0, 0, 0);
            
            if (deadlineDate.getTime() === today.getTime()) {
                if (!notificationShownToday.has(`today-${order.id}-${item.name}`)) {
                    urgentOrders.push({ order, item, type: 'today' });
                    notificationShownToday.add(`today-${order.id}-${item.name}`);
                }
            } else if (deadlineDate.getTime() === tomorrow.getTime() && dayBeforeEnabled) {
                if (!notificationShownToday.has(`tomorrow-${order.id}-${item.name}`)) {
                    urgentOrders.push({ order, item, type: 'tomorrow' });
                    notificationShownToday.add(`tomorrow-${order.id}-${item.name}`);
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
        showNotification('Внимание! Срок сдачи товаров', message.trim(), 'warning');
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
        notificationShownToday.clear();
        resetNotificationTracking();
    }, msUntilMidnight);
}

function showNotification(title, message, type = 'info') {
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

function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.warn("Не удалось воспроизвести звук:", e);
    }
}