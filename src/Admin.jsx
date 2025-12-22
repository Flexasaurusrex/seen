import { useState, useEffect } from 'react';
import './Admin.css';

const API_BASE = window.location.origin;

function Admin() {
  const [auth, setAuth] = useState({ username: '', password: '' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('keywords'); // 'keywords' | 'contracts' | 'collections'
  
  // Keywords state
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  
  // Contracts state
  const [contracts, setContracts] = useState([]);
  const [newContract, setNewContract] = useState({
    address: '',
    chain: 'ethereum',
    collectionName: '',
    artistName: '',
    notes: ''
  });
  const [contractPreview, setContractPreview] = useState(null);
  const [validating, setValidating] = useState(false);
  
  // Collections state
  const [collections, setCollections] = useState([]);
  const [newCollection, setNewCollection] = useState({ name: '', description: '' });
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionContracts, setCollectionContracts] = useState([]);
  
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const authHeaders = () => ({
    'Authorization': 'Basic ' + btoa(`${auth.username}:${auth.password}`),
    'Content-Type': 'application/json'
  });

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const login = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/keywords`, { headers: authHeaders() });
      if (res.ok) {
        setIsAuthenticated(true);
        loadAll();
      } else {
        showMessage('Invalid credentials', 'error');
      }
    } catch (err) {
      showMessage('Login failed', 'error');
    }
  };

  const loadAll = () => {
    loadKeywords();
    loadContracts();
    loadCollections();
  };

  // ===== KEYWORDS =====
  const loadKeywords = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/keywords`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setKeywords(data);
      }
    } catch (err) {
      console.error('Load keywords error:', err);
    }
  };

  const addKeyword = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/keywords`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ keyword: newKeyword.trim() })
      });

      if (res.ok) {
        setNewKeyword('');
        showMessage('Keyword added');
        loadKeywords();
      } else {
        showMessage('Failed to add', 'error');
      }
    } catch (err) {
      showMessage('Failed to add', 'error');
    }
    setLoading(false);
  };

  const deleteKeyword = async (id, keyword) => {
    if (!confirm(`Delete "${keyword}"?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/keywords?id=${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });

      if (res.ok) {
        showMessage('Deleted');
        loadKeywords();
      } else {
        showMessage('Failed to delete', 'error');
      }
    } catch (err) {
      showMessage('Failed to delete', 'error');
    }
    setLoading(false);
  };

  const activateKeyword = async (id, keyword) => {
    setLoading(true);
    showMessage(`Activating "${keyword}"...`, 'info');

    try {
      const res = await fetch(`${API_BASE}/api/admin/activate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ id })
      });

      if (res.ok) {
        const data = await res.json();
        showMessage(`Activated! ${data.nftCount} NFTs fetched`);
        loadKeywords();
      } else {
        showMessage('Activation failed', 'error');
      }
    } catch (err) {
      showMessage('Activation failed', 'error');
    }
    setLoading(false);
  };

  // ===== CONTRACTS =====
  const loadContracts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/contracts`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setContracts(data);
      }
    } catch (err) {
      console.error('Load contracts error:', err);
    }
  };

  const validateContract = async () => {
    if (!newContract.address.trim()) {
      showMessage('Enter a contract address', 'error');
      return;
    }

    setValidating(true);
    setContractPreview(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/contracts/validate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          contractAddress: newContract.address.trim(),
          chain: newContract.chain
        })
      });

      if (res.ok) {
        const data = await res.json();
        setContractPreview(data);
        showMessage(`Valid contract! ${data.previewCount} sample NFTs loaded`);
        
        // Auto-fill collection name if we got it
        if (data.contract.name && !newContract.collectionName) {
          setNewContract(prev => ({ ...prev, collectionName: data.contract.name }));
        }
      } else {
        const error = await res.json();
        showMessage(error.error || 'Invalid contract', 'error');
      }
    } catch (err) {
      showMessage('Validation failed', 'error');
    }
    setValidating(false);
  };

  const addContract = async () => {
    if (!contractPreview) {
      showMessage('Validate the contract first', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/contracts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          contractAddress: newContract.address.trim(),
          chain: newContract.chain,
          collectionName: newContract.collectionName || contractPreview.contract.name,
          artistName: newContract.artistName,
          notes: newContract.notes
        })
      });

      if (res.ok) {
        showMessage('Contract added!');
        setNewContract({
          address: '',
          chain: 'ethereum',
          collectionName: '',
          artistName: '',
          notes: ''
        });
        setContractPreview(null);
        loadContracts();
      } else {
        const error = await res.json();
        showMessage(error.error || 'Failed to add', 'error');
      }
    } catch (err) {
      showMessage('Failed to add', 'error');
    }
    setLoading(false);
  };

  const deleteContract = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/contracts?id=${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });

      if (res.ok) {
        showMessage('Deleted');
        loadContracts();
      } else {
        showMessage('Failed to delete', 'error');
      }
    } catch (err) {
      showMessage('Failed to delete', 'error');
    }
    setLoading(false);
  };

  const cacheContractNFTs = async (id, name) => {
    setLoading(true);
    showMessage(`Caching NFTs from "${name}"...`, 'info');

    try {
      const res = await fetch(`${API_BASE}/api/admin/contracts/cache`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ contractId: id })
      });

      if (res.ok) {
        const data = await res.json();
        showMessage(`Cached ${data.nftCount} NFTs!`);
        loadContracts();
      } else {
        showMessage('Caching failed', 'error');
      }
    } catch (err) {
      showMessage('Caching failed', 'error');
    }
    setLoading(false);
  };

  // ===== COLLECTIONS =====
  const loadCollections = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/collections`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCollections(data);
      }
    } catch (err) {
      console.error('Load collections error:', err);
    }
  };

  const addCollection = async (e) => {
    e.preventDefault();
    if (!newCollection.name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/collections`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newCollection)
      });

      if (res.ok) {
        setNewCollection({ name: '', description: '' });
        showMessage('Collection created');
        loadCollections();
      } else {
        const error = await res.json();
        showMessage(error.error || 'Failed to create', 'error');
      }
    } catch (err) {
      showMessage('Failed to create', 'error');
    }
    setLoading(false);
  };

  const toggleCollectionActive = async (id, currentState, name) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/collections`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ id, isActive: !currentState })
      });

      if (res.ok) {
        showMessage(`"${name}" ${!currentState ? 'activated' : 'deactivated'}`);
        loadCollections();
      } else {
        showMessage('Failed to update', 'error');
      }
    } catch (err) {
      showMessage('Failed to update', 'error');
    }
    setLoading(false);
  };

  const deleteCollection = async (id, name) => {
    if (!confirm(`Delete collection "${name}"?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/collections?id=${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });

      if (res.ok) {
        showMessage('Deleted');
        loadCollections();
        if (selectedCollection === id) setSelectedCollection(null);
      } else {
        showMessage('Failed to delete', 'error');
      }
    } catch (err) {
      showMessage('Failed to delete', 'error');
    }
    setLoading(false);
  };

  const loadCollectionContracts = async (collectionId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/collections/contracts?collectionId=${collectionId}`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCollectionContracts(data);
      }
    } catch (err) {
      console.error('Load collection contracts error:', err);
    }
  };

  const addContractToCollection = async (collectionId, contractId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/collections/contracts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ collectionId, contractId })
      });

      if (res.ok) {
        showMessage('Added to collection');
        loadCollectionContracts(collectionId);
      } else {
        const error = await res.json();
        showMessage(error.error || 'Failed to add', 'error');
      }
    } catch (err) {
      showMessage('Failed to add', 'error');
    }
    setLoading(false);
  };

  const removeContractFromCollection = async (collectionId, contractId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/collections/contracts?collectionId=${collectionId}&contractId=${contractId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });

      if (res.ok) {
        showMessage('Removed from collection');
        loadCollectionContracts(collectionId);
      } else {
        showMessage('Failed to remove', 'error');
      }
    } catch (err) {
      showMessage('Failed to remove', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedCollection) {
      loadCollectionContracts(selectedCollection);
    }
  }, [selectedCollection]);

  // ===== LOGIN SCREEN =====
  if (!isAuthenticated) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#000',
        color: '#fff',
        fontFamily: 'monospace'
      }}>
        <form onSubmit={login} style={{ width: '300px' }}>
          <h1 style={{ marginBottom: '2rem', letterSpacing: '0.2em' }}>ADMIN</h1>
          <input
            type="text"
            placeholder="Username"
            value={auth.username}
            onChange={(e) => setAuth({ ...auth, username: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: '1rem',
              background: '#111',
              border: '1px solid #333',
              color: '#fff'
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={auth.password}
            onChange={(e) => setAuth({ ...auth, password: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: '1rem',
              background: '#111',
              border: '1px solid #333',
              color: '#fff'
            }}
          />
          <button type="submit" style={{
            width: '100%',
            padding: '0.75rem',
            background: '#fff',
            color: '#000',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}>
            LOGIN
          </button>
          {message.text && (
            <div style={{ marginTop: '1rem', color: message.type === 'error' ? '#f44' : '#4f4' }}>
              {message.text}
            </div>
          )}
        </form>
      </div>
    );
  }

  // ===== MAIN ADMIN INTERFACE =====
  const activeKeyword = keywords.find(k => k.is_active);
  const activeCollections = collections.filter(c => c.is_active);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: 'monospace',
      padding: '2rem'
    }}>
      <header style={{ 
        marginBottom: '3rem', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ letterSpacing: '0.2em' }}>SEEN ADMIN</h1>
        <button 
          onClick={() => setIsAuthenticated(false)}
          style={{
            padding: '0.5rem 1rem',
            background: 'transparent',
            border: '1px solid #666',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          LOGOUT
        </button>
      </header>

      {/* Message banner */}
      {message.text && (
        <div style={{ 
          padding: '1rem',
          marginBottom: '2rem',
          background: message.type === 'error' ? '#300' : message.type === 'info' ? '#036' : '#030',
          border: `1px solid ${message.type === 'error' ? '#f44' : message.type === 'info' ? '#4af' : '#4f4'}`
        }}>
          {message.text}
        </div>
      )}

      {/* Active status banner */}
      <div style={{ 
        padding: '1.5rem', 
        marginBottom: '2rem', 
        background: '#111',
        border: '1px solid #333'
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ color: '#888', marginBottom: '0.5rem' }}>RANDOM MODE ACTIVE:</div>
          <div style={{ fontSize: '1.2rem' }}>
            {activeKeyword ? activeKeyword.keyword : 'No keywords active'}
          </div>
        </div>
        <div>
          <div style={{ color: '#888', marginBottom: '0.5rem' }}>CURATED MODE ACTIVE:</div>
          <div style={{ fontSize: '1.2rem' }}>
            {activeCollections.length > 0 
              ? activeCollections.map(c => c.name).join(', ')
              : 'No collections active'
            }
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '2rem',
        borderBottom: '1px solid #333'
      }}>
        {['keywords', 'contracts', 'collections'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '1rem 2rem',
              background: activeTab === tab ? '#111' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #fff' : '2px solid transparent',
              color: activeTab === tab ? '#fff' : '#666',
              cursor: 'pointer',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              fontWeight: activeTab === tab ? 'bold' : 'normal'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: KEYWORDS */}
      {activeTab === 'keywords' && (
        <>
          <section style={{ marginBottom: '3rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>ADD KEYWORD</h2>
            <form onSubmit={addKeyword} style={{ display: 'flex', gap: '1rem' }}>
              <input
                type="text"
                placeholder="e.g. photography, generative art"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#111',
                  border: '1px solid #333',
                  color: '#fff'
                }}
              />
              <button 
                type="submit" 
                disabled={loading || !newKeyword.trim()}
                style={{
                  padding: '0.75rem 2rem',
                  background: '#fff',
                  color: '#000',
                  border: 'none',
                  cursor: loading ? 'wait' : 'pointer',
                  fontWeight: 'bold',
                  opacity: loading || !newKeyword.trim() ? 0.5 : 1
                }}
              >
                ADD
              </button>
            </form>
          </section>

          <section>
            <h2 style={{ marginBottom: '1rem' }}>KEYWORDS ({keywords.length})</h2>
            {keywords.length === 0 ? (
              <div style={{ color: '#666', padding: '2rem', textAlign: 'center' }}>
                No keywords yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {keywords.map(kw => (
                  <div 
                    key={kw.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem',
                      background: kw.is_active ? '#113' : '#111',
                      border: `1px solid ${kw.is_active ? '#4f4' : '#333'}`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontWeight: kw.is_active ? 'bold' : 'normal' }}>
                        {kw.keyword}
                      </span>
                      {kw.is_active && (
                        <span style={{ 
                          fontSize: '0.75rem', 
                          color: '#4f4',
                          border: '1px solid #4f4',
                          padding: '0.25rem 0.5rem'
                        }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => activateKeyword(kw.id, kw.keyword)}
                        disabled={loading}
                        style={{
                          padding: '0.5rem 1rem',
                          background: kw.is_active ? '#4f4' : '#fff',
                          color: '#000',
                          border: 'none',
                          cursor: loading ? 'wait' : 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        {kw.is_active ? 'REFRESH' : 'ACTIVATE'}
                      </button>
                      <button
                        onClick={() => deleteKeyword(kw.id, kw.keyword)}
                        disabled={loading}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'transparent',
                          color: '#f44',
                          border: '1px solid #f44',
                          cursor: loading ? 'wait' : 'pointer'
                        }}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* TAB CONTENT: CONTRACTS */}
      {activeTab === 'contracts' && (
        <>
          <section style={{ marginBottom: '3rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>ADD CURATED CONTRACT</h2>
            
            {/* Step 1: Validate contract */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <select
                  value={newContract.chain}
                  onChange={(e) => setNewContract({ ...newContract, chain: e.target.value })}
                  disabled={validating}
                  style={{
                    padding: '0.75rem',
                    background: '#111',
                    border: '1px solid #333',
                    color: '#fff'
                  }}
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="base">Base</option>
                </select>
                
                <input
                  type="text"
                  placeholder="Contract address (0x...)"
                  value={newContract.address}
                  onChange={(e) => setNewContract({ ...newContract, address: e.target.value })}
                  disabled={validating}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#111',
                    border: '1px solid #333',
                    color: '#fff'
                  }}
                />
                
                <button 
                  onClick={validateContract}
                  disabled={validating || !newContract.address.trim()}
                  style={{
                    padding: '0.75rem 2rem',
                    background: '#4af',
                    color: '#000',
                    border: 'none',
                    cursor: validating ? 'wait' : 'pointer',
                    fontWeight: 'bold',
                    opacity: validating || !newContract.address.trim() ? 0.5 : 1
                  }}
                >
                  {validating ? 'VALIDATING...' : 'VALIDATE'}
                </button>
              </div>
            </div>

            {/* Step 2: Show preview and metadata */}
            {contractPreview && (
              <div style={{ 
                padding: '1.5rem', 
                background: '#111', 
                border: '1px solid #4f4',
                marginBottom: '2rem'
              }}>
                <h3 style={{ marginBottom: '1rem', color: '#4f4' }}>✓ VALID CONTRACT</h3>
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ color: '#888', fontSize: '0.9rem' }}>Collection Name:</div>
                  <div style={{ fontSize: '1.1rem' }}>{contractPreview.contract.name}</div>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ color: '#888', fontSize: '0.9rem' }}>Total Supply:</div>
                  <div>{contractPreview.contract.totalSupply}</div>
                </div>
                
                {/* Sample NFTs preview */}
                {contractPreview.sampleNFTs.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      Sample NFTs ({contractPreview.previewCount}):
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
                      {contractPreview.sampleNFTs.map((nft, i) => (
                        <img 
                          key={i}
                          src={nft.image} 
                          alt={nft.title}
                          style={{ 
                            width: '100px', 
                            height: '100px', 
                            objectFit: 'cover',
                            border: '1px solid #333'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Additional metadata fields */}
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input
                    type="text"
                    placeholder="Collection Name (optional override)"
                    value={newContract.collectionName}
                    onChange={(e) => setNewContract({ ...newContract, collectionName: e.target.value })}
                    style={{
                      padding: '0.75rem',
                      background: '#000',
                      border: '1px solid #333',
                      color: '#fff'
                    }}
                  />
                  
                  <input
                    type="text"
                    placeholder="Artist Name"
                    value={newContract.artistName}
                    onChange={(e) => setNewContract({ ...newContract, artistName: e.target.value })}
                    style={{
                      padding: '0.75rem',
                      background: '#000',
                      border: '1px solid #333',
                      color: '#fff'
                    }}
                  />
                  
                  <textarea
                    placeholder="Notes (why you're featuring this)"
                    value={newContract.notes}
                    onChange={(e) => setNewContract({ ...newContract, notes: e.target.value })}
                    style={{
                      padding: '0.75rem',
                      background: '#000',
                      border: '1px solid #333',
                      color: '#fff',
                      minHeight: '80px',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
                
                <button 
                  onClick={addContract}
                  disabled={loading}
                  style={{
                    marginTop: '1rem',
                    width: '100%',
                    padding: '0.75rem',
                    background: '#fff',
                    color: '#000',
                    border: 'none',
                    cursor: loading ? 'wait' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  ADD TO CURATED CONTRACTS
                </button>
              </div>
            )}
          </section>

          <section>
            <h2 style={{ marginBottom: '1rem' }}>CURATED CONTRACTS ({contracts.length})</h2>
            {contracts.length === 0 ? (
              <div style={{ color: '#666', padding: '2rem', textAlign: 'center' }}>
                No curated contracts yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {contracts.map(contract => (
                  <div 
                    key={contract.id}
                    style={{
                      padding: '1rem',
                      background: '#111',
                      border: '1px solid #333'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                          {contract.collection_name || 'Unnamed Collection'}
                        </div>
                        {contract.artist_name && (
                          <div style={{ color: '#888', marginBottom: '0.5rem' }}>
                            by {contract.artist_name}
                          </div>
                        )}
                        <div style={{ color: '#666', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                          {contract.contract_address}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ 
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            background: '#222',
                            border: '1px solid #444'
                          }}>
                            {contract.chain.toUpperCase()}
                          </span>
                          <span style={{ color: '#888', fontSize: '0.85rem' }}>
                            {contract.nft_count || 0} NFTs cached
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => cacheContractNFTs(contract.id, contract.collection_name)}
                          disabled={loading}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#4af',
                            color: '#000',
                            border: 'none',
                            cursor: loading ? 'wait' : 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          CACHE NFTs
                        </button>
                        <button
                          onClick={() => deleteContract(contract.id, contract.collection_name)}
                          disabled={loading}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'transparent',
                            color: '#f44',
                            border: '1px solid #f44',
                            cursor: loading ? 'wait' : 'pointer'
                          }}
                        >
                          DELETE
                        </button>
                      </div>
                    </div>
                    
                    {contract.notes && (
                      <div style={{ 
                        marginTop: '0.75rem', 
                        padding: '0.75rem',
                        background: '#000',
                        border: '1px solid #222',
                        fontSize: '0.9rem',
                        color: '#aaa'
                      }}>
                        {contract.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* TAB CONTENT: COLLECTIONS */}
      {activeTab === 'collections' && (
        <>
          <section style={{ marginBottom: '3rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>CREATE COLLECTION</h2>
            <form onSubmit={addCollection} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="text"
                placeholder="Collection name (e.g. 'Generative Pioneers')"
                value={newCollection.name}
                onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                disabled={loading}
                style={{
                  padding: '0.75rem',
                  background: '#111',
                  border: '1px solid #333',
                  color: '#fff'
                }}
              />
              <textarea
                placeholder="Description"
                value={newCollection.description}
                onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
                disabled={loading}
                style={{
                  padding: '0.75rem',
                  background: '#111',
                  border: '1px solid #333',
                  color: '#fff',
                  minHeight: '80px',
                  fontFamily: 'monospace'
                }}
              />
              <button 
                type="submit" 
                disabled={loading || !newCollection.name.trim()}
                style={{
                  padding: '0.75rem 2rem',
                  background: '#fff',
                  color: '#000',
                  border: 'none',
                  cursor: loading ? 'wait' : 'pointer',
                  fontWeight: 'bold',
                  opacity: loading || !newCollection.name.trim() ? 0.5 : 1
                }}
              >
                CREATE COLLECTION
              </button>
            </form>
          </section>

          <section>
            <h2 style={{ marginBottom: '1rem' }}>COLLECTIONS ({collections.length})</h2>
            {collections.length === 0 ? (
              <div style={{ color: '#666', padding: '2rem', textAlign: 'center' }}>
                No collections yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {collections.map(collection => (
                  <div 
                    key={collection.id}
                    style={{
                      padding: '1rem',
                      background: collection.is_active ? '#113' : '#111',
                      border: `1px solid ${collection.is_active ? '#4f4' : '#333'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                            {collection.name}
                          </span>
                          {collection.is_active && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              color: '#4f4',
                              border: '1px solid #4f4',
                              padding: '0.25rem 0.5rem'
                            }}>
                              ACTIVE
                            </span>
                          )}
                        </div>
                        
                        {collection.description && (
                          <div style={{ color: '#888', marginBottom: '0.5rem' }}>
                            {collection.description}
                          </div>
                        )}
                        
                        <div style={{ color: '#666', fontSize: '0.85rem' }}>
                          {collection.contract_count || 0} contracts
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => toggleCollectionActive(collection.id, collection.is_active, collection.name)}
                          disabled={loading}
                          style={{
                            padding: '0.5rem 1rem',
                            background: collection.is_active ? '#4f4' : '#fff',
                            color: '#000',
                            border: 'none',
                            cursor: loading ? 'wait' : 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          {collection.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCollection(selectedCollection === collection.id ? null : collection.id);
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'transparent',
                            color: '#4af',
                            border: '1px solid #4af',
                            cursor: 'pointer'
                          }}
                        >
                          {selectedCollection === collection.id ? 'HIDE' : 'MANAGE'}
                        </button>
                        <button
                          onClick={() => deleteCollection(collection.id, collection.name)}
                          disabled={loading}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'transparent',
                            color: '#f44',
                            border: '1px solid #f44',
                            cursor: loading ? 'wait' : 'pointer'
                          }}
                        >
                          DELETE
                        </button>
                      </div>
                    </div>
                    
                    {/* Manage collection contracts */}
                    {selectedCollection === collection.id && (
                      <div style={{ 
                        marginTop: '1rem',
                        padding: '1rem',
                        background: '#000',
                        border: '1px solid #333'
                      }}>
                        <h3 style={{ marginBottom: '1rem' }}>CONTRACTS IN THIS COLLECTION</h3>
                        
                        {/* Add contract dropdown */}
                        <div style={{ marginBottom: '1rem' }}>
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                addContractToCollection(collection.id, parseInt(e.target.value));
                                e.target.value = '';
                              }
                            }}
                            disabled={loading}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              background: '#111',
                              border: '1px solid #333',
                              color: '#fff'
                            }}
                          >
                            <option value="">+ Add contract to collection</option>
                            {contracts
                              .filter(c => !collectionContracts.find(cc => cc.id === c.id))
                              .map(contract => (
                                <option key={contract.id} value={contract.id}>
                                  {contract.collection_name || contract.contract_address.slice(0, 10)}
                                  {contract.artist_name ? ` by ${contract.artist_name}` : ''}
                                </option>
                              ))
                            }
                          </select>
                        </div>
                        
                        {/* List contracts in collection */}
                        {collectionContracts.length === 0 ? (
                          <div style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>
                            No contracts in this collection yet
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {collectionContracts.map(contract => (
                              <div 
                                key={contract.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '0.75rem',
                                  background: '#111',
                                  border: '1px solid #222'
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 'bold' }}>
                                    {contract.collection_name || 'Unnamed'}
                                  </div>
                                  {contract.artist_name && (
                                    <div style={{ color: '#888', fontSize: '0.85rem' }}>
                                      by {contract.artist_name}
                                    </div>
                                  )}
                                  <div style={{ color: '#666', fontSize: '0.85rem' }}>
                                    {contract.nft_count || 0} NFTs
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeContractFromCollection(collection.id, contract.id)}
                                  disabled={loading}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    background: 'transparent',
                                    color: '#f44',
                                    border: '1px solid #f44',
                                    cursor: loading ? 'wait' : 'pointer',
                                    fontSize: '0.85rem'
                                  }}
                                >
                                  REMOVE
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default Admin;
