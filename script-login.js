// Função de login
function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    // Credenciais padrão + contas criadas
    const defaultUsers = {
        'aluno': { password: 'aluno123', role: 'aluno' },
        'professor': { password: 'prof123', role: 'professor' }
    };

    // Buscar contas criadas pelo usuário
    const customUsers = JSON.parse(localStorage.getItem('customUsers') || '{}');
    const allUsers = { ...defaultUsers, ...customUsers };

    if (allUsers[username] && allUsers[username].password === password) {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', allUsers[username].role);
        localStorage.setItem('username', username);
        window.location.href = 'index.html';
    } else {
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 3000);
    }
}

// Função de registro
function handleRegister(event) {
    event.preventDefault();

    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');

    // Validar senhas
    if (password !== confirmPassword) {
        errorMessage.textContent = 'As senhas não coincidem!';
        errorMessage.style.display = 'block';
        setTimeout(() => errorMessage.style.display = 'none', 3000);
        return;
    }

    // Verificar se usuário já existe
    const defaultUsers = ['aluno', 'professor'];
    const customUsers = JSON.parse(localStorage.getItem('customUsers') || '{}');

    if (defaultUsers.includes(username) || customUsers[username]) {
        errorMessage.textContent = 'Usuário já existe!';
        errorMessage.style.display = 'block';
        setTimeout(() => errorMessage.style.display = 'none', 3000);
        return;
    }

    // Criar nova conta (perfil aluno por padrão)
    customUsers[username] = { password: password, role: 'aluno' };
    localStorage.setItem('customUsers', JSON.stringify(customUsers));

    // Mostrar sucesso e voltar ao login
    successMessage.style.display = 'block';
    setTimeout(() => {
        successMessage.style.display = 'none';
        showLoginForm();
    }, 2000);
}

// Alternar para formulário de registro
function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.querySelector('h1').textContent = 'Criar Conta';
}

// Alternar para formulário de login
function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.querySelector('h1').textContent = 'Smart Farm';
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
});