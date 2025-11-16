// static/js/state.js
// (Новый файл)

// --- Приватные переменные состояния ---
let _orders = [];
let _productCatalog = [];
let _userCatalog = [];
let _currentEditingOrderId = null;
let _notificationShownToday = new Set();

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