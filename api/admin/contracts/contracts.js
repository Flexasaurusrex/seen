import { sql } from '@vercel/postgres';

function checkAuth(req) {
  const auth = req.headers.authorization;
  if (!auth) return false;
  const [, credentials] = auth.split(' ');
  const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');
  return username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (!checkAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // GET: List all curated contracts
    if (req.method === 'GET') {
      const contracts = await sql`
        SELECT 
          cc.*,
          COUNT(DISTINCT cnc.id) as nft_count
        FROM curated_contracts cc
        LEFT JOIN curated_nft_cache cnc ON cnc.contract_id = cc.id
        GROUP BY cc.id
        ORDER BY cc.created_at DESC
      `;
      return res.json(contracts.rows);
    }

    // POST: Add new curated contract
    if (req.method === 'POST') {
      const { 
        contractAddress, 
        chain, 
        collectionName, 
        artistName, 
        notes 
      } = req.body;

      if (!contractAddress || !chain) {
        return res.status(400).json({ error: 'Missing contract address or chain' });
      }

      if (!['ethereum', 'base'].includes(chain)) {
        return res.status(400).json({ error: 'Invalid chain. Must be "ethereum" or "base"' });
      }

      // Check for duplicates
      const existing = await sql`
        SELECT * FROM curated_contracts 
        WHERE contract_address = ${contractAddress} AND chain = ${chain}
      `;

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Contract already exists' });
      }

      const result = await sql`
        INSERT INTO curated_contracts (
          contract_address, 
          chain, 
          collection_name, 
          artist_name, 
          notes,
          added_by
        ) VALUES (
          ${contractAddress}, 
          ${chain}, 
          ${collectionName || null}, 
          ${artistName || null}, 
          ${notes || null},
          'admin'
        ) 
        RETURNING *
      `;

      return res.json(result.rows[0]);
    }

    // DELETE: Remove curated contract
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing contract ID' });

      const result = await sql`
        DELETE FROM curated_contracts 
        WHERE id = ${id} 
        RETURNING *
      `;

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Contracts error:', error);
    return res.status(500).json({ error: error.message });
  }
}
