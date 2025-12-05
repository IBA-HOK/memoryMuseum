// Gallery modal functionality
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('art-modal');
  const modalImage = document.getElementById('modal-image');
  const modalTitle = document.getElementById('modal-title');
  const modalDate = document.getElementById('modal-date');
  const closeBtn = document.querySelector('.close');
  const similarBtn = document.getElementById('similar-art-btn');
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

  // Collect all arts data
  document.querySelectorAll('.gallery-card').forEach(card => {
    allArts.push({
      artid: card.getAttribute('data-artid'),
      title: card.getAttribute('data-title'),
      date: card.getAttribute('data-date'),
      imgSrc: card.querySelector('img').src
    });
  });

  function showArt(artid, title, date, imgSrc) {
    currentArtId = artid;
    modalImage.src = imgSrc;
    modalTitle.textContent = title ? `「${title}」` : '無題';
    modalDate.textContent = date;
    modal.style.display = 'flex';
  }

  // Add click event to gallery cards
  document.querySelectorAll('.gallery-card').forEach(card => {
    card.addEventListener('click', function() {
      const artid = this.getAttribute('data-artid');
      const title = this.getAttribute('data-title');
      const date = this.getAttribute('data-date');
      const imgSrc = this.querySelector('img').src;
      showArt(artid, title, date, imgSrc);
    });
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