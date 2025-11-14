// D:\Projects\EcoPrint\static\js\statistics.js (ПОЛНЫЙ КОД)

document.addEventListener('DOMContentLoaded', () => {
    
    // Запускаем загрузку данных
    fetchStatisticsData();

});

// --- ГЛАВНАЯ ФУНКЦИЯ ---
async function fetchStatisticsData() {
    try {
        const response = await fetch('/api/statistics-data/');
        
        if (!response.ok) {
            throw new Error(`Ошибка сети: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 1. Заполняем KPI-карточки
        populateKPIs(data);
        
        // 2. Рисуем графики
        renderStatusPieChart(data.status_counts);
        renderActivityLineChart(data.activity_last_7_days);

    } catch (error) {
        console.error("Не удалось загрузить статистику:", error);
        // Можно показать ошибку пользователю
        document.getElementById('kpi-total-orders').textContent = "Ошибка";
        document.getElementById('kpi-pending-orders').textContent = "Ошибка";
        document.getElementById('kpi-ready-today').textContent = "Ошибка";
        document.getElementById('kpi-top-product').textContent = "Ошибка";
    }
}

// --- 1. ЗАПОЛНЕНИЕ KPI ---
function populateKPIs(data) {
    document.getElementById('kpi-total-orders').textContent = data.total_orders;
    document.getElementById('kpi-pending-orders').textContent = data.pending_orders;
    document.getElementById('kpi-ready-today').textContent = data.created_today; // Используем 'created_today'
    document.getElementById('kpi-top-product').textContent = data.top_product;
}

// --- 2. РИСОВАНИЕ ГРАФИКА (Статусы) ---
function renderStatusPieChart(statusData) {
    const ctx = document.getElementById('statusPieChart');
    if (!ctx) return; // Убеждаемся, что элемент существует

    // Цвета для статусов
    const statusColors = {
        'not-ready': '#f97316', // Оранжевый
        'in-progress': '#3b82f6', // Синий
        'ready': '#22c55e'       // Зеленыый
    };

    // Назначаем цвета в том же порядке, что и labels
    const backgroundColors = statusData.labels.map(label => statusColors[label] || '#9ca3af'); // Серый по умолчанию

    new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: statusData.labels.map(label => translateStatus(label)), // Переводим статусы
            datasets: [{
                label: 'Заказы',
                data: statusData.counts,
                backgroundColor: backgroundColors,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += context.parsed + ' шт.';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// --- 3. РИСОВАНИЕ ГРАФИКА (Активность) ---
function renderActivityLineChart(activityData) {
    const ctx = document.getElementById('activityLineChart');
    if (!ctx) return; // Убеждаемся, что элемент существует

    new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: activityData.labels, // Даты (напр. '14.11')
            datasets: [{
                label: 'Создано заказов',
                data: activityData.counts, // Количество
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.1)', // Прозрачный синий
                borderColor: 'rgba(59, 130, 246, 1)', // Яркий синий
                tension: 0.3, // Сглаживание линии
                pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                pointBorderColor: '#ffffff',
                pointHoverRadius: 7,
                pointHoverBackgroundColor: 'rgba(59, 130, 246, 1)',
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false // Скрываем легенду
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    // Показываем только целые числа (1, 2, 3... а не 1.5)
                    ticks: {
                        stepSize: 1 
                    }
                }
            }
        }
    });
}

// --- Вспомогательная функция для перевода статусов ---
function translateStatus(status) {
    switch(status) {
        case 'not-ready': return 'Не готов';
        case 'in-progress': return 'В процессе';
        case 'ready': return 'Готово';
        default: return status;
    }
}