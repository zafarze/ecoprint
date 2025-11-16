// D:\Projects\EcoPrint\static\js\main.js
// (НОВЫЙ ФАЙЛ)

/**
 * Этот скрипт запускается на КАЖДОЙ странице.
 * Он отвечает за глобальные элементы: сайдбар, хедер и мобильное меню.
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Логика для выпадающего меню профиля (Header) ---
    const avatarBtn = document.getElementById('avatarBtn');
    const profileDropdownMenu = document.getElementById('profileDropdownMenu');
    
    avatarBtn?.addEventListener('click', () => {
        if (profileDropdownMenu) {
            profileDropdownMenu.style.display = profileDropdownMenu.style.display === 'block' ? 'none' : 'block';
        }
    });
    
    // Закрытие меню по клику вне его
    window.addEventListener('click', (e) => {
        if (profileDropdownMenu && !e.target.closest('#avatarBtn') && !e.target.closest('#profileDropdownMenu')) {
            profileDropdownMenu.style.display = 'none';
        }
    });

    // --- 2. Логика для Складного сайдбара (Desktop) ---
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    if (sidebarToggleBtn) {
        const body = document.body;
        
        // Проверяем LocalStorage, чтобы восстановить состояние сайдбара
        if (localStorage.getItem('sidebarCollapsed') === 'true') {
            body.classList.add('sidebar-collapsed');
        }
        
        // Вешаем обработчик на кнопку
        sidebarToggleBtn.addEventListener('click', () => {
            body.classList.toggle('sidebar-collapsed');
            // Сохраняем выбор пользователя
            localStorage.setItem('sidebarCollapsed', body.classList.contains('sidebar-collapsed'));
        });
    }

    // --- 3. Логика для Мобильного меню (Гамбургер) ---
    const menuToggleBtn = document.getElementById("menuToggleBtn");
    const sidebar = document.querySelector(".sidebar");
    const pageContainer = document.querySelector(".page-container");

    menuToggleBtn?.addEventListener("click", (e) => {
        e.stopPropagation(); 
        sidebar?.classList.toggle("show");
    });

    pageContainer?.addEventListener("click", () => {
        if (sidebar?.classList.contains("show")) {
            sidebar.classList.remove("show");
        }
    });

    sidebar?.addEventListener("click", (e) => {
        // Закрываем мобильное меню при клике на ссылку
        if (e.target.tagName === 'A' || e.target.closest('A')) {
             sidebar.classList.remove("show");
        }
    });
});