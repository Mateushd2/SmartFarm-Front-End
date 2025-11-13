
const ESP32_IP = "http://10.106.33.1";

let isUpdating = false;

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
        
        document.getElementById("data").innerHTML = `
            Temperatura do Ambiente: ${data.temperature} °C<br>
            Umidade do ambiente: ${data.humidity}%<br>
            Vapor/Chuva: ${data.steam}%<br>
            Luz do ambiente ${data.light}<br>
            Umidade do Solo: ${data.soil}%<br>
            Nível da água: ${data.water}%
        `;
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

setInterval(updateSensors, 2000);
updateSensors();
