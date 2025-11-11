# The Printernet Bookshop

A minimal book swapping app where readers can upload 1-5 books, browse other readers' books in a feed-like interface called The Stacks, and offer trades to one another. Once a trade is accepted, readers can mail their books to one another using USPS Media Mail Rates.

## Features

- **The Stacks**: Browse all available books from all users in a simple grid layout
- **User Profiles**: Click on any user to view all their available books
- **Book Management**: Upload and manage 1-5 books you're offering to trade
- **Trade Proposals and Tracking**: Initiate trade proposals between users and track trade progress
- **Trade Provenance**: Every book in The Printernet Bookshop retains its trade history so readers can see where each book has been
- **Minimal Design**: Clean, modern aesthetic inspired by Teenage Engineering and Apple design

## Usage

1. **Getting Started**: Sign up and create a username. I recommend using an alias or pseudo-alias.
2. **Add Books to your shelf**: Click "My Books" and "Add Book" to manage your collection (max 5 books at a time)
3. **Browse The Stacks**: View all available books in the bookshop from all users
4. **View User Books**: Click on a user's name to see all their books
5. **Propose trade and make your first trade**: Click "Trade" on any book to initiate a trade proposal

## Tech Stack

- **Backend**: Node.js with Express
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **File Upload**: Multer for handling book cover images
- **Storage**: AWS DynamoDB

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

