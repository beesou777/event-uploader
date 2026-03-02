import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_msIzNKg26ApR@ep-fragrant-morning-a8urnhqb-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function cleanup() {
  try {
    // Delete media linked to our events
    await pool.query('DELETE FROM media WHERE "creatorId" = 3');
    // Delete our events
    const res = await pool.query('DELETE FROM events WHERE "creatorId" = 3');
    console.log(`Deleted ${res.rowCount} events and their media for a fresh start.`);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

cleanup();
