import { BlobServiceClient } from '@azure/storage-blob';
import axios from 'axios';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'blobimage';

if (!connectionString) {
  console.error('❌ AZURE_STORAGE_CONNECTION_STRING is not defined in .env');
}

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient(containerName);

/**
 * Uploads an image from a URL to Azure Blob Storage
 * @param {string} imageUrl The source URL of the image
 * @returns {Promise<{url: string, blobName: string, mimetype: string}>}
 */
export async function uploadImageToAzure(imageUrl) {
  try {
    if (!imageUrl || !imageUrl.startsWith('http')) {
      throw new Error('Invalid image URL');
    }

    // Download the image
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    const mimetype = response.headers['content-type'] || 'image/jpeg';
    
    // Generate a unique blob name
    const extension = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const blobName = `${uuidv4()}${extension}`;
    
    // Upload to Azure
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: mimetype }
    });

    const finalUrl = blockBlobClient.url;
    console.log(`📸 Image uploaded to Azure: ${finalUrl}`);
    
    return {
      url: finalUrl,
      blobName: blobName,
      mimetype: mimetype
    };
  } catch (error) {
    console.error(`❌ Failed to upload image ${imageUrl} to Azure:`, error.message);
    return null;
  }
}
