/**
 * 背景画像プリローダー
 * アプリケーションで使用される全ての背景画像を事前に読み込み、
 * 画面遷移時の読み込み遅延を防ぎます。
 */

(function() {
  'use strict';

  // プリロードする背景画像のリスト
  const backgroundImages = [
    '/images/home.png',
    '/images/mode-back.png',
    '/images/canvas-quick-back.png',
    '/images/canvas-slow-back.png',
    '/images/draw-quick-back.png',
    '/images/draw-slow-back.png',
    '/images/complete-quick-back.png',
    '/images/complete-slow-back.png',
    '/images/gallery-back.png'
  ];

  let loadedCount = 0;
  const totalCount = backgroundImages.length;

  /**
   * 画像を非同期でプリロード
   * @param {string} src - 画像のURL
   * @returns {Promise<void>}
   */
  function preloadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        loadedCount++;
        console.log(`[Preload] ${loadedCount}/${totalCount}: ${src}`);
        resolve();
      };
      
      img.onerror = (err) => {
        console.warn(`[Preload] Failed to load: ${src}`, err);
        // エラーでも処理を続行
        loadedCount++;
        resolve();
      };
      
      img.src = src;
    });
  }

  /**
   * 全ての背景画像をプリロード
   */
  async function preloadAllBackgrounds() {
    console.log('[Preload] Starting background image preload...');
    const startTime = performance.now();

    try {
      // 全ての画像を並列でプリロード
      await Promise.all(backgroundImages.map(src => preloadImage(src)));
      
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      
      console.log(`[Preload] Complete! Loaded ${loadedCount}/${totalCount} images in ${duration}ms`);
      
      // カスタムイベントを発火（他のスクリプトで利用可能）
      window.dispatchEvent(new CustomEvent('backgroundsPreloaded', {
        detail: { count: loadedCount, duration }
      }));
      
    } catch (error) {
      console.error('[Preload] Error during preload:', error);
    }
  }

  // DOMContentLoadedまたはページロード完了後にプリロード開始
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadAllBackgrounds);
  } else {
    // すでにDOMが読み込まれている場合は即座に実行
    preloadAllBackgrounds();
  }

})();
