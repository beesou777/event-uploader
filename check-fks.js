import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_msIzNKg26ApR@ep-fragrant-morning-a8urnhqb-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function checkFKs() {
  try {
    const res = await pool.query(`
      SELECT
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          conname
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='events';
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    
    // Also check if user 2 exists
    const userRes = await pool.query('SELECT id FROM "user" WHERE id = 2');
    console.log('User 2 exists:', userRes.rowCount > 0);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkFKs();
