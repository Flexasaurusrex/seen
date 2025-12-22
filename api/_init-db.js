import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS keywords (
        id SERIAL PRIMARY KEY,
        keyword TEXT NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS nft_cache (
        id SERIAL PRIMARY KEY,
        keyword_id INTEGER REFERENCES keywords(id),
        contract_address TEXT NOT NULL,
        token_id TEXT NOT NULL,
        title TEXT,
        description TEXT,
        image_url TEXT,
        external_url TEXT,
        creator_name TEXT,
        cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        nft_id INTEGER REFERENCES nft_cache(id),
        event_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`INSERT INTO settings (key, value) VALUES ('rotation_hours', '24') ON CONFLICT (key) DO NOTHING`;
    await sql`INSERT INTO settings (key, value) VALUES ('max_nfts', '50') ON CONFLICT (key) DO NOTHING`;
    await sql`INSERT INTO settings (key, value) VALUES ('auto_rotate', 'true') ON CONFLICT (key) DO NOTHING`;
    await sql`INSERT INTO settings (key, value) VALUES ('last_rotation', NOW()::TEXT) ON CONFLICT (key) DO NOTHING`;

    return res.json({ success: true, message: 'Database initialized' });
  } catch (error) {
    console.error('Init error:', error);
    return res.status(500).json({ error: error.message });
  }
}
