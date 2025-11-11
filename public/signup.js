// API Base URL
const API_BASE = 'http://localhost:3000/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.querySelector('.signup-form');
    
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
});

async function handleSignup(e) {
    e.preventDefault();
    
    const username = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    if (!username || !email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }
    
    // Disable button during request
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing up...';
    
    try {
        const response = await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store token and user info
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', data.user.userId);
            localStorage.setItem('userName', data.user.username);
            
            // Set flag to play login sound
            localStorage.setItem('playLoginSound', 'true');
            
            // Redirect to main feed
            window.location.href = 'index.html';
        } else {
            alert(data.error || 'Signup failed. Please try again.');
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('An error occurred. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

