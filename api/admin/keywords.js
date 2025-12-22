import { sql } from '@vercel/postgres';
import { Alchemy, Network } from 'alchemy-sdk';

const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
});

function checkAuth(req) {
  const auth = req.headers.authorization;
  if (!auth) return false;
  const [, credentials] = auth.split(' ');
  const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');
  return username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;
}

async function buildGalleryNFTs(keyword, maxNfts = 50) {
  const searchResults = await alchemy.nft.searchContractMetadata(keyword);
  const nfts = [];
  
  for (const contract of searchResults.slice(0, 10)) {
    try {
      const nftsForContract = await alchemy.nft.getNftsForContract(contract.address, {
        pageSize: Math.ceil(maxNfts / 10)
      });

      for (const nft of nftsForContract.nfts) {
        if (nfts.length >= maxNfts) break;
        const image = nft.image?.cachedUrl || nft.image?.originalUrl || nft.raw?.metadata?.image;
        if (image) {
          nfts.push({
            contractAddress: nft.contract.address,
            tokenId: nft.tokenId,
            title: nft.name || nft.contract.name || 'Untitled',
            description: nft.description || '',
            image,
            externalUrl: nft.raw?.metadata?.external_url || `https://opensea.io/assets/ethereum/${nft.contract.address}/${nft.tokenId}`,
            creatorName: nft.contract.name || 'Unknown Artist'
          });
        }
      }
      if (nfts.length >= maxNfts) break;
    } catch (err) {
      continue;
    }
  }
  return nfts;
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
    // GET - List all keywords
    if (req.method === 'GET') {
      const keywords = await sql`SELECT * FROM keywords ORDER BY created_at DESC`;
      return res.json(keywords.rows);
    }

    // POST - Create new keyword
    if (req.method === 'POST') {
      const { keyword } = req.body;
      const result = await sql`INSERT INTO keywords (keyword) VALUES (${keyword}) RETURNING *`;
      return res.json(result.rows[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Keywords error:', error);
    return res.status(500).json({ error: error.message });
  }
}
