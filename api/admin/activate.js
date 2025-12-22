import { sql } from '@vercel/postgres';
import { Alchemy, Network } from 'alchemy-sdk';

const alchemyEth = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
});

const alchemyBase = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

function checkAuth(req) {
  const auth = req.headers.authorization;
  if (!auth) return false;
  const [, credentials] = auth.split(' ');
  const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');
  return username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD;
}

async function buildGalleryNFTs(keyword) {
  try {
    // Search BOTH Ethereum and Base
    const [ethResults, baseResults] = await Promise.all([
      alchemyEth.nft.searchContractMetadata(keyword),
      alchemyBase.nft.searchContractMetadata(keyword)
    ]);
    
    const ethContracts = Array.isArray(ethResults) ? ethResults : (ethResults.contracts || []);
    const baseContracts = Array.isArray(baseResults) ? baseResults : (baseResults.contracts || []);
    
    // Tag contracts with their chain and alchemy instance
    const allContracts = [
      ...ethContracts.map(c => ({ ...c, chain: 'ethereum', alchemy: alchemyEth })),
      ...baseContracts.map(c => ({ ...c, chain: 'base', alchemy: alchemyBase }))
    ];
    
    // Shuffle to mix both chains
    allContracts.sort(() => Math.random() - 0.5);
    
    if (allContracts.length === 0) return [];
    
    const nfts = [];
    const MAX_NFTS = 100;
    const MAX_CONTRACTS = 500;
    const contractsToSearch = Math.min(allContracts.length, MAX_CONTRACTS);
    
    console.log(`Searching ${contractsToSearch} contracts (ETH: ${ethContracts.length}, Base: ${baseContracts.length}) for ${keyword}...`);
    
    for (let i = 0; i < contractsToSearch; i++) {
      if (nfts.length >= MAX_NFTS) {
        console.log(`Reached ${MAX_NFTS} NFTs, stopping search`);
        break;
      }
      
      const contract = allContracts[i];
      
      try {
        const nftsForContract = await contract.alchemy.nft.getNftsForContract(contract.address, {
          pageSize: 5
        });

        for (const nft of nftsForContract.nfts || []) {
          if (nfts.length >= MAX_NFTS) break;
          
          const image = nft.image?.cachedUrl || nft.image?.originalUrl || nft.raw?.metadata?.image;
          
          if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
            // Build OpenSea URL based on chain
            const openseaChain = contract.chain === 'base' ? 'base' : 'ethereum';
            const openseaUrl = `https://opensea.io/assets/${openseaChain}/${nft.contract.address}/${nft.tokenId}`;
            
            nfts.push({
              contractAddress: nft.contract.address,
              tokenId: nft.tokenId,
              title: nft.name || nft.contract.name || 'Untitled',
              description: nft.description || '',
              image,
              externalUrl: nft.raw?.metadata?.external_url || openseaUrl,
              creatorName: nft.contract.name || 'Unknown Artist',
              chain: contract.chain
            });
          }
        }
      } catch (err) {
        console.error(`Contract ${i} error:`, err.message);
        continue;
      }
      
      // Log progress every 50 contracts
      if (i % 50 === 0 && i > 0) {
        console.log(`Processed ${i} contracts, found ${nfts.length} NFTs so far...`);
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
    
    // Set this keyword as active (DOES NOT deactivate others)
    const keyword = await sql`UPDATE keywords SET is_active = true WHERE id = ${id} RETURNING *`;
    
    if (keyword.rows.length === 0) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    const nfts = await buildGalleryNFTs(keyword.rows[0].keyword);
    
    // Delete existing NFTs for this keyword only
    await sql`DELETE FROM nft_cache WHERE keyword_id = ${id}`;
    
    for (const nft of nfts) {
      await sql`
        INSERT INTO nft_cache (
          keyword_id, contract_address, token_id, title, description,
          image_url, external_url, creator_name, chain
        ) VALUES (
          ${id}, ${nft.contractAddress}, ${nft.tokenId}, ${nft.title},
          ${nft.description}, ${nft.image}, ${nft.externalUrl}, ${nft.creatorName}, ${nft.chain}
        )
      `;
    }

    return res.json({ success: true, keyword: keyword.rows[0], nftCount: nfts.length });
  } catch (error) {
    console.error('Activate error:', error);
    return res.status(500).json({ error: error.message });
  }
}
