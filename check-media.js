import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_msIzNKg26ApR@ep-fragrant-morning-a8urnhqb-pooler.eastus2.azure.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function checkMediaSchema() {
  try {
    const mediaSchema = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'media' ORDER BY ordinal_position");
    console.log(JSON.stringify(mediaSchema.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkMediaSchema();
