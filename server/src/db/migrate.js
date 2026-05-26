const pool = require('./index');

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id        SERIAL PRIMARY KEY,
        email     VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cv_data (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        data       JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id)
      );
    `);
    console.log('Database migrations completed');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
