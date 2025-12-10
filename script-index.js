// Controle de acesso baseado em perfil
function initializeUserAccess() {
    const userRole = localStorage.getItem('userRole');
    const username = localStorage.getItem('username');
    const welcomeMessage = document.getElementById('welcome-message');

    if (!localStorage.getItem('isLoggedIn')) {
        window.location.href = 'login.html';
        return;
    }

    // Log de entrada no sistema
    setTimeout(() => addLog('Acesso ao Dashboard', 'Sucesso'), 100);

    // Exibir mensagem de boas-vindas
    if (userRole === 'professor') {
        welcomeMessage.innerHTML = `Bem-vindo, ${username} <span class="readonly-badge">SOMENTE LEITURA</span>`;
        disableControls();
    } else {
        welcomeMessage.innerHTML = `Bem-vindo, ${username}`;
    }
}

// Desabilitar controles para professor (somente leitura)
function disableControls() {
    // Desabilitar botões de atuadores
    const actuatorButtons = document.querySelectorAll('.actuator-button');
    actuatorButtons.forEach(button => {
        button.classList.add('disabled');
        button.onclick = null;
        button.title = 'Acesso negado - Perfil somente leitura';
    });

    // Adicionar badge nos títulos dos atuadores
    const actuatorTitles = document.querySelectorAll('.actuator-title');
    actuatorTitles.forEach(title => {
        title.innerHTML += ' <span class="readonly-badge">LEITURA</span>';
    });
}

// Sobrescrever função sendCmd para professor
async function sendCmd(device) {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'professor') {
        alert('Acesso negado: Perfil de professor permite apenas visualização.');
        return;
    }
    // Função original seria chamada aqui
    console.log('Comando enviado para:', device);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 800);
        await fetch(`${ESP32_IP}/actuator?cmd=${device}`, { signal: controller.signal });
        clearTimeout(timeout);
        console.log("Comando enviado:", device);

        // Tenta buscar o novo status imediatamente após o comando
        updateActuatorStatus();

    } catch (erro) {
        console.warn("Erro ao enviar comando", erro);
    }
}

// Inicializar controle de acesso quando a página carregar
document.addEventListener('DOMContentLoaded', initializeUserAccess);

// Funcionalidade de filtros de logs
function filterLogs() {
    const logFilter = document.getElementById('logFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    const rows = document.querySelectorAll('#logsTableBody tr');

    rows.forEach(row => {
        const action = row.cells[2].textContent.toLowerCase();
        const date = row.cells[0].textContent.split(' ')[0];
        const status = row.cells[3].textContent.toLowerCase();

        let showRow = true;

        // Filtro por tipo
        if (logFilter === 'commands' && !action.includes('led') && !action.includes('ventilador')) {
            showRow = false;
        }
        if (logFilter === 'errors' && !status.includes('falha')) {
            showRow = false;
        }

        // Filtro por data
        if (dateFilter && !date.includes(dateFilter)) {
            showRow = false;
        }

        row.style.display = showRow ? '' : 'none';
    });
}

// Adicionar event listeners para os filtros e novos botões
document.addEventListener('DOMContentLoaded', function () {
    const logFilter = document.getElementById('logFilter');
    const dateFilter = document.getElementById('dateFilter');
    const themeToggleTop = document.getElementById('theme-toggle-top');

    if (logFilter) logFilter.addEventListener('change', filterLogs);
    if (dateFilter) dateFilter.addEventListener('change', filterLogs);
    if (themeToggleTop) themeToggleTop.addEventListener('click', toggleTheme);
});

// Sistema de logs persistente
function addLog(action, status) {
    const username = localStorage.getItem("username") || "desconhecido";
    const d = new Date();
    const timestamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

    const logEntry = { timestamp, username, action, status };

    let logs = JSON.parse(localStorage.getItem('smartfarm_logs') || '[]');
    logs.unshift(logEntry);
    logs = logs.slice(0, 100);
    localStorage.setItem('smartfarm_logs', JSON.stringify(logs));

    loadLogs();
}

function loadLogs() {
    const logsTableBody = document.getElementById("logsTableBody");
    if (!logsTableBody) return;

    const logs = JSON.parse(localStorage.getItem('smartfarm_logs') || '[]');
    logsTableBody.innerHTML = '';

    logs.forEach(log => {
        const row = document.createElement("tr");
        row.innerHTML = `
                <td>${log.timestamp}</td>
                <td>${log.username}</td>
                <td>${log.action}</td>
                <td><span class="${log.status === "Sucesso" ? "status-success" : "status-error"}">${log.status}</span></td>
            `;
        logsTableBody.appendChild(row);
    });
}

// Carregar logs ao trocar para view de logs
function changeView(view) {
    currentView = view;

    const views = ['home-view', 'indicadores-view', 'contato-view', 'logs-view'];
    views.forEach(viewId => {
        const element = document.getElementById(viewId);
        if (element) element.classList.add('hidden');
    });

    const buttons = ['home-btn', 'indicadores-btn', 'contato-btn', 'logs-btn'];
    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.classList.remove('active');
    });

    const header = document.getElementById('header');

    switch (view) {
        case 'home':
            document.getElementById('home-view')?.classList.remove('hidden');
            document.getElementById('home-btn')?.classList.add('active');
            if (header) header.innerText = "Home";
            break;
        case 'indicadores':
            document.getElementById('indicadores-view')?.classList.remove('hidden');
            document.getElementById('indicadores-btn')?.classList.add('active');
            if (header) header.innerText = "📊 Indicadores/KPIs";
            renderChart();
            break;
        case 'contato':
            document.getElementById('contato-view')?.classList.remove('hidden');
            document.getElementById('contato-btn')?.classList.add('active');
            if (header) header.innerText = "👤 Contato/CV";
            break;
        case 'logs':
            document.getElementById('logs-view')?.classList.remove('hidden');
            document.getElementById('logs-btn')?.classList.add('active');
            if (header) header.innerText = "📋 Logs/Auditoria";
            loadLogs();
            break;
    }
}