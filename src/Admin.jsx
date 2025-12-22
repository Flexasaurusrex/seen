import { useState, useEffect } from 'react';
import './Admin.css';

const API_BASE = '/api';

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [keywords, setKeywords] = useState([]);
  const [settings, setSettings] = useState({});
  const [analytics, setAnalytics] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('keywords');

  const authHeaders = () => ({
    'Authorization': `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`,
    'Content-Type': 'application/json'
  });

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/admin/keywords`, {
        headers: authHeaders()
      });

      if (response.ok) {
        setAuthenticated(true);
        fetchAllData();
      } else {
        alert('Invalid credentials');
      }
    } catch (error) {
      alert('Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllData() {
    try {
      const [keywordsRes, settingsRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/keywords`, { headers: authHeaders() }),
        fetch(`${API_BASE}/admin/settings`, { headers: authHeaders() }),
        fetch(`${API_BASE}/admin/analytics`, { headers: authHeaders() })
      ]);

      const keywordsData = await keywordsRes.json();
      const settingsData = await settingsRes.json();
      const analyticsData = await analyticsRes.json();

      setKeywords(keywordsData);
      setSettings(settingsData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  }

  async function handleCreateKeyword() {
    if (!newKeyword.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/keywords`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ keyword: newKeyword })
      });

      if (response.ok) {
        setNewKeyword('');
        fetchAllData();
      }
    } catch (error) {
      alert('Failed to create keyword');
    } finally {
      setLoading(false);
    }
  }

  async function handleActivateKeyword(id) {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/keywords/${id}/activate`, {
        method: 'PUT',
        headers: authHeaders()
      });

      if (response.ok) {
        fetchAllData();
      }
    } catch (error) {
      alert('Failed to activate keyword');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteKeyword(id) {
    if (!confirm('Delete this keyword?')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/keywords/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });

      if (response.ok) {
        fetchAllData();
      }
    } catch (error) {
      alert('Failed to delete keyword');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateSettings(updates) {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        fetchAllData();
      }
    } catch (error) {
      alert('Failed to update settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshCache() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/refresh`, {
        method: 'POST',
        headers: authHeaders()
      });

      if (response.ok) {
        alert('Cache refreshed successfully!');
      }
    } catch (error) {
      alert('Failed to refresh cache');
    } finally {
      setLoading(false);
    }
  }

  if (!authenticated) {
    return (
      <div className="admin-login">
        <form onSubmit={handleLogin} className="login-form">
          <h1 className="login-title">ADMIN ACCESS</h1>
          <input
            type="text"
            placeholder="USERNAME"
            value={credentials.username}
            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
            className="login-input"
          />
          <input
            type="password"
            placeholder="PASSWORD"
            value={credentials.password}
            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
            className="login-input"
          />
          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'AUTHENTICATING...' : 'LOGIN'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <h1 className="admin-title">GALLERY ADMIN</h1>
        <button onClick={() => setAuthenticated(false)} className="logout-button">
          LOGOUT
        </button>
      </header>

      <div className="admin-tabs">
        <button 
          onClick={() => setActiveTab('keywords')}
          className={`tab ${activeTab === 'keywords' ? 'active' : ''}`}
        >
          KEYWORDS
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
        >
          SETTINGS
        </button>
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
        >
          ANALYTICS
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'keywords' && (
          <div className="admin-section">
            <h2 className="section-title">KEYWORD MANAGEMENT</h2>
            
            <div className="keyword-creator">
              <input
                type="text"
                placeholder="NEW KEYWORD"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="keyword-input"
              />
              <button 
                onClick={handleCreateKeyword} 
                disabled={loading}
                className="button-primary"
              >
                ADD KEYWORD
              </button>
            </div>

            <div className="keywords-list">
              {keywords.map((keyword) => (
                <div key={keyword.id} className={`keyword-item ${keyword.is_active ? 'active' : ''}`}>
                  <div className="keyword-info">
                    <span className="keyword-text">{keyword.keyword}</span>
                    {keyword.is_active && <span className="active-badge">ACTIVE</span>}
                    <span className="keyword-date">{new Date(keyword.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="keyword-actions">
                    {!keyword.is_active && (
                      <button 
                        onClick={() => handleActivateKeyword(keyword.id)}
                        disabled={loading}
                        className="button-activate"
                      >
                        ACTIVATE
                      </button>
                    )}
                    <button 
                      onClick={() => handleDeleteKeyword(keyword.id)}
                      disabled={loading}
                      className="button-delete"
                    >
                      DELETE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="admin-section">
            <h2 className="section-title">GALLERY SETTINGS</h2>
            
            <div className="settings-grid">
              <div className="setting-item">
                <label className="setting-label">ROTATION HOURS</label>
                <input
                  type="number"
                  value={settings.rotation_hours || 24}
                  onChange={(e) => handleUpdateSettings({ rotation_hours: e.target.value })}
                  className="setting-input"
                />
              </div>

              <div className="setting-item">
                <label className="setting-label">MAX NFTS</label>
                <input
                  type="number"
                  value={settings.max_nfts || 50}
                  onChange={(e) => handleUpdateSettings({ max_nfts: e.target.value })}
                  className="setting-input"
                />
              </div>

              <div className="setting-item">
                <label className="setting-label">AUTO ROTATE</label>
                <select
                  value={settings.auto_rotate || 'true'}
                  onChange={(e) => handleUpdateSettings({ auto_rotate: e.target.value })}
                  className="setting-input"
                >
                  <option value="true">ENABLED</option>
                  <option value="false">DISABLED</option>
                </select>
              </div>

              <div className="setting-item full-width">
                <button onClick={handleRefreshCache} disabled={loading} className="button-primary">
                  REFRESH CACHE NOW
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="admin-section">
            <h2 className="section-title">ANALYTICS</h2>
            
            <div className="analytics-table">
              <div className="table-header">
                <div className="table-cell">ARTWORK</div>
                <div className="table-cell">CREATOR</div>
                <div className="table-cell">VIEWS</div>
                <div className="table-cell">CLICKS</div>
                <div className="table-cell">LAST SEEN</div>
              </div>
              {analytics.map((item, i) => (
                <div key={i} className="table-row">
                  <div className="table-cell">{item.title}</div>
                  <div className="table-cell">{item.creator_name}</div>
                  <div className="table-cell">{item.views}</div>
                  <div className="table-cell">{item.clicks}</div>
                  <div className="table-cell">{new Date(item.last_interaction).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
