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

async function buildGalleryNFTs(keyword, maxNfts = 50, maxContracts = 500) {
  try {
    const searchResults = await alchemy.nft.searchContractMetadata(keyword);
    
    const contracts = Array.isArray(searchResults) ? searchResults : (searchResults.contracts || []);
    
    if (contracts.length === 0) {
      return [];
    }
    
    const nfts = [];
    const contractsToSearch = Math.min(contracts.length, maxContracts);
    const nftsPerContract = Math.max(1, Math.ceil(maxNfts / contractsToSearch));
    
    for (const contract of contracts.slice(0, contractsToSearch)) {
      try {
        const nftsForContract = await alchemy.nft.getNftsForContract(contract.address, {
          pageSize: nftsPerContract
        });

        for (const nft of nftsForContract.nfts || []) {
          if (nfts.length >= maxNfts) break;
          
          const image = nft.image?.cachedUrl || nft.image?.originalUrl || nft.raw?.metadata?.image;
          
          // Only include NFTs with valid HTTP(S) image URLs
          if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
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
        console.error('Contract fetch error:', err);
        continue;
      }
    }
    return nfts;
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!checkAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Missing keyword ID' });
    }
    
    await sql`UPDATE keywords SET is_active = false`;
    const keyword = await sql`UPDATE keywords SET is_active = true WHERE id = ${id} RETURNING *`;
    
    if (keyword.rows.length === 0) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    const settings = await sql`SELECT * FROM settings`;
    const maxNfts = parseInt(settings.rows.find(s => s.key === 'max_nfts')?.value || '50');
    const maxContracts = parseInt(settings.rows.find(s => s.key === 'max_contracts')?.value || '500');
    
    const nfts = await buildGalleryNFTs(keyword.rows[0].keyword, maxNfts, maxContracts);
    
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

    return res.json({ success: true, keyword: keyword.rows[0], nftCount: nfts.length });
  } catch (error) {
    console.error('Activate error:', error);
    return res.status(500).json({ error: error.message });
  }
}
