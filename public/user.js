// API Base URL - relative URL works in both dev and production
const API_BASE = '/api';

// State management
let currentUserId = localStorage.getItem('userId');
let currentUserName = localStorage.getItem('userName');
let myBooks = [];
let allTrades = [];
let currentBookFilter = 'current'; // 'current' or 'previous'

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeUserPage();
});

function initializeUserPage() {
    // Check if user exists
    if (currentUserId && currentUserName) {
        showMyBooks();
        loadMyBooks();
        updateUserInfo();
    } else {
        showUserPrompt();
    }

    // Event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // User prompt
    const startBtn = document.getElementById('startBtn');
    const userNameInput = document.getElementById('userNameInput');
    
    if (startBtn) {
        startBtn.addEventListener('click', handleStart);
        userNameInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleStart();
        });
    }

    // Toggle add book form
    const toggleAddBookBtn = document.getElementById('toggleAddBookBtn');
    if (toggleAddBookBtn) {
        toggleAddBookBtn.addEventListener('click', toggleAddBookForm);
    }

    // Cancel add book
    const cancelAddBookBtn = document.getElementById('cancelAddBookBtn');
    if (cancelAddBookBtn) {
        cancelAddBookBtn.addEventListener('click', hideAddBookForm);
    }

    // Add book form
    const addBookForm = document.getElementById('addBookForm');
    if (addBookForm) {
        console.log('Add book form found, attaching event listener');
        addBookForm.addEventListener('submit', handleAddBook);
    } else {
        console.error('Add book form not found!');
    }

    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsModal);
    }

    // Settings modal
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModal = settingsModal?.querySelector('.close-modal');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    const settingsForm = document.getElementById('settingsForm');

    if (closeSettingsModal) {
        closeSettingsModal.addEventListener('click', closeSettings);
    }

    if (cancelSettingsBtn) {
        cancelSettingsBtn.addEventListener('click', closeSettings);
    }

    if (settingsForm) {
        settingsForm.addEventListener('submit', handleSaveSettings);
    }

    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettings();
        }
    });

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Book filter buttons
    const filterCurrentBtn = document.getElementById('filterCurrentBtn');
    const filterPreviousBtn = document.getElementById('filterPreviousBtn');
    
    if (filterCurrentBtn) {
        filterCurrentBtn.addEventListener('click', () => {
            currentBookFilter = 'current';
            filterCurrentBtn.classList.add('active');
            filterPreviousBtn.classList.remove('active');
            renderMyBooks();
        });
    }
    
    if (filterPreviousBtn) {
        filterPreviousBtn.addEventListener('click', () => {
            currentBookFilter = 'previous';
            filterPreviousBtn.classList.add('active');
            filterCurrentBtn.classList.remove('active');
            renderMyBooks();
        });
    }

    // Edit book modal
    const editBookModal = document.getElementById('editBookModal');
    const closeEditBookModalBtn = editBookModal?.querySelector('.close-modal');
    const cancelEditBookBtn = document.getElementById('cancelEditBookBtn');
    const editBookForm = document.getElementById('editBookForm');

    if (closeEditBookModalBtn) {
        closeEditBookModalBtn.addEventListener('click', closeEditBookModal);
    }

    if (cancelEditBookBtn) {
        cancelEditBookBtn.addEventListener('click', closeEditBookModal);
    }

    if (editBookForm) {
        editBookForm.addEventListener('submit', handleEditBook);
    }

    window.addEventListener('click', (e) => {
        if (e.target === editBookModal) {
            closeEditBookModal();
        }
    });

    // Shipping address modal
    const shippingModal = document.getElementById('shippingAddressModal');
    const closeShippingModalBtn = shippingModal?.querySelector('.close-modal');
    const closeShippingBtn = document.getElementById('closeShippingModalBtn');
    const markAsMailedBtn = document.getElementById('markAsMailedBtn');

    if (closeShippingModalBtn) {
        closeShippingModalBtn.addEventListener('click', closeShippingModal);
    }

    if (closeShippingBtn) {
        closeShippingBtn.addEventListener('click', closeShippingModal);
    }

    if (markAsMailedBtn) {
        markAsMailedBtn.addEventListener('click', markAsMailed);
    }

    window.addEventListener('click', (e) => {
        if (e.target === shippingModal) {
            closeShippingModal();
        }
    });

    // Trade history modal
    const tradeHistoryModal = document.getElementById('tradeHistoryModal');
    const closeTradeHistoryBtn = document.getElementById('closeTradeHistoryBtn');

    if (closeTradeHistoryBtn) {
        closeTradeHistoryBtn.addEventListener('click', closeTradeHistoryModal);
    }

    window.addEventListener('click', (e) => {
        if (e.target === tradeHistoryModal) {
            closeTradeHistoryModal();
        }
    });

}

function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        // Clear all user data from localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        
        // Clear state variables
        currentUserId = null;
        currentUserName = null;
        myBooks = [];
        
        // Redirect to login page
        window.location.href = 'login.html';
    }
}

function closeEditBookModal() {
    const modal = document.getElementById('editBookModal');
    if (modal) {
        modal.style.display = 'none';
    }
    const form = document.getElementById('editBookForm');
    if (form) {
        form.reset();
    }
}

async function openEditBookModal(bookId) {
    if (!currentUserId) {
        alert('Please log in first');
        return;
    }

    const book = myBooks.find(b => b.id === bookId || b.bookId === bookId);
    if (!book) {
        alert('Book not found');
        return;
    }

    const modal = document.getElementById('editBookModal');
    if (!modal) return;

    // Use bookId if available, otherwise use id
    const actualBookId = book.bookId || book.id;

    // Populate form with book data
    document.getElementById('editBookId').value = actualBookId;
    document.getElementById('editBookTitle').value = book.title || '';
    document.getElementById('editBookAuthor').value = book.author || '';
    document.getElementById('editBookDescription').value = book.description || '';
    document.getElementById('editBookCondition').value = book.condition || 'used';
    document.getElementById('editBookImage').value = ''; // Clear file input

    modal.style.display = 'block';
}

async function handleEditBook(e) {
    e.preventDefault();

    if (!currentUserId) {
        alert('Please log in first');
        return;
    }

    const bookId = document.getElementById('editBookId').value;
    const title = document.getElementById('editBookTitle').value.trim();
    const author = document.getElementById('editBookAuthor').value.trim();
    const description = document.getElementById('editBookDescription').value.trim();
    const condition = document.getElementById('editBookCondition').value;
    const imageFile = document.getElementById('editBookImage').files[0];

    if (!title || !author) {
        alert('Please fill in all required fields (Title and Author)');
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('author', author);
    formData.append('description', description);
    formData.append('condition', condition);
    if (imageFile) {
        formData.append('image', imageFile);
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/books/${bookId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (response.ok) {
            const updatedBook = await response.json();
            // Update book in local array
            const bookIndex = myBooks.findIndex(b => (b.id === bookId) || (b.bookId === bookId));
            if (bookIndex !== -1) {
                myBooks[bookIndex] = { 
                    ...myBooks[bookIndex], 
                    ...updatedBook, 
                    id: updatedBook.id || updatedBook.bookId,
                    bookId: updatedBook.bookId || updatedBook.id
                };
            }
            renderMyBooks();
            closeEditBookModal();
            alert('Book updated successfully!');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update book');
        }
    } catch (error) {
        console.error('Error updating book:', error);
        alert(error.message || 'Failed to update book. Please try again.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText || 'Save Changes';
        }
    }
}

// Make functions available globally for onclick handlers
window.openEditBookModal = openEditBookModal;
window.acceptTrade = acceptTrade;
window.declineTrade = declineTrade;
window.cancelTrade = cancelTrade;
window.showTradeHistory = showTradeHistory;

async function acceptTrade(tradeId, bookSelectId = null) {
    // If bookSelectId is provided, get the selected book
    let selectedBookId = null;
    if (bookSelectId) {
        const selectElement = document.getElementById(bookSelectId);
        if (selectElement) {
            selectedBookId = selectElement.value;
            if (!selectedBookId) {
                alert('Please select which book you want from the other user');
                return;
            }
        }
    }
    
    if (!confirm('Are you sure you want to accept this trade offer?')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const requestBody = selectedBookId ? { fromBookId: selectedBookId } : {};
        
        const response = await fetch(`${API_BASE}/trades/${tradeId}/accept`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestBody)
        });

        if (response.ok) {
            alert('Trade accepted!');
            loadTrades();
            loadMyBooks(); // Refresh books in case they were removed
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to accept trade');
        }
    } catch (error) {
        console.error('Error accepting trade:', error);
        alert(error.message || 'Failed to accept trade. Please try again.');
    }
}

async function declineTrade(tradeId) {
    if (!confirm('Are you sure you want to decline this trade offer?')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/trades/${tradeId}/decline`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            alert('Trade declined');
            loadTrades();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to decline trade');
        }
    } catch (error) {
        console.error('Error declining trade:', error);
        alert(error.message || 'Failed to decline trade. Please try again.');
    }
}

async function cancelTrade(tradeId) {
    if (!confirm('Are you sure you want to cancel this trade offer?')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/trades/${tradeId}/cancel`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            alert('Trade offer cancelled');
            loadTrades();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to cancel trade');
        }
    } catch (error) {
        console.error('Error cancelling trade:', error);
        alert(error.message || 'Failed to cancel trade. Please try again.');
    }
}

async function handleStart() {
    const userNameInput = document.getElementById('userNameInput');
    const name = userNameInput?.value.trim();
    
    if (!name) {
        alert('Please enter your name');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, userId: currentUserId })
        });

        const user = await response.json();
        currentUserId = user.id;
        currentUserName = user.name;
        
        localStorage.setItem('userId', currentUserId);
        localStorage.setItem('userName', currentUserName);

        showMyBooks();
        loadMyBooks();
        updateUserInfo();
    } catch (error) {
        console.error('Error creating user:', error);
        alert('Failed to create user. Please try again.');
    }
}

function showUserPrompt() {
    const prompt = document.getElementById('userPrompt');
    const container = document.getElementById('myBooksContainer');
    
    if (prompt) prompt.style.display = 'block';
    if (container) container.style.display = 'none';
}

function showMyBooks() {
    const prompt = document.getElementById('userPrompt');
    const container = document.getElementById('myBooksContainer');
    
    if (prompt) prompt.style.display = 'none';
    if (container) container.style.display = 'block';
    
    // Hide add book form by default
    hideAddBookForm();
}

function toggleAddBookForm() {
    const addBookSection = document.getElementById('addBookSection');
    
    if (addBookSection) {
        if (addBookSection.style.display === 'none' || !addBookSection.style.display) {
            addBookSection.style.display = 'block';
        } else {
            hideAddBookForm();
        }
    }
}

function hideAddBookForm() {
    const addBookSection = document.getElementById('addBookSection');
    const form = document.getElementById('addBookForm');
    
    if (addBookSection) {
        addBookSection.style.display = 'none';
    }
    if (form) {
        form.reset();
    }
}

function updateUserInfo() {
    const userNameEl = document.getElementById('currentUserName');
    const bookCountEl = document.getElementById('bookCount');
    
    if (userNameEl) userNameEl.textContent = currentUserName || 'My Books';
    
    // Only count current books (not previous) that are actually owned by the user
    if (bookCountEl) {
        const currentBooksCount = myBooks.filter(book => {
            const bookStatus = book.status || book.bookStatus || 'current';
            const bookUserId = book.userId || book.user_id;
            // Count books that are current and owned by the user
            return bookStatus === 'current' && bookUserId === currentUserId;
        }).length;
        bookCountEl.textContent = currentBooksCount;
    }
}

async function openSettingsModal() {
    if (!currentUserId) {
        alert('Please log in first');
        return;
    }

    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    // Load current user data
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/users/${currentUserId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const user = await response.json();
            
            // Populate form fields
            document.getElementById('settingsUsername').value = user.username || '';
            document.getElementById('settingsStreet').value = user.shippingAddress?.street || '';
            document.getElementById('settingsCity').value = user.shippingAddress?.city || '';
            document.getElementById('settingsState').value = user.shippingAddress?.state || '';
            document.getElementById('settingsZip').value = user.shippingAddress?.zip || '';
        }
    } catch (error) {
        console.error('Error loading user settings:', error);
    }

    modal.style.display = 'block';
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();

    if (!currentUserId) {
        alert('Please log in first');
        return;
    }

    const username = document.getElementById('settingsUsername').value.trim();
    const street = document.getElementById('settingsStreet').value.trim();
    const city = document.getElementById('settingsCity').value.trim();
    const state = document.getElementById('settingsState').value;
    const zip = document.getElementById('settingsZip').value.trim();

    if (!username) {
        alert('Username is required');
        return;
    }

    const shippingAddress = {};
    if (street) shippingAddress.street = street;
    if (city) shippingAddress.city = city;
    if (state) shippingAddress.state = state;
    if (zip) shippingAddress.zip = zip;

    const updates = {
        username: username
    };

    // Only include shipping address if at least one field is filled
    if (Object.keys(shippingAddress).length > 0) {
        updates.shippingAddress = shippingAddress;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/users/${currentUserId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
        });

        if (response.ok) {
            const updatedUser = await response.json();
            currentUserName = updatedUser.username;
            localStorage.setItem('userName', currentUserName);
            
            updateUserInfo();
            closeSettings();
            alert('Settings saved successfully!');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save settings');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        alert(error.message || 'Failed to save settings. Please try again.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText || 'Save Settings';
        }
    }
}

async function loadMyBooks() {
    if (!currentUserId) return;

    try {
        const response = await fetch(`${API_BASE}/users/${currentUserId}/books`);
        let books = await response.json();
        
        // Also fetch books that are no longer on their shelf (for "Previous Books" tab)
        // These include:
        // 1. Books they traded away (fromUserId === currentUserId in completed trades)
        // 2. Books they received but are no longer owned by them (toUserId === currentUserId, but userId !== currentUserId)
        try {
            const tradesResponse = await fetch(`${API_BASE}/users/${currentUserId}/trades`);
            if (tradesResponse.ok) {
                const trades = await tradesResponse.json();
                const completedTrades = trades.filter(trade => trade.status === 'completed');
                
                // Get unique book IDs from completed trades where user was the sender (books they traded away)
                const tradedAwayBookIds = [...new Set(
                    completedTrades
                        .filter(trade => trade.fromUserId === currentUserId)
                        .map(trade => trade.fromBookId)
                        .filter(bookId => bookId) // Filter out null/undefined
                )];
                
                // Get unique book IDs from completed trades where user was the receiver (books they received)
                const receivedBookIds = [...new Set(
                    completedTrades
                        .filter(trade => trade.toUserId === currentUserId)
                        .map(trade => trade.toBookId)
                        .filter(bookId => bookId)
                )];
                
                // Combine all book IDs that might be "previous" books
                const allPreviousBookIds = [...new Set([...tradedAwayBookIds, ...receivedBookIds])];
                
                // Fetch these books and check if they're no longer on the user's shelf
                // A book is "previous" if it was part of a completed trade involving the user,
                // but is NOT currently owned by them (userId !== currentUserId)
                if (allPreviousBookIds.length > 0) {
                    const previousBooks = await Promise.all(
                        allPreviousBookIds.map(async (bookId) => {
                            try {
                                const bookResponse = await fetch(`${API_BASE}/books/${bookId}`);
                                if (bookResponse.ok) {
                                    const book = await bookResponse.json();
                                    const bookUserId = book.userId || book.user_id;
                                    
                                    // If the book is currently owned by the user, it's not a "previous" book
                                    // (it should already be in the books list from the initial fetch)
                                    // If it's not owned by the user, it's a "previous" book (was on their shelf, now isn't)
                                    if (bookUserId !== currentUserId) {
                                        return {
                                            ...book,
                                            id: book.id || book.bookId
                                        };
                                    }
                                    
                                    return null;
                                }
                            } catch (error) {
                                console.warn(`Could not fetch book ${bookId}:`, error);
                            }
                            return null;
                        })
                    );
                    
                    // Add previous books that aren't already in the list
                    const existingBookIds = new Set(books.map(b => b.id || b.bookId));
                    previousBooks.forEach(book => {
                        if (book && !existingBookIds.has(book.id || book.bookId)) {
                            books.push(book);
                        }
                    });
                }
            }
        } catch (error) {
            console.warn('Could not load previous books:', error);
            // Continue without previous books - not critical
        }
        
        myBooks = books;
        updateUserInfo();
        renderMyBooks();
    } catch (error) {
        console.error('Error loading my books:', error);
    }
}

async function loadTrades() {
    if (!currentUserId) return;

    try {
        const response = await fetch(`${API_BASE}/users/${currentUserId}/trades`);
        allTrades = await response.json();
        renderSentOffers();
        renderReceivedOffers();
        renderAcceptedTrades();
    } catch (error) {
        console.error('Error loading trades:', error);
    }
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Show/hide filter buttons based on tab
    const filterButtons = document.querySelectorAll('.filter-btn');
    const filterContainer = filterButtons[0]?.parentElement;
    if (filterContainer) {
        filterContainer.style.display = tabName === 'books' ? 'flex' : 'none';
    }

    // Reset filter to current when switching away from books tab
    if (tabName !== 'books') {
        currentBookFilter = 'current';
        const filterCurrentBtn = document.getElementById('filterCurrentBtn');
        const filterPreviousBtn = document.getElementById('filterPreviousBtn');
        if (filterCurrentBtn) filterCurrentBtn.classList.add('active');
        if (filterPreviousBtn) filterPreviousBtn.classList.remove('active');
    }

    // Load trades when switching to trade tabs
    if ((tabName === 'sent' || tabName === 'received' || tabName === 'accepted') && allTrades.length === 0) {
        loadTrades();
    }
}

async function renderSentOffers() {
    const container = document.getElementById('sentOffersGrid');
    if (!container) return;

    const sentTrades = allTrades.filter(trade => trade.fromUserId === currentUserId && trade.status === 'pending');
    
    if (sentTrades.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>You haven\'t sent any trade offers yet</p></div>';
        return;
    }

    // Fetch book details for sent trades
    const tradeCards = await Promise.all(sentTrades.map(async (trade) => {
        try {
            const isAnyOfMyBooks = !trade.fromBookId;
            
            // Fetch my book only if it's specified (not "any of my books")
            const myBookRes = isAnyOfMyBooks ? null : await fetch(`${API_BASE}/books/${trade.fromBookId}`);
            const myBook = myBookRes && myBookRes.ok ? await myBookRes.json() : null;
            
            // Always fetch their book (the book they want)
            const theirBookRes = await fetch(`${API_BASE}/books/${trade.toBookId}`);
            const theirBook = theirBookRes.ok ? await theirBookRes.json() : null;
            
            if (!theirBook) return '';

            // Get the receiver's username
            const receiverRes = await fetch(`${API_BASE}/users/${trade.toUserId}`);
            const receiver = receiverRes.ok ? await receiverRes.json() : { username: 'Unknown' };

            return `
                <div class="trade-offer-card">
                    <div class="trade-offer-books">
                        <div class="trade-offer-book">
                            <img src="${theirBook.imageUrl}" alt="${theirBook.title}" class="trade-offer-image"
                                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect fill=%22%23D2D2D7%22 width=%22200%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%2386868B%22 font-family=%22system-ui%22 font-size=%2214%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                            <div class="trade-offer-book-info">
                                <div class="trade-offer-label">Their Book</div>
                                <div class="trade-offer-title">${escapeHtml(theirBook.title)}</div>
                                <div class="trade-offer-author">${escapeHtml(theirBook.author)}</div>
                            </div>
                        </div>
                        <div class="trade-offer-arrow">⇄</div>
                        <div class="trade-offer-book">
                            ${isAnyOfMyBooks ? `
                                <div class="trade-offer-placeholder" style="min-height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--color-bg); border: 1px dashed var(--color-border); border-radius: var(--border-radius); padding: 20px;">
                                    <div style="font-size: 16px; font-weight: 500; color: var(--color-text); margin-bottom: 8px;">Any of my books</div>
                                    <div style="font-size: 12px; color: var(--color-text-light); text-align: center;">They will select which book they want</div>
                                </div>
                            ` : `
                                <img src="${myBook.imageUrl}" alt="${myBook.title}" class="trade-offer-image"
                                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect fill=%22%23D2D2D7%22 width=%22200%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%2386868B%22 font-family=%22system-ui%22 font-size=%2214%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                                <div class="trade-offer-book-info">
                                    <div class="trade-offer-label">Your Book</div>
                                    <div class="trade-offer-title">${escapeHtml(myBook.title)}</div>
                                    <div class="trade-offer-author">${escapeHtml(myBook.author)}</div>
                                </div>
                            `}
                        </div>
                    </div>
                    ${trade.message ? `<div class="trade-offer-message">${escapeHtml(trade.message)}</div>` : ''}
                    <div class="trade-offer-actions">
                        <div class="trade-offer-sender">To: ${escapeHtml(receiver.username || 'Unknown')}</div>
                        <div class="trade-offer-status" style="margin-top: 8px;">Status: Pending</div>
                        <div style="display: flex; gap: 8px; margin-top: 8px;">
                            <button class="btn-secondary btn-small" onclick="cancelTrade('${trade.id}')">Cancel Offer</button>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering trade offer:', error);
            return '';
        }
    }));

    container.innerHTML = tradeCards.filter(card => card).join('');
}

async function renderReceivedOffers() {
    const container = document.getElementById('receivedOffersGrid');
    if (!container) return;

    const receivedTrades = allTrades.filter(trade => trade.toUserId === currentUserId && trade.status === 'pending');
    
    if (receivedTrades.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>You haven\'t received any trade offers yet</p></div>';
        return;
    }

    // Fetch book details for received trades
    const tradeCards = await Promise.all(receivedTrades.map(async (trade) => {
        try {
            const isAnyOfMyBooks = !trade.fromBookId;
            
            // Fetch their book only if it's specified (not "any of my books")
            const theirBookRes = isAnyOfMyBooks ? null : await fetch(`${API_BASE}/books/${trade.fromBookId}`);
            const theirBook = theirBookRes && theirBookRes.ok ? await theirBookRes.json() : null;
            
            // Always fetch my book (the book they want)
            const myBookRes = await fetch(`${API_BASE}/books/${trade.toBookId}`);
            const myBook = myBookRes.ok ? await myBookRes.json() : null;
            
            if (!myBook) return '';

            // Get the sender's username
            const senderRes = await fetch(`${API_BASE}/users/${trade.fromUserId}`);
            const sender = senderRes.ok ? await senderRes.json() : { username: 'Unknown' };
            
            // If "any of my books", fetch sender's current books for selection
            let senderBooks = [];
            let bookSelectHtml = '';
            if (isAnyOfMyBooks) {
                const senderBooksRes = await fetch(`${API_BASE}/users/${trade.fromUserId}/books`);
                if (senderBooksRes.ok) {
                    senderBooks = await senderBooksRes.json();
                    // Filter to only current books
                    senderBooks = senderBooks.filter(book => {
                        const bookStatus = book.status || 'current';
                        return bookStatus === 'current';
                    });
                    
                    if (senderBooks.length > 0) {
                        bookSelectHtml = `
                            <div style="margin-top: 12px;">
                                <label for="bookSelect_${trade.id}" style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: var(--color-text-light);">
                                    Select which book you want:
                                </label>
                                <select id="bookSelect_${trade.id}" class="book-select" style="width: 100%; padding: 8px; border: 1px solid var(--color-border); border-radius: var(--border-radius); font-size: 14px;">
                                    <option value="">Choose a book...</option>
                                    ${senderBooks.map(book => 
                                        `<option value="${book.id}">${escapeHtml(book.title)} by ${escapeHtml(book.author)}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        `;
                    }
                }
            }

            return `
                <div class="trade-offer-card">
                    <div class="trade-offer-books">
                        <div class="trade-offer-book">
                            ${isAnyOfMyBooks ? `
                                <div class="trade-offer-placeholder" style="min-height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--color-bg); border: 1px dashed var(--color-border); border-radius: var(--border-radius); padding: 20px;">
                                    <div style="font-size: 16px; font-weight: 500; color: var(--color-text); margin-bottom: 8px;">Any of their books</div>
                                    <div style="font-size: 12px; color: var(--color-text-light); text-align: center;">Select which book you want below</div>
                                </div>
                            ` : `
                                <img src="${theirBook.imageUrl}" alt="${theirBook.title}" class="trade-offer-image"
                                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect fill=%22%23D2D2D7%22 width=%22200%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%2386868B%22 font-family=%22system-ui%22 font-size=%2214%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                                <div class="trade-offer-book-info">
                                    <div class="trade-offer-label">Their Book</div>
                                    <div class="trade-offer-title">${escapeHtml(theirBook.title)}</div>
                                    <div class="trade-offer-author">${escapeHtml(theirBook.author)}</div>
                                </div>
                            `}
                        </div>
                        <div class="trade-offer-arrow">⇄</div>
                        <div class="trade-offer-book">
                            <img src="${myBook.imageUrl}" alt="${myBook.title}" class="trade-offer-image"
                                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect fill=%22%23D2D2D7%22 width=%22200%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%2386868B%22 font-family=%22system-ui%22 font-size=%2214%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                            <div class="trade-offer-book-info">
                                <div class="trade-offer-label">Your Book</div>
                                <div class="trade-offer-title">${escapeHtml(myBook.title)}</div>
                                <div class="trade-offer-author">${escapeHtml(myBook.author)}</div>
                            </div>
                        </div>
                    </div>
                    ${trade.message ? `<div class="trade-offer-message">${escapeHtml(trade.message)}</div>` : ''}
                    ${bookSelectHtml}
                    <div class="trade-offer-actions">
                        <div class="trade-offer-sender">From: ${escapeHtml(sender.username || 'Unknown')}</div>
                        <div style="display: flex; gap: 8px; margin-top: 8px;">
                            <button class="btn-primary btn-small" onclick="acceptTrade('${trade.id}', ${isAnyOfMyBooks ? `'bookSelect_${trade.id}'` : 'null'})">Accept</button>
                            <button class="btn-secondary btn-small" onclick="declineTrade('${trade.id}')">Decline</button>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering trade offer:', error);
            return '';
        }
    }));

    container.innerHTML = tradeCards.filter(card => card).join('');
}

async function renderAcceptedTrades() {
    const container = document.getElementById('acceptedTradesGrid');
    if (!container) return;

    const acceptedTrades = allTrades.filter(trade => 
        (trade.status === 'accepted' || trade.status === 'completed') && 
        (trade.fromUserId === currentUserId || trade.toUserId === currentUserId));
    
    if (acceptedTrades.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>You don\'t have any accepted trades yet</p></div>';
        return;
    }

    // Fetch book details and user info for accepted trades
    const tradeCards = await Promise.all(acceptedTrades.map(async (trade) => {
        try {
            const isSender = trade.fromUserId === currentUserId;
            const otherUserId = isSender ? trade.toUserId : trade.fromUserId;
            const myBookId = isSender ? trade.fromBookId : trade.toBookId;
            const theirBookId = isSender ? trade.toBookId : trade.fromBookId;

            const [myBookRes, theirBookRes, otherUserRes] = await Promise.all([
                fetch(`${API_BASE}/books/${myBookId}`),
                fetch(`${API_BASE}/books/${theirBookId}`),
                fetch(`${API_BASE}/users/${otherUserId}`)
            ]);
            
            const myBook = myBookRes.ok ? await myBookRes.json() : null;
            const theirBook = theirBookRes.ok ? await theirBookRes.json() : null;
            const otherUser = otherUserRes.ok ? await otherUserRes.json() : null;
            
            if (!myBook || !theirBook) return '';

            // Determine mailing and receiving status
            const fromUserMailed = trade.fromUserMailed || false;
            const toUserMailed = trade.toUserMailed || false;
            const fromUserReceived = trade.fromUserReceived || false;
            const toUserReceived = trade.toUserReceived || false;
            
            let statusText = 'trade pending, mail your trade';
            if (isSender) {
                if (fromUserReceived && toUserReceived) {
                    statusText = 'trade complete! both books have arrived';
                } else if (fromUserReceived) {
                    statusText = 'your book has arrived! waiting for other member to receive theirs';
                } else if (toUserReceived) {
                    statusText = 'other member received their book! waiting for yours to arrive';
                } else if (fromUserMailed && toUserMailed) {
                    statusText = 'both books are in the mail!';
                } else if (toUserMailed) {
                    statusText = 'other member has mailed their book to you';
                } else if (fromUserMailed) {
                    statusText = 'you have mailed, waiting for other member';
                }
            } else {
                if (fromUserReceived && toUserReceived) {
                    statusText = 'trade complete! both books have arrived';
                } else if (toUserReceived) {
                    statusText = 'your book has arrived! waiting for other member to receive theirs';
                } else if (fromUserReceived) {
                    statusText = 'other member received their book! waiting for yours to arrive';
                } else if (fromUserMailed && toUserMailed) {
                    statusText = 'both books are in the mail!';
                } else if (fromUserMailed) {
                    statusText = 'other member has mailed their book to you';
                } else if (toUserMailed) {
                    statusText = 'you have mailed, waiting for other member';
                }
            }

            const canMail = isSender ? !fromUserMailed : !toUserMailed;
            const canMarkReceived = isSender ? toUserMailed && !fromUserReceived : fromUserMailed && !toUserReceived;
            const isCompleted = trade.status === 'completed' && fromUserReceived && toUserReceived;

            return `
                <div class="trade-offer-card">
                    <div class="trade-offer-books">
                        <div class="trade-offer-book">
                            <img src="${theirBook.imageUrl}" alt="${theirBook.title}" class="trade-offer-image"
                                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect fill=%22%23D2D2D7%22 width=%22200%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%2386868B%22 font-family=%22system-ui%22 font-size=%2214%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                            <div class="trade-offer-book-info">
                                <div class="trade-offer-label">Their Book</div>
                                <div class="trade-offer-title">${escapeHtml(theirBook.title)}</div>
                                <div class="trade-offer-author">${escapeHtml(theirBook.author)}</div>
                            </div>
                        </div>
                        <div class="trade-offer-arrow">⇄</div>
                        <div class="trade-offer-book">
                            <img src="${myBook.imageUrl}" alt="${myBook.title}" class="trade-offer-image"
                                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect fill=%22%23D2D2D7%22 width=%22200%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%2386868B%22 font-family=%22system-ui%22 font-size=%2214%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                            <div class="trade-offer-book-info">
                                <div class="trade-offer-label">Your Book</div>
                                <div class="trade-offer-title">${escapeHtml(myBook.title)}</div>
                                <div class="trade-offer-author">${escapeHtml(myBook.author)}</div>
                            </div>
                        </div>
                    </div>
                    ${trade.message ? `<div class="trade-offer-message">${escapeHtml(trade.message)}</div>` : ''}
                    <div class="trade-offer-status">Status: ${statusText}</div>
                    <div class="trade-offer-actions">
                        <div class="trade-offer-sender">Trading with: ${escapeHtml(otherUser?.username || 'Unknown')}</div>
                        <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
                            ${canMail ? `
                                <button class="btn-primary btn-small" onclick="showShippingAddress('${trade.id || trade.tradeId}', '${otherUserId}')">Mail Your Book</button>
                            ` : ''}
                            ${canMarkReceived ? `
                                <button class="btn-primary btn-small" onclick="markBookArrived('${trade.id || trade.tradeId}')">My book arrived!</button>
                            ` : ''}
                            ${isCompleted ? `
                                <button class="btn-primary btn-small" onclick="relistBook('${trade.id || trade.tradeId}')">Reintroduce this book to the bookshop</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering accepted trade:', error);
            return '';
        }
    }));

    container.innerHTML = tradeCards.filter(card => card).join('');
}

async function relistBook(tradeId) {
    if (!confirm('Reintroduce this book to the bookshop? It will appear on your shelf as an active book and retain its full trade history.')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/trades/${tradeId}/relist-book`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const relistedBook = await response.json();
            alert('Book reintroduced to the bookshop! It will now appear on your shelf.');
            // Reload trades and books to reflect the change
            loadTrades();
            loadMyBooks();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to relist book');
        }
    } catch (error) {
        console.error('Error relisting book:', error);
        alert(error.message || 'Failed to relist book. Please try again.');
    }
}

// Make functions available globally
window.showShippingAddress = showShippingAddress;
window.markAsMailed = markAsMailed;
window.relistBook = relistBook;
window.markBookArrived = markBookArrived;

let currentShippingTradeId = null;
let currentShippingOtherUserId = null;

async function showShippingAddress(tradeId, otherUserId) {
    currentShippingTradeId = tradeId;
    currentShippingOtherUserId = otherUserId;

    const modal = document.getElementById('shippingAddressModal');
    const content = document.getElementById('shippingAddressContent');
    
    if (!modal || !content) return;

    try {
        const response = await fetch(`${API_BASE}/users/${otherUserId}`);
        if (response.ok) {
            const user = await response.json();
            const address = user.shippingAddress;
            
            if (address && (address.street || address.city || address.state || address.zip)) {
                content.innerHTML = `
                    <div style="padding: var(--spacing-md); background-color: var(--color-bg); border-radius: var(--border-radius);">
                        <p><strong>${escapeHtml(user.username || 'User')}</strong></p>
                        ${address.street ? `<p>${escapeHtml(address.street)}</p>` : ''}
                        ${address.city || address.state || address.zip ? 
                            `<p>${escapeHtml([address.city, address.state, address.zip].filter(Boolean).join(', '))}</p>` : ''}
                        ${!address.street && !address.city && !address.state && !address.zip ? 
                            '<p style="color: var(--color-text-light); font-style: italic;">No shipping address provided</p>' : ''}
                    </div>
                `;
            } else {
                content.innerHTML = '<p style="color: var(--color-text-light); font-style: italic;">No shipping address provided by this user</p>';
            }
        } else {
            content.innerHTML = '<p style="color: var(--color-text-light);">Could not load shipping address</p>';
        }
    } catch (error) {
        console.error('Error loading shipping address:', error);
        content.innerHTML = '<p style="color: var(--color-text-light);">Error loading shipping address</p>';
    }

    modal.style.display = 'block';
}

async function markAsMailed() {
    if (!currentShippingTradeId) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/trades/${currentShippingTradeId}/mark-mailed`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            alert('Marked as mailed! The other user will be notified.');
            closeShippingModal();
            loadTrades(); // Reload to update status
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to mark as mailed');
        }
    } catch (error) {
        console.error('Error marking as mailed:', error);
        alert(error.message || 'Failed to mark as mailed. Please try again.');
    }
}

function closeShippingModal() {
    const modal = document.getElementById('shippingAddressModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentShippingTradeId = null;
    currentShippingOtherUserId = null;
}

async function showTradeHistory(bookId) {
    if (!currentUserId) {
        alert('Please log in first');
        return;
    }

    const book = myBooks.find(b => (b.id === bookId) || (b.bookId === bookId));
    if (!book) {
        alert('Book not found');
        return;
    }

    const modal = document.getElementById('tradeHistoryModal');
    const content = document.getElementById('tradeHistoryContent');
    
    if (!modal || !content) return;

    // Show loading state
    content.innerHTML = '<p>Loading trade history...</p>';
    modal.style.display = 'block';

    try {
        // Get all trades for the user
        const response = await fetch(`${API_BASE}/users/${currentUserId}/trades`);
        if (!response.ok) {
            throw new Error('Failed to load trades');
        }
        
        const trades = await response.json();
        
        // Find completed trades involving this book
        // Need to check both book.id and book.bookId formats
        const actualBookId = book.id || book.bookId;
        const completedTrades = trades.filter(trade => 
            trade.status === 'completed' &&
            (trade.fromBookId === actualBookId || trade.toBookId === actualBookId)
        );

        if (completedTrades.length === 0) {
            content.innerHTML = '<p style="color: var(--color-text-light); font-style: italic;">No trade history found for this book.</p>';
            return;
        }

        // Sort by date (oldest first, like a library card)
        completedTrades.sort((a, b) => {
            const dateA = a.acceptedAt || a.createdAt || '';
            const dateB = b.acceptedAt || b.createdAt || '';
            return new Date(dateA) - new Date(dateB);
        });

        // Fetch user info for all trades
        const tradeEntries = await Promise.all(completedTrades.map(async (trade) => {
            const otherUserId = trade.fromUserId === currentUserId ? trade.toUserId : trade.fromUserId;
            const userResponse = await fetch(`${API_BASE}/users/${otherUserId}`);
            const otherUser = userResponse.ok ? await userResponse.json() : { username: 'Unknown' };
            
            // Format the date (use acceptedAt if available, otherwise createdAt)
            const dateToUse = trade.acceptedAt || trade.createdAt;
            const tradeDate = dateToUse ? new Date(dateToUse) : null;
            
            // Format date like library stamps: "OCT 16 1980" or "MAR 9 1987"
            let formattedDate = 'Unknown date';
            if (tradeDate) {
                const month = tradeDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                const day = tradeDate.getDate();
                const year = tradeDate.getFullYear();
                formattedDate = `${month} ${day} ${year}`;
            }
            
            return {
                date: formattedDate,
                dateObj: tradeDate,
                otherUser: otherUser.username || 'Unknown',
                otherUserId: otherUserId,
                currentUser: currentUserName || 'You',
                currentUserId: currentUserId
            };
        }));

        // Build the library card HTML with clickable user names
        const cardRows = tradeEntries.map((entry, index) => {
            const isEven = index % 2 === 0;
            const rowClass = isEven ? 'library-card-row' : 'library-card-row library-card-row-alt';
            return `
                <div class="${rowClass}">
                    <div class="library-card-date">${escapeHtml(entry.date)}</div>
                    <div class="library-card-participants">
                        <a href="index.html?userId=${entry.currentUserId}&userName=${encodeURIComponent(entry.currentUser)}" class="library-card-user-link">${escapeHtml(entry.currentUser)}</a>
                        <span class="library-card-separator">↔</span>
                        <a href="index.html?userId=${entry.otherUserId}&userName=${encodeURIComponent(entry.otherUser)}" class="library-card-user-link">${escapeHtml(entry.otherUser)}</a>
                    </div>
                </div>
            `;
        }).join('');

        // Add blank rows to make the card taller (like a real library card)
        // Always show at least 10 rows total (filled + blank)
        const minRows = 10;
        const blankRowCount = Math.max(0, minRows - tradeEntries.length);
        const blankRows = Array(blankRowCount).fill(0).map((_, index) => {
            const rowIndex = tradeEntries.length + index;
            const isEven = rowIndex % 2 === 0;
            const rowClass = isEven ? 'library-card-row library-card-row-blank' : 'library-card-row library-card-row-alt library-card-row-blank';
            return `
                <div class="${rowClass}">
                    <div class="library-card-date"></div>
                    <div class="library-card-participants"></div>
                </div>
            `;
        }).join('');

        content.innerHTML = `
            <div class="library-card-container">
                <div class="library-card-header">
                    <p class="library-card-instruction">This book is a proud part of The Printernet Bookshop. Below is its provenance.</p>
                </div>
                <div class="library-card-table">
                    <div class="library-card-table-header">
                        <div class="library-card-date-header">DATE</div>
                        <div class="library-card-participants-header">PARTICIPANTS</div>
                    </div>
                    ${cardRows}
                    ${blankRows}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading trade history:', error);
        content.innerHTML = '<p style="color: var(--color-text-light);">Error loading trade history.</p>';
    }
}

function closeTradeHistoryModal() {
    const modal = document.getElementById('tradeHistoryModal');
    if (modal) {
        modal.style.display = 'none';
    }
    const content = document.getElementById('tradeHistoryContent');
    if (content) {
        content.innerHTML = '';
    }
}

async function markBookArrived(tradeId) {
    if (!confirm('Mark that you have received the other member\'s book?')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/trades/${tradeId}/mark-received`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            alert('Marked as received!');
            loadTrades(); // Reload to update status
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to mark as received');
        }
    } catch (error) {
        console.error('Error marking book as received:', error);
        alert(error.message || 'Failed to mark as received. Please try again.');
    }
}

function renderMyBooks() {
    const container = document.getElementById('myBooksGrid');
    if (!container) return;

    // Filter books based on current filter
    const filteredBooks = myBooks.filter(book => {
        const bookStatus = book.status || book.bookStatus || 'current';
        const bookUserId = book.userId || book.user_id;
        
        if (currentBookFilter === 'previous') {
            // Show books that are no longer on the user's shelf:
            // 1. Books with status 'previous' that are owned by the user (completed trades)
            // 2. Books that were part of completed trades but are NOT currently owned by the user
            //    (these were added via the trade history lookup above)
            // If a book was relisted by the user, it will have status 'current' and userId === currentUserId,
            // so it will NOT appear in previous books (correct behavior)
            if (bookStatus === 'previous' && bookUserId === currentUserId) {
                return true; // Book on their shelf but marked as previous (completed trade)
            }
            // Books not owned by the user (were on their shelf, now aren't)
            return bookUserId !== currentUserId;
        } else {
            // For 'current', only show books with status 'current' that are owned by the user
            return bookStatus === 'current' && bookUserId === currentUserId;
        }
    });

    if (filteredBooks.length === 0) {
        const emptyMessage = currentBookFilter === 'current' 
            ? 'You haven\'t added any current books yet'
            : 'You don\'t have any previous books yet';
        container.innerHTML = `<div class="empty-state"><p>${emptyMessage}</p></div>`;
        return;
    }

    container.innerHTML = filteredBooks.map(book => {
        const bookId = book.id || book.bookId;
        const bookStatus = book.status || book.bookStatus || 'current';
        const bookUserId = book.userId || book.user_id;
        // A book is "previous" if it has status 'previous' OR is not currently owned by the user
        const isPrevious = bookStatus === 'previous' || bookUserId !== currentUserId;
        const clickHandler = isPrevious 
            ? `onclick="showTradeHistory('${bookId}')"` 
            : `onclick="openEditBookModal('${bookId}')"`;
        return `
        <div class="book-card" data-book-id="${bookId}" ${clickHandler} style="cursor: pointer;">
            <img src="${book.imageUrl}" alt="${book.title}" class="book-image"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect fill=%22%23D2D2D7%22 width=%22200%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%2386868B%22 font-family=%22system-ui%22 font-size=%2214%22%3ENo Image%3C/text%3E%3C/svg%3E'">
            <div class="book-info">
                <div class="book-title">${escapeHtml(book.title)}</div>
                <div class="book-author">${escapeHtml(book.author)}</div>
                ${book.description ? `<div class="book-description" style="font-size: 12px; color: var(--color-text-light); margin-top: 4px;">${escapeHtml(book.description)}</div>` : ''}
                ${!isPrevious ? `
                    <div class="book-actions">
                        <button class="btn-small btn-delete" onclick="event.stopPropagation(); deleteBook('${bookId}')">
                            Remove
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    }).join('');

    // Update add book button visibility and state (only count current books)
    const toggleAddBookBtn = document.getElementById('toggleAddBookBtn');
    if (toggleAddBookBtn) {
        const currentBooksCount = myBooks.filter(book => {
            const bookStatus = book.status || book.bookStatus || 'current';
            return bookStatus === 'current';
        }).length;
        
        if (currentBooksCount >= 5) {
            toggleAddBookBtn.disabled = true;
            toggleAddBookBtn.textContent = 'Maximum 5 books reached';
            toggleAddBookBtn.style.opacity = '0.5';
            toggleAddBookBtn.style.cursor = 'not-allowed';
            // Hide form if it's open
            hideAddBookForm();
        } else {
            toggleAddBookBtn.disabled = false;
            toggleAddBookBtn.textContent = 'Add Book';
            toggleAddBookBtn.style.opacity = '1';
            toggleAddBookBtn.style.cursor = 'pointer';
        }
    }
}

async function handleAddBook(e) {
    e.preventDefault();
    console.log('handleAddBook called');

    if (!currentUserId) {
        alert('Please log in first');
        return;
    }

    // Ensure user exists on server before adding book
    try {
        const userResponse = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                name: currentUserName || 'Anonymous Reader', 
                userId: currentUserId 
            })
        });
        
        if (!userResponse.ok) {
            throw new Error('Failed to verify user');
        }
    } catch (error) {
        console.error('Error ensuring user exists:', error);
        alert('Failed to verify user. Please try logging in again.');
        return;
    }

    if (myBooks.length >= 5) {
        alert('You can only have a maximum of 5 books');
        return;
    }

    const form = e.target;
    const formData = new FormData();
    
    const title = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const description = document.getElementById('bookDescription').value.trim();
    const imageFile = document.getElementById('bookImage').files[0];
    const condition = document.getElementById('bookCondition').value;

    console.log('Form data:', { title, author, description, condition, hasImage: !!imageFile });

    if (!title || !author) {
        alert('Please fill in all required fields (Title and Author)');
        return;
    }

    formData.append('title', title);
    formData.append('author', author);
    formData.append('description', description);
    formData.append('condition', condition);
    if (imageFile) {
        formData.append('image', imageFile);
    }

    // Disable submit button during request
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';
    }

    try {
        console.log('Sending request to:', `${API_BASE}/users/${currentUserId}/books`);
        const response = await fetch(`${API_BASE}/users/${currentUserId}/books`, {
            method: 'POST',
            body: formData
        });

        console.log('Response status:', response.status);

        if (response.ok) {
            const newBook = await response.json();
            console.log('Book added:', newBook);
            myBooks.push(newBook);
            updateUserInfo();
            renderMyBooks();
            
            // Reset form and hide it
            form.reset();
            hideAddBookForm();
            alert('Book added successfully!');
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Server error:', errorData);
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
    } catch (error) {
        console.error('Error adding book:', error);
        alert(error.message || 'Failed to add book. Please check the console for details.');
    } finally {
        // Re-enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText || 'Add Book';
        }
    }
}

async function deleteBook(bookId) {
    if (!confirm('Are you sure you want to remove this book?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/books/${bookId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            myBooks = myBooks.filter(book => book.id !== bookId);
            updateUserInfo();
            renderMyBooks();
        } else {
            throw new Error('Failed to delete book');
        }
    } catch (error) {
        console.error('Error deleting book:', error);
        alert('Failed to delete book. Please try again.');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make function available globally for onclick handlers
window.deleteBook = deleteBook;

