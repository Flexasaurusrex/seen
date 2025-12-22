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

async function cacheContractNFTs(contractAddress, chain, contractId) {
  const alchemy = chain === 'ethereum' ? alchemyEth : alchemyBase;
  
  try {
    console.log(`Caching NFTs from ${chain} contract: ${contractAddress}`);
    
    // Get contract metadata to see total supply
    const contractMetadata = await alchemy.nft.getContractMetadata(contractAddress);
    const totalSupply = parseInt(contractMetadata.totalSupply) || 1000;
    
    console.log(`Total supply: ${totalSupply}`);
    
    // Generate random token IDs across the entire collection
    const randomTokenIds = new Set();
    const targetTokens = Math.min(500, totalSupply);
    
    while (randomTokenIds.size < targetTokens) {
      const randomId = Math.floor(Math.random() * totalSupply);
      randomTokenIds.add(randomId.toString());
    }
    
    console.log(`Generated ${randomTokenIds.size} random token IDs to fetch`);
    
    const allNFTs = [];
    let fetchedCount = 0;
    
    // Fetch NFTs in batches (Alchemy allows batch requests)
    const tokenIdArray = Array.from(randomTokenIds);
    
    for (let i = 0; i < tokenIdArray.length; i += 50) {
      const batch = tokenIdArray.slice(i, i + 50);
      
      try {
        // Fetch each token individually (could optimize with getNftsForContract but need specific tokens)
        const batchPromises = batch.map(async (tokenId) => {
          try {
            const nft = await alchemy.nft.getNftMetadata(contractAddress, tokenId);
            return nft;
          } catch (err) {
            console.log(`Failed to fetch token ${tokenId}: ${err.message}`);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        for (const nft of batchResults) {
          if (!nft) continue;
          
          const image = nft.image?.cachedUrl || nft.image?.originalUrl || nft.raw?.metadata?.image;
          
          if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
            const openseaChain = chain === 'base' ? 'base' : 'ethereum';
            const openseaUrl = `https://opensea.io/assets/${openseaChain}/${nft.contract.address}/${nft.tokenId}`;
            
            allNFTs.push({
              contractId: contractId,
              tokenId: nft.tokenId,
              title: nft.name || nft.contract.name || 'Untitled',
              description: nft.description || '',
              image: image,
              externalUrl: nft.raw?.metadata?.external_url || openseaUrl
            });
          }
        }
        
        fetchedCount += batch.length;
        console.log(`Fetched ${fetchedCount}/${targetTokens} random tokens...`);
        
      } catch (err) {
        console.error(`Batch fetch error:`, err.message);
      }
    }
    
    console.log(`Total fetched: ${allNFTs.length} valid NFTs from random sampling`);
    
    // Shuffle the results
    const shuffled = [...allNFTs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const sampled = shuffled.slice(0, 100);
    
    console.log(`Returning ${sampled.length} randomly sampled NFTs from contract ${contractAddress}`);
    return sampled;
  } catch (error) {
    console.error(`Error caching contract ${contractAddress}:`, error.message);
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
    const { contractId } = req.body;

    if (!contractId) {
      return res.status(400).json({ error: 'Missing contract ID' });
    }

    // Get contract details
    const contract = await sql`
      SELECT * FROM curated_contracts WHERE id = ${contractId}
    `;

    if (contract.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contractData = contract.rows[0];
    const nfts = await cacheContractNFTs(
      contractData.contract_address, 
      contractData.chain, 
      contractId
    );

    // Delete existing cached NFTs for this contract
    await sql`DELETE FROM curated_nft_cache WHERE contract_id = ${contractId}`;

    // Insert new cached NFTs
    for (const nft of nfts) {
      await sql`
        INSERT INTO curated_nft_cache (
          contract_id, token_id, title, description, image_url, external_url
        ) VALUES (
          ${nft.contractId}, ${nft.tokenId}, ${nft.title}, 
          ${nft.description}, ${nft.image}, ${nft.externalUrl}
        )
      `;
    }

    return res.json({ 
      success: true, 
      contract: contractData,
      nftCount: nfts.length 
    });
  } catch (error) {
    console.error('Cache error:', error);
    return res.status(500).json({ error: error.message });
  }
}
