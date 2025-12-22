import { useState, useEffect, useCallback } from 'react';
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
  const [galleryMode, setGalleryMode] = useState('random');
  
  // Modal state
  const [collectionInfo, setCollectionInfo] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchGallery();
  }, [galleryMode]);

  async function fetchGallery() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/gallery?mode=${galleryMode}`);
      const data = await response.json();
      
      setNfts(data.nfts || []);
      setCurrentKeyword(data.keywords || data.collections || '');
      setCurrentIndex(0);
      setLoading(false);
      
      // If curated mode and we have collections, fetch collection info
      if (galleryMode === 'curated' && data.collections) {
        fetchCollectionInfo();
        setShowModal(true); // Auto-open modal
      } else {
        setShowModal(false);
        setCollectionInfo(null);
      }
      
      if (data.nfts && data.nfts.length > 0) {
        trackView(data.nfts[0].id);
      }
    } catch (error) {
      console.error('Error fetching gallery:', error);
      setLoading(false);
    }
  }

  async function fetchCollectionInfo() {
    try {
      const response = await fetch(`${API_BASE}/admin/collections/collections`);
      const collections = await response.json();
      const activeCollection = collections.find(c => c.is_active);
      if (activeCollection) {
        setCollectionInfo(activeCollection);
      }
    } catch (error) {
      console.error('Error fetching collection info:', error);
    }
  }

  async function trackView(nftId) {
    try {
      await fetch(`${API_BASE}/analytics/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nftId })
      });
    } catch (error) {
      // Silent fail
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
      // Silent fail
    }
  }

  function handleNFTClick(nft) {
    trackClick(nft.id);
    if (nft.external_url) {
      window.open(nft.external_url, '_blank');
    }
  }

  const goToNext = useCallback(() => {
    if (nfts.length === 0) return;
    
    let nextIndex = (currentIndex + 1) % nfts.length;
    let attempts = 0;
    while (brokenImages.has(nfts[nextIndex]?.image_url) && attempts < nfts.length) {
      nextIndex = (nextIndex + 1) % nfts.length;
      attempts++;
    }
    
    const nextImage = new Image();
    nextImage.src = nfts[nextIndex]?.image_url;
    
    nextImage.onload = () => {
      setFade(false);
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        if (nfts[nextIndex]) {
          trackView(nfts[nextIndex].id);
        }
        setTimeout(() => setFade(true), 50);
      }, 400);
    };
    
    setTimeout(() => {
      if (!nextImage.complete) {
        nextImage.onload = null;
        setFade(false);
        setTimeout(() => {
          setCurrentIndex(nextIndex);
          if (nfts[nextIndex]) {
            trackView(nfts[nextIndex].id);
          }
          setTimeout(() => setFade(true), 50);
        }, 400);
      }
    }, 1000);
  }, [nfts, currentIndex, brokenImages]);

  const goToPrevious = useCallback(() => {
    if (nfts.length === 0) return;
    
    let prevIndex = (currentIndex - 1 + nfts.length) % nfts.length;
    let attempts = 0;
    while (brokenImages.has(nfts[prevIndex]?.image_url) && attempts < nfts.length) {
      prevIndex = (prevIndex - 1 + nfts.length) % nfts.length;
      attempts++;
    }
    
    const prevImage = new Image();
    prevImage.src = nfts[prevIndex]?.image_url;
    
    prevImage.onload = () => {
      setFade(false);
      setTimeout(() => {
        setCurrentIndex(prevIndex);
        if (nfts[prevIndex]) {
          trackView(nfts[prevIndex].id);
        }
        setTimeout(() => setFade(true), 50);
      }, 400);
    };
    
    setTimeout(() => {
      if (!prevImage.complete) {
        prevImage.onload = null;
        setFade(false);
        setTimeout(() => {
          setCurrentIndex(prevIndex);
          if (nfts[prevIndex]) {
            trackView(nfts[prevIndex].id);
          }
          setTimeout(() => setFade(true), 50);
        }, 400);
      }
    }, 1000);
  }, [nfts, currentIndex, brokenImages]);

  useEffect(() => {
    if (nfts.length === 0 || !isPlaying) return;

    const interval = setInterval(() => {
      goToNext();
    }, 8000);

    return () => clearInterval(interval);
  }, [nfts, isPlaying, goToNext]);

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

        <div className="mode-toggle">
          <button 
            className={`mode-button ${galleryMode === 'random' ? 'active' : ''}`}
            onClick={() => setGalleryMode('random')}
          >
            RANDOM
          </button>
          <button 
            className={`mode-button ${galleryMode === 'curated' ? 'active' : ''}`}
            onClick={() => setGalleryMode('curated')}
          >
            CURATED
          </button>
        </div>

        <div className="gallery-content">
          <div className="empty-container">
            <div className="empty-box">
              <div className="empty-text">
                {galleryMode === 'curated' 
                  ? 'NO CURATED COLLECTIONS ACTIVE' 
                  : 'NO ARTWORK AVAILABLE'
                }
              </div>
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
      
      {/* Collection Info Modal */}
      {showModal && collectionInfo && (
        <>
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="collection-modal">
            <button 
              className="modal-close"
              onClick={() => setShowModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="modal-collection-title">{collectionInfo.name}</h2>
            <p className="modal-collection-description">{collectionInfo.description}</p>
          </div>
        </>
      )}

      {/* Info Button - Shows when modal is closed in curated mode */}
      {galleryMode === 'curated' && !showModal && collectionInfo && (
        <button 
          className="collection-info-button"
          onClick={() => setShowModal(true)}
          title="View Collection Info"
          aria-label="View Collection Info"
        >
          ℹ
        </button>
      )}
      
      <div className="gallery-content">
        <header className="gallery-header">
          <div className="header-left">
            <h1 className="gallery-title">SEEN</h1>
            <p className="gallery-tagline">Because being seen is enough.</p>
          </div>
        </header>

        <div className="mode-toggle">
          <button 
            className={`mode-button ${galleryMode === 'random' ? 'active' : ''}`}
            onClick={() => setGalleryMode('random')}
            title="Algorithmically discovered NFTs"
          >
            RANDOM
          </button>
          <button 
            className={`mode-button ${galleryMode === 'curated' ? 'active' : ''}`}
            onClick={() => setGalleryMode('curated')}
            title="Hand-picked collections"
          >
            CURATED
          </button>
        </div>

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
                  setBrokenImages(prev => new Set([...prev, imageUrl]));
                  goToNext();
                }
              }}
            />
          </div>
        </div>

        <div className={`nft-info ${fade ? 'fade-in' : 'fade-out'}`}>
          <h2 className="nft-title">{currentNFT.title}</h2>
          <div className="nft-creator">{currentNFT.creator_name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div className="nft-counter">{currentIndex + 1} of {nfts.length}</div>
            {currentNFT.chain && (
              <span style={{
                padding: '0.25rem 0.5rem',
                background: '#333',
                color: '#aaa',
                fontSize: '0.7rem',
                borderRadius: '3px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {currentNFT.chain}
              </span>
            )}
            <span style={{
              padding: '0.25rem 0.5rem',
              background: galleryMode === 'curated' ? '#4f4' : '#333',
              color: galleryMode === 'curated' ? '#000' : '#aaa',
              fontSize: '0.7rem',
              borderRadius: '3px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: galleryMode === 'curated' ? 'bold' : 'normal'
            }}>
              {galleryMode === 'curated' ? 'CURATED' : 'RANDOM'}
            </span>
          </div>
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
