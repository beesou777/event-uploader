import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_msIzNKg26ApR@ep-fragrant-morning-a8urnhqb-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require",
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Checks if an event with the given externalRedirectUrl already exists in the database.
 * @param {string} url - The external redirect URL to check.
 * @returns {Promise<boolean>} - True if it exists, false otherwise.
 */
export async function checkIfEventExists(url) {
  if (!url) return false;
  
  try {
    const query = 'SELECT 1 FROM events WHERE "externalRedirectUrl" = $1 LIMIT 1';
    const res = await pool.query(query, [url]);
    return res.rowCount > 0;
  } catch (error) {
    console.error('Database query error:', error.message);
    // In case of error, we might want to assume it doesn't exist so we don't skip potential events
    // or return true to be safe. Given the user request, returning false (meaning it doesn't exist)
    // might lead to duplicates if DB is down, but returning true might skip everything.
    return false; 
  }
}

/**
 * Normalizes a URL for consistent comparison.
 * @param {string} url 
 * @returns {string}
 */
export function normalizeUrl(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}`.toLowerCase().replace(/\/$/, '');
  } catch {
    return url.toLowerCase().trim();
  }
}

export async function closePool() {
  await pool.end();
}
