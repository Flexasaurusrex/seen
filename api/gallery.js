import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Check for mode parameter: ?mode=curated or ?mode=random (default: random)
    const mode = req.query.mode || 'random';
    
    if (mode === 'curated') {
      return await getCuratedGallery(res);
    } else {
      return await getRandomGallery(res);
    }
  } catch (error) {
    console.error('Gallery error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// RANDOM MODE: Original keyword-based system
async function getRandomGallery(res) {
  // Get all active keywords
  const activeKeywords = await sql`SELECT * FROM keywords WHERE is_active = true`;
  
  if (activeKeywords.rows.length === 0) {
    return res.json({ nfts: [], keywords: [], mode: 'random' });
  }

  // Get NFTs from all active keywords
  const keywordIds = activeKeywords.rows.map(k => k.id);
  const nfts = await sql`
    SELECT * FROM nft_cache 
    WHERE keyword_id = ANY(${keywordIds})
  `;

  // Fisher-Yates shuffle
  const shuffled = [...nfts.rows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return res.json({ 
    nfts: shuffled,
    keywords: activeKeywords.rows.map(k => k.keyword).join(', '),
    mode: 'random'
  });
}

// CURATED MODE: Show NFTs from curated contracts/collections
async function getCuratedGallery(res) {
  // Get all active curated collections
  const activeCollections = await sql`
    SELECT * FROM curated_collections 
    WHERE is_active = true 
    ORDER BY sort_order ASC
  `;

  if (activeCollections.rows.length === 0) {
    return res.json({ 
      nfts: [], 
      collections: [],
      mode: 'curated',
      message: 'No active curated collections' 
    });
  }

  // Get all contracts from active collections
  const collectionIds = activeCollections.rows.map(c => c.id);
  const contractsInCollections = await sql`
    SELECT DISTINCT cc.contract_id, ctr.contract_address, ctr.chain, ctr.collection_name, ctr.artist_name
    FROM collection_contracts cc
    JOIN curated_contracts ctr ON cc.id = ctr.id
    WHERE cc.collection_id = ANY(${collectionIds})
      AND ctr.is_active = true
    ORDER BY cc.sort_order ASC
  `;

  if (contractsInCollections.rows.length === 0) {
    return res.json({ 
      nfts: [], 
      collections: activeCollections.rows.map(c => c.name),
      mode: 'curated',
      message: 'No contracts in active collections'
    });
  }

  // Get cached NFTs from these contracts
  const contractIds = contractsInCollections.rows.map(c => c.contract_id);
  const nfts = await sql`
    SELECT 
      cn.*,
      ctr.contract_address,
      ctr.chain,
      ctr.collection_name,
      ctr.artist_name
    FROM curated_nft_cache cn
    JOIN curated_contracts ctr ON cn.contract_id = ctr.id
    WHERE cn.contract_id = ANY(${contractIds})
  `;

  // Fisher-Yates shuffle
  const shuffled = [...nfts.rows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return res.json({ 
    nfts: shuffled,
    collections: activeCollections.rows.map(c => c.name).join(', '),
    mode: 'curated'
  });
}
