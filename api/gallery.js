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

function isScamNFT(nft) {
  const title = (nft.title || '').toLowerCase();
  const description = (nft.description || '').toLowerCase();
  const titleOriginal = nft.title || '';
  
  // Only flag if MULTIPLE scam indicators are present
  let scamScore = 0;
  
  // High-confidence scam keywords (instant flag)
  const highConfidenceScams = [
    'claim your',
    'click here',
    'free mint',
    'congratulations you',
    'you won',
    'redeem now',
    'visit to claim'
  ];
  
  for (const phrase of highConfidenceScams) {
    if (title.includes(phrase) || description.includes(phrase)) {
      return true;
    }
  }
  
  // Medium confidence keywords (need multiple)
  const mediumConfidenceScams = ['claim', 'reward', 'airdrop', 'prize', 'bonus'];
  
  for (const keyword of mediumConfidenceScams) {
    if (title.includes(keyword)) scamScore++;
    if (description.includes(keyword)) scamScore++;
  }
  
  // Check for URLs in title (always suspicious)
  if (titleOriginal.match(/https?:\/\//)) {
    return true;
  }
  
  // Check for all caps with numbers AND dollar signs/crypto terms
  if (titleOriginal.match(/^[A-Z0-9\s]{15,}$/) && 
      (titleOriginal.includes('BTC') || titleOriginal.includes('ETH') || titleOriginal.includes('$'))) {
    return true;
  }
  
  // Only flag if scam score is 2 or higher
  return scamScore >= 2;
}

async function getRandomNFTs() {
  const activeKeywords = await sql`
    SELECT keyword FROM keywords WHERE is_active = true ORDER BY sort_order ASC
  `;

  if (activeKeywords.rows.length === 0) {
    return { nfts: [], keywords: '' };
  }

  const keyword = activeKeywords.rows[0].keyword;
  const allNFTs = [];

  try {
    const ethResults = await alchemyEth.nft.searchContractMetadata(keyword);
    const baseResults = await alchemyBase.nft.searchContractMetadata(keyword);

    const contracts = [
      ...ethResults.contracts.slice(0, 15).map(c => ({ address: c.address, chain: 'ethereum' })),
      ...baseResults.contracts.slice(0, 15).map(c => ({ address: c.address, chain: 'base' }))
    ];

    for (const { address, chain } of contracts) {
      try {
        const alchemy = chain === 'ethereum' ? alchemyEth : alchemyBase;
        const nftsResponse = await alchemy.nft.getNftsForContract(address, { pageSize: 20 });
        
        for (const nft of nftsResponse.nfts) {
          const image = nft.image?.cachedUrl || nft.image?.originalUrl || nft.raw?.metadata?.image;
          
          if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
            const openseaChain = chain === 'base' ? 'base' : 'ethereum';
            const openseaUrl = `https://opensea.io/assets/${openseaChain}/${nft.contract.address}/${nft.tokenId}`;
            
            const nftData = {
              title: nft.name || nft.contract.name || 'Untitled',
              creator_name: nft.contract.name || 'Unknown',
              image_url: image,
              external_url: nft.raw?.metadata?.external_url || openseaUrl,
              chain: chain,
              description: nft.description || ''
            };
            
            // FILTER OUT SCAMS
            if (!isScamNFT(nftData)) {
              allNFTs.push(nftData);
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching NFTs for ${address}:`, err.message);
      }
    }
  } catch (error) {
    console.error('Error searching contracts:', error);
  }

  // NO SERVER-SIDE SHUFFLE - client will handle randomization
  const selected = allNFTs.slice(0, 200);

  return { nfts: selected, keywords: keyword };
}

async function getCuratedNFTs() {
  const activeCollection = await sql`
    SELECT * FROM curated_collections WHERE is_active = true LIMIT 1
  `;

  if (activeCollection.rows.length === 0) {
    return { nfts: [], collections: '' };
  }

  const collectionId = activeCollection.rows[0].id;
  const collectionName = activeCollection.rows[0].name;

  const contracts = await sql`
    SELECT cc.contract_id 
    FROM collection_contracts cc
    WHERE cc.collection_id = ${collectionId}
    ORDER BY cc.sort_order ASC
  `;

  if (contracts.rows.length === 0) {
    return { nfts: [], collections: collectionName };
  }

  const contractIds = contracts.rows.map(r => r.contract_id);

  const nfts = await sql`
    SELECT 
      cnc.id,
      cnc.title,
      cnc.image_url,
      cnc.external_url,
      cc.artist_name as creator_name,
      cc.chain
    FROM curated_nft_cache cnc
    JOIN curated_contracts cc ON cnc.contract_id = cc.id
    WHERE cnc.contract_id = ANY(${contractIds})
    ORDER BY RANDOM()
  `;

  return { nfts: nfts.rows, collections: collectionName };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mode = 'random' } = req.query;

    let result;
    if (mode === 'curated') {
      result = await getCuratedNFTs();
    } else {
      result = await getRandomNFTs();
    }

    return res.json(result);
  } catch (error) {
    console.error('Gallery API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
