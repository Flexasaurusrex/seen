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
    
    const allNFTs = [];
    const targetNFTs = 100;
    const segmentSize = 100; // Fetch 100 tokens per segment
    const numSegments = 5; // Fetch from 5 random segments
    
    // Divide collection into segments and pick random starting points
    const segmentWidth = Math.floor(totalSupply / numSegments);
    
    for (let i = 0; i < numSegments; i++) {
      // Pick a random starting point within this segment
      const segmentStart = i * segmentWidth;
      const segmentEnd = Math.min((i + 1) * segmentWidth, totalSupply);
      const randomOffset = segmentStart + Math.floor(Math.random() * Math.max(1, segmentEnd - segmentStart - segmentSize));
      
      console.log(`Fetching segment ${i + 1}/${numSegments} starting from token ~${randomOffset}`);
      
      try {
        // Fetch NFTs starting from this random offset
        const nftsResponse = await alchemy.nft.getNftsForContract(contractAddress, {
          pageSize: segmentSize,
          startToken: randomOffset.toString()
        });
        
        for (const nft of nftsResponse.nfts || []) {
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
        
        console.log(`Segment ${i + 1} fetched, total NFTs so far: ${allNFTs.length}`);
        
      } catch (err) {
        console.error(`Error fetching segment ${i + 1}:`, err.message);
      }
    }
    
    console.log(`Total fetched: ${allNFTs.length} NFTs from ${numSegments} random segments`);
    
    // Fisher-Yates shuffle
    const shuffled = [...allNFTs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const sampled = shuffled.slice(0, targetNFTs);
    
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
