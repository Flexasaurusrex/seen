import { sql } from '@vercel/postgres';
import { buildGalleryNFTs } from './alchemy.js';

// Initialize database
let dbInitialized = false;
async function initDatabase() {
  if (dbInitialized) return;
  
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

    await sql`
      INSERT INTO settings (key, value) VALUES ('rotation_hours', '24')
      ON CONFLICT (key) DO NOTHING
    `;
    await sql`
      INSERT INTO settings (key, value) VALUES ('max_nfts', '50')
      ON CONFLICT (key) DO NOTHING
    `;
    await sql`
      INSERT INTO settings (key, value) VALUES ('auto_rotate', 'true')
      ON CONFLICT (key) DO NOTHING
    `;
    await sql`
      INSERT INTO settings (key, value) VALUES ('last_rotation', NOW()::TEXT)
      ON CONFLICT (key) DO NOTHING
    `;

    dbInitialized = true;
  } catch (error) {
    console.error('Database init error:', error);
  }
}

// Basic auth helper
function checkAuth(req) {
  const auth = req.headers.authorization || req.headers.get?.('authorization');
  if (!auth) return false;

  const [, credentials] = auth.split(' ');
  const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');

  return username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  await initDatabase();

  const { url, method } = req;
  const path = url.replace('/api', '');

  try {
    // PUBLIC ROUTES
    if (path === '/gallery' && method === 'GET') {
      const activeKeyword = await sql`
        SELECT * FROM keywords WHERE is_active = true LIMIT 1
      `;

      if (activeKeyword.rows.length === 0) {
        return res.json({ keyword: 'none', nfts: [] });
      }

      const nfts = await sql`
        SELECT * FROM nft_cache 
        WHERE keyword_id = ${activeKeyword.rows[0].id}
        ORDER BY RANDOM()
      `;

      return res.json({
        keyword: activeKeyword.rows[0].keyword,
        nfts: nfts.rows.map(nft => ({
          id: nft.id,
          contract_address: nft.contract_address,
          token_id: nft.token_id,
          title: nft.title,
          description: nft.description,
          image_url: nft.image_url,
          external_url: nft.external_url,
          creator_name: nft.creator_name
        }))
      });
    }

    if (path === '/analytics/view' && method === 'POST') {
      const { nftId } = req.body;
      await sql`INSERT INTO analytics (nft_id, event_type) VALUES (${nftId}, 'view')`;
      return res.json({ success: true });
    }

    if (path === '/analytics/click' && method === 'POST') {
      const { nftId } = req.body;
      await sql`INSERT INTO analytics (nft_id, event_type) VALUES (${nftId}, 'click')`;
      return res.json({ success: true });
    }

    // ADMIN ROUTES - require auth
    if (!checkAuth(req)) {
      res.setHeader('WWW-Authenticate', 'Basic');
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (path === '/admin/keywords' && method === 'GET') {
      const keywords = await sql`SELECT * FROM keywords ORDER BY created_at DESC`;
      return res.json(keywords.rows);
    }

    if (path === '/admin/keywords' && method === 'POST') {
      const { keyword } = req.body;
      const result = await sql`
        INSERT INTO keywords (keyword) VALUES (${keyword})
        RETURNING *
      `;
      return res.json(result.rows[0]);
    }

    if (path.match(/^\/admin\/keywords\/\d+\/activate$/) && method === 'PUT') {
      const id = parseInt(path.split('/')[3]);
      
      await sql`UPDATE keywords SET is_active = false`;
      
      const keyword = await sql`
        UPDATE keywords SET is_active = true 
        WHERE id = ${id}
        RETURNING *
      `;

      if (keyword.rows.length === 0) {
        return res.status(404).json({ error: 'Keyword not found' });
      }

      const settings = await sql`SELECT * FROM settings`;
      const maxNfts = parseInt(settings.rows.find(s => s.key === 'max_nfts')?.value || '50');
      
      const nfts = await buildGalleryNFTs(keyword.rows[0].keyword, maxNfts);
      
      await sql`DELETE FROM nft_cache WHERE keyword_id = ${id}`;
      
      for (const nft of nfts) {
        await sql`
          INSERT INTO nft_cache (
            keyword_id, contract_address, token_id, title, description,
            image_url, external_url, creator_name
          ) VALUES (
            ${id}, ${nft.contractAddress}, ${nft.tokenId}, ${nft.title},
            ${nft.description}, ${nft.image}, ${nft.externalUrl}, ${nft.creatorName}
          )
        `;
      }

      await sql`UPDATE settings SET value = NOW()::TEXT WHERE key = 'last_rotation'`;

      return res.json({ keyword: keyword.rows[0], nftCount: nfts.length });
    }

    if (path.match(/^\/admin\/keywords\/\d+$/) && method === 'DELETE') {
      const id = parseInt(path.split('/')[3]);
      await sql`DELETE FROM nft_cache WHERE keyword_id = ${id}`;
      await sql`DELETE FROM keywords WHERE id = ${id}`;
      return res.json({ success: true });
    }

    if (path === '/admin/settings' && method === 'GET') {
      const settings = await sql`SELECT * FROM settings`;
      const settingsObj = {};
      settings.rows.forEach(s => {
        settingsObj[s.key] = s.value;
      });
      return res.json(settingsObj);
    }

    if (path === '/admin/settings' && method === 'PUT') {
      const { rotation_hours, max_nfts, auto_rotate } = req.body;
      
      if (rotation_hours) {
        await sql`
          INSERT INTO settings (key, value) VALUES ('rotation_hours', ${rotation_hours})
          ON CONFLICT (key) DO UPDATE SET value = ${rotation_hours}
        `;
      }
      if (max_nfts) {
        await sql`
          INSERT INTO settings (key, value) VALUES ('max_nfts', ${max_nfts})
          ON CONFLICT (key) DO UPDATE SET value = ${max_nfts}
        `;
      }
      if (auto_rotate !== undefined) {
        await sql`
          INSERT INTO settings (key, value) VALUES ('auto_rotate', ${auto_rotate.toString()})
          ON CONFLICT (key) DO UPDATE SET value = ${auto_rotate.toString()}
        `;
      }
      
      return res.json({ success: true });
    }

    if (path === '/admin/analytics' && method === 'GET') {
      const analytics = await sql`
        SELECT 
          n.title,
          n.creator_name,
          COUNT(CASE WHEN a.event_type = 'view' THEN 1 END) as views,
          COUNT(CASE WHEN a.event_type = 'click' THEN 1 END) as clicks,
          MAX(a.created_at) as last_interaction
        FROM analytics a
        JOIN nft_cache n ON a.nft_id = n.id
        GROUP BY n.id, n.title, n.creator_name
        ORDER BY last_interaction DESC
      `;
      return res.json(analytics.rows);
    }

    if (path === '/admin/refresh' && method === 'POST') {
      const activeKeyword = await sql`
        SELECT * FROM keywords WHERE is_active = true LIMIT 1
      `;

      if (activeKeyword.rows.length === 0) {
        return res.status(400).json({ error: 'No active keyword' });
      }

      const settings = await sql`SELECT * FROM settings`;
      const maxNfts = parseInt(settings.rows.find(s => s.key === 'max_nfts')?.value || '50');
      
      const nfts = await buildGalleryNFTs(activeKeyword.rows[0].keyword, maxNfts);
      
      await sql`DELETE FROM nft_cache WHERE keyword_id = ${activeKeyword.rows[0].id}`;
      
      for (const nft of nfts) {
        await sql`
          INSERT INTO nft_cache (
            keyword_id, contract_address, token_id, title, description,
            image_url, external_url, creator_name
          ) VALUES (
            ${activeKeyword.rows[0].id}, ${nft.contractAddress}, ${nft.tokenId},
            ${nft.title}, ${nft.description}, ${nft.image}, ${nft.externalUrl},
            ${nft.creatorName}
          )
        `;
      }

      await sql`UPDATE settings SET value = NOW()::TEXT WHERE key = 'last_rotation'`;

      return res.json({ success: true, nftCount: nfts.length });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
