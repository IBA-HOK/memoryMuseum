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
  };

  function syncHiddenInput() {
    hiddenInput.value = JSON.stringify(state.selected);
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
      hint.className = "selected-chip";
      hint.textContent = "タップして色を入れ替えできます";
      info.appendChild(hint);
    }
    state.selected.forEach((color, idx) => {
      const chip = document.createElement("div");
      chip.className = "selected-chip";
      chip.style.backgroundColor = color;
      chip.style.color = "#fff";
      chip.textContent = `${idx + 1}. ${color}`;
      info.appendChild(chip);
    });
    if (submitBtn) {
      submitBtn.disabled = state.selected.length !== maxColors;
    }
  }

  function toggleColor(color) {
    const index = state.selected.indexOf(color);
    if (index >= 0) {
      state.selected.splice(index, 1);
    } else if (state.selected.length < maxColors) {
      state.selected.push(color);
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
});
