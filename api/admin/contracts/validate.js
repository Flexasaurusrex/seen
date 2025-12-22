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
    const { contractAddress, chain } = req.body;
    
    if (!contractAddress) {
      return res.status(400).json({ error: 'Missing contract address' });
    }
    
    if (!chain || !['ethereum', 'base'].includes(chain)) {
      return res.status(400).json({ error: 'Invalid chain. Must be "ethereum" or "base"' });
    }

    const alchemy = chain === 'ethereum' ? alchemyEth : alchemyBase;
    
    console.log(`Validating ${chain} contract: ${contractAddress}`);

    // 1. Get contract metadata
    let contractMetadata;
    try {
      contractMetadata = await alchemy.nft.getContractMetadata(contractAddress);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid contract address or contract not found',
        details: error.message
      });
    }

    // 2. Fetch sample NFTs (5 for preview)
    let sampleNFTs = [];
    try {
      const nftsResponse = await alchemy.nft.getNftsForContract(contractAddress, {
        pageSize: 5
      });
      
      sampleNFTs = (nftsResponse.nfts || []).map(nft => {
        const image = nft.image?.cachedUrl || nft.image?.originalUrl || nft.raw?.metadata?.image;
        return {
          tokenId: nft.tokenId,
          title: nft.name || 'Untitled',
          description: nft.description || '',
          image: image || null
        };
      }).filter(nft => nft.image);
    } catch (error) {
      console.error('Error fetching sample NFTs:', error);
    }

    // 3. Return validation result with preview data
    return res.json({
      valid: true,
      contract: {
        address: contractAddress,
        chain: chain,
        name: contractMetadata.name || 'Unknown Collection',
        symbol: contractMetadata.symbol || '',
        totalSupply: contractMetadata.totalSupply || 'Unknown',
        tokenType: contractMetadata.tokenType || 'Unknown',
        contractDeployer: contractMetadata.contractDeployer || null,
        deployedBlockNumber: contractMetadata.deployedBlockNumber || null,
        openSeaMetadata: contractMetadata.openSeaMetadata || null
      },
      sampleNFTs: sampleNFTs,
      previewCount: sampleNFTs.length
    });

  } catch (error) {
    console.error('Validation error:', error);
    return res.status(500).json({ 
      error: 'Validation failed',
      details: error.message 
    });
  }
}
