document.addEventListener("DOMContentLoaded", () => {
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

  // Image upload handler
  const imageUpload = document.getElementById("image-upload");
  if (imageUpload) {
    imageUpload.addEventListener("change", async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("images", files[i]);
      }

      try {
        const response = await fetch("/api/extract-colors", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to extract colors");
        }

        const result = await response.json();
        if (result.colors && result.colors.length > 0) {
          // Add extracted colors to available colors
          result.colors.forEach((color) => {
            if (!data.availableColors.includes(color)) {
              data.availableColors.unshift(color);
            }
          });
          
          // Auto-select the extracted colors
          state.selected = result.colors.slice(0, maxColors);
          
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
