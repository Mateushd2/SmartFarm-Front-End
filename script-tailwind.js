// ===================================
// script-tailwind.js - Smart Farm Dashboard com Tailwind
// ===================================

const ESP32_IP = "http://10.106.33.1";

// Variáveis de Estado
let isUpdating = false;
let sensorHistory = [];
const HISTORY_LIMIT = 60;
let currentView = 'dashboard';

// ===================================
// 1. FUNÇÕES DE COMANDO E SENSOR
// ===================================

function normalizeLight(raw) {
    let light = Math.pow(raw / 4095.0, 0.6) * 100.0;
    light = Math.round(light / 10) * 10;
    return Math.min(100, Math.max(0, light));
}

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

async function updateActuatorStatus() {
    try {
        const res = await fetch(`${ESP32_IP}/status`);
        if (!res.ok) throw new Error("Falha ao obter status dos atuadores.");
        
        const status = await res.json();

        for (const [key, isActive] of Object.entries(status)) {
            const button = document.getElementById(`btn-${key}`);
            const statusElement = document.getElementById(`status-${key}`);
            
            if (button && statusElement) {
                if (isActive) {
                    button.classList.add('animate-pulse-glow');
                    statusElement.classList.remove('bg-gray-500');
                    statusElement.classList.add('bg-green-500', 'dark:bg-green-400', 'active');
                    
                    if (key === 'LED') statusElement.textContent = 'Ligado';
                    if (key === 'FAN') statusElement.textContent = 'Ligado';
                    if (key === 'FEED') statusElement.textContent = 'Alimentando';
                    if (key === 'WATER') statusElement.textContent = 'Regando';
                } else {
                    button.classList.remove('animate-pulse-glow');
                    statusElement.classList.remove('bg-green-500', 'dark:bg-green-400', 'active');
                    statusElement.classList.add('bg-gray-500');
                    
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
        
        data.light = normalizeLight(data.light);
        addToHistory(data);
        updateActuatorStatus();

        if (currentView === 'dashboard') {
            document.getElementById("data").innerHTML = `
                <div class="sensor-card bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 text-center hover:-translate-y-2 hover:scale-105 hover:shadow-xl transition-all duration-300">
                    <div class="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">🌡️ Temperatura do Ambiente</div>
                    <div class="text-3xl font-bold text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110 transition-all duration-300">${data.temperature} °C</div>
                </div>
                <div class="sensor-card bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 text-center hover:-translate-y-2 hover:scale-105 hover:shadow-xl transition-all duration-300">
                    <div class="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">💧 Umidade do Ambiente</div>
                    <div class="text-3xl font-bold text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110 transition-all duration-300">${data.humidity}%</div>
                </div>
                <div class="sensor-card bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 text-center hover:-translate-y-2 hover:scale-105 hover:shadow-xl transition-all duration-300">
                    <div class="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">🌦️ Vapor/Chuva</div>
                    <div class="text-3xl font-bold text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110 transition-all duration-300">${data.steam}%</div>
                </div>
                <div class="sensor-card bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 text-center hover:-translate-y-2 hover:scale-105 hover:shadow-xl transition-all duration-300">
                    <div class="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">💡 Luz do Ambiente</div>
                    <div class="text-3xl font-bold text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110 transition-all duration-300">${data.light}%</div>
                </div>
                <div class="sensor-card bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 text-center hover:-translate-y-2 hover:scale-105 hover:shadow-xl transition-all duration-300">
                    <div class="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">🌱 Umidade do Solo</div>
                    <div class="text-3xl font-bold text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110 transition-all duration-300">${data.soil}%</div>
                </div>
                <div class="sensor-card bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 text-center hover:-translate-y-2 hover:scale-105 hover:shadow-xl transition-all duration-300">
                    <div class="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">🚰 Nível da Água</div>
                    <div class="text-3xl font-bold text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110 transition-all duration-300">${data.water}%</div>
                </div>
            `;
        }
        
        if (currentView === 'report') {
            renderChart();
        }

    } catch (erro) {
        if (currentView === 'dashboard') {
            document.getElementById("data").innerHTML = `<p class="text-red-500 text-xl col-span-full text-center">Erro ao conectar com o ESP32</p>`;
        }
        console.error("Erro ao conectar com o ESP32:", erro);
    } finally {
        isUpdating = false;
    }
}

async function sendCmd(cmd) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 800);
        await fetch(`${ESP32_IP}/actuator?cmd=${cmd}`, { signal: controller.signal });
        clearTimeout(timeout);
        console.log("Comando enviado:", cmd);
        
        updateActuatorStatus();
    } catch(erro) {
        console.warn("Erro ao enviar comando", erro);
    }
}

// ===================================
// 2. FUNÇÕES DE NAVEGAÇÃO
// ===================================

function changeView(view) {
    currentView = view;
    
    const dashboardDiv = document.getElementById('dashboard-view');
    const reportDiv = document.getElementById('report-view');
    const header = document.getElementById('header');
    
    document.querySelectorAll('.nav-link').forEach(btn => {
        btn.classList.remove('active');
    });

    const newActiveButton = document.querySelector(`.nav-link[onclick*="changeView('${view}')"]`);
    if (newActiveButton) {
        newActiveButton.classList.add('active');
    }

    if (view === 'report') {
        dashboardDiv.classList.add('hidden');
        reportDiv.classList.remove('hidden');
        header.innerText = "📊 Smart Farm - Gráficos dos Sensores";
        renderChart();
    } else {
        reportDiv.classList.add('hidden');
        dashboardDiv.classList.remove('hidden');
        header.innerText = "Smart Farm Dashboard";
    }
}

// ===================================
// 3. FUNÇÕES DE GRÁFICO
// ===================================

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

function renderChart() {
    const canvas = document.getElementById("chartCanvas");
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const width = canvas.width, height = canvas.height, margin = 50;
    const graphWidth = width - 2 * margin, graphHeight = height - 2 * margin;

    ctx.clearRect(0, 0, width, height);

    // Grade
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = margin + (graphHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(width - margin, y);
        ctx.stroke();
    }

    // Eixos
    const isDark = document.documentElement.classList.contains('dark');
    ctx.strokeStyle = isDark ? '#e5e7eb' : '#000';
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();

    // Rótulos
    ctx.fillStyle = isDark ? '#e5e7eb' : '#000';
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
        const val = 100 - i * 20;
        const y = margin + (graphHeight / 5) * i;
        ctx.fillText(val + "%", margin - 10, y + 4);
    }

    ctx.textAlign = "center";
    ctx.fillText("Amostras (tempo)", width / 2, height - 10);
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Percentual (%)", -height / 2, 15);
    ctx.restore();

    // Dados
    const colors = {
        temp: "red",
        humidity: "blue", 
        steam: "purple",
        light: "orange",
        soil: "green",
        water: "cyan"
    };

    for (const [key, color] of Object.entries(colors)) {
        const data = sensorHistory.map(d => d[key]);
        drawLine(ctx, data, color, graphWidth, graphHeight, margin, width, height);
    }
}

// ===================================
// 4. FUNÇÕES DE AUTENTICAÇÃO
// ===================================

function checkAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn) {
        window.location.href = 'login.html';
    }
}

function logout() {
    localStorage.removeItem('isLoggedIn');
    window.location.href = 'login.html';
}

// ===================================
// 5. FUNÇÕES DE TEMA
// ===================================

function toggleTheme() {
    const html = document.documentElement;
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        themeToggle.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        themeToggle.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    }

    if (currentView === 'report') {
        renderChart();
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        themeToggle.textContent = '☀️';
    } else {
        themeToggle.textContent = '🌙';
    }
    
    const initialActiveButton = document.querySelector(`.nav-link[onclick*="changeView('dashboard')"]`);
    if (initialActiveButton) {
        initialActiveButton.classList.add('active');
    }
}

// ===================================
// 6. INICIALIZAÇÃO
// ===================================

checkAuth();
document.addEventListener('DOMContentLoaded', initTheme);
setInterval(updateSensors, 2000);
updateSensors();