const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'printernet_bookshop_users';
const BOOKS_TABLE = process.env.DYNAMODB_BOOKS_TABLE || 'books';
const TRADES_TABLE = process.env.DYNAMODB_TRADES_TABLE || 'trades';

// User functions
async function getUser(userId) {
  try {
    const command = new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
    });
    const response = await docClient.send(command);
    return response.Item;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
}

async function getUserByEmail(email) {
  try {
    // Note: This requires an email-index GSI. If you don't have one yet, you'll need to create it.
    // For now, we'll scan (less efficient but works without GSI)
    const command = new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email,
      },
    });
    const response = await docClient.send(command);
    return response.Items && response.Items.length > 0 ? response.Items[0] : null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
}

async function createUser(user) {
  try {
    const command = new PutCommand({
      TableName: USERS_TABLE,
      Item: user,
    });
    await docClient.send(command);
    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

async function updateUser(userId, updates) {
  try {
    const user = await getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const updatedUser = {
      ...user,
      ...updates,
    };
    
    const command = new PutCommand({
      TableName: USERS_TABLE,
      Item: updatedUser,
    });
    await docClient.send(command);
    return updatedUser;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

// Book functions
async function getBook(bookId) {
  try {
    const command = new GetCommand({
      TableName: BOOKS_TABLE,
      Key: { bookId },
    });
    const response = await docClient.send(command);
    return response.Item;
  } catch (error) {
    console.error('Error getting book:', error);
    throw error;
  }
}

async function getBooksByUser(userId) {
  try {
    const command = new QueryCommand({
      TableName: BOOKS_TABLE,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    });
    const response = await docClient.send(command);
    return response.Items || [];
  } catch (error) {
    console.error('Error getting books by user:', error);
    throw error;
  }
}

async function getAllBooks() {
  try {
    const command = new ScanCommand({
      TableName: BOOKS_TABLE,
    });
    const response = await docClient.send(command);
    return response.Items || [];
  } catch (error) {
    console.error('Error getting all books:', error);
    throw error;
  }
}

async function createBook(book) {
  try {
    const command = new PutCommand({
      TableName: BOOKS_TABLE,
      Item: book,
    });
    await docClient.send(command);
    return book;
  } catch (error) {
    console.error('Error creating book:', error);
    throw error;
  }
}

async function deleteBook(bookId) {
  try {
    const command = new DeleteCommand({
      TableName: BOOKS_TABLE,
      Key: { bookId },
    });
    await docClient.send(command);
    return { success: true };
  } catch (error) {
    console.error('Error deleting book:', error);
    throw error;
  }
}

// Trade functions
async function getTrade(tradeId) {
  try {
    const command = new GetCommand({
      TableName: TRADES_TABLE,
      Key: { tradeId },
    });
    const response = await docClient.send(command);
    return response.Item;
  } catch (error) {
    console.error('Error getting trade:', error);
    throw error;
  }
}

async function getTradesByFromUser(fromUserId) {
  try {
    const command = new QueryCommand({
      TableName: TRADES_TABLE,
      IndexName: 'fromUserId-index',
      KeyConditionExpression: 'fromUserId = :fromUserId',
      ExpressionAttributeValues: {
        ':fromUserId': fromUserId,
      },
    });
    const response = await docClient.send(command);
    return response.Items || [];
  } catch (error) {
    // If table or index doesn't exist, return empty array
    if (error.name === 'ResourceNotFoundException') {
      console.warn(`Trades table or fromUserId-index does not exist. Table: ${TRADES_TABLE}`);
      return [];
    }
    console.error('Error getting trades by from user:', error);
    throw error;
  }
}

async function getTradesByToUser(toUserId) {
  try {
    const command = new QueryCommand({
      TableName: TRADES_TABLE,
      IndexName: 'toUserId-index',
      KeyConditionExpression: 'toUserId = :toUserId',
      ExpressionAttributeValues: {
        ':toUserId': toUserId,
      },
    });
    const response = await docClient.send(command);
    return response.Items || [];
  } catch (error) {
    // If table or index doesn't exist, return empty array
    if (error.name === 'ResourceNotFoundException') {
      console.warn(`Trades table or toUserId-index does not exist. Table: ${TRADES_TABLE}`);
      return [];
    }
    console.error('Error getting trades by to user:', error);
    throw error;
  }
}

async function getTradesByUser(userId) {
  try {
    // Get trades where user is the sender
    const sentTrades = await getTradesByFromUser(userId);
    // Get trades where user is the receiver
    const receivedTrades = await getTradesByToUser(userId);
    // Combine and deduplicate (in case a trade somehow has the same fromUserId and toUserId)
    const allTrades = [...sentTrades, ...receivedTrades];
    const uniqueTrades = Array.from(
      new Map(allTrades.map(trade => [trade.tradeId, trade])).values()
    );
    return uniqueTrades;
  } catch (error) {
    console.error('Error getting trades by user:', error);
    throw error;
  }
}

async function createTrade(trade) {
  try {
    const command = new PutCommand({
      TableName: TRADES_TABLE,
      Item: trade,
    });
    await docClient.send(command);
    return trade;
  } catch (error) {
    // If table doesn't exist, throw a more descriptive error
    if (error.name === 'ResourceNotFoundException') {
      console.error(`Trades table does not exist. Table: ${TRADES_TABLE}`);
      throw new Error(`Trades table "${TRADES_TABLE}" does not exist in DynamoDB. Please create the table first.`);
    }
    console.error('Error creating trade:', error);
    throw error;
  }
}

async function updateTrade(tradeId, updates) {
  try {
    const trade = await getTrade(tradeId);
    if (!trade) {
      throw new Error('Trade not found');
    }
    
    const updatedTrade = {
      ...trade,
      ...updates,
    };
    
    const command = new PutCommand({
      TableName: TRADES_TABLE,
      Item: updatedTrade,
    });
    await docClient.send(command);
    return updatedTrade;
  } catch (error) {
    console.error('Error updating trade:', error);
    throw error;
  }
}

async function getAllActiveTrades() {
  try {
    // Get all active trades (pending, accepted, completed) in a single scan
    // This is more efficient than N+1 queries per user
    const command = new ScanCommand({
      TableName: TRADES_TABLE,
      FilterExpression: 'status IN (:pending, :accepted, :completed)',
      ExpressionAttributeValues: {
        ':pending': 'pending',
        ':accepted': 'accepted',
        ':completed': 'completed'
      }
    });
    const response = await docClient.send(command);
    return response.Items || [];
  } catch (error) {
    // If table doesn't exist yet, return empty array
    if (error.name === 'ResourceNotFoundException') {
      console.warn(`Trades table does not exist. Table: ${TRADES_TABLE}`);
      return [];
    }
    console.error('Error getting all active trades:', error);
    throw error;
  }
}

module.exports = {
  getUser,
  getUserByEmail,
  createUser,
  updateUser,
  getBook,
  getBooksByUser,
  getAllBooks,
  createBook,
  deleteBook,
  getTrade,
  getTradesByFromUser,
  getTradesByToUser,
  getTradesByUser,
  createTrade,
  updateTrade,
  getAllActiveTrades,
};

