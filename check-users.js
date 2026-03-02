import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_msIzNKg26ApR@ep-fragrant-morning-a8urnhqb-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function checkUsers() {
  try {
    const userRes = await pool.query('SELECT id, "fullName", email FROM "users" LIMIT 10');
    console.log('Users in DB:');
    console.log(JSON.stringify(userRes.rows, null, 2));
    
    // Check if user 2 specifically exists
    const user2Res = await pool.query('SELECT id FROM "users" WHERE id = 2');
    console.log('User 2 exists:', user2Res.rowCount > 0);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkUsers();
