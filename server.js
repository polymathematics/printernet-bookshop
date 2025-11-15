require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const s3 = require('./s3');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required for rate limiting to work correctly behind reverse proxy (Railway, etc.)
app.set('trust proxy', true);

// CORS Configuration
// Allow localhost in development, restrict to your domain in production
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : [])
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.length === 0 || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Allow cookies/auth headers if needed
}));

// Rate limiting - protect against abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/signup attempts per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful requests
});

app.use('/api/auth/', authLimiter);

// Middleware
app.use(express.json());

// Serve home.html as the default root page (must be before static middleware)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Serve static files (after route handlers to prevent index.html from being served at root)
app.use(express.static('public'));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads (using memory storage for S3)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Trades are now stored in DynamoDB

// Helper function to generate user ID
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Helper function to generate book ID
function generateBookId() {
  return 'book_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('ERROR: JWT_SECRET environment variable is not set!');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// API Routes

// Authentication Routes
// Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user with email already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userId = uuidv4();
    const user = {
      userId: userId,
      username: username,
      email: email,
      passwordHash: passwordHash,
      createdAt: new Date().toISOString()
    };

    await db.createUser(user);

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('ERROR: JWT_SECRET environment variable is not set!');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const token = jwt.sign(
      { userId: user.userId, email: user.email },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Return user without password hash
    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('ERROR: JWT_SECRET environment variable is not set!');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const token = jwt.sign(
      { userId: user.userId, email: user.email },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Return user without password hash
    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current user (protected route)
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('ERROR: JWT_SECRET environment variable is not set!');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const decoded = jwt.verify(token, jwtSecret);
    const user = await db.getUser(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Get all books for feed
app.get('/api/books', async (req, res) => {
  try {
    const allBooks = await db.getAllBooks();
    
    // Batch fetch all unique users in a single operation (fixes N+1 problem)
    const uniqueUserIds = [...new Set(allBooks.map(book => book.userId))];
    const users = await db.getUsersBatch(uniqueUserIds);
    
    // Create a map for O(1) lookup
    const userMap = new Map();
    users.forEach((user, index) => {
      if (user) {
        userMap.set(uniqueUserIds[index], user);
      }
    });
    
    // Map books with user info (no additional DB calls needed)
    const booksWithUsers = allBooks.map(book => {
      const user = userMap.get(book.userId);
      return {
        ...book,
        id: book.bookId, // Map bookId to id for frontend compatibility
        userName: user ? user.username : 'Unknown',
        status: book.status || 'current' // Ensure status is set, default to 'current'
      };
    });
    
    res.json(booksWithUsers);
  } catch (error) {
    console.error('Error getting books:', error);
    res.status(500).json({ error: 'Failed to get books' });
  }
});

// Diagnostic endpoint to check all books (including status)
app.get('/api/books/debug', async (req, res) => {
  try {
    const allBooks = await db.getAllBooks();
    const booksWithStatus = allBooks.map(book => ({
      bookId: book.bookId,
      title: book.title,
      author: book.author,
      status: book.status || 'MISSING',
      userId: book.userId,
      imageUrl: book.imageUrl // Include imageUrl for debugging
    }));
    res.json({
      total: allBooks.length,
      current: allBooks.filter(b => (b.status || 'current') === 'current').length,
      previous: allBooks.filter(b => b.status === 'previous').length,
      missing: allBooks.filter(b => !b.status).length,
      books: booksWithStatus
    });
  } catch (error) {
    console.error('Error getting debug books:', error);
    res.status(500).json({ error: 'Failed to get debug books' });
  }
});

// Fix ACL permissions for a specific book's image
app.post('/api/books/:bookId/fix-image-acl', authenticateToken, async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const book = await db.getBook(bookId);
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // Verify user owns the book
    if (req.user.userId !== book.userId) {
      return res.status(403).json({ error: 'Forbidden: You can only fix images for your own books' });
    }
    
    if (!book.imageUrl || book.imageUrl.startsWith('data:')) {
      return res.status(400).json({ error: 'Book does not have an S3 image URL' });
    }
    
    await s3.fixImageAcl(book.imageUrl);
    res.json({ success: true, message: 'Image ACL fixed successfully' });
  } catch (error) {
    console.error('Error fixing image ACL:', error);
    res.status(500).json({ error: 'Failed to fix image ACL', details: error.message });
  }
});

// Get a single book by ID
app.get('/api/books/:bookId', async (req, res) => {
  try {
    const book = await db.getBook(req.params.bookId);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json({
      ...book,
      id: book.bookId // Map bookId to id for frontend compatibility
    });
  } catch (error) {
    console.error('Error getting book:', error);
    res.status(500).json({ error: 'Failed to get book' });
  }
});

// Get books by user ID
app.get('/api/users/:userId/books', async (req, res) => {
  try {
    const userId = req.params.userId;
    const userBooks = await db.getBooksByUser(userId);
    const user = await db.getUser(userId);
    
    const booksWithUser = userBooks.map(book => ({
      ...book,
      id: book.bookId, // Map bookId to id for frontend compatibility
      userName: user ? user.username : 'Unknown'
    }));
    
    res.json(booksWithUser);
  } catch (error) {
    console.error('Error getting user books:', error);
    res.status(500).json({ error: 'Failed to get user books' });
  }
});

// Get user info
app.get('/api/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await db.getUser(userId);
    if (user) {
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user settings
app.put('/api/users/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Verify user can only update their own settings
    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You can only update your own settings' });
    }

    const { username, shippingAddress } = req.body;
    
    const updates = {};
    if (username !== undefined) {
      updates.username = username;
    }
    if (shippingAddress !== undefined) {
      updates.shippingAddress = shippingAddress;
    }

    const updatedUser = await db.updateUser(userId, updates);
    const { passwordHash: _, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Create or update user (legacy endpoint - kept for compatibility)
app.post('/api/users', async (req, res) => {
  try {
    const { name, userId } = req.body;
    
    if (userId) {
      const existingUser = await db.getUser(userId);
      if (existingUser) {
        // Update existing user
        const updatedUser = await db.updateUser(userId, {
          username: name || existingUser.username
        });
        const { passwordHash: _, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
      } else {
        // Create new user (legacy - should use /api/auth/signup)
        const newUser = {
          userId: userId,
          username: name || 'Anonymous Reader',
          email: `${userId}@temp.com`, // Temporary email
          passwordHash: '', // Empty for legacy users
          createdAt: new Date().toISOString()
        };
        await db.createUser(newUser);
        const { passwordHash: _, ...userWithoutPassword } = newUser;
        res.json(userWithoutPassword);
      }
    } else {
      res.status(400).json({ error: 'UserId is required' });
    }
  } catch (error) {
    console.error('Error creating/updating user:', error);
    res.status(500).json({ error: 'Failed to create/update user' });
  }
});

// Add book to user's collection
app.post('/api/users/:userId/books', upload.single('image'), async (req, res) => {
  try {
    const userId = req.params.userId;
    const { title, author, description, condition } = req.body;
    
    // Verify user exists
    const user = await db.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user already has 5 current books (not counting previous books)
    const userBooks = await db.getBooksByUser(userId);
    const currentBooks = userBooks.filter(book => (book.status || 'current') === 'current');
    if (currentBooks.length >= 5) {
      return res.status(400).json({ error: 'Maximum of 5 books allowed per user' });
    }
    
    const bookId = uuidv4();
    // Upload to S3 if image provided, otherwise use placeholder
    let imageUrl;
    if (req.file) {
      try {
        imageUrl = await s3.uploadImage(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
      } catch (error) {
        console.error('Error uploading image to S3:', error);
        return res.status(500).json({ error: 'Failed to upload image' });
      }
    } else {
      // Use placeholder SVG
      imageUrl = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect fill=%22%23D2D2D7%22 width=%22200%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%2386868B%22 font-family=%22system-ui%22 font-size=%2214%22%3ENo Image%3C/text%3E%3C/svg%3E';
    }
    
    const book = {
      bookId: bookId,
      userId: userId,
      title: title || 'Untitled',
      author: author || 'Unknown',
      description: description || '',
      condition: condition || 'used',
      imageUrl: imageUrl,
      status: 'current', // 'current' or 'previous'
      createdAt: new Date().toISOString()
    };
    
    await db.createBook(book);
    // Return with id field for frontend compatibility
    res.json({
      ...book,
      id: book.bookId
    });
  } catch (error) {
    console.error('Error adding book:', error);
    res.status(500).json({ error: 'Failed to add book' });
  }
});

// Update a book
app.put('/api/books/:bookId', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const bookId = req.params.bookId;
    const { title, author, description, condition } = req.body;
    
    // Get existing book
    const existingBook = await db.getBook(bookId);
    if (!existingBook) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // Verify user owns the book
    if (req.user.userId !== existingBook.userId) {
      return res.status(403).json({ error: 'Forbidden: You can only edit your own books' });
    }
    
    // Handle image update
    let imageUrl = existingBook.imageUrl;
    if (req.file) {
      // Delete old S3 image if it exists and is not a placeholder
      if (existingBook.imageUrl && !existingBook.imageUrl.startsWith('data:')) {
        await s3.deleteImage(existingBook.imageUrl);
      }
      // Upload new image to S3
      try {
        imageUrl = await s3.uploadImage(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
      } catch (error) {
        console.error('Error uploading image to S3:', error);
        return res.status(500).json({ error: 'Failed to upload image' });
      }
    }
    
    // Update book (preserve status field)
    const updatedBook = {
      ...existingBook,
      title: title || existingBook.title,
      author: author || existingBook.author,
      description: description !== undefined ? description : existingBook.description,
      condition: condition || existingBook.condition,
      imageUrl: imageUrl,
      status: existingBook.status || 'current' // Preserve existing status or default to 'current'
    };
    
    await db.createBook(updatedBook); // PutCommand updates if exists
    
    // Return with id field for frontend compatibility
    res.json({
      ...updatedBook,
      id: updatedBook.bookId
    });
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// Delete a book
app.delete('/api/books/:bookId', async (req, res) => {
  try {
    const bookId = req.params.bookId;
    
    // Get book to find image path
    const book = await db.getBook(bookId);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // Delete image from S3 (if it's an S3 URL, not a placeholder)
    if (book.imageUrl && !book.imageUrl.startsWith('data:')) {
      await s3.deleteImage(book.imageUrl);
    }
    
    // Delete book from database
    await db.deleteBook(bookId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// Create trade proposal
app.post('/api/trades', async (req, res) => {
  try {
    const { fromUserId, toUserId, fromBookId, toBookId, message } = req.body;
    
    // fromBookId can be null for "any of my books" offers
    if (!fromUserId || !toUserId || toBookId === undefined || toBookId === null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if a pending trade already exists with the same parameters
    const existingTrade = await db.findExistingPendingTrade(
      fromUserId,
      toUserId,
      fromBookId,
      toBookId
    );
    
    if (existingTrade) {
      return res.status(409).json({ 
        error: 'A pending trade offer already exists for these books',
        existingTradeId: existingTrade.tradeId
      });
    }
    
    const tradeId = uuidv4();
    const proposal = {
      tradeId: tradeId,
      fromUserId,
      toUserId,
      fromBookId: fromBookId || null, // Allow null for "any of my books"
      toBookId,
      message: message || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    await db.createTrade(proposal);
    res.json({
      ...proposal,
      id: proposal.tradeId // Map tradeId to id for frontend compatibility
    });
  } catch (error) {
    console.error('Error creating trade:', error);
    // Provide a more helpful error message if table doesn't exist
    if (error.message && error.message.includes('does not exist')) {
      return res.status(503).json({ 
        error: 'Trades table not configured. Please contact the administrator.',
        details: error.message
      });
    }
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// Get all active trades (for batch loading - fixes N+1 query problem)
app.get('/api/trades/all', async (req, res) => {
  try {
    // Get all active trades in a single query (replaces N+1 queries per user)
    const allTrades = await db.getAllActiveTrades();
    
    // Map tradeId to id for frontend compatibility
    const tradesWithId = allTrades.map(trade => ({
      ...trade,
      id: trade.tradeId
    }));
    
    res.json(tradesWithId);
  } catch (error) {
    console.error('Error getting all trades:', error);
    // If table doesn't exist yet, return empty array instead of error
    if (error.name === 'ResourceNotFoundException') {
      console.warn('Trades table does not exist yet, returning empty array');
      return res.json([]);
    }
    res.status(500).json({ error: 'Failed to get trades' });
  }
});

// Get trade proposals for a user
app.get('/api/users/:userId/trades', async (req, res) => {
  try {
    const userId = req.params.userId;
    const userTrades = await db.getTradesByUser(userId);
    // Map tradeId to id for frontend compatibility
    const tradesWithId = userTrades.map(trade => ({
      ...trade,
      id: trade.tradeId
    }));
    res.json(tradesWithId);
  } catch (error) {
    console.error('Error getting trades:', error);
    // If table doesn't exist yet, return empty array instead of error
    if (error.name === 'ResourceNotFoundException') {
      console.warn('Trades table does not exist yet, returning empty array');
      return res.json([]);
    }
    res.status(500).json({ error: 'Failed to get trades' });
  }
});

// Diagnostic endpoint to check all trades
app.get('/api/trades/debug', async (req, res) => {
  try {
    // Get all trades by scanning (for debugging only)
    const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
    const docClient = require('./db').docClient || db.docClient;
    const TRADES_TABLE = process.env.DYNAMODB_TRADES_TABLE || 'trades';
    
    // Access docClient from db module
    const dbModule = require('./db');
    // We need to get the docClient - let's use a different approach
    const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    const docClientDebug = DynamoDBDocumentClient.from(client);
    
    const command = new ScanCommand({
      TableName: TRADES_TABLE,
    });
    const response = await docClientDebug.send(command);
    const allTrades = response.Items || [];
    
    res.json({
      total: allTrades.length,
      pending: allTrades.filter(t => t.status === 'pending').length,
      accepted: allTrades.filter(t => t.status === 'accepted').length,
      declined: allTrades.filter(t => t.status === 'declined').length,
      completed: allTrades.filter(t => t.status === 'completed').length,
      trades: allTrades.map(trade => ({
        tradeId: trade.tradeId,
        fromUserId: trade.fromUserId,
        toUserId: trade.toUserId,
        fromBookId: trade.fromBookId,
        toBookId: trade.toBookId,
        status: trade.status || 'MISSING',
        createdAt: trade.createdAt
      }))
    });
  } catch (error) {
    console.error('Error getting debug trades:', error);
    if (error.name === 'ResourceNotFoundException') {
      return res.json({ error: 'Trades table does not exist', total: 0, trades: [] });
    }
    res.status(500).json({ error: 'Failed to get debug trades', details: error.message });
  }
});

// Accept a trade proposal
app.put('/api/trades/:tradeId/accept', authenticateToken, async (req, res) => {
  try {
    const tradeId = req.params.tradeId;
    const { fromBookId } = req.body; // Optional: selected book when trade has "any of my books"
    const trade = await db.getTrade(tradeId);
    
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    
    if (trade.toUserId !== req.user.userId) {
      return res.status(403).json({ error: 'You can only accept trades sent to you' });
    }
    
    if (trade.status !== 'pending') {
      return res.status(400).json({ error: 'Trade is not pending' });
    }
    
    // If trade has null fromBookId (any of my books), require fromBookId in request
    if (!trade.fromBookId && !fromBookId) {
      return res.status(400).json({ error: 'Please select which book you want from the other user' });
    }
    
    // Prepare update object
    const updates = {
      status: 'accepted',
      acceptedAt: new Date().toISOString()
    };
    
    // If fromBookId was null and user selected a book, update it
    if (!trade.fromBookId && fromBookId) {
      updates.fromBookId = fromBookId;
    }
    
    const updatedTrade = await db.updateTrade(tradeId, updates);
    res.json({
      ...updatedTrade,
      id: updatedTrade.tradeId // Map tradeId to id for frontend compatibility
    });
  } catch (error) {
    console.error('Error accepting trade:', error);
    res.status(500).json({ error: 'Failed to accept trade' });
  }
});

// Decline a trade proposal
app.put('/api/trades/:tradeId/decline', authenticateToken, async (req, res) => {
  try {
    const tradeId = req.params.tradeId;
    const trade = await db.getTrade(tradeId);
    
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    
    if (trade.toUserId !== req.user.userId) {
      return res.status(403).json({ error: 'You can only decline trades sent to you' });
    }
    
    if (trade.status !== 'pending') {
      return res.status(400).json({ error: 'Trade is not pending' });
    }
    
    const updatedTrade = await db.updateTrade(tradeId, { status: 'declined' });
    res.json({
      ...updatedTrade,
      id: updatedTrade.tradeId // Map tradeId to id for frontend compatibility
    });
  } catch (error) {
    console.error('Error declining trade:', error);
    res.status(500).json({ error: 'Failed to decline trade' });
  }
});

// Mark trade as mailed
app.put('/api/trades/:tradeId/mark-mailed', authenticateToken, async (req, res) => {
  try {
    const tradeId = req.params.tradeId;
    const trade = await db.getTrade(tradeId);
    
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    
    if (trade.status !== 'accepted') {
      return res.status(400).json({ error: 'Trade must be accepted before marking as mailed' });
    }
    
    // Determine which user is marking as mailed
    const isSender = trade.fromUserId === req.user.userId;
    const isReceiver = trade.toUserId === req.user.userId;
    
    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'You can only mark your own trades as mailed' });
    }
    
    // Update the appropriate mailing status
    const updates = {};
    if (isSender) {
      updates.fromUserMailed = true;
    } else {
      updates.toUserMailed = true;
    }
    
    const updatedTrade = await db.updateTrade(tradeId, updates);
    res.json({
      ...updatedTrade,
      id: updatedTrade.tradeId // Map tradeId to id for frontend compatibility
    });
  } catch (error) {
    console.error('Error marking trade as mailed:', error);
    res.status(500).json({ error: 'Failed to mark trade as mailed' });
  }
});

// Mark book as received
app.put('/api/trades/:tradeId/mark-received', authenticateToken, async (req, res) => {
  try {
    const tradeId = req.params.tradeId;
    const trade = await db.getTrade(tradeId);
    
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    
    if (trade.status !== 'accepted' && trade.status !== 'completed') {
      return res.status(400).json({ error: 'Trade must be accepted before marking as received' });
    }
    
    // Determine which user is marking as received
    const isSender = trade.fromUserId === req.user.userId;
    const isReceiver = trade.toUserId === req.user.userId;
    
    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'You can only mark your own trades as received' });
    }
    
    // Check if the other user has mailed their book
    if (isSender && !trade.toUserMailed) {
      return res.status(400).json({ error: 'Other user has not mailed their book yet' });
    }
    if (isReceiver && !trade.fromUserMailed) {
      return res.status(400).json({ error: 'Other user has not mailed their book yet' });
    }
    
    // Update the appropriate received status
    const updates = {};
    if (isSender) {
      updates.fromUserReceived = true;
    } else {
      updates.toUserReceived = true;
    }
    
    // If both users have received, update status to completed and mark books as previous
    const fromUserReceived = isSender ? true : (trade.fromUserReceived || false);
    const toUserReceived = isReceiver ? true : (trade.toUserReceived || false);
    
    if (fromUserReceived && toUserReceived) {
      updates.status = 'completed';
      
      // Mark both books as 'previous' since the trade is complete
      try {
        const fromBook = await db.getBook(trade.fromBookId);
        const toBook = await db.getBook(trade.toBookId);
        
        if (fromBook) {
          await db.createBook({ ...fromBook, status: 'previous' });
        }
        if (toBook) {
          await db.createBook({ ...toBook, status: 'previous' });
        }
      } catch (error) {
        console.error('Error updating book status to previous:', error);
        // Continue even if book update fails
      }
    }
    
    const updatedTrade = await db.updateTrade(tradeId, updates);
    res.json({
      ...updatedTrade,
      id: updatedTrade.tradeId // Map tradeId to id for frontend compatibility
    });
  } catch (error) {
    console.error('Error marking book as received:', error);
    res.status(500).json({ error: 'Failed to mark book as received' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Book Swap server running on http://localhost:${PORT}`);
});

