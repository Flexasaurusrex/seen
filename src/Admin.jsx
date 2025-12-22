import { useState, useEffect } from 'react';
import './Admin.css';

const API_BASE = window.location.origin;

function Admin() {
  const [auth, setAuth] = useState({ username: '', password: '' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
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
        loadKeywords();
      } else {
        showMessage('Invalid credentials', 'error');
      }
    } catch (err) {
      showMessage('Login failed', 'error');
    }
  };

  const loadKeywords = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/keywords`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setKeywords(data);
      }
    } catch (err) {
      console.error('Load error:', err);
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

  const activeKeyword = keywords.find(k => k.is_active);

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

      {activeKeyword && (
        <div style={{ 
          padding: '1.5rem', 
          marginBottom: '3rem', 
          background: '#111',
          border: '1px solid #333'
        }}>
          <div style={{ marginBottom: '0.5rem', color: '#888' }}>CURRENTLY ACTIVE:</div>
          <div style={{ fontSize: '1.5rem' }}>{activeKeyword.keyword}</div>
          <div style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
            Fetches 200 NFTs from 500 contracts
          </div>
        </div>
      )}

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
    </div>
  );
}

export default Admin;
