# Smart Farm - Sistema de Monitoramento IoT

## Descrição
Sistema web para monitoramento e controle de fazenda inteligente com ESP32, sensores e atuadores.

## Execução Rápida
1. Abra `login.html` no navegador
2. Use credenciais: `aluno/aluno123` ou `professor/prof123`
3. Configure IP do ESP32 em `script.js` (linha 5)

## Estrutura
```
├── contacts               # Organização de currículos
├── login.html             # Tela de autenticação
├── index.html             # Dashboard principal
├── script.js              # Lógica JavaScript geral
├── script-index.js        # Lógica JavaScript para o index
├── script-login.js        # Lógica JavaScript para o login
├── script-tailwind.js     # Lógica JavaScript para os dashboards
├── styles-index.js        # Personalização para o index
├── styles-login.js        # Personalização para o login
└── icons8-fazenda-100.png # Logo
```

## Usuários
- **Aluno**: Controle total (aluno/aluno123)
- **Professor**: Somente leitura (professor/prof123)

## Configuração ESP32
Altere a variável `ESP32_IP` no arquivo `script.js`:
```javascript
const ESP32_IP = "http://SEU_IP_AQUI";
```

## Funcionalidades
- Monitoramento de 6 sensores
- Controle de 4 atuadores
- Gráficos em tempo real
- Sistema de logs
- Tema claro/escuro

## Tecnologias
- HTML5, CSS3, JavaScript (Vanilla)
- LocalStorage para autenticação
- Canvas API para gráficos
- Fetch API para comunicação
