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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function buildGalleryNFTs(keyword) {
  try {
    const searchResults = await alchemy.nft.searchContractMetadata(keyword);
    const contracts = Array.isArray(searchResults) ? searchResults : (searchResults.contracts || []);
    
    if (contracts.length === 0) return [];
    
    const nfts = [];
    const MAX_NFTS = 100;
    const MAX_CONTRACTS = 500;
    const contractsToSearch = Math.min(contracts.length, MAX_CONTRACTS);
    
    console.log(`Searching ${contractsToSearch} contracts for ${keyword}...`);
    
    for (let i = 0; i < contractsToSearch; i++) {
      if (nfts.length >= MAX_NFTS) {
        console.log(`Reached ${MAX_NFTS} NFTs, stopping search`);
        break;
      }
      
      const contract = contracts[i];
      
      try {
        const nftsForContract = await alchemy.nft.getNftsForContract(contract.address, {
          pageSize: 1
        });

        for (const nft of nftsForContract.nfts || []) {
          if (nfts.length >= MAX_NFTS) break;
          
          const image = nft.image?.cachedUrl || nft.image?.originalUrl || nft.raw?.metadata?.image;
          
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
        
        // Aggressive delay after every contract to avoid rate limits
        await delay(100);
        
        // Log progress every 50 contracts
        if (i % 50 === 0 && i > 0) {
          console.log(`Processed ${i} contracts, found ${nfts.length} NFTs so far...`);
        }
      } catch (err) {
        console.error(`Contract ${i} error:`, err.message);
        // Still delay even on error to avoid hammering API
        await delay(100);
        continue;
      }
    }
    
    console.log(`Final result: ${nfts.length} NFTs from ${contractsToSearch} contracts`);
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
    if (!id) return res.status(400).json({ error: 'Missing keyword ID' });
    
    await sql`UPDATE keywords SET is_active = false`;
    const keyword = await sql`UPDATE keywords SET is_active = true WHERE id = ${id} RETURNING *`;
    
    if (keyword.rows.length === 0) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    const nfts = await buildGalleryNFTs(keyword.rows[0].keyword);
    
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

    return res.json({ success: true, keyword: keyword.rows[0], nftCount: nfts.length });
  } catch (error) {
    console.error('Activate error:', error);
    return res.status(500).json({ error: error.message });
  }
}
