import { useState, useEffect } from 'react';
import './Gallery.css';

const API_BASE = '/api';

export default function Gallery() {
  const [nfts, setNfts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [fade, setFade] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [brokenImages, setBrokenImages] = useState(new Set());

  useEffect(() => {
    fetchGallery();
  }, []);

  async function fetchGallery() {
    try {
      const response = await fetch(`${API_BASE}/gallery`);
      const data = await response.json();
      
      setNfts(data.nfts || []);
      setCurrentKeyword(data.keyword);
      setLoading(false);
      
      if (data.nfts && data.nfts.length > 0) {
        trackView(data.nfts[0].id);
      }
    } catch (error) {
      console.error('Error fetching gallery:', error);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (nfts.length === 0 || !isPlaying) return;

    const interval = setInterval(() => {
      goToNext();
    }, 8000);

    return () => clearInterval(interval);
  }, [nfts, isPlaying]);

  async function trackView(nftId) {
    try {
      await fetch(`${API_BASE}/analytics/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nftId })
      });
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }

  async function trackClick(nftId) {
    try {
      await fetch(`${API_BASE}/analytics/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nftId })
      });
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  }

  function handleNFTClick(nft) {
    trackClick(nft.id);
    if (nft.external_url) {
      window.open(nft.external_url, '_blank');
    }
  }

  function goToNext() {
    setFade(false);
    
    setTimeout(() => {
      setCurrentIndex((prev) => {
        let next = (prev + 1) % nfts.length;
        let attempts = 0;
        while (brokenImages.has(nfts[next]?.image_url) && attempts < nfts.length) {
          next = (next + 1) % nfts.length;
          attempts++;
        }
        if (nfts[next]) {
          trackView(nfts[next].id);
        }
        return next;
      });
      
      setTimeout(() => {
        setFade(true);
      }, 50);
    }, 400);
  }

  function goToPrevious() {
    setFade(false);
    
    setTimeout(() => {
      setCurrentIndex((prev) => {
        let next = (prev - 1 + nfts.length) % nfts.length;
        let attempts = 0;
        while (brokenImages.has(nfts[next]?.image_url) && attempts < nfts.length) {
          next = (next - 1 + nfts.length) % nfts.length;
          attempts++;
        }
        if (nfts[next]) {
          trackView(nfts[next].id);
        }
        return next;
      });
      
      setTimeout(() => {
        setFade(true);
      }, 50);
    }, 400);
  }

  if (loading) {
    return (
      <div className="gallery-loading">
        <div className="loading-text">LOADING</div>
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="gallery-empty">
        <div className="gallery-bg"></div>
        
        <header className="gallery-header">
          <div className="header-left">
            <h1 className="gallery-title">SEEN</h1>
            <p className="gallery-tagline">Because being seen is enough.</p>
          </div>
        </header>

        <div className="gallery-content">
          <div className="empty-container">
            <div className="empty-box">
              <div className="empty-text">NO ARTWORK AVAILABLE</div>
            </div>
          </div>
        </div>

        <footer className="gallery-footer">
          <div className="footer-manifesto">
            SEEN is an anti-marketplace that uses public infrastructure to display artists' work without fees, friction, or obligation—because art deserves to be seen, not sold to be visible.
          </div>
        </footer>
      </div>
    );
  }

  const currentNFT = nfts[currentIndex];

  return (
    <div className={`gallery ${fullscreen ? 'fullscreen' : ''}`}>
      <div className="gallery-bg"></div>
      
      <div className="gallery-content">
        <header className="gallery-header">
          <div className="header-left">
            <h1 className="gallery-title">SEEN</h1>
            <p className="gallery-tagline">Because being seen is enough.</p>
          </div>
        </header>

        <div 
          className={`nft-hero ${fade ? 'fade-in' : 'fade-out'}`}
          onClick={() => handleNFTClick(currentNFT)}
        >
          <div className="nft-image-container">
            <img 
              src={currentNFT.image_url} 
              alt={currentNFT.title}
              className="nft-image"
              onError={() => {
                const imageUrl = currentNFT.image_url;
                if (!brokenImages.has(imageUrl)) {
                  console.warn('Image failed to load:', imageUrl);
                  setBrokenImages(prev => new Set([...prev, imageUrl]));
                  goToNext();
                }
              }}
            />
          </div>
        </div>

        <div className={`nft-info ${fade ? 'fade-in' : 'fade-out'}`}>
          <h2 className="nft-title">{currentNFT.title}</h2>
          <div className="nft-creator">
            {currentNFT.creator_name}
            {currentNFT.chain && (
              <span style={{
                marginLeft: '1rem',
                padding: '0.25rem 0.5rem',
                background: '#333',
                color: '#aaa',
                fontSize: '0.75rem',
                borderRadius: '3px',
                textTransform: 'uppercase'
              }}>
                {currentNFT.chain}
              </span>
            )}
          </div>
          <div className="nft-counter">{currentIndex + 1} of {nfts.length}</div>
        </div>

        <div className="gallery-controls">
          <button onClick={goToPrevious} className="control-button" title="Previous">
            ‹
          </button>
          <button onClick={() => setIsPlaying(!isPlaying)} className="control-button" title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <button onClick={goToNext} className="control-button" title="Next">
            ›
          </button>
        </div>

        <button 
          className="fullscreen-toggle"
          onClick={() => setFullscreen(!fullscreen)}
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? '×' : '⛶'}
        </button>

        <footer className="gallery-footer">
          <div className="footer-manifesto">
            SEEN is an anti-marketplace that uses public infrastructure to display artists' work without fees, friction, or obligation—because art deserves to be seen, not sold to be visible.
          </div>
        </footer>
      </div>
    </div>
  );
}
