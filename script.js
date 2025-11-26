// ===================================
// script.js - Smart Farm Dashboard
// ===================================

const ESP32_IP = "http://10.106.33.1";

// Variáveis de Estado
let isUpdating = false;
let sensorHistory = []; // Histórico para o gráfico
const HISTORY_LIMIT = 60; // Limite de 60 amostras
let currentView = 'dashboard'; // Controla o modo atual (dashboard ou report)

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

        // Atualiza a visualização no modo Dashboard (com Cards)
        if (currentView === 'dashboard') {
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
        
        // Se estiver no modo relatório, redesenha o gráfico
        if (currentView === 'report') {
            renderChart();
        }

    } catch (erro) {
        // Exibe erro apenas no modo dashboard para não sobrepor o gráfico
        if (currentView === 'dashboard') {
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
        
    }catch(erro){
        console.warn("Erro ao enviar comando", erro);
    }
}

// ===================================
// 2. FUNÇÕES DE TROCA DE VISUALIZAÇÃO
// ===================================

/**
 * Alterna entre as visualizações Dashboard e Relatório Gráfico.
 * @param {string} view - O modo a ser ativado ('dashboard' ou 'report').
 */
function changeView(view) {
    currentView = view;
    
    const dashboardDiv = document.getElementById('dashboard-view');
    const reportDiv = document.getElementById('report-view');
    const header = document.getElementById('header');

    if (view === 'report') {
        dashboardDiv.classList.add('hidden');
        reportDiv.classList.remove('hidden');
        header.innerText = "📊 Smart Farm - Gráficos dos Sensores";
        renderChart(); // Desenha o gráfico imediatamente
    } else {
        reportDiv.classList.add('hidden');
        dashboardDiv.classList.remove('hidden');
        header.innerText = "Smart Farm Dashboard";
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
    ctx.strokeStyle = "#000";
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();

    // --- Rótulos Eixo Y (0–100%) ---
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
        // Nota: O gráfico usa escala 0-100% para todos os dados (Temperatura, Umidade, etc.).
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
    const html = document.documentElement;
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (html.getAttribute('data-theme') === 'dark') {
        html.removeAttribute('data-theme');
        themeToggle.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    }
}

/**
 * Inicializa o tema baseado na preferência salva
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
    } else {
        themeToggle.textContent = '🌙';
    }
}

// ===================================
// 6. INICIALIZAÇÃO
// ===================================
// Verifica autenticação
checkAuth();

// Inicializa o tema
document.addEventListener('DOMContentLoaded', initTheme);

// Inicia a atualização dos dados a cada 2 segundos
setInterval(updateSensors, 2000);

// Faz a primeira leitura e configura a tela
updateSensors();
