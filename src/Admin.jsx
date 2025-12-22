import { useState, useEffect } from 'react';
import './Admin.css';

const API_BASE = window.location.origin;

function Admin() {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [keywords, setKeywords] = useState([]);
  const [settings, setSettings] = useState({});
  const [stats, setStats] = useState({});
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const authHeaders = () => ({
    'Authorization': 'Basic ' + btoa(`${credentials.username}:${credentials.password}`),
    'Content-Type': 'application/json'
  });

  const login = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/keywords`, {
        headers: authHeaders()
      });
      
      if (response.ok) {
        setIsAuthenticated(true);
        fetchAllData();
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('Login failed');
    }
  };

  const fetchAllData = async () => {
    try {
      const [keywordsRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/keywords`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/admin/settings`, { headers: authHeaders() })
      ]);

      if (keywordsRes.ok) {
        const keywordsData = await keywordsRes.json();
        setKeywords(keywordsData);
        
        // Get stats for active keyword
        const active = keywordsData.find(k => k.is_active);
        if (active) {
          fetchKeywordStats(active.id);
        }
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  const fetchKeywordStats = async (keywordId) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/keywords/${keywordId}/stats`, {
        headers: authHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Stats error:', err);
    }
  };

  const addKeyword = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch(`${API_BASE}/api/admin/keywords`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ keyword: newKeyword.trim() })
      });

      if (response.ok) {
        setNewKeyword('');
        setSuccess('Keyword added!');
        fetchAllData();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add keyword');
      }
    } catch (err) {
      setError('Failed to add keyword');
    } finally {
      setLoading(false);
    }
  };

  const deleteKeyword = async (id) => {
    if (!confirm('Delete this keyword? This will remove all associated NFTs.')) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE}/api/admin/keywords/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });

      if (response.ok) {
        setSuccess('Keyword deleted!');
        fetchAllData();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to delete keyword');
      }
    } catch (err) {
      setError('Failed to delete keyword');
    } finally {
      setLoading(false);
    }
  };

  const activateKeyword = async (id) => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch(`${API_BASE}/api/admin/activate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ id })
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(`Activated! Fetched ${data.nftCount} NFTs from ${data.contractsSearched || settings.max_contracts || 500} contracts`);
        fetchAllData();
        setTimeout(() => setSuccess(''), 5000);
      } else {
        const data = await response.json();
        setError(data.error || 'Activation failed');
      }
    } catch (err) {
      setError('Activation failed');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (key, value) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ [key]: value })
      });

      if (response.ok) {
        setSettings({ ...settings, [key]: value });
        setSuccess('Settings updated!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('Failed to update settings');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <div className="login-container">
          <h1 className="login-title">ADMIN ACCESS</h1>
          <form onSubmit={login} className="login-form">
            <input
              type="text"
              placeholder="USERNAME"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              className="login-input"
              autoComplete="username"
            />
            <input
              type="password"
              placeholder="PASSWORD"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              className="login-input"
              autoComplete="current-password"
            />
            <button type="submit" className="login-button">
              {loading ? 'AUTHENTICATING...' : 'LOGIN'}
            </button>
            {error && <div className="error-message">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  const activeKeyword = keywords.find(k => k.is_active);

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1 className="admin-title">GALLERY ADMIN</h1>
        <button onClick={() => setIsAuthenticated(false)} className="logout-button">
          LOGOUT
        </button>
      </header>

      <div className="admin-content">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Stats Section */}
        {activeKeyword && (
          <section className="admin-section stats-section">
            <h2 className="section-title">Current Gallery Stats</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Active Keyword</div>
                <div className="stat-value">{activeKeyword.keyword}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">NFTs Displayed</div>
                <div className="stat-value">{stats.nftCount || '—'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Contracts Searched</div>
                <div className="stat-value">{settings.max_contracts || 500}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Last Activated</div>
                <div className="stat-value">
                  {activeKeyword.created_at ? new Date(activeKeyword.created_at).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Keywords Section */}
        <section className="admin-section">
          <h2 className="section-title">Keywords</h2>
          
          <form onSubmit={addKeyword} className="add-keyword-form">
            <input
              type="text"
              placeholder="NEW KEYWORD (e.g. 'generative art', 'photography')"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              className="keyword-input"
            />
            <button type="submit" className="add-button" disabled={loading || !newKeyword.trim()}>
              ADD KEYWORD
            </button>
          </form>

          <div className="keywords-list">
            {keywords.length === 0 ? (
              <div className="empty-state">No keywords yet. Add one above to start curating.</div>
            ) : (
              keywords.map(keyword => (
                <div key={keyword.id} className={`keyword-item ${keyword.is_active ? 'active' : ''}`}>
                  <div className="keyword-info">
                    <span className="keyword-name">{keyword.keyword}</span>
                    {keyword.is_active && <span className="active-badge">ACTIVE</span>}
                  </div>
                  <div className="keyword-actions">
                    <button
                      onClick={() => activateKeyword(keyword.id)}
                      disabled={loading}
                      className={`activate-button ${keyword.is_active ? 'refresh' : ''}`}
                    >
                      {keyword.is_active ? 'REFRESH' : 'ACTIVATE'}
                    </button>
                    <button
                      onClick={() => deleteKeyword(keyword.id)}
                      disabled={loading}
                      className="delete-button"
                      title="Delete keyword"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Settings Section */}
        <section className="admin-section">
          <h2 className="section-title">Gallery Settings</h2>
          
          <div className="settings-grid">
            <div className="setting-item">
              <label className="setting-label">
                Max NFTs to Display
                <span className="setting-value">{settings.max_nfts || 50}</span>
              </label>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={settings.max_nfts || 50}
                onChange={(e) => updateSettings('max_nfts', e.target.value)}
                className="setting-slider"
              />
              <p className="setting-help">Number of NFTs to show in the gallery rotation</p>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                Max Contracts to Search
                <span className="setting-value">{settings.max_contracts || 500}</span>
              </label>
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={settings.max_contracts || 500}
                onChange={(e) => updateSettings('max_contracts', e.target.value)}
                className="setting-slider"
              />
              <p className="setting-help">More contracts = more variety (500 max for free tier)</p>
            </div>

            <div className="setting-item">
              <label className="setting-label">
                Auto-Rotation Hours
                <span className="setting-value">{settings.rotation_hours || 24}h</span>
              </label>
              <input
                type="range"
                min="1"
                max="168"
                value={settings.rotation_hours || 24}
                onChange={(e) => updateSettings('rotation_hours', e.target.value)}
                className="setting-slider"
              />
              <p className="setting-help">How often to automatically refresh the gallery (if enabled)</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Admin;
