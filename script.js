// ===================================
// script.js - Smart Farm Dashboard
// ===================================

const ESP32_IP = "http://10.91.144.1";

// Variáveis de Estado
let isUpdating = false;
let sensorHistory = []; // Histórico para o gráfico
const HISTORY_LIMIT = 60; // Limite de 60 amostras
let currentView = 'home'; // Controla o modo atual (home, indicadores, contato, logs)

// ===================================
// 1. FUNÇÕES DE COMANDO E SENSOR
// ===================================

/**
 * Normaliza o valor de luz bruta (0-4095) para um percentual (0-100).
 * @param {number} raw - Valor lido do sensor de luz.
 * @returns {number} - Valor normalizado e arredondado.
 */
function normalizeLight(raw) {
    let light = Math.pow(raw / 4095.0, 0.6) * 100.0;
    light = Math.round(light / 10) * 10;
    return Math.min(100, Math.max(0, light));
}

/**
 * Adiciona a leitura de dados ao histórico para o gráfico.
 * @param {object} data - Dados atuais dos sensores.
 */
function addToHistory(data) {
    if (sensorHistory.length >= HISTORY_LIMIT) sensorHistory.shift();
    sensorHistory.push({
        temp: data.temperature,
        humidity: data.humidity,
        steam: data.steam,
        light: data.light,
        soil: data.soil,
        water: data.water
    });
}

/**
 * Busca e atualiza o estado dos atuadores (LED, FAN, etc.) - INDICADORES
 */
async function updateActuatorStatus() {
    try {
        // Assume-se que o endpoint /status retorna um JSON como { "LED": true, "FAN": false, ... }
        const res = await fetch(`${ESP32_IP}/status`); 
        if (!res.ok) throw new Error("Falha ao obter status dos atuadores.");
        
        const status = await res.json();

        // Mapeia o estado retornado para classes CSS e atualiza o status
        for (const [key, isActive] of Object.entries(status)) {
            const button = document.getElementById(`btn-${key}`);
            const statusElement = document.getElementById(`status-${key}`);
            
            if (button && statusElement) {
                if (isActive) {
                    button.classList.add('active');
                    statusElement.classList.add('active');
                    // Atualiza o status
                    if (key === 'LED') statusElement.textContent = 'Ligado';
                    if (key === 'FAN') statusElement.textContent = 'Ligado';
                    if (key === 'FEED') statusElement.textContent = 'Alimentando';
                    if (key === 'WATER') statusElement.textContent = 'Regando';
                } else {
                    button.classList.remove('active');
                    statusElement.classList.remove('active');
                    // Volta ao status original
                    if (key === 'LED') statusElement.textContent = 'Desligado';
                    if (key === 'FAN') statusElement.textContent = 'Desligado';
                    if (key === 'FEED') statusElement.textContent = 'Parado';
                    if (key === 'WATER') statusElement.textContent = 'Parado';
                }
            }
        }

    } catch (erro) {
        console.warn("Erro ao buscar status dos atuadores", erro);
    }
}


/**
 * Busca e atualiza os dados dos sensores no ESP32.
 */
async function updateSensors() {
    if (isUpdating) return;
    isUpdating = true;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`${ESP32_IP}/sensors`, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) throw new Error("Falha ao obter dados dos sensores.");

        const data = await res.json();
        
        // Normaliza a luz e adiciona ao histórico
        data.light = normalizeLight(data.light); 
        addToHistory(data);
        
        // Atualiza o status dos atuadores (CHAMADA PARA INDICADORES)
        updateActuatorStatus(); 

        // Atualiza a visualização no modo Home (com Cards)
        if (currentView === 'home') {
            document.getElementById("data").innerHTML = `
                <div class="sensor-card">
                    <div class="label">🌡️ Temperatura do Ambiente</div>
                    <div class="value">${data.temperature} °C</div>
                </div>
                <div class="sensor-card">
                    <div class="label">💧 Umidade do Ambiente</div>
                    <div class="value">${data.humidity}%</div>
                </div>
                <div class="sensor-card">
                    <div class="label">🌦️ Vapor/Chuva</div>
                    <div class="value">${data.steam}%</div>
                </div>
                <div class="sensor-card">
                    <div class="label">💡 Luz do Ambiente</div>
                    <div class="value">${data.light}%</div>
                </div>
                <div class="sensor-card">
                    <div class="label">🌱 Umidade do Solo</div>
                    <div class="value">${data.soil}%</div>
                </div>
                <div class="sensor-card">
                    <div class="label">🚰 Nível da Água</div>
                    <div class="value">${data.water}%</div>
                </div>
            `;
        }
        
        // Se estiver no modo indicadores, redesenha o gráfico
        if (currentView === 'indicadores') {
            renderChart();
        }

    } catch (erro) {
        // Exibe erro apenas no modo home para não sobrepor o gráfico
        if (currentView === 'home') {
            document.getElementById("data").innerHTML = `<p style="color:red; font-size:1.2em;">Erro ao conectar com o ESP32</p>`;
        }
        console.error("Erro ao conectar com o ESP32:", erro);

    } finally {
        isUpdating = false;
    }
}

/**
 * Envia um comando para o atuador (LED, FAN, FEED, WATER).
 * @param {string} cmd - Comando a ser enviado.
 */
async function sendCmd(cmd) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 800);
        await fetch(`${ESP32_IP}/actuator?cmd=${cmd}`, { signal: controller.signal });
        clearTimeout(timeout);
        console.log("Comando enviado:", cmd);
        
        // Tenta buscar o novo status imediatamente após o comando
        updateActuatorStatus();

    }catch(erro){
        console.warn("Erro ao enviar comando", erro);
    }
}

// ===================================
// 2. FUNÇÕES DE TROCA DE VISUALIZAÇÃO - NAVEGAÇÃO
// ===================================

/**
 * Alterna entre as visualizações do sistema.
 * @param {string} view - O modo a ser ativado ('home', 'indicadores', 'contato', 'logs').
 */
function changeView(view) {
    currentView = view;
    
    // Ocultar todas as views
    const views = ['home-view', 'indicadores-view', 'contato-view', 'logs-view'];
    views.forEach(viewId => {
        const element = document.getElementById(viewId);
        if (element) element.classList.add('hidden');
    });
    
    // Remover classe active de todos os botões
    const buttons = ['home-btn', 'indicadores-btn', 'contato-btn', 'logs-btn'];
    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.classList.remove('active');
    });
    
    const header = document.getElementById('header');
    
    // Mostrar view selecionada
    switch(view) {
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
            break;
    }
}


// ===================================
// 3. FUNÇÕES DE DESENHO DO GRÁFICO (Chart)
// ===================================

/**
 * Desenha uma linha de dados no contexto do canvas.
 * (Função adaptada do seu index_graph.html)
 */
function drawLine(ctx, data, color, graphWidth, graphHeight, margin, width, height) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    data.forEach((val, i) => {
        const x = margin + (i / Math.max(data.length - 1, 1)) * graphWidth;
        const y = height - margin - (val / 100) * graphHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();

    ctx.fillStyle = color;
    data.forEach((val, i) => {
        const x = margin + (i / Math.max(data.length - 1, 1)) * graphWidth;
        const y = height - margin - (val / 100) * graphHeight;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
    });
}

/**
 * Renderiza todo o gráfico de histórico no Canvas.
 */
function renderChart() {
    const canvas = document.getElementById("chartCanvas");
    if (!canvas) return;
    
    // Configurações e cálculo de dimensões
    const ctx = canvas.getContext("2d");
    const width = canvas.width, height = canvas.height, margin = 50;
    const graphWidth = width - 2 * margin, graphHeight = height - 2 * margin;

    ctx.clearRect(0, 0, width, height);

    // --- Desenho da Grade ---
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = margin + (graphHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(width - margin, y);
        ctx.stroke();
    }

    // --- Desenho dos Eixos ---
    // Ajusta a cor dos eixos no modo escuro
    ctx.strokeStyle = document.documentElement.classList.contains('dark') ? '#e9ecef' : '#000';
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();

    // --- Rótulos Eixo Y (0–100%) ---
    // Ajusta a cor do texto no modo escuro
    ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#e9ecef' : '#000';
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
        const val = 100 - i * 20;
        const y = margin + (graphHeight / 5) * i;
        ctx.fillText(val + "%", margin - 10, y + 4);
    }

    // --- Rótulos Eixo X (Tempo) ---
    ctx.textAlign = "center";
    ctx.fillText("Amostras (tempo)", width / 2, height - 10);
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.font = "10px Arial";
    ctx.fillText("Percentual (%)", -height / 2, 15);
    ctx.restore();

    // --- Desenho dos Dados ---
    const colors = {
        temp: "red",
        humidity: "blue",
        steam: "purple",
        light: "orange",
        soil: "green",
        water: "cyan"
    };

    for (const [key, color] of Object.entries(colors)) {
        // Mapeia os dados, forçando 'temp' para 0-100 para o gráfico (ex: se temp for 25°C, desenha na linha 25%)
        const data = sensorHistory.map(d => d[key]);
        drawLine(ctx, data, color, graphWidth, graphHeight, margin, width, height);
    }
}


// ===================================
// 4. FUNÇÕES DE AUTENTICAÇÃO
// ===================================

/**
 * Verifica se o usuário está logado
 */
function checkAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn) {
        window.location.href = 'login.html';
    }
}

/**
 * Função de logout
 */
function logout() {
    localStorage.removeItem('isLoggedIn');
    window.location.href = 'login.html';
}

// ===================================
// 5. FUNÇÕES DE TEMA
// ===================================

/**
 * Alterna entre tema claro e escuro
 */
function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Atualiza ícones do sidebar
    const moonIcon = document.getElementById('moon-icon');
    const sunIcon = document.getElementById('sun-icon');
    
    if (moonIcon && sunIcon) {
        if (isDark) {
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        } else {
            moonIcon.classList.remove('hidden');
            sunIcon.classList.add('hidden');
        }
    }
    
    // Atualiza ícones do topo
    const moonIconTop = document.getElementById('moon-icon-top');
    const sunIconTop = document.getElementById('sun-icon-top');
    
    if (moonIconTop && sunIconTop) {
        if (isDark) {
            moonIconTop.classList.add('hidden');
            sunIconTop.classList.remove('hidden');
        } else {
            moonIconTop.classList.remove('hidden');
            sunIconTop.classList.add('hidden');
        }
    }

    // Redesenha o gráfico se estiver visível (para atualizar cores/eixos)
    if (currentView === 'report') {
        renderChart();
    }
}

/**
 * Inicializa o tema baseado na preferência salva
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const moonIcon = document.getElementById('moon-icon');
    const sunIcon = document.getElementById('sun-icon');
    const moonIconTop = document.getElementById('moon-icon-top');
    const sunIconTop = document.getElementById('sun-icon-top');
    
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        if (moonIcon && sunIcon) {
            moonIcon.classList.add('hidden');
            sunIcon.classList.remove('hidden');
        }
        if (moonIconTop && sunIconTop) {
            moonIconTop.classList.add('hidden');
            sunIconTop.classList.remove('hidden');
        }
    } else {
        document.documentElement.classList.remove('dark');
        if (moonIcon && sunIcon) {
            moonIcon.classList.remove('hidden');
            sunIcon.classList.add('hidden');
        }
        if (moonIconTop && sunIconTop) {
            moonIconTop.classList.remove('hidden');
            sunIconTop.classList.add('hidden');
        }
    }
    
    // Define o link ativo inicial do sidebar
    const initialActiveButton = document.getElementById('home-btn');
    if (initialActiveButton) {
        initialActiveButton.classList.add('active');
    }
}

// ===================================
// 6. INICIALIZAÇÃO
// ===================================
// Verifica autenticação
checkAuth();

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    
    const buttons = ['theme-toggle'];
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', toggleTheme);
        }
    });
});

// Inicia a atualização dos dados a cada 2 segundos
setInterval(updateSensors, 2000);

// Faz a primeira leitura e configura a tela
updateSensors();