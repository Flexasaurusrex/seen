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
    // GET: Get all contracts in a specific collection
    if (req.method === 'GET') {
      const { collectionId } = req.query;

      if (!collectionId) {
        return res.status(400).json({ error: 'Missing collection ID' });
      }

      const contracts = await sql`
        SELECT 
          cc.*,
          cct.sort_order,
          COUNT(DISTINCT cnc.id) as nft_count
        FROM collection_contracts cct
        JOIN curated_contracts cc ON cc.id = cct.contract_id
        LEFT JOIN curated_nft_cache cnc ON cnc.contract_id = cc.id
        WHERE cct.collection_id = ${collectionId}
        GROUP BY cc.id, cct.sort_order
        ORDER BY cct.sort_order ASC
      `;

      return res.json(contracts.rows);
    }

    // POST: Add contract to collection
    if (req.method === 'POST') {
      const { collectionId, contractId } = req.body;

      if (!collectionId || !contractId) {
        return res.status(400).json({ error: 'Missing collection ID or contract ID' });
      }

      // Check if already in collection
      const existing = await sql`
        SELECT * FROM collection_contracts 
        WHERE collection_id = ${collectionId} AND contract_id = ${contractId}
      `;

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Contract already in collection' });
      }

      // Get max sort_order for this collection
      const maxSort = await sql`
        SELECT COALESCE(MAX(sort_order), -1) as max_sort 
        FROM collection_contracts 
        WHERE collection_id = ${collectionId}
      `;

      const nextSort = maxSort.rows[0].max_sort + 1;

      await sql`
        INSERT INTO collection_contracts (collection_id, contract_id, sort_order) 
        VALUES (${collectionId}, ${contractId}, ${nextSort})
      `;

      return res.json({ success: true, sort_order: nextSort });
    }

    // DELETE: Remove contract from collection
    if (req.method === 'DELETE') {
      const { collectionId, contractId } = req.query;

      if (!collectionId || !contractId) {
        return res.status(400).json({ error: 'Missing collection ID or contract ID' });
      }

      const result = await sql`
        DELETE FROM collection_contracts 
        WHERE collection_id = ${collectionId} AND contract_id = ${contractId}
        RETURNING *
      `;

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Association not found' });
      }

      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Collection contracts error:', error);
    return res.status(500).json({ error: error.message });
  }
}
