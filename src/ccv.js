const sharp = require('sharp');
const fs = require('fs').promises;

/**
 * Calculate Color Coherence Vector for an image
 * @param {string} imagePath - Path to the image file
 * @param {number} gridSize - Grid size for dividing the image (default: 8)
 * @returns {Promise<Array>} - CCV feature vector
 */
async function calculateCCV(imagePath, gridSize = 8) {
  try {
    // Load and resize image to fixed size for consistent comparison
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const { data, info } = await image
      .resize(256, 256, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const cellWidth = Math.floor(width / gridSize);
    const cellHeight = Math.floor(height / gridSize);

    const ccvVector = [];

    // Process each grid cell
    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const colorHistogram = {};
        
        // Calculate color histogram for this cell
        for (let y = gy * cellHeight; y < (gy + 1) * cellHeight && y < height; y++) {
          for (let x = gx * cellWidth; x < (gx + 1) * cellWidth && x < width; x++) {
            const idx = (y * width + x) * 3;
            const r = Math.floor(data[idx] / 64); // Quantize to 4 levels (0-3)
            const g = Math.floor(data[idx + 1] / 64);
            const b = Math.floor(data[idx + 2] / 64);
            const colorKey = `${r},${g},${b}`;
            
            colorHistogram[colorKey] = (colorHistogram[colorKey] || 0) + 1;
          }
        }

        // Convert histogram to sorted array
        const colors = Object.entries(colorHistogram)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8) // Take top 8 colors
          .map(([color, count]) => ({ color, count }));

        ccvVector.push(colors);
      }
    }

    return ccvVector;
  } catch (error) {
    console.error('Error calculating CCV:', error);
    throw error;
  }
}

/**
 * Calculate similarity between two CCV vectors
 * @param {Array} ccv1 - First CCV vector
 * @param {Array} ccv2 - Second CCV vector
 * @returns {number} - Similarity score (0-1, higher is more similar)
 */
function calculateCCVSimilarity(ccv1, ccv2) {
  if (!ccv1 || !ccv2 || ccv1.length !== ccv2.length) {
    return 0;
  }

  let totalSimilarity = 0;
  const numCells = ccv1.length;

  for (let i = 0; i < numCells; i++) {
    const cell1 = ccv1[i];
    const cell2 = ccv2[i];

    // Create color maps for quick lookup
    const colorMap1 = new Map(cell1.map(c => [c.color, c.count]));
    const colorMap2 = new Map(cell2.map(c => [c.color, c.count]));

    // Calculate intersection of color histograms
    let intersection = 0;
    let total1 = 0;
    let total2 = 0;

    for (const [color, count] of colorMap1) {
      total1 += count;
      if (colorMap2.has(color)) {
        intersection += Math.min(count, colorMap2.get(color));
      }
    }

    for (const count of colorMap2.values()) {
      total2 += count;
    }

    const cellSimilarity = total1 + total2 > 0 ? (2 * intersection) / (total1 + total2) : 0;
    totalSimilarity += cellSimilarity;
  }

  return totalSimilarity / numCells;
}

/**
 * Find similar arts using CCV
 * @param {string} targetImagePath - Path to target image
 * @param {Array} artsList - Array of art objects with path property
 * @param {number} topN - Number of top similar arts to return
 * @returns {Promise<Array>} - Array of similar arts with similarity scores
 */
async function findSimilarArts(targetImagePath, artsList, topN = 5) {
  try {
    const targetCCV = await calculateCCV(targetImagePath);
    const similarities = [];

    for (const art of artsList) {
      try {
        const artCCV = await calculateCCV(art.path);
        const similarity = calculateCCVSimilarity(targetCCV, artCCV);
        similarities.push({ art, similarity });
      } catch (error) {
        console.error(`Error processing art ${art.artid}:`, error);
      }
    }

    // Sort by similarity (descending) and return top N
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topN);
  } catch (error) {
    console.error('Error finding similar arts:', error);
    throw error;
  }
}

module.exports = {
  calculateCCV,
  calculateCCVSimilarity,
  findSimilarArts
};
