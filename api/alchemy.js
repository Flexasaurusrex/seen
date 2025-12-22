import { Alchemy, Network } from 'alchemy-sdk';

const config = {
  apiKey: process.env.ALCHEMY_API_KEY || 'eprkUYTWwDDqT9DOnqAvt-l4z',
  network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(config);

export async function buildGalleryNFTs(keyword, maxNfts = 50) {
  try {
    const searchResults = await alchemy.nft.searchContractMetadata(keyword);
    
    const nfts = [];
    for (const contract of searchResults.slice(0, 10)) {
      try {
        const nftsForContract = await alchemy.nft.getNftsForContract(contract.address, {
          pageSize: Math.ceil(maxNfts / 10)
        });

        for (const nft of nftsForContract.nfts) {
          if (nfts.length >= maxNfts) break;

          const metadata = await nft.raw?.metadata || {};
          const image = nft.image?.cachedUrl || nft.image?.originalUrl || metadata.image;

          if (image) {
            nfts.push({
              contractAddress: nft.contract.address,
              tokenId: nft.tokenId,
              title: nft.name || nft.contract.name || 'Untitled',
              description: nft.description || '',
              image: image,
              externalUrl: nft.raw?.metadata?.external_url || `https://opensea.io/assets/ethereum/${nft.contract.address}/${nft.tokenId}`,
              creatorName: nft.contract.name || 'Unknown Artist'
            });
          }
        }

        if (nfts.length >= maxNfts) break;
      } catch (err) {
        console.error('Error fetching NFTs for contract:', err);
        continue;
      }
    }

    return nfts;
  } catch (error) {
    console.error('Error building gallery:', error);
    throw error;
  }
}
