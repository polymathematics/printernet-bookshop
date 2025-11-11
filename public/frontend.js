// API Base URL - relative URL works in both dev and production
const API_BASE = '/api';

// State management
let currentUserId = localStorage.getItem('userId');
let currentUserName = localStorage.getItem('userName');
let allBooks = [];
let myBooks = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Check if user is logged in
    if (currentUserId && currentUserName) {
        showFeed();
        loadFeed();
        
        // Play login sound only if flag is set (user just logged in)
        if (localStorage.getItem('playLoginSound') === 'true') {
            playLoginSound();
            // Clear the flag so it doesn't play again on subsequent page loads
            localStorage.removeItem('playLoginSound');
        }
    } else {
        // Redirect to login if not authenticated
        window.location.href = 'login.html';
    }

    // Event listeners
    setupEventListeners();
}

function playLoginSound() {
    try {
        const audio = new Audio('sounds/bell.wav');
        audio.volume = 0.8;
        audio.play();
        
        // Stop after 2 seconds
        setTimeout(() => {
            audio.pause();
            audio.currentTime = 0;
        }, 2000);
    } catch (error) {
        console.warn('Could not play login sound:', error);
        // Silently fail if audio can't be played
    }
}

function setupEventListeners() {
    // Navigation
    const myBooksBtn = document.getElementById('myBooksBtn');
    const backToFeedBtn = document.getElementById('backToFeedBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    myBooksBtn?.addEventListener('click', () => {
        window.location.href = 'user.html';
    });

    logoutBtn?.addEventListener('click', handleLogout);

    backToFeedBtn?.addEventListener('click', () => {
        showFeed();
        loadFeed();
    });

    // Trade modal
    const tradeModal = document.getElementById('tradeModal');
    const closeModal = document.querySelector('.close-modal');
    
    closeModal?.addEventListener('click', () => {
        closeTradeModal();
    });

    window.addEventListener('click', (e) => {
        if (e.target === tradeModal) {
            closeTradeModal();
        }
    });
}


function showFeed() {
    const feed = document.getElementById('feedContainer');
    const userView = document.getElementById('userViewContainer');
    
    if (feed) feed.style.display = 'block';
    if (userView) userView.style.display = 'none';
}

function showUserView(userId, userName) {
    const feed = document.getElementById('feedContainer');
    const userView = document.getElementById('userViewContainer');
    const viewedUserName = document.getElementById('viewedUserName');
    
    if (feed) feed.style.display = 'none';
    if (userView) userView.style.display = 'block';
    if (viewedUserName) {
        // Only set if userName is provided, otherwise wait for loadUserBooks to fetch it
        if (userName) {
            viewedUserName.textContent = `${userName}'s Books`;
        } else {
            viewedUserName.textContent = 'Loading...';
        }
    }

    loadUserBooks(userId);
}

async function loadFeed() {
    try {
        const response = await fetch(`${API_BASE}/books`);
        allBooks = await response.json();
        
        // Load user's books for trade proposals
        if (currentUserId) {
            const userBooksResponse = await fetch(`${API_BASE}/users/${currentUserId}/books`);
            myBooks = await userBooksResponse.json();
            
            // Check for pending trades (gracefully handle errors if table doesn't exist)
            try {
                const tradesResponse = await fetch(`${API_BASE}/users/${currentUserId}/trades`);
                if (tradesResponse.ok) {
                    const trades = await tradesResponse.json();
                    
                    // Mark books with pending trades (where current user initiated the trade)
                    allBooks = allBooks.map(book => {
                        const hasPending = trades.some(trade => 
                            trade.status === 'pending' && 
                            trade.fromUserId === currentUserId &&
                            trade.toBookId === book.id
                        );
                        
                        return { 
                            ...book, 
                            hasPendingTrade: hasPending
                        };
                    });
                }
            } catch (error) {
                console.warn('Could not load trades (table may not exist yet):', error);
                // Continue without trade status - this is okay if table doesn't exist yet
            }
        }
        
        // Check ALL books for trades in progress (both books have been mailed)
        // We need to check all users' trades to see if any book is in a trade in progress
        try {
            // Get all trades by checking each book's owner's trades
            const bookOwners = [...new Set(allBooks.map(book => book.userId))];
            const allTradesPromises = bookOwners.map(userId => 
                fetch(`${API_BASE}/users/${userId}/trades`).then(r => r.ok ? r.json() : [])
            );
            const allTradesArrays = await Promise.all(allTradesPromises);
            const allTrades = allTradesArrays.flat();
            
            // Mark books that are part of trades in progress
            allBooks = allBooks.map(book => {
                const tradeInProgress = allTrades.some(trade => 
                    (trade.status === 'accepted' || trade.status === 'completed') &&
                    trade.fromUserMailed && 
                    trade.toUserMailed &&
                    (trade.fromBookId === book.id || trade.toBookId === book.id)
                );
                
                // Also mark books with status 'previous' as traded
                const bookStatus = book.status || 'current';
                const isPrevious = bookStatus === 'previous';
                
                return { 
                    ...book, 
                    tradeInProgress: tradeInProgress || isPrevious || book.tradeInProgress || false,
                    status: bookStatus // Ensure status is included
                };
            });
        } catch (error) {
            console.warn('Could not check for trades in progress:', error);
            // Continue without trade in progress status
        }

        renderBooks(allBooks, 'booksGrid', false);
    } catch (error) {
        console.error('Error loading feed:', error);
    }
}

async function loadUserBooks(userId) {
    try {
        // Fetch user info
        const userResponse = await fetch(`${API_BASE}/users/${userId}`);
        const user = userResponse.ok ? await userResponse.json() : null;
        
        // Fetch user's books
        const booksResponse = await fetch(`${API_BASE}/users/${userId}/books`);
        let userBooks = await booksResponse.json();
        
        // Update header with actual user name
        const viewedUserName = document.getElementById('viewedUserName');
        if (viewedUserName && user) {
            viewedUserName.textContent = `${user.username || user.name || 'Unknown'}'s Books`;
        }
        
        // Check for pending trades (where current user initiated the trade)
        if (currentUserId) {
            try {
                const tradesResponse = await fetch(`${API_BASE}/users/${currentUserId}/trades`);
                if (tradesResponse.ok) {
                    const trades = await tradesResponse.json();
                    
                    // Mark books with pending trades (where current user initiated the trade)
                    userBooks = userBooks.map(book => {
                        const hasPending = trades.some(trade => 
                            trade.status === 'pending' && 
                            trade.fromUserId === currentUserId &&
                            trade.toBookId === book.id
                        );
                        
                        return { 
                            ...book, 
                            hasPendingTrade: hasPending
                        };
                    });
                }
            } catch (error) {
                console.warn('Could not load trades (table may not exist yet):', error);
                // Continue without trade status - this is okay if table doesn't exist yet
            }
        }
        
        // Check for trades in progress (both books have been mailed)
        try {
            // Get trades for the viewed user to check if their books are in trades in progress
            const viewedUserTradesResponse = await fetch(`${API_BASE}/users/${userId}/trades`);
            if (viewedUserTradesResponse.ok) {
                const viewedUserTrades = await viewedUserTradesResponse.json();
                
                // Mark books that are part of trades in progress
                userBooks = userBooks.map(book => {
                    const tradeInProgress = viewedUserTrades.some(trade => 
                        (trade.status === 'accepted' || trade.status === 'completed') &&
                        trade.fromUserMailed && 
                        trade.toUserMailed &&
                        (trade.fromBookId === book.id || trade.toBookId === book.id)
                    );
                    
                    // Also mark books with status 'previous' as traded
                    const bookStatus = book.status || 'current';
                    const isPrevious = bookStatus === 'previous';
                    
                    return { 
                        ...book, 
                        tradeInProgress: tradeInProgress || isPrevious || book.tradeInProgress || false,
                        status: bookStatus // Ensure status is included
                    };
                });
            }
        } catch (error) {
            console.warn('Could not check for trades in progress:', error);
            // Continue without trade in progress status
        }
        
        renderBooks(userBooks, 'userBooksGrid', false);
    } catch (error) {
        console.error('Error loading user books:', error);
    }
}

function renderBooks(books, containerId, isMyBooks = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (books.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No books available</p></div>';
        return;
    }

    container.innerHTML = books.map(book => {
        const hasPendingTrade = book.hasPendingTrade || false;
        const tradeInProgress = book.tradeInProgress || false;
        const bookStatus = book.status || 'current';
        const isPrevious = bookStatus === 'previous';
        const isTraded = tradeInProgress || isPrevious; // Show badge if trade in progress OR previous status
        
        // Don't allow clicking if trade is in progress, book is previous, or if it's the user's own book
        const canClick = !isMyBooks && book.userId !== currentUserId && !isTraded;
        const clickHandler = canClick 
            ? `onclick="openTradeModal('${book.id}', '${book.userId}')"` 
            : '';
        const cursorStyle = canClick ? 'cursor: pointer;' : (isTraded ? 'cursor: not-allowed;' : '');
        const cardClass = isTraded ? 'book-card trade-in-progress' : 'book-card';
        
        return `
        <div class="${cardClass}" data-book-id="${book.id}" ${clickHandler} style="${cursorStyle}">
            ${isTraded ? '<div class="trade-in-progress-badge">traded</div>' : ''}
            <img src="${book.imageUrl}" alt="${book.title}" class="book-image" 
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect fill=%22%23D2D2D7%22 width=%22200%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%2386868B%22 font-family=%22system-ui%22 font-size=%2214%22%3ENo Image%3C/text%3E%3C/svg%3E'">
            <div class="book-info">
                <div class="book-title">${escapeHtml(book.title)}</div>
                <div class="book-author">${escapeHtml(book.author)}</div>
                ${!isMyBooks ? `
                    <div class="book-user" data-user-id="${book.userId}" data-user-name="${escapeHtml(book.userName || getUserName(book.userId))}">
                        from the shelf of ${escapeHtml(book.userName || getUserName(book.userId))}
                    </div>
                    ${hasPendingTrade ? '<div class="trade-pending">trade offer pending</div>' : ''}
                ` : `
                    <div class="book-actions">
                        <button class="btn-small btn-delete" onclick="event.stopPropagation(); deleteBook('${book.id}')">
                            Remove
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
    }).join('');

    // Add click handlers for viewing user's books
    if (!isMyBooks) {
        container.querySelectorAll('.book-user').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = el.getAttribute('data-user-id');
                const userName = el.getAttribute('data-user-name');
                showUserView(userId, userName);
            });
        });
    }
    
    // Prevent card click when clicking on user name
    if (!isMyBooks) {
        container.querySelectorAll('.book-user').forEach(el => {
            el.style.cursor = 'pointer';
        });
    }
}

function getUserName(userId) {
    // Try to get from localStorage or return a default
    if (userId === currentUserId) {
        return currentUserName || 'You';
    }
    // Get from book object if available
    const book = allBooks.find(b => b.userId === userId);
    return book?.userName || 'Reader';
}

function closeTradeModal() {
    const modal = document.getElementById('tradeModal');
    const tradeMessage = document.getElementById('tradeMessage');
    const successMessage = document.getElementById('tradeSuccessMessage');
    const submitBtn = document.getElementById('submitTradeBtn');
    
    if (modal) modal.style.display = 'none';
    if (tradeMessage) tradeMessage.value = '';
    if (successMessage) successMessage.style.display = 'none';
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Offer Trade';
    }
}

async function openTradeModal(bookId, toUserId) {
    if (!currentUserId) {
        alert('Please log in to propose a trade');
        return;
    }

    // Filter to only current books for trade selection
    const currentBooks = myBooks.filter(book => {
        const bookStatus = book.status || book.bookStatus || 'current';
        return bookStatus === 'current';
    });

    if (currentBooks.length === 0) {
        alert('You need to add at least one current book before you can trade');
        window.location.href = 'user.html';
        return;
    }

    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;

    const modal = document.getElementById('tradeModal');
    const theirBookDisplay = document.getElementById('theirBookDisplay');
    const yourBookDisplay = document.getElementById('yourBookDisplay');
    const bookSelect = document.getElementById('myBookSelect');
    const successMessage = document.getElementById('tradeSuccessMessage');
    const tradeMessage = document.getElementById('tradeMessage');
    const submitBtn = document.getElementById('submitTradeBtn');

    // Hide success message and reset button
    successMessage.style.display = 'none';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Offer Trade';

    // Display their book
    theirBookDisplay.innerHTML = `
        <img src="${book.imageUrl}" alt="${book.title}" class="trade-book-image">
        <div class="trade-book-title">${escapeHtml(book.title)}</div>
        <div class="trade-book-author">${escapeHtml(book.author)}</div>
    `;

    // Populate select with user's current books only
    bookSelect.innerHTML = '<option value="">Select your book...</option>' + 
        currentBooks.map(b => 
            `<option value="${b.id}">${escapeHtml(b.title)} by ${escapeHtml(b.author)}</option>`
        ).join('');

    // Clear your book display initially
    yourBookDisplay.innerHTML = '';

    // Remove existing event listeners by cloning the select
    const newSelect = bookSelect.cloneNode(true);
    bookSelect.parentNode.replaceChild(newSelect, bookSelect);
    const freshSelect = document.getElementById('myBookSelect');

    // Update your book display when selection changes
    freshSelect.addEventListener('change', function() {
        const selectedBookId = this.value;
        const selectedBook = currentBooks.find(b => b.id === selectedBookId);
        if (selectedBook) {
            yourBookDisplay.innerHTML = `
                <img src="${selectedBook.imageUrl}" alt="${selectedBook.title}" class="trade-book-image">
                <div class="trade-book-title">${escapeHtml(selectedBook.title)}</div>
                <div class="trade-book-author">${escapeHtml(selectedBook.author)}</div>
            `;
        } else {
            yourBookDisplay.innerHTML = '';
        }
    });

    // Reset message
    tradeMessage.value = '';

    modal.style.display = 'block';

    // Set up submit handler
    submitBtn.onclick = () => submitTrade(bookId, toUserId);
}

async function submitTrade(toBookId, toUserId) {
    const fromBookId = document.getElementById('myBookSelect').value;
    const message = document.getElementById('tradeMessage').value;
    const submitBtn = document.getElementById('submitTradeBtn');
    const successMessage = document.getElementById('tradeSuccessMessage');

    if (!fromBookId) {
        alert('Please select a book to trade');
        return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
        const response = await fetch(`${API_BASE}/trades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fromUserId: currentUserId,
                toUserId: toUserId,
                fromBookId: fromBookId,
                toBookId: toBookId,
                message: message
            })
        });

        if (response.ok) {
            // Show success message
            successMessage.style.display = 'block';
            
            // Wait a moment, then close modal and reload feed
            setTimeout(() => {
                closeTradeModal();
                loadFeed(); // Reload to show "trade offer pending" status
            }, 1500);
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || errorData.details || 'Failed to send trade proposal';
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('Error submitting trade:', error);
        const errorMessage = error.message || 'Failed to send trade proposal. Please try again.';
        alert(errorMessage);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Offer Trade';
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
            // Reload books
            if (window.location.pathname.includes('user.html')) {
                // Reload user page
                window.location.reload();
            } else {
                loadFeed();
            }
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

function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        // Clear all user data from localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        
        // Clear state variables
        currentUserId = null;
        currentUserName = null;
        allBooks = [];
        myBooks = [];
        
        // Redirect to login page
        window.location.href = 'login.html';
    }
}

// Make functions available globally for onclick handlers
window.openTradeModal = openTradeModal;
window.deleteBook = deleteBook;

