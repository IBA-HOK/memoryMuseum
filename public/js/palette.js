document.addEventListener("DOMContentLoaded", () => {
  // Prevent swipe gestures on the entire document
  const preventSwipe = (e) => {
    // Allow touch events on interactive elements
    const target = e.target;
    const isInteractive = target.tagName === 'BUTTON' ||
               target.closest('button') ||
               target.tagName === 'LABEL' ||
               target.closest('label') ||
               target.tagName === 'A' ||
               target.closest('a') ||
               target.classList.contains('color-cell') ||
               target.closest('.color-cell') ||
               target.classList.contains('selected-chip') ||
               target.closest('.selected-chip') ||
               target.closest('.menu-overlay') ||
               target.closest('.menu-nav') ||
               target.closest('.menu-list');

    if (isInteractive) return; // Allow touch on interactive elements

    if (e.touches && e.touches.length > 1) return; // Allow pinch zoom
    e.preventDefault();
  };

  // Add touch event listeners to prevent swiping
  document.addEventListener('touchstart', preventSwipe, { passive: false });
  document.addEventListener('touchmove', preventSwipe, { passive: false });
  document.addEventListener('touchend', preventSwipe, { passive: false });

  const data = window.__PALETTE_DATA__ || {
    mode: "slow",
    autoSelected: false,
    availableColors: [],
    selectedColors: [],
  };

  const grid = document.getElementById("color-grid");
  const hiddenInput = document.getElementById("selected-colors-input");
  const info = document.getElementById("selected-colors-info");
  const submitBtn = document.querySelector(".palette-form button[type='submit']");
  const maxColors = 5;

  const state = {
    selected: Array.isArray(data.selectedColors)
      ? [...data.selectedColors.slice(0, maxColors)]
      : [],
    selectedChipIndex: null,
  };

  function syncHiddenInput() {
    hiddenInput.value = JSON.stringify(state.selected);
  }

  function selectChip(idx) {
    state.selectedChipIndex = idx;
    renderSelectedChips();
  }

  function renderSelectedChips() {
    info.innerHTML = "";
    if (state.selected.length === 0) {
      const p = document.createElement("p");
      p.className = "selected-chip";
      p.textContent = "色を5つ選択してください";
      info.appendChild(p);
      if (submitBtn) {
        submitBtn.disabled = true;
      }
      return;
    }

    if (data.autoSelected) {
      const hint = document.createElement("p");
      hint.className = "selected-hint";
      hint.textContent = "タップして色を入れ替えできます";
      info.appendChild(hint);
    }
    state.selected.forEach((color, idx) => {
      const chip = document.createElement("div");
      chip.className = "selected-chip";
      if (state.selectedChipIndex === idx) {
        chip.classList.add("selected");
      }
      chip.style.backgroundColor = color;
      chip.style.color = "#fff";
      chip.textContent = `${idx + 1}. ${color}`;
      chip.addEventListener("click", () => selectChip(idx));
      info.appendChild(chip);
    });
    if (submitBtn) {
      submitBtn.disabled = state.selected.length !== maxColors;
    }
  }

  function toggleColor(color) {
    if (state.selectedChipIndex !== null) {
      // Swap the selected chip with the new color
      state.selected[state.selectedChipIndex] = color;
      state.selectedChipIndex = null;
    } else {
      const index = state.selected.indexOf(color);
      if (index >= 0) {
        state.selected.splice(index, 1);
      } else if (state.selected.length < maxColors) {
        state.selected.push(color);
      }
    }
    syncHiddenInput();
    updateActiveCells();
    renderSelectedChips();
  }

  function updateActiveCells() {
    grid.querySelectorAll(".color-cell").forEach((cell) => {
      const color = cell.dataset.color;
      if (state.selected.includes(color)) {
        cell.classList.add("selected");
      } else {
        cell.classList.remove("selected");
      }
    });
  }

  function buildGrid() {
    grid.innerHTML = "";
    data.availableColors.forEach((color, idx) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "color-cell";
      cell.style.backgroundColor = color;
      cell.dataset.color = color;

      const label = document.createElement("span");
      label.textContent = idx + 1;
      cell.appendChild(label);

      cell.addEventListener("click", () => toggleColor(color));

      grid.appendChild(cell);
    });
  }

  buildGrid();
  updateActiveCells();
  renderSelectedChips();
  syncHiddenInput();

  if (submitBtn) {
    submitBtn.disabled = state.selected.length !== maxColors;
  }

  // Image upload handler (Client-side color extraction)
  const imageUpload = document.getElementById("image-upload");
  if (imageUpload) {
    imageUpload.addEventListener("change", async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      try {
        const allColors = [];

        // Process each selected image
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          // Create an image element to load the file
          const img = new Image();
          const imageUrl = URL.createObjectURL(file);
          
          // Wait for image to load
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
          });

          // Extract colors using Vibrant.js
          const vibrant = new Vibrant(img);
          const palette = await vibrant.getPalette();
          
          // Collect all available swatches
          const swatches = [
            palette.Vibrant,
            palette.DarkVibrant,
            palette.LightVibrant,
            palette.Muted,
            palette.DarkMuted,
            palette.LightMuted,
          ].filter(swatch => swatch !== null && swatch !== undefined);
          
          // Extract hex colors
          swatches.forEach(swatch => {
            const hex = swatch.hex;
            if (!allColors.includes(hex)) {
              allColors.push(hex);
            }
          });

          // Clean up the object URL
          URL.revokeObjectURL(imageUrl);
        }

        if (allColors.length > 0) {
          // Add extracted colors to available colors
          allColors.forEach((color) => {
            if (!data.availableColors.includes(color)) {
              data.availableColors.unshift(color);
            }
          });
          
          // Auto-select the extracted colors (up to maxColors)
          state.selected = allColors.slice(0, maxColors);
          
          buildGrid();
          updateActiveCells();
          renderSelectedChips();
          syncHiddenInput();
        }
      } catch (error) {
        console.error("Error extracting colors:", error);
        alert("画像から色を抽出できませんでした");
      }

      // Reset input
      e.target.value = "";
    });
  }
});
