import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_msIzNKg26ApR@ep-fragrant-morning-a8urnhqb-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function checkTables() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', res.rows.map(r => r.table_name));
    
    // Also check schema for 'media' if it exists
    if (res.rows.some(r => r.table_name === 'media')) {
      const mediaSchema = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'media'");
      console.log('Media Schema:', mediaSchema.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkTables();
