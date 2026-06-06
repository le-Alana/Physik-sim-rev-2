/**
 * Engine - Core WebGPU/WebGL Renderer Management
 * 
 * Handles renderer initialization, WebGPU detection and fallback,
 * render target management, and renderer configuration.
 * 
 * @module core/Engine
 * @version 1.0.0
 */

import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { WebGLRenderer } from 'three/webgl';

/**
 * Engine configuration options
 * @typedef {Object} EngineOptions
 * @property {boolean} preferWebGPU - Try WebGPU first, fallback to WebGL2
 * @property {boolean} antialias - Enable MSAA
 * @property {boolean} alpha - Enable alpha channel
 * @property {string} powerPreference - 'high-performance' | 'low-power'
 * @property {boolean} preserveDrawingBuffer - Preserve buffer for screenshots
 * @property {number} logarithmicDepthBuffer - Use logarithmic depth
 */

/**
 * Engine class managing the Three.js renderer
 */
export class Engine {
  /**
   * @param {EngineOptions} options - Engine configuration
   */
  constructor(options = {}) {
    this.options = {
      preferWebGPU: true,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      logarithmicDepthBuffer: true,
      ...options
    };

    /** @type {WebGPURenderer|WebGLRenderer|null} */
    this.renderer = null;
    /** @type {boolean} */
    this.isWebGPU = false;
    /** @type {boolean} */
    this.isInitialized = false;
    /** @type {WebGLContextAttributes|null} */
    this.contextAttributes = null;
  }

  /**
   * Initialize the renderer with WebGPU detection and fallback
   * @returns {Promise<void>}
   */
  async init() {
    if (this.isInitialized) {
      console.warn('[Engine] Already initialized');
      return;
    }

    // Try WebGPU first if preferred
    if (this.options.preferWebGPU && await this._checkWebGPUSupport()) {
      try {
        this.renderer = new WebGPURenderer({
          antialias: this.options.antialias,
          alpha: this.options.alpha,
          powerPreference: this.options.powerPreference,
          preserveDrawingBuffer: this.options.preserveDrawingBuffer,
          logarithmicDepthBuffer: this.options.logarithmicDepthBuffer
        });

        await this.renderer.init();
        this.isWebGPU = true;
        console.log('[Engine] WebGPU renderer initialized');
      } catch (error) {
        console.warn('[Engine] WebGPU initialization failed, falling back to WebGL2:', error.message);
        this._initWebGL2();
      }
    } else {
      this._initWebGL2();
    }

    this._configureRenderer();
    this.isInitialized = true;
  }

  /**
   * Check if WebGPU is supported in the current browser
   * @returns {Promise<boolean>}
   * @private
   */
  async _checkWebGPUSupport() {
    if (!navigator.gpu) {
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: this.options.powerPreference
      });
      return !!adapter;
    } catch (error) {
      console.warn('[Engine] WebGPU adapter request failed:', error.message);
      return false;
    }
  }

  /**
   * Initialize WebGL2 renderer as fallback
   * @private
   */
  _initWebGL2() {
    this.contextAttributes = {
      antialias: this.options.antialias,
      alpha: this.options.alpha,
      powerPreference: this.options.powerPreference,
      preserveDrawingBuffer: this.options.preserveDrawingBuffer,
      depth: true,
      stencil: false,
      failIfMajorPerformanceCaveat: false
    };

    this.renderer = new WebGLRenderer({
      ...this.contextAttributes,
      logarithmicDepthBuffer: this.options.logarithmicDepthBuffer
    });

    this.isWebGPU = false;
    console.log('[Engine] WebGL2 renderer initialized');
  }

  /**
   * Configure renderer settings for quality and performance
   * @private
   */
  _configureRenderer() {
    if (!this.renderer) return;

    // Shadow map configuration
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = true;

    // Tone mapping for HDR output
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Color space
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Physically correct lights
    this.renderer.physicallyCorrectLights = true;

    // Pixel ratio (clamp for performance)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Default size
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Render info for stats
    this.renderer.info.autoReset = true;
  }

  /**
   * Set renderer size
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  setSize(width, height) {
    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }

  /**
   * Set pixel ratio
   * @param {number} ratio - Device pixel ratio
   */
  setPixelRatio(ratio) {
    if (this.renderer) {
      this.renderer.setPixelRatio(Math.min(ratio, 2));
    }
  }

  /**
   * Get render target for off-screen rendering
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @param {Object} options - Render target options
   * @returns {THREE.RenderTarget}
   */
  createRenderTarget(width, height, options = {}) {
    if (!this.renderer) return null;

    const defaultOptions = {
      depthBuffer: true,
      stencilBuffer: false,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.SRGBColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false
    };

    return new THREE.RenderTarget(width, height, { ...defaultOptions, ...options });
  }

  /**
   * Dispose of renderer resources
   */
  dispose() {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
      this.isInitialized = false;
      console.log('[Engine] Renderer disposed');
    }
  }

  /**
   * Get renderer capabilities/info
   * @returns {Object}
   */
  getInfo() {
    if (!this.renderer) return null;

    return {
      isWebGPU: this.isWebGPU,
      renderer: this.renderer.constructor.name,
      maxTextureSize: this.renderer.capabilities?.maxTextureSize || 0,
      maxAnisotropy: this.renderer.capabilities?.maxAnisotropy || 0,
      vertexTextures: this.renderer.capabilities?.vertexTextures || false,
      floatVertexTextures: this.renderer.capabilities?.floatVertexTextures || false,
      floatFragmentTextures: this.renderer.capabilities?.floatFragmentTextures || false,
      drawBuffers: this.renderer.capabilities?.drawBuffers || 0,
      info: this.renderer.info
    };
  }
}

export default Engine;