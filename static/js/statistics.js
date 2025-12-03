// D:\Projects\EcoPrint\static\js\statistics.js
// (ОБНОВЛЕННАЯ ВЕРСИЯ: ИМПОРТ ИЗ UTILS, БЕЗ ДУБЛИРОВАНИЯ)

// 👇 Импортируем токен напрямую из утилит (DRY)
import { csrftoken } from './utils.js';

document.addEventListener('DOMContentLoaded', function() {
    console.log('Статистика: скрипт загружен');
    
    let currentPeriod = 'week';
    let statusChart = null;
    let activityChart = null;

    // Элементы DOM для KPI
    const totalOrdersEl = document.getElementById('kpi-total-orders');
    const pendingOrdersEl = document.getElementById('kpi-pending-orders');
    const createdTodayEl = document.getElementById('kpi-created-today');
    const topProductEl = document.getElementById('kpi-top-product');
    const syncBtn = document.getElementById('sync-btn');

    // Инициализация Chart.js
    const statusCtx = document.getElementById('statusPieChart');
    const activityCtx = document.getElementById('activityLineChart');
    
    // Проверка наличия элементов (чтобы скрипт не падал на других страницах)
    if (!statusCtx || !activityCtx) {
        // Если графиков нет на странице, просто выходим (тихо)
        return;
    }

    const statusChartCtx = statusCtx.getContext('2d');
    const activityChartCtx = activityCtx.getContext('2d');

    // Загрузка данных
    function loadStatisticsData(period) {
        console.log('Загружаем данные для периода:', period);
        
        fetch(`/api/statistics-data/?period=${period}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Ошибка сети: ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                updateKPIs(data);
                updateCharts(data);
            })
            .catch(error => {
                console.error('Ошибка загрузки статистики:', error);
                showError();
            });
    }

    // Обновление KPI значений
    function updateKPIs(data) {
        if (totalOrdersEl) totalOrdersEl.textContent = data.total_orders || 0;
        if (pendingOrdersEl) pendingOrdersEl.textContent = data.pending_orders || 0;
        if (createdTodayEl) createdTodayEl.textContent = data.created_today || 0;
        
        let topProductText = data.top_product || 'Нет данных';
        if (topProductText.length > 15) {
            topProductText = topProductText.substring(0, 15) + '...';
        }
        if (topProductEl) topProductEl.textContent = topProductText;
    }

    // Показать ошибку
    function showError() {
        if (totalOrdersEl) totalOrdersEl.textContent = '-';
        if (pendingOrdersEl) pendingOrdersEl.textContent = '-';
        if (createdTodayEl) createdTodayEl.textContent = '-';
        if (topProductEl) topProductEl.textContent = 'Ошибка';
        
        if (statusChart) {
            statusChart.destroy();
            statusChart = null;
        }
        if (activityChart) {
            activityChart.destroy();
            activityChart = null;
        }
    }

    // Обновление графиков
    function updateCharts(data) {
        // 1. Круговая диаграмма статусов
        if (statusChart) {
            statusChart.destroy();
        }
        
        if (data.status_counts && data.status_counts.labels && data.status_counts.labels.length > 0) {
            const statusLabels = data.status_counts.labels.map(label => {
                return label === 'not-ready' ? 'Не готов' : 
                       label === 'in-progress' ? 'В процессе' : 
                       label === 'ready' ? 'Готово' : label;
            });
            
            const backgroundColors = data.status_counts.labels.map(label => {
                return label === 'not-ready' ? '#f56565' :
                       label === 'in-progress' ? '#f6ad55' :
                       '#68d391';
            });
            
            statusChart = new Chart(statusChartCtx, {
                type: 'doughnut',
                data: {
                    labels: statusLabels,
                    datasets: [{
                        data: data.status_counts.counts,
                        backgroundColor: backgroundColors,
                        borderWidth: 1,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: { size: 12 }
                            }
                        }
                    },
                    cutout: '70%'
                }
            });
        }

        // 2. Линейная диаграмма активности
        if (activityChart) {
            activityChart.destroy();
        }
        
        if (data.activity_data && data.activity_data.labels && data.activity_data.labels.length > 0) {
            activityChart = new Chart(activityChartCtx, {
                type: 'line',
                data: {
                    labels: data.activity_data.labels,
                    datasets: [{
                        label: 'Количество заказов',
                        data: data.activity_data.counts,
                        borderColor: '#4299e1',
                        backgroundColor: 'rgba(66, 153, 225, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#4299e1',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: { font: { size: 12 } }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: true, color: 'rgba(0,0,0,0.05)' },
                            ticks: { font: { size: 11 } }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { display: true, color: 'rgba(0,0,0,0.05)' },
                            ticks: { font: { size: 11 }, precision: 0 }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'nearest'
                    }
                }
            });
        }
    }

    // Обработчики кнопок периода
    document.querySelectorAll('.btn-stat').forEach(button => {
        button.addEventListener('click', function() {
            // Сброс активного состояния
            document.querySelectorAll('.btn-stat').forEach(btn => {
                btn.classList.remove('active');
                btn.style.background = '#fff';
                btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
            });
            
            // Установка активного состояния
            this.classList.add('active');
            this.style.background = '#e5e7eb';
            this.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.1)';
            
            // Загрузка данных
            currentPeriod = this.dataset.period;
            loadStatisticsData(currentPeriod);
        });
    });

    // Обработчик синхронизации
    if (syncBtn) {
        syncBtn.addEventListener('click', function() {
            const btn = this;
            const originalText = btn.innerHTML;
            
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Синхронизация...';
            
            fetch('/api/sync-sheets/', {
                method: 'POST',
                headers: {
                    // 👇 Используем импортированный токен
                    'X-CSRFToken': csrftoken,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert('✅ ' + data.message);
                    loadStatisticsData(currentPeriod);
                } else {
                    alert('❌ Ошибка: ' + (data.error || data.message || 'Неизвестная ошибка'));
                }
            })
            .catch(error => {
                console.error('Ошибка синхронизации:', error);
                alert('❌ Ошибка сети: ' + error.message);
            })
            .finally(() => {
                btn.disabled = false;
                btn.innerHTML = originalText;
            });
        });
    }

    // 👇 ФУНКЦИЯ getCookie УДАЛЕНА ОТСЮДА (она теперь в utils.js)

    // Инициализация
    loadStatisticsData(currentPeriod);
});