import { sql } from '@vercel/postgres';

function checkAuth(req) {
  const auth = req.headers.authorization;
  if (!auth) return false;
  const [, credentials] = auth.split(' ');
  const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');
  return username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (!checkAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // GET: List all collections with contract counts
    if (req.method === 'GET') {
      const collections = await sql`
        SELECT 
          cc.*,
          COUNT(DISTINCT cct.contract_id) as contract_count
        FROM curated_collections cc
        LEFT JOIN collection_contracts cct ON cct.collection_id = cc.id
        GROUP BY cc.id
        ORDER BY cc.sort_order ASC, cc.created_at DESC
      `;
      return res.json(collections.rows);
    }

    // POST: Create new collection
    if (req.method === 'POST') {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Missing collection name' });
      }

      const slug = slugify(name);

      // Check for duplicate slug
      const existing = await sql`
        SELECT * FROM curated_collections WHERE slug = ${slug}
      `;

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Collection with this name already exists' });
      }

      const result = await sql`
        INSERT INTO curated_collections (name, slug, description) 
        VALUES (${name}, ${slug}, ${description || null}) 
        RETURNING *
      `;

      return res.json(result.rows[0]);
    }

    // PUT: Update collection (toggle active status or edit details)
    if (req.method === 'PUT') {
      const { id, name, description, isActive } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Missing collection ID' });
      }

      // If just toggling active status
      if (isActive !== undefined && !name && !description) {
        const result = await sql`
          UPDATE curated_collections 
          SET is_active = ${isActive} 
          WHERE id = ${id} 
          RETURNING *
        `;

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Collection not found' });
        }

        return res.json(result.rows[0]);
      }

      // If editing name/description
      if (name) {
        const slug = slugify(name);
        const result = await sql`
          UPDATE curated_collections 
          SET name = ${name}, slug = ${slug}, description = ${description || null}
          WHERE id = ${id} 
          RETURNING *
        `;

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Collection not found' });
        }

        return res.json(result.rows[0]);
      }

      return res.status(400).json({ error: 'Invalid update parameters' });
    }

    // DELETE: Remove collection
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing collection ID' });

      const result = await sql`
        DELETE FROM curated_collections 
        WHERE id = ${id} 
        RETURNING *
      `;

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Collection not found' });
      }

      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Collections error:', error);
    return res.status(500).json({ error: error.message });
  }
}
