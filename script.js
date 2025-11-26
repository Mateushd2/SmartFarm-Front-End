// ===============================
// script.js (Versão 3 - MESMA PÁGINA)
// ===============================

const ESP32_IP = "http://10.106.33.1";
let isUpdating = false;
let sensorHistory = []; // Histórico para o gráfico
const HISTORY_LIMIT = 60; 
let currentView = 'dashboard'; // Novo: Controla o modo atual

// ===============================
// FUNÇÕES DE COMANDO E SENSOR
// ===============================
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

        // Adiciona ao histórico
        addToHistory(data);

        // Atualiza o display de texto (se estiver no modo dashboard)
        if (currentView === 'dashboard') {
             document.getElementById("data").innerHTML = `
                Temperatura do Ambiente: ${data.temperature} °C<br>
                Umidade do ambiente: ${data.humidity}%<br>
                Vapor/Chuva: ${data.steam}%<br>
                Luz do ambiente ${data.light}%<br>
                Umidade do Solo: ${data.soil}%<br>
                Nível da água: ${data.water}%
            `;
        }
        
        // Se estiver no modo relatório, redesenha o gráfico
        if (currentView === 'report') {
            renderChart();
        }

    } catch (erro) {
        document.getElementById("data").innerText = "Erro ao conectar com o ESP32";

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
        
    }catch(erro){
        console.warn("Erro ao enviar comando", erro);
    }
}

// ===============================
// NOVO: FUNÇÃO DE TROCA DE VISUALIZAÇÃO
// ===============================
function changeView(view) {
    currentView = view;
    
    const dashboardDiv = document.getElementById('dashboard-view');
    const reportDiv = document.getElementById('report-view');
    const header = document.getElementById('header');

    if (view === 'report') {
        dashboardDiv.classList.add('hidden');
        reportDiv.classList.remove('hidden');
        header.innerText = "📊 Smart Farm - Gráficos dos Sensores";
        renderChart(); // Desenha o gráfico imediatamente ao entrar
    } else {
        reportDiv.classList.add('hidden');
        dashboardDiv.classList.remove('hidden');
        header.innerText = "Smart Farm Dashboard";
    }
}


// ===============================
// FUNÇÕES PARA O RELATÓRIO (Mantenha todas as funções de normalização, histórico e desenho de gráfico que enviei na resposta anterior)
// ===============================

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

    // Grade Horizontal
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = margin + (graphHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(width - margin, y);
        ctx.stroke();
    }

    // Eixos X e Y
    ctx.strokeStyle = "#000";
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();

    // Rótulos Eixo Y (0–100%)
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
        const val = 100 - i * 20;
        const y = margin + (graphHeight / 5) * i;
        ctx.fillText(val + "%", margin - 10, y + 4);
    }

    // Rótulos Eixo X
    ctx.textAlign = "center";
    ctx.fillText("Amostras (tempo)", width / 2, height - 10);
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Percentual (%)", -height / 2, 15);
    ctx.restore();

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


// ===============================
// INICIALIZAÇÃO
// ===============================
setInterval(updateSensors, 2000);
updateSensors();
