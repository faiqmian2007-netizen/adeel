// Initialize Socket.IO connection
const socket = io();

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');

// Socket event listeners
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Button event listeners
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        window.location.href = 'login.html';
    });
}

if (registerBtn) {
    registerBtn.addEventListener('click', () => {
        window.location.href = 'register.html';
    });
}

// Test API connection
fetch('/api/health')
    .then(response => response.json())
    .then(data => {
        console.log('API Health Check:', data);
    })
    .catch(error => {
        console.error('API Error:', error);
    });