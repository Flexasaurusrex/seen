import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // 1. CURATED CONTRACTS TABLE
    // Manually selected contracts that deserve to be featured
    await sql`
      CREATE TABLE IF NOT EXISTS curated_contracts (
        id SERIAL PRIMARY KEY,
        contract_address TEXT NOT NULL,
        chain TEXT NOT NULL CHECK (chain IN ('ethereum', 'base')),
        collection_name TEXT,
        artist_name TEXT,
        notes TEXT,
        added_by TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(contract_address, chain)
      )
    `;

    // 2. ARTISTS TABLE
    // Artist profiles with bio, socials, etc.
    await sql`
      CREATE TABLE IF NOT EXISTS artists (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        bio TEXT,
        twitter TEXT,
        farcaster TEXT,
        website TEXT,
        profile_image TEXT,
        is_featured BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 3. ARTIST_CONTRACTS JUNCTION TABLE
    // Links artists to their contracts
    await sql`
      CREATE TABLE IF NOT EXISTS artist_contracts (
        artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
        contract_id INTEGER REFERENCES curated_contracts(id) ON DELETE CASCADE,
        PRIMARY KEY (artist_id, contract_id)
      )
    `;

    // 4. CURATED COLLECTIONS TABLE
    // Themed groups of contracts ("Generative Pioneers", "Base Builders", etc.)
    await sql`
      CREATE TABLE IF NOT EXISTS curated_collections (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT FALSE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 5. COLLECTION_CONTRACTS JUNCTION TABLE
    // Many-to-many: collections can have multiple contracts, contracts can be in multiple collections
    await sql`
      CREATE TABLE IF NOT EXISTS collection_contracts (
        collection_id INTEGER REFERENCES curated_collections(id) ON DELETE CASCADE,
        contract_id INTEGER REFERENCES curated_contracts(id) ON DELETE CASCADE,
        sort_order INTEGER DEFAULT 0,
        PRIMARY KEY (collection_id, contract_id)
      )
    `;

    // 6. CURATED_NFT_CACHE TABLE
    // Cache of NFTs from curated contracts (separate from keyword-based cache)
    await sql`
      CREATE TABLE IF NOT EXISTS curated_nft_cache (
        id SERIAL PRIMARY KEY,
        contract_id INTEGER REFERENCES curated_contracts(id) ON DELETE CASCADE,
        token_id TEXT NOT NULL,
        title TEXT,
        description TEXT,
        image_url TEXT,
        external_url TEXT,
        cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(contract_id, token_id)
      )
    `;

    // 7. SUBMISSIONS TABLE (for Phase 3 - artist submissions)
    await sql`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        artist_name TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        chain TEXT NOT NULL CHECK (chain IN ('ethereum', 'base')),
        artist_bio TEXT,
        contact_email TEXT,
        twitter TEXT,
        farcaster TEXT,
        submission_notes TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        reviewed_at TIMESTAMP,
        reviewer_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add indexes for better query performance
    await sql`CREATE INDEX IF NOT EXISTS idx_curated_contracts_active ON curated_contracts(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_curated_contracts_chain ON curated_contracts(chain)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_curated_collections_active ON curated_collections(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_curated_nft_cache_contract ON curated_nft_cache(contract_id)`;

    return res.status(200).json({ 
      success: true, 
      message: 'Curation system tables created successfully',
      tables: [
        'curated_contracts',
        'artists', 
        'artist_contracts',
        'curated_collections',
        'collection_contracts',
        'curated_nft_cache',
        'submissions'
      ]
    });
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
