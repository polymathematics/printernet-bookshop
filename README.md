# Book Swap

A minimal book swapping platform where users can upload 1-5 books they're offering to trade and browse other users' books in a feed-like interface.

## Features

- **Main Feed**: Browse all available books from all users in a beautiful grid layout
- **User Profiles**: Click on any user to view all their available books
- **Book Management**: Upload and manage 1-5 books you're offering to trade
- **Trade Proposals**: Initiate trade proposals between users
- **Minimal Design**: Clean, modern aesthetic inspired by Teenage Engineering and Apple design

## Getting Started

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

1. **Getting Started**: Enter your name when prompted
2. **Add Books**: Click "My Books" or "Add Book" to manage your collection (max 5 books)
3. **Browse Feed**: View all available books from all users
4. **View User Books**: Click on a user's name to see all their books
5. **Propose Trade**: Click "Trade" on any book to initiate a trade proposal

## Tech Stack

- **Backend**: Node.js with Express
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **File Upload**: Multer for handling book cover images
- **Storage**: In-memory storage (can be upgraded to a database)

## Project Structure

```
swap/
├── server.js          # Express server and API endpoints
├── package.json       # Dependencies
├── public/
│   ├── index.html     # Main feed page
│   ├── user.html      # User book management page
│   ├── frontend.js    # Main feed JavaScript
│   ├── user.js        # User page JavaScript
│   ├── style.css      # Stylesheet
│   └── uploads/       # Uploaded book images (created automatically)
└── README.md
```

## API Endpoints

- `GET /api/books` - Get all books for feed
- `GET /api/users/:userId/books` - Get books by user
- `POST /api/users` - Create or update user
- `POST /api/users/:userId/books` - Add book to user collection
- `DELETE /api/books/:bookId` - Delete a book
- `POST /api/trades` - Create trade proposal
- `GET /api/users/:userId/trades` - Get trade proposals for user

## Design

The design follows a minimal aesthetic with:
- Clean typography and spacing
- Subtle shadows and borders
- Pops of color (bright blues and forest greens)
- Smooth animations and transitions
- Responsive grid layout

