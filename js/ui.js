// Controle de Modais
export const showModal = (elementId) => {
    const modal = document.getElementById(elementId);
    if (modal) modal.style.display = 'block';
};

export const hideModal = (element) => {
    if (typeof element === 'string') {
        document.getElementById(element).style.display = 'none';
    } else {
        element.style.display = 'none';
    }
};

export const closeAllModals = () => {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
};

// Alertas
export const showAlert = (title, message) => {
    const titleEl = document.getElementById('alert-title');
    const msgEl = document.getElementById('alert-message');
    if(titleEl) titleEl.textContent = title;
    if(msgEl) msgEl.textContent = message;
    showModal('alert-modal');
};

// Controle de Abas (Login, Admin, Relatórios)
export const switchView = (viewName, userRole) => {
    const btnLaunch = document.getElementById('btn-view-launch');
    const btnAdmin = document.getElementById('btn-view-admin');
    const btnReports = document.getElementById('btn-view-reports');
    
    const viewLaunch = document.getElementById('view-launch');
    const viewAdmin = document.getElementById('view-admin');
    const viewReports = document.getElementById('view-reports');

    // Reset visual
    [btnLaunch, btnAdmin, btnReports].forEach(btn => btn?.classList.replace('text-red-600', 'text-gray-600'));
    [viewLaunch, viewAdmin, viewReports].forEach(view => view.style.display = 'none');

    if (viewName === 'admin') {
        viewAdmin.style.display = 'block';
        btnAdmin?.classList.replace('text-gray-600', 'text-red-600');
    } else if (viewName === 'reports') {
        viewReports.style.display = 'block';
        btnReports?.classList.replace('text-gray-600', 'text-red-600');
    } else { 
        viewLaunch.style.display = 'grid';
        btnLaunch?.classList.replace('text-gray-600', 'text-red-600');
    }
};

// Renderização do Gráfico (Chart.js)
let evolutionChart = null;

export const renderChart = (canvasId, labels, dataPoints, labelName) => {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if (evolutionChart) evolutionChart.destroy();
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(220, 38, 38, 0.5)');
    gradient.addColorStop(1, 'rgba(220, 38, 38, 0.0)');

    evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: labelName,
                data: dataPoints,
                borderColor: '#dc2626',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#dc2626',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { grid: { display: false } },
                y: { 
                    beginAtZero: true, 
                    border: { display: false },
                    ticks: { callback: (value) => 'R$ ' + value } 
                }
            }
        }
    });
};
