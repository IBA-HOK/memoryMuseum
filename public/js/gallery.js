// Gallery modal functionality
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('art-modal');
  const modalImage = document.getElementById('modal-image');
  const modalTitle = document.getElementById('modal-title');
  const modalDate = document.getElementById('modal-date');
  const closeBtn = document.querySelector('.close');
  const similarBtn = document.getElementById('similar-art-btn');
  const downloadBtn = document.getElementById('download-art-btn');
  const shareBtn = document.getElementById('share-art-btn');
  let currentArtId = null;
  let allArts = [];

  // Gallery swipe functionality
  const galleryContainer = document.querySelector('.gallery-container');
  const galleries = document.querySelectorAll('.gallery-screen');
  const totalGalleries = galleries.length;
  let currentGalleryIndex = 0;
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  function updateGalleryPosition(instant = false) {
    galleries.forEach((gallery, index) => {
      if (instant) {
        gallery.style.transition = 'none';
      } else {
        gallery.style.transition = 'transform 0.3s ease-out';
      }
      const offset = (index - currentGalleryIndex) * 100;
      gallery.style.transform = `translateY(${offset}svh)`;
    });
  }

  function handleTouchStart(e) {
    if (modal.style.display === 'flex') return;
    startY = e.touches[0].clientY;
    currentY = startY;
    isDragging = true;
  }

  function handleTouchMove(e) {
    if (!isDragging || modal.style.display === 'flex') return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    
    // Apply resistance effect
    const resistance = 0.3;
    galleries.forEach((gallery, index) => {
      gallery.style.transition = 'none';
      const baseOffset = (index - currentGalleryIndex) * window.innerHeight;
      gallery.style.transform = `translateY(${baseOffset + diff * resistance}px)`;
    });
  }

  function handleTouchEnd(e) {
    if (!isDragging || modal.style.display === 'flex') return;
    isDragging = false;
    
    const diff = currentY - startY;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swipe down - go to previous gallery
        currentGalleryIndex = (currentGalleryIndex - 1 + totalGalleries) % totalGalleries;
      } else {
        // Swipe up - go to next gallery
        currentGalleryIndex = (currentGalleryIndex + 1) % totalGalleries;
      }
    }

    updateGalleryPosition();
  }

  galleryContainer.addEventListener('touchstart', handleTouchStart);
  galleryContainer.addEventListener('touchmove', handleTouchMove);
  galleryContainer.addEventListener('touchend', handleTouchEnd);

  // Initialize gallery positions
  updateGalleryPosition(true);

  // Collect all arts data (include shape info)
  document.querySelectorAll('.gallery-card').forEach(card => {
    const shape = card.classList.contains('shape-circle') ? 'circle' : 'square';
    allArts.push({
      artid: card.getAttribute('data-artid'),
      title: card.getAttribute('data-title'),
      date: card.getAttribute('data-date'),
      imgSrc: card.querySelector('img').src,
      shape: shape
    });
  });

  // showArt now accepts shape ('circle' or 'square') and applies class to modal image
  function showArt(artid, title, date, imgSrc, shape) {
    currentArtId = artid;
    modalImage.src = imgSrc;
    modalTitle.textContent = title ? `「${title}」` : '無題';
    modalDate.textContent = date;
    // apply shape class
    modalImage.classList.remove('shape-circle', 'shape-square');
    if (shape === 'circle') {
      modalImage.classList.add('shape-circle');
    } else {
      modalImage.classList.add('shape-square');
    }
    modal.style.display = 'flex';
  }

  // Add click event to gallery cards
  document.querySelectorAll('.gallery-card').forEach(card => {
    card.addEventListener('click', function() {
      const artid = this.getAttribute('data-artid');
      const title = this.getAttribute('data-title');
      const date = this.getAttribute('data-date');
      const imgSrc = this.querySelector('img').src;
      const shape = this.classList.contains('shape-circle') ? 'circle' : 'square';
      showArt(artid, title, date, imgSrc, shape);
    });
  });

  // Share button
  shareBtn.addEventListener('click', async function() {
    if (!currentArtId) return;
    
    const originalText = shareBtn.textContent;
    const originalBg = shareBtn.style.backgroundColor;
    
    try {
      const response = await fetch(`/api/arts/${currentArtId}/share`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate share URL');
      }
      
      const data = await response.json();
      
      if (data.shareUrl) {
        const title = modalTitle.textContent.replace(/「|」/g, '') || '無題';
        
        // Check if Web Share API is available and supported
        const isSecureContext = window.isSecureContext;
        const hasShareAPI = 'share' in navigator;
        
        console.log('Share API Debug:', {
          isSecureContext,
          hasShareAPI,
          protocol: window.location.protocol,
          userAgent: navigator.userAgent
        });
        
        // Try to use native Web Share API first (requires HTTPS on mobile)
        if (hasShareAPI && isSecureContext) {
          try {
            await navigator.share({
              title: `${title} | 思い出美術館`,
              text: '思い出美術館で共有された作品をご覧ください',
              url: data.shareUrl
            });
            
            // Show success notification
            shareBtn.textContent = '共有しました！';
            shareBtn.style.backgroundColor = '#4CAF50';
            
            setTimeout(() => {
              shareBtn.textContent = originalText;
              shareBtn.style.backgroundColor = originalBg;
            }, 2000);
            
            return; // Exit if Web Share API succeeded
          } catch (shareError) {
            // User cancelled or share failed
            if (shareError.name === 'AbortError') {
              console.log('Share cancelled by user');
              return; // Don't show error if user just cancelled
            }
            console.warn('Web Share API failed:', shareError.name, shareError.message);
          }
        } else {
          console.log('Web Share API not available:', {
            reason: !hasShareAPI ? 'API not supported' : 'Not secure context (needs HTTPS)'
          });
        }
        
        // Fallback: Copy to clipboard (for desktop or when share API unavailable)
        let copySuccess = false;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(data.shareUrl);
            copySuccess = true;
          }
        } catch (clipboardError) {
          console.warn('Clipboard API failed:', clipboardError);
        }
        
        // Fallback: use textarea method
        if (!copySuccess) {
          const textarea = document.createElement('textarea');
          textarea.value = data.shareUrl;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          textarea.style.top = '-9999px';
          textarea.style.left = '-9999px';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          textarea.setSelectionRange(0, textarea.value.length);
          try {
            copySuccess = document.execCommand('copy');
          } catch (err) {
            console.error('Fallback copy failed:', err);
          }
          document.body.removeChild(textarea);
        }
        
        // Show notification
        if (copySuccess) {
          shareBtn.textContent = 'URLをコピーしました！';
          shareBtn.style.backgroundColor = '#4CAF50';
        } else {
          // If copy failed, show the URL in a prompt (better for mobile)
          const userAction = prompt('共有URL（長押しでコピー）:', data.shareUrl);
          if (userAction !== null) {
            shareBtn.textContent = 'URLを表示しました';
            shareBtn.style.backgroundColor = '#2196F3';
          }
          setTimeout(() => {
            shareBtn.textContent = originalText;
            shareBtn.style.backgroundColor = originalBg;
          }, 2000);
          return;
        }
        
        setTimeout(() => {
          shareBtn.textContent = originalText;
          shareBtn.style.backgroundColor = originalBg;
        }, 2000);
      }
    } catch (error) {
      console.error('Error sharing art:', error);
      shareBtn.textContent = originalText;
      shareBtn.style.backgroundColor = originalBg;
      alert('共有URLの作成に失敗しました');
    }
  });

  // Download button
  downloadBtn.addEventListener('click', function() {
    const imgSrc = modalImage.src;
    const title = modalTitle.textContent.replace(/「|」/g, '') || '無題';
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = imgSrc;
    link.download = `${title}_${currentArtId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Similar art button
  similarBtn.addEventListener('click', async function() {
    if (!currentArtId || allArts.length < 2) return;
    
    try {
      const response = await fetch(`/api/similar-arts/${currentArtId}`);
      const data = await response.json();
      
      if (data.similarArt) {
        const art = allArts.find(a => a.artid === String(data.similarArt.artid));
        if (art) {
          showArt(art.artid, art.title, art.date, art.imgSrc);
        }
      }
    } catch (error) {
      console.error('Error fetching similar art:', error);
    }
  });

  // Close modal
  closeBtn.addEventListener('click', function() {
    modal.style.display = 'none';
  });

  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
});