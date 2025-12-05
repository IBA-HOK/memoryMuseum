(() => {
  let isDragging = false;

  // Prevent swipe gestures on the entire document
  const preventSwipe = (e) => {
    // Allow touch events on scrollable areas
    const target = e.target;
    const isScrollable = target.closest('.draw-main') ||
                        target.closest('.color-screen') ||
                        target.closest('.gallery-wrapper');

    // Allow touch events on interactive elements
    const isInteractive = target.tagName === 'BUTTON' ||
                         target.closest('button') ||
                         target.tagName === 'INPUT' ||
                         target.closest('input') ||
                         target.classList.contains('quick-color-swatch') ||
                         target.closest('.quick-color-swatch') ||
                         target.classList.contains('color-modal__swatch') ||
                         target.closest('.color-modal__swatch') ||
                         target.classList.contains('shape-swatch') ||
                         target.closest('.shape-swatch') ||
                         target.classList.contains('placed-shape') ||
                         target.closest('.placed-shape');

    if (isInteractive) return; // Allow touch on interactive elements

    if (isScrollable && e.type === 'touchmove' && !isDragging) {
      // Allow vertical scrolling in scrollable areas when not dragging
      return;
    }

    if (e.touches && e.touches.length > 1) return; // Allow pinch zoom
    e.preventDefault();
  };

  // Track drag state
  document.addEventListener('touchstart', (e) => {
    isDragging = false;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    isDragging = false;
  }, { passive: true });

  // Add touch event listeners to prevent swiping
  document.addEventListener('touchstart', preventSwipe, { passive: false });
  document.addEventListener('touchmove', preventSwipe, { passive: false });
  document.addEventListener('touchend', preventSwipe, { passive: false });

  const container = document.querySelector(".draw-screen-v2");
  if (!container) return;

  const canvasShape = container.dataset.shape || "square";
  const mode = container.dataset.mode || "slow";
  const userColors = (() => {
    try {
      const parsed = JSON.parse(container.dataset.colors || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  })();

  const colorPool = (() => {
    try {
      const parsed = JSON.parse(container.dataset.colorPool || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  })();

  const isSlowMode = mode === "slow";
  const isQuickMode = mode === "quick";
  const usesNeutralShapeColoring = isSlowMode || isQuickMode;
  const NEUTRAL_SHAPE_COLOR = "#d0ccc4";

  const canvasArea = document.getElementById("canvas-area");
  const palette = document.getElementById("shape-palette");
  const undoBtn = document.getElementById("undo-btn");
  const keepBtn = document.getElementById("keep-btn");
  const regenPaletteBtn = document.getElementById("regen-palette-btn");
  const completeBtn = document.getElementById("complete-btn");
  const sizeControl = document.getElementById("size-control");
  const sizeSlider = document.getElementById("size-slider");
  const sizeValue = document.getElementById("size-value");
  const rotationSlider = document.getElementById("rotation-slider");
  const rotationValue = document.getElementById("rotation-value");
  const sizeConfirmBtn = document.getElementById("size-confirm-btn");
  const statusEl = document.getElementById("save-status");
  const colorPickerBtn = document.getElementById("color-picker-btn");
  const colorModal = document.getElementById("color-modal");
  const colorModalGrid = document.getElementById("color-modal-grid");
  const colorModalClose = document.getElementById("color-modal-close");
  const quickColorPalette = document.getElementById("quick-color-palette");

  let state = {
    placed: [],
    selectedId: null,
    suppressNextDeselect: false,
    selectedPaletteIndex: null,
    keptShapes: [], // {type, size, color}
    activePaintColor: null,
  };
  let idCounter = 1;
  let currentPalette = []; // {type, size, color, kept: boolean}
  let colorModalLastFocus = null;

  const DEFAULT_QUICK_COLORS = ['#f87171', '#facc15', '#4ade80', '#60a5fa', '#a855f7'];

  if (!usesNeutralShapeColoring && userColors.length > 0) {
    setActivePaintColor(userColors[0]);
  }

  const SHAPE_TYPES = ['circle', 'square', 'triangle', 'hexagon'];
  const MAX_PALETTE_SIZE = 8;

  function normalizeColor(color) {
    return (color || '').toString().trim().toLowerCase();
  }

  function isSameColor(a, b) {
    return normalizeColor(a) === normalizeColor(b);
  }

  function setActivePaintColor(color) {
    state.activePaintColor = color || null;
    if (!quickColorPalette) return;
    const normalized = normalizeColor(state.activePaintColor);
    quickColorPalette.querySelectorAll('.quick-color-swatch').forEach((el) => {
      const isActive = el.dataset.color === normalized && normalized !== '';
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function renderQuickColorPalette() {
    if (!quickColorPalette) return;
    const paletteSource = userColors.length > 0 ? userColors : (colorPool.length > 0 ? colorPool : DEFAULT_QUICK_COLORS);
    const base = paletteSource.length > 0 ? paletteSource : DEFAULT_QUICK_COLORS;
    const paletteColors = base.slice(0, 5);
    let fallbackIndex = 0;
    while (paletteColors.length < 5) {
      paletteColors.push(DEFAULT_QUICK_COLORS[fallbackIndex % DEFAULT_QUICK_COLORS.length]);
      fallbackIndex += 1;
    }
    quickColorPalette.innerHTML = '';
    paletteColors.forEach((color) => {
      const normalized = normalizeColor(color);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quick-color-swatch';
      button.style.backgroundColor = color;
      button.dataset.color = normalized;
      button.setAttribute('aria-label', color);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => handleColorSelection(color));
      quickColorPalette.appendChild(button);
    });
    setActivePaintColor(state.activePaintColor);
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomShapeType() {
    return SHAPE_TYPES[randomInt(0, SHAPE_TYPES.length - 1)];
  }

  function randomSize() {
    return randomInt(40, 80);
  }

  function randomColorFromPalette() {
    if (usesNeutralShapeColoring) return null;
    if (userColors.length === 0) return '#999';
    return userColors[randomInt(0, userColors.length - 1)];
  }

  function generatePalette(count = 8) {
    const keptCount = state.keptShapes.length;
    const newCount = Math.max(0, Math.min(count, MAX_PALETTE_SIZE) - keptCount);
    
    currentPalette = [...state.keptShapes.map(s => ({...s, kept: true}))];
    
    for (let i = 0; i < newCount; i++) {
      currentPalette.push({
        type: randomShapeType(),
        size: randomSize(),
        color: randomColorFromPalette(),
        kept: false
      });
    }

    state.selectedPaletteIndex = null;
    renderPalette();
    updateKeepButton();
    syncKeptShapesFromPalette();
  }

  function renderPalette() {
    palette.innerHTML = '';
    currentPalette.forEach((shapeSpec, index) => {
      const swatch = document.createElement('div');
      swatch.className = 'shape-swatch';
      if (shapeSpec.kept) {
        swatch.classList.add('kept');
      }
      if (state.selectedPaletteIndex === index) {
        swatch.classList.add('selected');
      }
      swatch.dataset.index = index;

      const preview = document.createElement('div');
      preview.className = 'shape-preview';
      preview.innerHTML = renderShapeSVG(shapeSpec.type, shapeSpec.size, shapeSpec.size, shapeSpec.color);
      swatch.appendChild(preview);
      palette.appendChild(swatch);

      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        selectPaletteSwatch(index);
      });

      swatch.addEventListener('pointerdown', (e) => {
        if (!e.isPrimary) return;
        if (e.pointerType === 'mouse') {
          if (e.button !== 0) return;
          e.preventDefault();
          startDragFromSwatch(e, shapeSpec);
          return;
        }
        if (e.pointerType === 'touch' || e.pointerType === 'pen') {
          initiateDirectionalDrag(e, shapeSpec);
          return;
        }
        e.preventDefault();
        startDragFromSwatch(e, shapeSpec);
      });
    });
  }

  function syncKeptShapesFromPalette() {
    state.keptShapes = currentPalette
      .filter((spec) => spec.kept)
      .map((spec) => ({ type: spec.type, size: spec.size, color: spec.color }));
  }

  function selectPaletteSwatch(index) {
    if (state.selectedPaletteIndex === index) {
      state.selectedPaletteIndex = null;
    } else {
      state.selectedPaletteIndex = index;
    }
    palette.querySelectorAll('.shape-swatch').forEach((el) => el.classList.remove('selected'));
    if (state.selectedPaletteIndex !== null) {
      const target = palette.querySelector(`.shape-swatch[data-index="${state.selectedPaletteIndex}"]`);
      if (target) {
        target.classList.add('selected');
      }
      
      // じっくりモードで無色の図形をタップしたら自動でカラーパレットを開く
      if (isSlowMode) {
        const spec = currentPalette[state.selectedPaletteIndex];
        if (spec && !spec.color) {
          openColorModal();
        }
      }
    }
    updateKeepButton();
  }

  function updateKeepButton() {
    const selectedSpec = state.selectedPaletteIndex !== null ? currentPalette[state.selectedPaletteIndex] : null;
    if (!selectedSpec) {
      keepBtn.disabled = true;
      keepBtn.textContent = 'キープ';
      return;
    }

    if (!selectedSpec.kept) {
      keepBtn.disabled = false;
      keepBtn.textContent = 'キープ';
    } else {
      keepBtn.disabled = false;
      keepBtn.textContent = '解除';
    }
  }

  function toggleKeep() {
    if (state.selectedPaletteIndex === null) return;
    const shapeSpec = currentPalette[state.selectedPaletteIndex];
    if (!shapeSpec) return;

    if (shapeSpec.kept) {
      // 解除
      shapeSpec.kept = false;
      const index = state.keptShapes.findIndex(s => 
        s.type === shapeSpec.type && s.size === shapeSpec.size && s.color === shapeSpec.color
      );
      if (index !== -1) {
        state.keptShapes.splice(index, 1);
      }
    } else {
      // キープ
      shapeSpec.kept = true;
      state.keptShapes.push({
        type: shapeSpec.type,
        size: shapeSpec.size,
        color: shapeSpec.color
      });
    }

    renderPalette();
    syncKeptShapesFromPalette();
    state.selectedPaletteIndex = null;
    updateKeepButton();
  }

  function applyColorToPlacedShape(shapeId, color) {
    const shape = state.placed.find((s) => s.id === shapeId);
    if (!shape || shape.locked) return false;
    shape.color = color;
    const el = canvasArea.querySelector(`.placed-shape[data-id="${shape.id}"]`);
    if (el) {
      el.innerHTML = renderShapeSVG(shape.type, shape.w, shape.h, shape.color, shape.rotation);
    }
    return true;
  }

  function handleColorSelection(color) {
    let applied = false;

    if (state.selectedPaletteIndex !== null) {
      const spec = currentPalette[state.selectedPaletteIndex];
      if (spec) {
        spec.color = color;
        applied = true;
        const swatch = palette.querySelector(`.shape-swatch[data-index="${state.selectedPaletteIndex}"]`);
        if (swatch) {
          const preview = swatch.querySelector('.shape-preview');
          if (preview) {
            preview.innerHTML = renderShapeSVG(spec.type, spec.size, spec.size, spec.color);
          }
        }
        syncKeptShapesFromPalette();
        updateKeepButton();
      }
    }

    if (!applied && state.selectedId) {
      applied = applyColorToPlacedShape(state.selectedId, color);
    }

    setActivePaintColor(color);
    closeColorModal();
  }

  function buildColorModalGrid() {
    if (!colorModalGrid) return;
    const paletteSource = colorPool.length > 0 ? colorPool : userColors;
    const swatches = paletteSource.length > 0 ? paletteSource : [NEUTRAL_SHAPE_COLOR];
    colorModalGrid.innerHTML = '';
    swatches.forEach((color) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color-modal__swatch';
      button.style.backgroundColor = color;
      button.setAttribute('aria-label', color);
      if (isSameColor(state.activePaintColor, color)) {
        button.classList.add('active');
      }
      button.addEventListener('click', () => handleColorSelection(color));
      colorModalGrid.appendChild(button);
    });
  }

  function handleColorModalKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeColorModal();
    }
  }

  function openColorModal() {
    if (!colorModal) return;
    buildColorModalGrid();
    colorModalLastFocus = colorPickerBtn || document.activeElement;
    colorModal.classList.add('is-open');
    colorModal.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', handleColorModalKeydown);
    const firstButton = colorModal.querySelector('button');
    if (firstButton) {
      firstButton.focus();
    }
  }

  function closeColorModal() {
    if (!colorModal) return;
    colorModal.classList.remove('is-open');
    colorModal.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', handleColorModalKeydown);
    if (colorModalLastFocus && typeof colorModalLastFocus.focus === 'function') {
      try {
        colorModalLastFocus.focus();
      } catch (_) {
        /* ignore focus errors */
      }
    }
    colorModalLastFocus = null;
  }

  function setupColorModal() {
    if (!colorPickerBtn || !colorModal) {
      return;
    }
    if (!isSlowMode) {
      colorModal.remove();
      colorPickerBtn.remove();
      return;
    }
    colorPickerBtn.addEventListener('click', openColorModal);
    if (colorModalClose) {
      colorModalClose.addEventListener('click', closeColorModal);
    }
    colorModal.addEventListener('click', (event) => {
      if (event.target && event.target.dataset && event.target.dataset.dismiss === 'color-modal') {
        closeColorModal();
      }
    });
  }

  function renderShapeSVG(type, w, h, color, rotation = 0) {
    const hasColor = Boolean(color);
    const fill = hasColor ? color : 'none';
    const strokeAttrs = hasColor ? '' : ' stroke="#b8b3aa" stroke-width="3"';
    const transform = rotation ? ` transform="rotate(${rotation} ${w/2} ${h/2})"` : '';

    if (type === 'circle') {
      const r = Math.min(w, h) / 2;
      return `<svg width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="${fill}"${strokeAttrs}${transform}/></svg>`;
    }

    if (type === 'square') {
      return `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${fill}"${strokeAttrs}${transform}/></svg>`;
    }

    if (type === 'triangle') {
      const pts = `${w / 2},0 ${w},${h} 0,${h}`;
      return `<svg width="${w}" height="${h}"><polygon points="${pts}" fill="${fill}"${strokeAttrs}${transform}/></svg>`;
    }

    if (type === 'hexagon') {
      const r = w / 2;
      const cx = r;
      const cy = r;
      const pts = [];
      for (let k = 0; k < 6; k++) {
        const ang = Math.PI / 3 * k - Math.PI / 6;
        pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)].join(','));
      }
      return `<svg width="${w}" height="${h}"><polygon points="${pts.join(' ')}" fill="${fill}"${strokeAttrs}${transform}/></svg>`;
    }

    return '';
  }

  function initiateDirectionalDrag(initialEvent, shapeSpec) {
    isDragging = true;
    const pointerId = initialEvent.pointerId;
    const startX = initialEvent.clientX;
    const startY = initialEvent.clientY;
    let resolved = false;

    const move = (evt) => {
      if (evt.pointerId !== pointerId || resolved) return;
      const dx = evt.clientX - startX;
      const dy = evt.clientY - startY;
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        resolved = true;
        cleanup();
        evt.preventDefault();
        startDragFromSwatch(evt, shapeSpec);
      } else {
        resolved = true;
        cleanup();
      }
    };

    const up = (evt) => {
      if (evt.pointerId !== pointerId) return;
      cleanup();
    };

    const cancel = (evt) => {
      if (evt.pointerId !== pointerId) return;
      cleanup();
    };

    function cleanup() {
      isDragging = false;
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', cancel, true);
    }

    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', cancel, true);
  }

  function startDragFromSwatch(e, shapeSpec) {
    isDragging = true;
    const pointerId = e.pointerId ?? Date.now();
    const helper = document.createElement('div');
    helper.className = 'dragging-helper';
    helper.innerHTML = renderShapeSVG(shapeSpec.type, shapeSpec.size, shapeSpec.size, shapeSpec.color);
    document.body.appendChild(helper);
    document.body.classList.add('dragging-touch-block');

    const updatePosition = (evt) => {
      helper.style.left = evt.clientX + 'px';
      helper.style.top = evt.clientY + 'px';
    };
    updatePosition(e);

    const move = (evt) => {
      if (evt.pointerId !== pointerId) return;
      evt.preventDefault();
      updatePosition(evt);
    };

    const up = (evt) => {
      if (evt.pointerId !== pointerId) return;
      finishDrag(evt);
    };

    const cancel = (evt) => {
      if (evt.pointerId !== pointerId) return;
      cleanupDrag();
    };

    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);

    function finishDrag(evt) {
      const rect = canvasArea.getBoundingClientRect();
      const inside = evt.clientX >= rect.left && evt.clientX <= rect.right && evt.clientY >= rect.top && evt.clientY <= rect.bottom;
      cleanupDrag();
      if (inside) {
        const x = evt.clientX - rect.left - shapeSpec.size / 2;
        const y = evt.clientY - rect.top - shapeSpec.size / 2;
        placeShapeOnCanvas(Object.assign({}, shapeSpec, { x, y }));
      }
    }

    function cleanupDrag() {
      isDragging = false;
      document.body.classList.remove('dragging-touch-block');
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
      helper.remove();
    }
  }

  function placeShapeOnCanvas(spec) {
    const w = spec.size, h = spec.size;
    let x = spec.x;
    let y = spec.y;

    state.placed.forEach(s => {
      s.locked = true;
      const pel = canvasArea.querySelector(`.placed-shape[data-id="${s.id}"]`);
      if (pel) {
        pel.classList.add('locked');
        pel.style.cursor = 'default';
      }
    });

    const resolvedColor = spec.color != null
      ? spec.color
      : (usesNeutralShapeColoring ? (state.activePaintColor || NEUTRAL_SHAPE_COLOR) : NEUTRAL_SHAPE_COLOR);

    const id = idCounter++;
    const shape = { id, type: spec.type, color: resolvedColor, w, h, x, y, locked: false, rotation: 0 };
    state.placed.push(shape);
    renderPlacedShape(shape);
    state.suppressNextDeselect = true;
    selectPlacedShape(shape.id);
    
    if (!window.matchMedia('(pointer: coarse)').matches) {
      try { sizeSlider.focus(); } catch(e){}
    }
  }

  function renderPlacedShape(shape) {
    const el = document.createElement('div');
    el.className = 'placed-shape';
    el.dataset.id = shape.id;
    el.style.left = `${shape.x}px`;
    el.style.top = `${shape.y}px`;
    el.style.width = `${shape.w}px`;
    el.style.height = `${shape.h}px`;
    el.innerHTML = renderShapeSVG(shape.type, shape.w, shape.h, shape.color);

    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (shape.locked) return;
      selectPlacedShape(shape.id);
    });

    // ドラッグで移動機能を追加
    el.addEventListener('pointerdown', (e) => {
      if (shape.locked || !e.isPrimary) return;
      if (e.target.closest('.placed-shape') !== el) return;
      
      isDragging = true;
      e.stopPropagation();
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startY = e.clientY;
      const startShapeX = shape.x;
      const startShapeY = shape.y;
      let hasMoved = false;

      const move = (evt) => {
        if (evt.pointerId !== pointerId) return;
        evt.preventDefault();
        hasMoved = true;
        
        const dx = evt.clientX - startX;
        const dy = evt.clientY - startY;
        
        let newX = startShapeX + dx;
        let newY = startShapeY + dy;
        
        shape.x = newX;
        shape.y = newY;
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
        
        // サイズコントロールの位置も更新
        if (state.selectedId === shape.id) {
          updateSizeControlPosition(shape);
        }
      };

      const up = (evt) => {
        if (evt.pointerId !== pointerId) return;
        cleanup();
        if (!hasMoved) {
          selectPlacedShape(shape.id);
        }
      };

      const cancel = (evt) => {
        if (evt.pointerId !== pointerId) return;
        cleanup();
      };

      function cleanup() {
        isDragging = false;
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', cancel);
      }

      document.addEventListener('pointermove', move, { passive: false });
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', cancel);
    });

    canvasArea.appendChild(el);
  }

  function selectPlacedShape(id) {
    const prev = canvasArea.querySelector('.placed-shape.selected');
    if (prev) prev.classList.remove('selected');
    const el = canvasArea.querySelector(`.placed-shape[data-id="${id}"]`);
    if (!el) {
      state.selectedId = null;
      sizeControl.style.display = 'none';
      return;
    }
    const shp = state.placed.find(s => s.id === id);
    if (!shp || shp.locked) {
      state.selectedId = null;
      sizeControl.style.display = 'none';
      return;
    }
    el.classList.add('selected');
    state.selectedId = id;
    sizeControl.style.display = 'flex';
    sizeSlider.value = shp.w;
    sizeValue.textContent = shp.w;
    rotationSlider.value = shp.rotation;
    rotationValue.textContent = shp.rotation;

    updateSizeControlPosition(shp);
  }

  function updateSizeControlPosition(shp) {
    const shouldFloatNearShape = !window.matchMedia('(max-width: 540px)').matches;
    if (shouldFloatNearShape) {
      sizeControl.style.bottom = '';
      requestAnimationFrame(() => {
        const canvasRect = canvasArea.getBoundingClientRect();
        const ctrlRect = sizeControl.getBoundingClientRect();
        let left = canvasRect.left + shp.x + shp.w / 2;
        let top = canvasRect.top + shp.y + shp.h + 8;
        if (top + ctrlRect.height > window.innerHeight - 8) {
          top = canvasRect.top + shp.y - ctrlRect.height - 8;
        }
        const minLeft = ctrlRect.width / 2 + 8;
        const maxLeft = window.innerWidth - ctrlRect.width / 2 - 8;
        left = Math.max(minLeft, Math.min(maxLeft, left));
        sizeControl.style.left = (left + window.scrollX) + 'px';
        sizeControl.style.top = (top + window.scrollY) + 'px';
      });
    } else {
      sizeControl.style.top = '';
      sizeControl.style.left = '';
      sizeControl.style.bottom = '16px';
    }
  }

  document.addEventListener('click', (e) => {
    if (state.suppressNextDeselect) {
      state.suppressNextDeselect = false;
      return;
    }
    if (e.target.closest('.placed-shape')) return;
    if (sizeControl.contains(e.target)) return;
    const prev = canvasArea.querySelector('.placed-shape.selected');
    if (prev) prev.classList.remove('selected');
    state.selectedId = null;
    sizeControl.style.display = 'none';
  });

  sizeSlider.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    sizeValue.textContent = val;
    if (!state.selectedId) return;
    const shp = state.placed.find(s => s.id === state.selectedId);
    if (!shp) return;
    const cx = shp.x + shp.w / 2;
    const cy = shp.y + shp.h / 2;
    const newW = val;
    const newH = val;
    let newX = cx - newW / 2;
    let newY = cy - newH / 2;
    shp.w = newW;
    shp.h = newH;
    shp.x = newX;
    shp.y = newY;
    const el = canvasArea.querySelector(`.placed-shape[data-id="${shp.id}"]`);
    if (!el) return;
    el.style.width = shp.w + 'px';
    el.style.height = shp.h + 'px';
    el.style.left = shp.x + 'px';
    el.style.top = shp.y + 'px';
    el.innerHTML = renderShapeSVG(shp.type, shp.w, shp.h, shp.color, shp.rotation);
    updateSizeControlPosition(shp);
  });

  rotationSlider.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    rotationValue.textContent = val;
    if (!state.selectedId) return;
    const shp = state.placed.find(s => s.id === state.selectedId);
    if (!shp) return;
    shp.rotation = val;
    const el = canvasArea.querySelector(`.placed-shape[data-id="${shp.id}"]`);
    if (!el) return;
    el.innerHTML = renderShapeSVG(shp.type, shp.w, shp.h, shp.color, shp.rotation);
  });

  function undo() {
    if (state.placed.length === 0) return;
    const removed = state.placed.pop();
    const el = canvasArea.querySelector(`.placed-shape[data-id="${removed.id}"]`);
    if (el) el.remove();
    if (state.selectedId === removed.id) {
      state.selectedId = null;
      const prev = canvasArea.querySelector('.placed-shape.selected');
      if (prev) prev.classList.remove('selected');
      sizeControl.style.display = 'none';
    }
    const last = state.placed[state.placed.length - 1];
    if (last) {
      last.locked = false;
      const lel = canvasArea.querySelector(`.placed-shape[data-id="${last.id}"]`);
      if (lel) {
        lel.classList.remove('locked');
        lel.style.cursor = 'grab';
      }
    }
  }

  async function completeDrawing() {
    try {
      if (statusEl) statusEl.textContent = "保存中...";
      const off = document.createElement('canvas');
      const rect = canvasArea.getBoundingClientRect();
      off.width = rect.width;
      off.height = rect.height;
      const ctx = off.getContext('2d');
      ctx.fillStyle = '#eaddcf';
      ctx.fillRect(0, 0, off.width, off.height);

      state.placed.forEach(s => {
        ctx.save();
        ctx.translate(s.x, s.y);
        const fillColor = s.color || NEUTRAL_SHAPE_COLOR;
        if (s.type === 'circle') {
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.arc(s.w / 2, s.h / 2, Math.min(s.w, s.h) / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (s.type === 'square') {
          ctx.fillStyle = fillColor;
          ctx.fillRect(0, 0, s.w, s.h);
        } else if (s.type === 'triangle') {
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.moveTo(s.w / 2, 0);
          ctx.lineTo(s.w, s.h);
          ctx.lineTo(0, s.h);
          ctx.closePath();
          ctx.fill();
        } else if (s.type === 'hexagon') {
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          const r = s.w / 2;
          const cx = r, cy = r;
          for (let k = 0; k < 6; k++) {
            const ang = Math.PI / 3 * k - Math.PI / 6;
            const px = cx + r * Math.cos(ang);
            const py = cy + r * Math.sin(ang);
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      });

      const imageData = off.toDataURL("image/png");
      const response = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData,
          mode,
          shape: canvasShape,
          colors: userColors,
        }),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`save failed: ${response.status}`);
      }
      const result = await response.json();
      if (statusEl) statusEl.textContent = "保存しました！";
      const redirect = result.redirect || "/atelier/complete";
      setTimeout(() => {
        window.location.href = redirect;
      }, 600);
    } catch (error) {
      console.error(error);
      if (statusEl) statusEl.textContent = "保存に失敗しました。";
    }
  }

  function lockAllShapes() {
    // Lock all placed shapes
    state.placed.forEach(shape => {
      shape.locked = true;
    });
    
    // Update DOM elements
    canvasArea.querySelectorAll('.placed-shape').forEach(el => {
      el.classList.add('locked');
    });
    
    // Hide size control
    if (sizeControl) {
      sizeControl.style.display = 'none';
    }
  }

  undoBtn.addEventListener('click', undo);
  keepBtn.addEventListener('click', toggleKeep);
  regenPaletteBtn.addEventListener('click', () => generatePalette(8));
  completeBtn.addEventListener('click', completeDrawing);
  sizeConfirmBtn.addEventListener('click', lockAllShapes);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.shape-swatch') && !e.target.closest('#keep-btn')) {
      if (e.target.closest('.color-modal__panel') || e.target.closest('#color-picker-btn')) {
        return;
      }
      state.selectedPaletteIndex = null;
      updateKeepButton();
    }
  });

  setupColorModal();
  renderQuickColorPalette();
  generatePalette(8);
  if (statusEl) {
    statusEl.textContent = mode === "quick"
      ? "図形をドラッグして配置し、下の色で彩ってみましょう！"
      : "じっくり図形を組み合わせてみましょう。";
  }
})();
