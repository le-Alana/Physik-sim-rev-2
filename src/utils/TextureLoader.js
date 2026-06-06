/**
 * TextureLoader - Async Texture Loading with Fallbacks
 *
 * Provides robust texture loading with automatic format detection,
 * mipmap generation, compression support, and error handling.
 *
 * @module utils/TextureLoader
 * @version 1.0.0
 */

import * as THREE from "three";

/**
 * Texture loading options
 * @typedef {Object} TextureLoadOptions
 * @property {boolean} generateMipmaps - Generate mipmaps
 * @property {number} minFilter - Minification filter
 * @property {number} magFilter - Magnification filter
 * @property {number} wrapS - Wrap mode S
 * @property {number} wrapT - Wrap mode T
 * @property {number} anisotropy - Anisotropy level
 * @property {THREE.ColorSpace} colorSpace - Color space
 * @property {boolean} flipY - Flip Y coordinate
 * @property {number} maxRetries - Max retry attempts
 * @property {number} retryDelay - Delay between retries (ms)
 * @property {Function} onProgress - Progress callback
 */

/**
 * Default texture options by type
 */
const DEFAULT_OPTIONS = {
  diffuse: {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    anisotropy: 4,
    colorSpace: THREE.SRGBColorSpace,
    flipY: false,
  },
  normal: {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    anisotropy: 4,
    colorSpace: THREE.LinearSRGBColorSpace,
    flipY: false,
  },
  roughness: {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    anisotropy: 4,
    colorSpace: THREE.LinearSRGBColorSpace,
    flipY: false,
  },
  metalness: {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    anisotropy: 4,
    colorSpace: THREE.LinearSRGBColorSpace,
    flipY: false,
  },
  ao: {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    anisotropy: 4,
    colorSpace: THREE.LinearSRGBColorSpace,
    flipY: false,
  },
  displacement: {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    anisotropy: 4,
    colorSpace: THREE.LinearSRGBColorSpace,
    flipY: false,
  },
  env: {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 1,
    colorSpace: THREE.LinearSRGBColorSpace,
    flipY: false,
  },
  default: {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    anisotropy: 4,
    colorSpace: THREE.SRGBColorSpace,
    flipY: false,
  },
};

/**
 * TextureLoader class with advanced loading features
 */
export class TextureLoader {
  /**
   * @param {THREE.LoadingManager} [manager] - Loading manager
   */
  constructor(manager) {
    this._loader = new THREE.TextureLoader(manager);
    this._cache = new Map();
    this._loadingPromises = new Map();
  }

  /**
   * Load a single texture with options
   * @param {string} url - Texture URL
   * @param {TextureLoadOptions} [options] - Load options
   * @param {string} [type='default'] - Texture type for defaults
   * @returns {Promise<THREE.Texture>}
   */
  async load(url, options = {}, type = "default") {
    // Check cache first
    if (this._cache.has(url)) {
      return this._cache.get(url);
    }

    // Check if already loading
    if (this._loadingPromises.has(url)) {
      return this._loadingPromises.get(url);
    }

    // Merge options with defaults
    const defaultOpts = DEFAULT_OPTIONS[type] || DEFAULT_OPTIONS.default;
    const mergedOptions = { ...defaultOpts, ...options };

    // Create loading promise with retries
    const promise = this._loadWithRetry(
      url,
      mergedOptions,
      0,
      mergedOptions.maxRetries || 3,
      mergedOptions.retryDelay || 500,
    );

    this._loadingPromises.set(url, promise);

    try {
      const texture = await promise;
      this._cache.set(url, texture);
      return texture;
    } finally {
      this._loadingPromises.delete(url);
    }
  }

  /**
   * Load texture with retry logic
   * @private
   */
  _loadWithRetry(url, options, attempt, maxRetries, retryDelay) {
    return new Promise((resolve, reject) => {
      this._loader.load(
        url,
        (texture) => {
          this._configureTexture(texture, options);
          resolve(texture);
        },
        (progress) => {
          if (options.onProgress) {
            options.onProgress(progress.loaded / progress.total);
          }
        },
        (error) => {
          if (attempt < maxRetries) {
            console.warn(
              `[TextureLoader] Retry ${attempt + 1}/${maxRetries} for ${url}`,
            );
            setTimeout(() => {
              this._loadWithRetry(
                url,
                options,
                attempt + 1,
                maxRetries,
                retryDelay,
              )
                .then(resolve)
                .catch(reject);
            }, retryDelay);
          } else {
            console.error(
              `[TextureLoader] Failed to load ${url} after ${maxRetries} retries:`,
              error,
            );
            // Return fallback texture
            const fallback = this._createFallbackTexture(options.colorSpace);
            resolve(fallback);
          }
        },
      );
    });
  }

  /**
   * Configure texture with options
   * @private
   */
  _configureTexture(texture, options) {
    texture.generateMipmaps = options.generateMipmaps;
    texture.minFilter = options.minFilter;
    texture.magFilter = options.magFilter;
    texture.wrapS = options.wrapS;
    texture.wrapT = options.wrapT;
    texture.anisotropy = options.anisotropy;
    texture.colorSpace = options.colorSpace;
    texture.flipY = options.flipY;
    texture.needsUpdate = true;
  }

  /**
   * Create fallback texture (solid color)
   * @private
   */
  _createFallbackTexture(colorSpace) {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#cccccc";
    ctx.fillRect(0, 0, 4, 4);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = colorSpace || THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.name = "FallbackTexture";
    return texture;
  }

  /**
   * Load multiple textures at once
   * @param {Object} urls - Map of name -> url
   * @param {Object} [options] - Common options for all
   * @returns {Promise<Object>} Map of name -> texture
   */
  async loadMultiple(urls, options = {}) {
    const promises = Object.entries(urls).map(([name, url]) =>
      this.load(url, options, name).then((texture) => ({ name, texture })),
    );

    const results = await Promise.allSettled(promises);
    const textures = {};

    results.forEach((result, index) => {
      const name = Object.keys(urls)[index];
      if (result.status === "fulfilled") {
        textures[name] = result.value.texture;
      } else {
        console.error(`[TextureLoader] Failed to load ${name}:`, result.reason);
        textures[name] = this._createFallbackTexture();
      }
    });

    return textures;
  }

  /**
   * Load a texture set for PBR material (diffuse, normal, roughness, metalness, ao)
   * @param {string} basePath - Base path without extension
   * @param {string} [extension='jpg'] - File extension
   * @returns {Promise<Object>} PBR texture set
   */
  async loadPBRSet(basePath, extension = "jpg") {
    const urls = {
      map: `${basePath}_diffuse.${extension}`,
      normalMap: `${basePath}_normal.${extension}`,
      roughnessMap: `${basePath}_roughness.${extension}`,
      metalnessMap: `${basePath}_metalness.${extension}`,
      aoMap: `${basePath}_ao.${extension}`,
    };

    const options = {
      map: { type: "diffuse" },
      normalMap: { type: "normal" },
      roughnessMap: { type: "roughness" },
      metalnessMap: { type: "metalness" },
      aoMap: { type: "ao" },
    };

    const textures = await this.loadMultiple(urls);

    // Apply type-specific options
    Object.entries(textures).forEach(([name, texture]) => {
      if (options[name] && options[name].type) {
        const defaultOpts = DEFAULT_OPTIONS[options[name].type];
        this._configureTexture(texture, defaultOpts);
      }
    });

    return textures;
  }

  /**
   * Load environment map (cubemap or equirectangular)
   * @param {string[]|string} urls - Array of 6 face URLs or single equirectangular URL
   * @param {Object} [options] - Load options
   * @returns {Promise<THREE.CubeTexture|THREE.Texture>}
   */
  async loadEnvironment(urls, options = {}) {
    const defaultOpts = {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      colorSpace: THREE.LinearSRGBColorSpace,
      ...options,
    };

    if (Array.isArray(urls)) {
      // Cubemap
      return new Promise((resolve, reject) => {
        const loader = new THREE.CubeTextureLoader(this._loader.manager);
        loader.load(
          urls,
          (cubeTexture) => {
            cubeTexture.generateMipmaps = defaultOpts.generateMipmaps;
            cubeTexture.minFilter = defaultOpts.minFilter;
            cubeTexture.magFilter = defaultOpts.magFilter;
            cubeTexture.wrapS = defaultOpts.wrapS;
            cubeTexture.wrapT = defaultOpts.wrapT;
            cubeTexture.colorSpace = defaultOpts.colorSpace;
            cubeTexture.needsUpdate = true;
            resolve(cubeTexture);
          },
          undefined,
          reject,
        );
      });
    } else {
      // Equirectangular
      const texture = await this.load(urls, defaultOpts, "env");
      return texture;
    }
  }

  /**
   * Load compressed texture (KTX2, Basis Universal)
   * @param {string} url - Compressed texture URL
   * @param {Object} [options] - Options
   * @returns {Promise<THREE.CompressedTexture>}
   */
  async loadCompressed(url, options = {}) {
    // This would require KTX2Loader or BasisTextureLoader
    // For now, fall back to regular texture loading
    console.warn(
      "[TextureLoader] Compressed texture loading not fully implemented, falling back",
    );
    return this.load(url, options);
  }

  /**
   * Get cached texture
   * @param {string} url - Texture URL
   * @returns {THREE.Texture|undefined}
   */
  getCached(url) {
    return this._cache.get(url);
  }

  /**
   * Check if texture is cached
   * @param {string} url - Texture URL
   * @returns {boolean}
   */
  hasCached(url) {
    return this._cache.has(url);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this._cache.forEach((texture) => texture.dispose());
    this._cache.clear();
  }

  /**
   * Remove specific texture from cache
   * @param {string} url - Texture URL
   */
  removeFromCache(url) {
    const texture = this._cache.get(url);
    if (texture) {
      texture.dispose();
      this._cache.delete(url);
    }
  }

  /**
   * Preload textures (load without waiting)
   * @param {string[]} urls - URLs to preload
   * @param {Object} [options] - Load options
   */
  preload(urls, options = {}) {
    urls.forEach((url) => {
      if (!this._cache.has(url) && !this._loadingPromises.has(url)) {
        this.load(url, options).catch(() => {}); // Ignore errors during preload
      }
    });
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getCacheStats() {
    let totalMemory = 0;
    let textureCount = 0;

    this._cache.forEach((texture) => {
      textureCount++;
      if (texture.image) {
        const w = texture.image.width || 0;
        const h = texture.image.height || 0;
        // Rough estimate: 4 bytes per pixel (RGBA)
        totalMemory += w * h * 4;
      }
    });

    return {
      textureCount,
      estimatedMemoryMB: (totalMemory / 1024 / 1024).toFixed(2),
      loadingCount: this._loadingPromises.size,
    };
  }
}

/**
 * Default singleton instance
 */
export const textureLoader = new TextureLoader();

export default TextureLoader;
