// Chromaticity gallery: plot gallery images by average color on a CIE 1931 xy plot
(function(){
  const MAX_SAMPLE_HEIGHT = 200;
  const PLOT_PADDING = 40;
  const XY_MAX = { x: 0.8, y: 0.9 };

  const canvas = document.getElementById('chromaticityCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('chromaticityStatus');
  const zoomLevelEl = document.getElementById('zoomLevelChrom');
  const zoomInBtn = document.getElementById('zoomInChrom');
  const zoomOutBtn = document.getElementById('zoomOutChrom');
  const resetBtn = document.getElementById('resetChromaticity');

  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');

  let samples = [];
  let scale = 1;
  // view center in normalized coordinates (0..1 of XY_MAX range)
  let viewCenter = { x: 0.5, y: 0.5 };

  function srgbToLinear(v){
    return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
  }

  function rgbToChromaticity({r,g,b}){
    const R = srgbToLinear(r/255);
    const G = srgbToLinear(g/255);
    const B = srgbToLinear(b/255);
    const X = 0.4124564*R + 0.3575761*G + 0.1804375*B;
    const Y = 0.2126729*R + 0.7151522*G + 0.072175*B;
    const Z = 0.0193339*R + 0.119192*G + 0.9503041*B;
    const s = X+Y+Z;
    if(!s) return {x:0,y:0};
    return { x: X/s, y: Y/s };
  }

  function xyToCanvas({x,y}){
    const padding = PLOT_PADDING;
    const plotW = canvas.width - padding*2;
    const plotH = canvas.height - padding*2;
    const cx = canvas.width/2;
    const cy = canvas.height/2;
    // normalized coordinates 0..1 within XY_MAX
    const nx = Math.min(x, XY_MAX.x) / XY_MAX.x;
    const ny = Math.min(y, XY_MAX.y) / XY_MAX.y;
    // position relative to view center
    const relX = (nx - viewCenter.x) * plotW * scale;
    // Y axis: invert so larger y appears higher on canvas
    const relY = (viewCenter.y - ny) * plotH * scale;
    return { x: cx + relX, y: cy + relY };
  }

  async function loadImage(src){
    return new Promise((resolve,reject)=>{
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = ()=>resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function analyzeAll(){
    const container = document.querySelector('.screen-container.gallery-screen[data-gallery-index="1"]');
    if(!container){ statusEl.textContent = '展示室Bが見つかりません'; return; }
    const cards = Array.from(container.querySelectorAll('.gallery-card'));
    if(!cards.length){ statusEl.textContent = '作品がありません'; drawPlot(); return; }
    samples = [];
    statusEl.textContent = `作品数 ${cards.length} 件を解析中...`;
    for(const card of cards){
      try{
        const imgEl = card.querySelector('img');
        if(!imgEl) continue;
        const img = await loadImage(imgEl.src);
        const hScale = Math.min(1, MAX_SAMPLE_HEIGHT / img.height);
        const w = Math.max(1, Math.round(img.width * hScale));
        const h = Math.max(1, Math.round(img.height * hScale));
        off.width = w; off.height = h; offCtx.clearRect(0,0,w,h); offCtx.drawImage(img,0,0,w,h);
        const data = offCtx.getImageData(0,0,w,h).data;
        let r=0,g=0,b=0,c=0;
        for(let i=0;i<data.length;i+=4){ r+=data[i]; g+=data[i+1]; b+=data[i+2]; c++; }
        if(c===0) continue;
        const avg = { r: Math.round(r/c), g: Math.round(g/c), b: Math.round(b/c) };
        const xy = rgbToChromaticity(avg);
        // create small thumbnail canvas for plotting
        const THUMB_MAX = 40;
        let tw = THUMB_MAX, th = THUMB_MAX;
        if (img.width > img.height) {
          th = Math.round((img.height / img.width) * THUMB_MAX) || 1;
        } else {
          tw = Math.round((img.width / img.height) * THUMB_MAX) || 1;
        }
        const thumb = document.createElement('canvas');
        thumb.width = tw; thumb.height = th;
        const tctx = thumb.getContext('2d');
        // draw cover-fit (centered)
        const ratio = Math.min(tw / img.width, th / img.height);
        const dw = Math.round(img.width * ratio);
        const dh = Math.round(img.height * ratio);
        const dx = Math.round((tw - dw) / 2);
        const dy = Math.round((th - dh) / 2);
        tctx.fillStyle = '#fff'; tctx.fillRect(0,0,tw,th);
        tctx.drawImage(img, 0,0, img.width, img.height, dx, dy, dw, dh);

        samples.push({ card, imgSrc: imgEl.src, avg, xy, thumb });
      }catch(e){ console.warn('解析失敗', e); }
    }
    statusEl.textContent = `完了: ${samples.length} 件をプロットしました`;
    // compute initial view to fit samples (allow zooming in)
    fitViewToSamples();
    drawPlot();
  }

  function fitViewToSamples(){
    if(!samples.length) return;
    // compute normalized ranges
    let minNx = 1, maxNx = 0, minNy = 1, maxNy = 0;
    samples.forEach(s=>{
      const nx = Math.min(s.xy.x, XY_MAX.x) / XY_MAX.x;
      const ny = Math.min(s.xy.y, XY_MAX.y) / XY_MAX.y;
      if(nx < minNx) minNx = nx; if(nx > maxNx) maxNx = nx;
      if(ny < minNy) minNy = ny; if(ny > maxNy) maxNy = ny;
    });
    // set view center to center of sample bounds
    viewCenter.x = (minNx + maxNx) / 2;
    viewCenter.y = (minNy + maxNy) / 2;

    const rangeX = Math.max(0.001, maxNx - minNx);
    const rangeY = Math.max(0.001, maxNy - minNy);
    // determine scale so that the larger normalized range fills ~85% of plot area
    const neededScale = 0.85 / Math.max(rangeX, rangeY);
    // allow zooming in beyond 1.0 but cap to a reasonable maximum to avoid huge magnification
    const MAX_INITIAL_SCALE = 4;
    scale = Math.min(MAX_INITIAL_SCALE, Math.max(0.6, neededScale));
    if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(scale*100)}%`;
  }

  function drawPlot(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawGrid();
    const MAX_DISPLAY_THUMB = 50; // avoid extremely large thumbs when zoomed
    samples.forEach(s=>{
      const pos = xyToCanvas(s.xy);
      const thumb = s.thumb;
      const w = thumb ? thumb.width : 20;
      const h = thumb ? thumb.height : 20;
      let drawW = w * scale;
      let drawH = h * scale;
      // cap drawn size
      const cap = MAX_DISPLAY_THUMB;
      if (drawW > cap || drawH > cap) {
        const ratio = Math.min(cap / drawW, cap / drawH);
        drawW = drawW * ratio;
        drawH = drawH * ratio;
      }
      const ox = pos.x - drawW / 2;
      const oy = pos.y - drawH / 2;
      if(thumb) ctx.drawImage(thumb, ox, oy, drawW, drawH);
      // border
      ctx.save();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#222';
      ctx.strokeRect(ox - 1, oy - 1, drawW + 2, drawH + 2);
      ctx.restore();
      s.bbox = { x: ox - 1, y: oy - 1, w: drawW + 2, h: drawH + 2 };
    });
  }

  function drawGrid(){
    // Grid and border intentionally hidden to keep plot background transparent.
    // If you want a subtle guide later, draw light lines here.
    return;
  }

  canvas.addEventListener('click', (ev)=>{
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left)/rect.width)*canvas.width;
    const y = ((ev.clientY - rect.top)/rect.height)*canvas.height;
    const hit = samples.find(s=> s.bbox && x>=s.bbox.x && x<=s.bbox.x+s.bbox.w && y>=s.bbox.y && y<=s.bbox.y+s.bbox.h );
    if(hit){ openModalForCard(hit.card); }
  });

  function openModalForCard(card){
    const modal = document.getElementById('art-modal');
    const modalImage = document.getElementById('modal-image');
    const modalTitle = document.getElementById('modal-title');
    const modalDate = document.getElementById('modal-date');
    const artid = card.getAttribute('data-artid');
    const title = card.getAttribute('data-title') || '無題';
    const date = card.getAttribute('data-date') || '';
    const img = card.querySelector('img');
    if(modalImage) modalImage.src = img ? img.src : '';
    if(modalTitle) modalTitle.textContent = title ? `「${title}」` : '無題';
    if(modalDate) modalDate.textContent = date;
    if(modal) modal.style.display = 'flex';
  }

  zoomInBtn && zoomInBtn.addEventListener('click', ()=>{ scale = Math.min(8, scale * 1.25); zoomLevelEl.textContent = Math.round(scale*100)+'%'; drawPlot(); });
  zoomOutBtn && zoomOutBtn.addEventListener('click', ()=>{ scale = Math.max(0.5, scale * 0.8); zoomLevelEl.textContent = Math.round(scale*100)+'%'; drawPlot(); });
  resetBtn && resetBtn.addEventListener('click', ()=>{ scale = 1; zoomLevelEl.textContent = '100%'; drawPlot(); });

  // initial
  analyzeAll().catch(err=>{ console.error(err); statusEl.textContent = 'エラーが発生しました'; });
})();
