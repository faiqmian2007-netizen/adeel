// Authentication utilities
class Auth {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.socket = io();
        this.init();
    }

    init() {
        this.setupEventListeners();
        
        // If user is already logged in, check approval status and redirect appropriately
        if (this.token && this.isLoggedIn()) {
            if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
                this.checkUserApprovalAndRedirect();
            }
        }
    }

    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const loginBtn = document.getElementById('loginBtn');
        const btnText = loginBtn.querySelector('.btn-text');
        const spinner = loginBtn.querySelector('.spinner');
        const messageEl = document.getElementById('message');

        // Get form data
        const formData = new FormData(e.target);
        const credentials = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        try {
            // Show loading state
            loginBtn.disabled = true;
            btnText.textContent = 'Signing in...';
            spinner.classList.remove('hidden');
            this.hideMessage();

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            const data = await response.json();

            if (response.ok) {
                // Store token and user data
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                
                this.showMessage('Login successful! Checking account status...', 'success');
                
                // Authenticate socket connection
                this.socket.emit('authenticate', data.token);
                
                // Check approval status and redirect accordingly
                setTimeout(() => {
                    this.checkUserApprovalAndRedirect();
                }, 1000);
            } else {
                this.showMessage(data.error || 'Login failed. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Network error. Please check your connection and try again.', 'error');
        } finally {
            // Reset button state
            loginBtn.disabled = false;
            btnText.textContent = 'Sign In';
            spinner.classList.add('hidden');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const registerBtn = document.getElementById('registerBtn');
        const btnText = registerBtn.querySelector('.btn-text');
        const spinner = registerBtn.querySelector('.spinner');
        const messageEl = document.getElementById('message');

        // Get form data
        const formData = new FormData(e.target);
        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password')
        };

        try {
            // Show loading state
            registerBtn.disabled = true;
            btnText.textContent = 'Creating Account...';
            spinner.classList.remove('hidden');
            this.hideMessage();

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            const data = await response.json();

            if (response.ok) {
                // Store token and user data
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                
                this.showMessage('Account created successfully! Redirecting to approval page...', 'success');
                
                // Authenticate socket connection
                this.socket.emit('authenticate', data.token);
                
                // Redirect to approval page after short delay
                setTimeout(() => {
                    window.location.href = 'approval.html';
                }, 1000);
            } else {
                this.showMessage(data.error || 'Registration failed. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage('Network error. Please check your connection and try again.', 'error');
        } finally {
            // Reset button state
            registerBtn.disabled = false;
            btnText.textContent = 'Create Account';
            spinner.classList.add('hidden');
        }
    }

    showMessage(message, type) {
        const messageEl = document.getElementById('message');
        messageEl.textContent = message;
        messageEl.className = `message ${type}`;
        messageEl.classList.remove('hidden');
    }

    hideMessage() {
        const messageEl = document.getElementById('message');
        messageEl.classList.add('hidden');
    }

    async checkUserApprovalAndRedirect() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                window.location.href = 'login.html';
                return;
            }

            const response = await fetch('/api/auth/profile', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const user = data.user;
                
                // Update user data in localStorage
                localStorage.setItem('userData', JSON.stringify(user));
                
                if (user.isApproved) {
                    // User is approved, redirect to dashboard
                    window.location.href = 'dashboard.html';
                } else {
                    // User is not approved, redirect to approval page
                    window.location.href = 'approval.html';
                }
            } else {
                // If profile fetch fails, redirect to login
                this.logout();
            }
        } catch (error) {
            console.error('Error checking user approval status:', error);
            this.logout();
        }
    }

    isLoggedIn() {
        const token = localStorage.getItem('authToken');
        if (!token) return false;

        try {
            // Basic JWT token validation (check if not expired)
            const payload = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Date.now() / 1000;
            return payload.exp > currentTime;
        } catch (error) {
            return false;
        }
    }

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        window.location.href = 'login.html';
    }

    static requireAuth() {
        const auth = new Auth();
        if (!auth.isLoggedIn()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }
}

// Initialize authentication
document.addEventListener('DOMContentLoaded', () => {
    new Auth();
});