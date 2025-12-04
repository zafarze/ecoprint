// static/js/state.js
// (Новый файл)

// --- Приватные переменные состояния ---
let _orders = [];
let _productCatalog = [];
let _userCatalog = [];
let _currentEditingOrderId = null;
let _notificationShownToday = new Set();
let _selectedProductFilters = new Set();

let _sortConfig = {
    field: 'created_at', // По умолчанию сортируем по дате создания
    direction: 'desc'    // Сначала новые
};
// --- Публичные функции (Геттеры и Сеттеры) ---

// Заказы
export const getOrders = () => _orders;
export const setOrders = (newOrders) => {
    _orders = newOrders;
};

// Каталог Товаров
export const getProductCatalog = () => _productCatalog;
export const setProductCatalog = (newCatalog) => {
    _productCatalog = newCatalog;
};

// Каталог Пользователей
export const getUserCatalog = () => _userCatalog;
export const setUserCatalog = (newCatalog) => {
    _userCatalog = newCatalog;
};

// ID редактируемого заказа
export const getCurrentEditingOrderId = () => _currentEditingOrderId;
export const setCurrentEditingOrderId = (id) => {
    _currentEditingOrderId = id;
};

// Уведомления о сроках
export const getNotificationSet = () => _notificationShownToday;
export const clearNotificationSet = () => {
    _notificationShownToday.clear();
};

export const getSortConfig = () => _sortConfig;
export const setSortConfig = (field, direction) => {
    _sortConfig = { field, direction };
};

export const getSelectedProductFilters = () => Array.from(_selectedProductFilters);

export const toggleProductFilter = (productName) => {
    if (_selectedProductFilters.has(productName)) {
        _selectedProductFilters.delete(productName);
    } else {
        _selectedProductFilters.add(productName);
    }
};

export const clearProductFilters = () => {
    _selectedProductFilters.clear();
};