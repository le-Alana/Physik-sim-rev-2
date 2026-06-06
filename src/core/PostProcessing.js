/**
 * PostProcessing - Full Post-Processing Pipeline
 *
 * Manages EffectComposer with multiple passes:
 * - RenderPass (base scene render)
 * - SSRPass (Screen Space Reflections)
 * - SSAOPass (Screen Space Ambient Occlusion)
 * - BloomPass (Unreal Bloom)
 * - ToneMappingPass (ACES/Reinhard)
 * - FXAAPass (Anti-aliasing)
 * - OutputPass (Final output)
 *
 * @module core/PostProcessing
 * @version 1.0.0
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { SSRPass } from "./postprocessing/SSRPass.js";
import { SSAOPass } from "./postprocessing/SSAOPass.js";
import { BloomPass } from "./postprocessing/BloomPass.js";
import { ToneMappingPass } from "./postprocessing/ToneMappingPass.js";

/**
 * PostProcessing configuration options
 * @typedef {Object} PostProcessingOptions
 * @property {boolean} enableSSR - Enable Screen Space Reflections
 * @property {boolean} enableSSAO - Enable Screen Space Ambient Occlusion
 * @property {boolean} enableBloom - Enable Unreal Bloom
 * @property {boolean} enableToneMapping - Enable Tone Mapping
 * @property {boolean} enableFXAA - Enable FXAA Anti-aliasing
 * @property {string} quality - Quality preset: 'low' | 'medium' | 'high' | 'ultra'
 * @property {number} bloomStrength - Bloom intensity
 * @property {number} bloomRadius - Bloom radius
 * @property {number} bloomThreshold - Bloom threshold
 * @property {number} ssaoRadius - SSAO radius
 * @property {number} ssaoIntensity - SSAO intensity
 * @property {number} ssrThickness - SSR thickness
 * @property {number} ssrSamples - SSR sample count
 */

/**
 * Quality presets for different devices
 */
const QUALITY_PRESETS = {
  low: {
    ssrSamples: 8,
    ssrThickness: 0.1,
    ssaoSamples: 8,
    ssaoRadius: 0.5,
    bloomMipLevel: 4,
    renderScale: 0.75,
  },
  medium: {
    ssrSamples: 16,
    ssrThickness: 0.08,
    ssaoSamples: 12,
    ssaoRadius: 0.8,
    bloomMipLevel: 2,
    renderScale: 0.85,
  },
  high: {
    ssrSamples: 24,
    ssrThickness: 0.06,
    ssaoSamples: 16,
    ssaoRadius: 1.0,
    bloomMipLevel: 1,
    renderScale: 1.0,
  },
  ultra: {
    ssrSamples: 32,
    ssrThickness: 0.04,
    ssaoSamples: 32,
    ssaoRadius: 1.5,
    bloomMipLevel: 0,
    renderScale: 1.0,
  },
};

/**
 * PostProcessing class managing the full pipeline
 */
export class PostProcessing {
  /**
   * @param {THREE.WebGPURenderer|THREE.WebGLRenderer} renderer - Three.js renderer
   * @param {THREE.Scene} scene - Scene to render
   * @param {THREE.Camera} camera - Camera to use
   * @param {PostProcessingOptions} options - Post-processing options
   */
  constructor(renderer, scene, camera, options = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.options = {
      enableSSR: true,
      enableSSAO: true,
      enableBloom: true,
      enableToneMapping: true,
      enableFXAA: true,
      quality: "high",
      bloomStrength: 0.6,
      bloomRadius: 0.4,
      bloomThreshold: 0.85,
      ssaoRadius: 1.0,
      ssaoIntensity: 0.5,
      ssrThickness: 0.06,
      ssrSamples: 24,
      ...options,
    };

    /** @type {EffectComposer} */
    this.composer = null;
    /** @type {RenderPass} */
    this.renderPass = null;
    /** @type {SSRPass|null} */
    this.ssrPass = null;
    /** @type {SSAOPass|null} */
    this.ssaoPass = null;
    /** @type {BloomPass|null} */
    this.bloomPass = null;
    /** @type {ToneMappingPass|null} */
    this.toneMappingPass = null;
    /** @type {ShaderPass|null} */
    this.fxaaPass = null;
    /** @type {OutputPass} */
    this.outputPass = null;

    /** @type {THREE.RenderTarget} */
    this.renderTarget = null;
    /** @type {Object} */
    this._qualitySettings =
      QUALITY_PRESETS[this.options.quality] || QUALITY_PRESETS.high;

    /** @type {number} */
    this._time = 0;
    /** @type {boolean} */
    this._needsResize = false;

    this._init();
  }

  /**
   * Initialize the post-processing pipeline
   * @private
   */
  _init() {
    const width = this.renderer.domElement.width;
    const height = this.renderer.domElement.height;

    // Create render target with appropriate settings
    this.renderTarget = this._createRenderTarget(width, height);

    // Create composer
    this.composer = new EffectComposer(this.renderer, this.renderTarget);

    // 1. Render Pass - Base scene render
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.renderPass.renderToScreen = false;
    this.composer.addPass(this.renderPass);

    // 2. SSR Pass - Screen Space Reflections
    if (this.options.enableSSR) {
      this.ssrPass = new SSRPass({
        renderer: this.renderer,
        scene: this.scene,
        camera: this.camera,
        width,
        height,
        selects: this.scene,
        thickness: this._qualitySettings.ssrThickness,
        maxDistance: 100,
        samples: this._qualitySettings.ssrSamples,
        resolutionScale: this._qualitySettings.renderScale,
      });
      this.composer.addPass(this.ssrPass);
    }

    // 3. SSAO Pass - Screen Space Ambient Occlusion
    if (this.options.enableSSAO) {
      this.ssaoPass = new SSAOPass(this.scene, this.camera, width, height);
      this.ssaoPass.kernelRadius = this._qualitySettings.ssaoRadius;
      this.ssaoPass.intensity = this.options.ssaoIntensity;
      this.ssaoPass.samples = this._qualitySettings.ssaoSamples;
      this.composer.addPass(this.ssaoPass);
    }

    // 4. Bloom Pass - Custom Bloom with quality presets
    if (this.options.enableBloom) {
      this.bloomPass = new BloomPass({
        strength: this.options.bloomStrength,
        radius: this.options.bloomRadius,
        threshold: this.options.bloomThreshold,
        mipLevel: this._qualitySettings.bloomMipLevel,
        anamorphic: false,
        dirtIntensity: 0.0,
      });
      this.bloomPass.setQuality(this.options.quality);
      this.composer.addPass(this.bloomPass);
    }

    // 5. Tone Mapping Pass
    if (this.options.enableToneMapping) {
      this.toneMappingPass = new ToneMappingPass({
        exposure: 1.0,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      });
      this.composer.addPass(this.toneMappingPass);
    }

    // 6. FXAA Pass - Anti-aliasing
    if (this.options.enableFXAA) {
      this.fxaaPass = new ShaderPass(FXAAShader);
      this.fxaaPass.material.uniforms["resolution"].value.set(
        1 / width,
        1 / height,
      );
      this.composer.addPass(this.fxaaPass);
    }

    // 7. Output Pass - Final output with sRGB conversion
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    console.log(
      "[PostProcessing] Pipeline initialized with passes:",
      this._getPassNames(),
    );
  }

  /**
   * Create render target with appropriate settings
   * @param {number} width - Width
   * @param {number} height - Height
   * @returns {THREE.RenderTarget}
   * @private
   */
  _createRenderTarget(width, height) {
    const scaledWidth = Math.floor(width * this._qualitySettings.renderScale);
    const scaledHeight = Math.floor(height * this._qualitySettings.renderScale);

    const target = new THREE.RenderTarget(scaledWidth, scaledHeight, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.SRGBColorSpace,
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
    });

    target.texture.name = "PostProcessing.RenderTarget";
    return target;
  }

  /**
   * Get list of active pass names
   * @returns {string[]}
   * @private
   */
  _getPassNames() {
    const names = ["RenderPass"];
    if (this.ssrPass) names.push("SSRPass");
    if (this.ssaoPass) names.push("SSAOPass");
    if (this.bloomPass) names.push("BloomPass");
    if (this.toneMappingPass) names.push("ToneMappingPass");
    if (this.fxaaPass) names.push("FXAAPass");
    names.push("OutputPass");
    return names;
  }

  /**
   * Render the scene through the post-processing pipeline
   * @param {THREE.Scene} [scene] - Optional scene override
   * @param {THREE.Camera} [camera] - Optional camera override
   */
  render(scene, camera) {
    if (!this.composer) return;

    // Update camera for passes that need it
    if (this.ssrPass) {
      this.ssrPass.camera = camera || this.camera;
    }
    if (this.ssaoPass) {
      this.ssaoPass.camera = camera || this.camera;
    }

    // Render through composer
    this.composer.render();
  }

  /**
   * Update time-dependent effects
   * @param {number} deltaTime - Time since last frame
   * @param {number} elapsedTime - Total elapsed time
   */
  update(deltaTime, elapsedTime) {
    this._time = elapsedTime;

    // Update SSR temporal accumulation
    if (this.ssrPass) {
      this.ssrPass.update(deltaTime);
    }

    // Update bloom (if animated)
    if (this.bloomPass) {
      // Could animate bloom intensity here if needed
    }
  }

  /**
   * Handle resize
   * @param {number} width - New width
   * @param {number} height - New height
   */
  setSize(width, height) {
    if (!this.composer) return;

    const scaledWidth = Math.floor(width * this._qualitySettings.renderScale);
    const scaledHeight = Math.floor(height * this._qualitySettings.renderScale);

    // Resize composer
    this.composer.setSize(scaledWidth, scaledHeight);

    // Resize render target
    if (this.renderTarget) {
      this.renderTarget.setSize(scaledWidth, scaledHeight);
      this.renderTarget.dispose();
      this.renderTarget = this._createRenderTarget(width, height);
      this.composer.renderTarget1 = this.renderTarget;
    }

    // Update FXAA resolution
    if (this.fxaaPass) {
      this.fxaaPass.material.uniforms["resolution"].value.set(
        1 / width,
        1 / height,
      );
    }

    // Update bloom resolution
    if (this.bloomPass) {
      this.bloomPass.setSize(width, height);
    }

    // Update SSR resolution
    if (this.ssrPass) {
      this.ssrPass.setSize(width, height);
    }

    // Update SSAO resolution
    if (this.ssaoPass) {
      this.ssaoPass.setSize(width, height);
    }

    console.log("[PostProcessing] Resized to", width, "x", height);
  }

  /**
   * Set quality preset
   * @param {string} quality - Quality preset name
   */
  setQuality(quality) {
    if (!QUALITY_PRESETS[quality]) {
      console.warn("[PostProcessing] Unknown quality preset:", quality);
      return;
    }

    this.options.quality = quality;
    this._qualitySettings = QUALITY_PRESETS[quality];

    // Update SSR
    if (this.ssrPass) {
      this.ssrPass.samples = this._qualitySettings.ssrSamples;
      this.ssrPass.thickness = this._qualitySettings.ssrThickness;
    }

    // Update SSAO
    if (this.ssaoPass) {
      this.ssaoPass.kernelRadius = this._qualitySettings.ssaoRadius;
      this.ssaoPass.samples = this._qualitySettings.ssaoSamples;
    }

    // Update Bloom
    if (this.bloomPass) {
      this.bloomPass.setQuality(quality);
    }

    // Recreate render target with new scale
    const width = this.renderer.domElement.width;
    const height = this.renderer.domElement.height;
    this.setSize(width, height);

    console.log("[PostProcessing] Quality set to:", quality);
  }

  /**
   * Enable/disable specific passes
   * @param {string} passName - Pass name
   * @param {boolean} enabled - Enable state
   */
  setPassEnabled(passName, enabled) {
    const passMap = {
      ssr: this.ssrPass,
      ssao: this.ssaoPass,
      bloom: this.bloomPass,
      toneMapping: this.toneMappingPass,
      fxaa: this.fxaaPass,
    };

    const pass = passMap[passName.toLowerCase()];
    if (pass) {
      pass.enabled = enabled;
      console.log(
        "[PostProcessing]",
        passName,
        enabled ? "enabled" : "disabled",
      );
    }
  }

  /**
   * Set bloom parameters
   * @param {Object} params - Bloom parameters
   */
  setBloomParams(params) {
    if (this.bloomPass) {
      if (params.strength !== undefined)
        this.bloomPass.strength = params.strength;
      if (params.radius !== undefined) this.bloomPass.radius = params.radius;
      if (params.threshold !== undefined)
        this.bloomPass.threshold = params.threshold;
      if (params.anamorphic !== undefined)
        this.bloomPass.setAnamorphic(params.anamorphic);
      if (params.dirtIntensity !== undefined)
        this.bloomPass.dirtIntensity = params.dirtIntensity;
      if (params.colorWeight !== undefined)
        this.bloomPass.customColorWeight.copy(params.colorWeight);
    }
  }

  /**
   * Set SSAO parameters
   * @param {Object} params - SSAO parameters
   */
  setSSAOParams(params) {
    if (this.ssaoPass) {
      if (params.radius !== undefined)
        this.ssaoPass.kernelRadius = params.radius;
      if (params.intensity !== undefined)
        this.ssaoPass.intensity = params.intensity;
      if (params.bias !== undefined) this.ssaoPass.bias = params.bias;
    }
  }

  /**
   * Set SSR parameters
   * @param {Object} params - SSR parameters
   */
  setSSRParams(params) {
    if (this.ssrPass) {
      if (params.thickness !== undefined)
        this.ssrPass.thickness = params.thickness;
      if (params.maxDistance !== undefined)
        this.ssrPass.maxDistance = params.maxDistance;
      if (params.samples !== undefined) this.ssrPass.samples = params.samples;
    }
  }

  /**
   * Set tone mapping parameters
   * @param {Object} params - Tone mapping parameters
   */
  setToneMappingParams(params) {
    if (this.toneMappingPass) {
      if (params.exposure !== undefined)
        this.toneMappingPass.exposure = params.exposure;
      if (params.toneMapping !== undefined)
        this.toneMappingPass.toneMapping = params.toneMapping;
    }
  }

  /**
   * Get current render target for reading (e.g., for screenshots)
   * @returns {THREE.RenderTarget}
   */
  getRenderTarget() {
    return this.renderTarget;
  }

  /**
   * Dispose of all resources
   */
  dispose() {
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }

    if (this.renderTarget) {
      this.renderTarget.dispose();
      this.renderTarget = null;
    }

    // Dispose passes
    const passes = [
      this.ssrPass,
      this.ssaoPass,
      this.bloomPass,
      this.toneMappingPass,
      this.fxaaPass,
      this.outputPass,
    ];
    passes.forEach((pass) => {
      if (pass && pass.dispose) {
        pass.dispose();
      }
    });

    console.log("[PostProcessing] Disposed");
  }
}

export default PostProcessing;
