const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const BUCKET_URL = process.env.AWS_S3_BUCKET_URL || 
  `https://${BUCKET_NAME}.s3.${process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-east-2'}.amazonaws.com`;

/**
 * Upload an image to S3
 * @param {Buffer} buffer - Image file buffer
 * @param {string} filename - Original filename
 * @param {string} mimetype - MIME type (e.g., 'image/jpeg')
 * @returns {Promise<string>} - Public URL of uploaded image
 */
async function uploadImage(buffer, filename, mimetype) {
  if (!BUCKET_NAME) {
    throw new Error('AWS_S3_BUCKET_NAME environment variable is not set');
  }

  // Generate unique key for the image
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1E9);
  const extension = filename.split('.').pop() || 'jpg';
  const key = `book-covers/${timestamp}-${random}.${extension}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
    ACL: 'public-read', // Make image publicly readable
  });

  try {
    await s3Client.send(command);
    const imageUrl = `${BUCKET_URL}/${key}`;
    return imageUrl;
  } catch (error) {
    console.error('Error uploading image to S3:', error);
    throw new Error('Failed to upload image to S3');
  }
}

/**
 * Delete an image from S3
 * @param {string} imageUrl - Full URL of the image to delete
 */
async function deleteImage(imageUrl) {
  if (!imageUrl || imageUrl.startsWith('data:') || imageUrl.startsWith('/uploads/')) {
    // Not an S3 URL, skip deletion (could be placeholder or local file)
    return;
  }

  if (!BUCKET_NAME) {
    console.warn('AWS_S3_BUCKET_NAME not set, skipping S3 deletion');
    return;
  }

  try {
    // Extract key from URL
    // URL format: https://bucket-name.s3.region.amazonaws.com/book-covers/filename.jpg
    const url = new URL(imageUrl);
    const key = url.pathname.substring(1); // Remove leading slash
    
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`Deleted image from S3: ${key}`);
  } catch (error) {
    console.error('Error deleting image from S3:', error);
    // Don't throw - continue even if deletion fails (image might already be deleted)
  }
}

/**
 * Get the public URL for an image key
 * @param {string} key - S3 object key
 * @returns {string} - Public URL
 */
function getImageUrl(key) {
  return `${BUCKET_URL}/${key}`;
}

module.exports = {
  uploadImage,
  deleteImage,
  getImageUrl,
};

