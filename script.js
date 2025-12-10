// ===================================
// script.js - Smart Farm Dashboard
// ===================================

const ESP32_IP = "http://10.91.144.1";

// Variáveis de Estado
let isUpdating = false;
let sensorHistory = []; // Histórico para o gráfico
const HISTORY_LIMIT = 60; // Limite de 60 amostras
let currentView = 'home'; // Controla o modo atual (home, indicadores, contato, logs)

// RNF03: Sistema de retry e confiabilidade
let retryCount = 0;
const MAX_RETRIES = 3;
let isConnected = true;
let backoffDelay = 1000; // Delay inicial de 1s

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
 * RNF01: Mostra feedback visual de loading
 */
function showLoading() {
    const dataEl = document.getElementById("data");
    if (dataEl && currentView === 'home') {
        dataEl.innerHTML = '<div class="loading">🔄 Carregando dados...</div>';
    }
}

/**
 * RNF01: Mostra feedback de sucesso
 */
function showSuccess() {
    updateConnectionStatus(true);
    retryCount = 0;
    backoffDelay = 1000;
}

/**
 * RNF01/RNF03: Mostra feedback de erro e estado desconectado
 */
function showError(message) {
    updateConnectionStatus(false);
    const dataEl = document.getElementById("data");
    if (dataEl && currentView === 'home') {
        dataEl.innerHTML = `<div class="error">❌ ${escapeHtml(message)}</div>`;
    }
}

/**
 * RNF04: Proteção contra XSS - escapa HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * RNF03: Atualiza indicador de conexão
 */
function updateConnectionStatus(connected) {
    isConnected = connected;
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.textContent = connected ? '🟢 Conectado' : '🔴 Desconectado';
        statusEl.className = connected ? 'status-connected' : 'status-disconnected';
    }
}

/**
 * RNF03: Busca dados com sistema de retry e backoff
 */
async function updateSensors() {
    if (isUpdating) return;
    isUpdating = true;

    showLoading();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000); // RNF02: timeout de 2s
        const res = await fetch(`${ESP32_IP}/sensors`, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`HTTP ${res.status}: Falha na comunicação`);

        const data = await res.json();
        
        // RNF04: Validação básica dos dados
        if (typeof data.temperature !== 'number' || typeof data.humidity !== 'number') {
            throw new Error('Dados inválidos recebidos');
        }
        
        // Normaliza a luz e adiciona ao histórico
        data.light = normalizeLight(data.light); 
        addToHistory(data);
        
        // Atualiza o status dos atuadores
        updateActuatorStatus(); 

        // Atualiza a visualização no modo Home (com Cards)
        if (currentView === 'home') {
            document.getElementById("data").innerHTML = `
                <div class="sensor-card">
                    <div class="label">🌡️ Temperatura do Ambiente</div>
                    <div class="value">${escapeHtml(data.temperature.toString())} °C</div>
                </div>
                <div class="sensor-card">
                    <div class="label">💧 Umidade do Ambiente</div>
                    <div class="value">${escapeHtml(data.humidity.toString())}%</div>
                </div>
                <div class="sensor-card">
                    <div class="label">🌦️ Vapor/Chuva</div>
                    <div class="value">${escapeHtml(data.steam.toString())}%</div>
                </div>
                <div class="sensor-card">
                    <div class="label">💡 Luz do Ambiente</div>
                    <div class="value">${escapeHtml(data.light.toString())}%</div>
                </div>
                <div class="sensor-card">
                    <div class="label">🌱 Umidade do Solo</div>
                    <div class="value">${escapeHtml(data.soil.toString())}%</div>
                </div>
                <div class="sensor-card">
                    <div class="label">🚰 Nível da Água</div>
                    <div class="value">${escapeHtml(data.water.toString())}%</div>
                </div>
            `;
        }
        
        // Se estiver no modo indicadores, redesenha o gráfico
        if (currentView === 'indicadores') {
            renderChart();
        }

        showSuccess();

    } catch (erro) {
        console.error("Erro ao conectar com o ESP32:", erro);
        
        // RNF03: Sistema de retry com backoff exponencial
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            showError(`Tentativa ${retryCount}/${MAX_RETRIES} - Reconectando...`);
            
            setTimeout(() => {
                updateSensors();
            }, backoffDelay);
            
            backoffDelay *= 2; // Backoff exponencial
        } else {
            showError('Falha na conexão após múltiplas tentativas');
        }

    } finally {
        isUpdating = false;
    }
}

/**
 * RNF03/RNF04: Envia comando com retry e validação
 * @param {string} cmd - Comando a ser enviado.
 */
async function sendCmd(cmd) {
    // RNF04: Validação de entrada
    const validCmds = ['LED_ON', 'LED_OFF', 'FAN_ON', 'FAN_OFF', 'FEED', 'WATER'];
    if (!validCmds.includes(cmd)) {
        console.error('Comando inválido:', cmd);
        return;
    }

    const deviceNames = {
        LED_ON: "LED Ligado",
        LED_OFF: "LED Desligado", 
        FAN_ON: "Ventilador Ligado",
        FAN_OFF: "Ventilador Desligado",
        FEED: "Alimentar",
        WATER: "Regar"
    };

    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1000);
            
            const response = await fetch(`${ESP32_IP}/actuator?cmd=${encodeURIComponent(cmd)}`, { 
                signal: controller.signal,
                method: 'GET' // RNF04: Método explícito
            });
            
            clearTimeout(timeout);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            console.log("Comando enviado:", cmd);
            
            // Registrar log de sucesso
            if (typeof addLog === 'function') {
                addLog(deviceNames[cmd] || cmd, "Sucesso");
            }
            
            updateActuatorStatus();
            return; // Sucesso
            
        } catch (erro) {
            attempts++;
            console.warn(`Tentativa ${attempts} falhou:`, erro);
            
            if (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500)); // Aguarda 500ms
            }
        }
    }
    
    // Registrar log de falha
    if (typeof addLog === 'function') {
        addLog(deviceNames[cmd] || cmd, "Falha");
    }
    
    console.error('Falha ao enviar comando após múltiplas tentativas');
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
