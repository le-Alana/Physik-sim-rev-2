/**
 * ToneMappingPass - Advanced Tone Mapping with Multiple Operators
 *
 * Supports ACES Filmic, Reinhard, Uncharted 2, and Custom tone mapping
 * with exposure control, white balance, and color grading.
 *
 * @module core/postprocessing/ToneMappingPass
 * @version 1.0.0
 */

import * as THREE from "three";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/**
 * Tone Mapping Shader - Multiple tone mapping operators
 */
const ToneMappingShader = {
  name: "ToneMappingShader",
  uniforms: {
    tDiffuse: { value: null },
    exposure: { value: 1.0 },
    toneMapping: { value: 0 }, // 0=ACES, 1=Reinhard, 2=Uncharted2, 3=Custom
    whitePoint: { value: 1.0 },
    contrast: { value: 1.0 },
    saturation: { value: 1.0 },
    colorBalance: { value: new THREE.Vector3(1, 1, 1) },
    lift: { value: new THREE.Vector3(0, 0, 0) },
    gamma: { value: 2.2 },
    outputColorSpace: { value: 0 }, // 0=SRGB, 1=Linear
  },

  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    #include <common>
    #include <tonemapping_pars_fragment>
    #include <colorspace_pars_fragment>

    varying vec2 vUv;
    
    uniform sampler2D tDiffuse;
    uniform float exposure;
    uniform int toneMapping;
    uniform float whitePoint;
    uniform float contrast;
    uniform float saturation;
    uniform vec3 colorBalance;
    uniform vec3 lift;
    uniform float gamma;
    uniform int outputColorSpace;

    // ACES Filmic Tone Mapping
    vec3 acesFilmic(vec3 color) {
      color *= exposure;
      
      const float a = 2.51;
      const float b = 0.03;
      const float c = 2.43;
      const float d = 0.59;
      const float e = 0.14;
      
      color = (color * (a * color + b)) / (color * (c * color + d) + e);
      color = clamp(color, 0.0, whitePoint);
      
      return color;
    }

    // Reinhard Tone Mapping
    vec3 reinhard(vec3 color) {
      color *= exposure;
      color = color / (color + vec3(whitePoint));
      return color;
    }

    // Modified Reinhard with white point
    vec3 reinhardExtended(vec3 color) {
      color *= exposure;
      float whiteSq = whitePoint * whitePoint;
      color = (color * (1.0 + color / whiteSq)) / (1.0 + color);
      return color;
    }

    // Uncharted 2 Tone Mapping (John Hable)
    vec3 uncharted2(vec3 color) {
      color *= exposure;
      
      const float A = 0.15;
      const float B = 0.50;
      const float C = 0.10;
      const float D = 0.20;
      const float E = 0.02;
      const float F = 0.30;
      const float W = whitePoint;
      
      vec3 x = max(vec3(0.0), color - vec3(0.004));
      vec3 numerator = x * (A * x + C * B) + D * E;
      vec3 denominator = x * (A * x + B) + D * F;
      color = numerator / denominator - E / F;
      
      // White scale
      vec3 whiteScale = vec3(1.0) / (W * (A * W + C * B) + D * E) / (W * (A * W + B) + D * F) - E / F;
      color *= whiteScale;
      
      return clamp(color, 0.0, 1.0);
    }

    // Custom tone mapping with full controls
    vec3 customToneMap(vec3 color) {
      // Exposure
      color *= exposure;
      
      // Lift (shadows)
      color += lift;
      
      // Color balance
      color *= colorBalance;
      
      // Contrast (around middle gray)
      color = mix(vec3(0.5), color, contrast);
      
      // Saturation
      float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luminance), color, saturation);
      
      // Apply tone mapping operator
      if (toneMapping == 0) {
        color = acesFilmic(color);
      } else if (toneMapping == 1) {
        color = reinhardExtended(color);
      } else if (toneMapping == 2) {
        color = uncharted2(color);
      }
      
      // Gamma correction (if output is sRGB)
      if (outputColorSpace == 0) {
        color = pow(color, vec3(1.0 / gamma));
      }
      
      return color;
    }

    // SRGB to Linear
    vec3 srgbToLinear(vec3 color) {
      vec3 lo = color / 12.92;
      vec3 hi = pow((color + 0.055) / 1.055, vec3(2.4));
      return mix(lo, hi, step(vec3(0.04045), color));
    }

    // Linear to SRGB
    vec3 linearToSrgb(vec3 color) {
      vec3 lo = color * 12.92;
      vec3 hi = 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055;
      return mix(lo, hi, step(vec3(0.0031308), color));
    }

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      
      // Convert to linear if input is sRGB
      color = srgbToLinear(color);
      
      // Apply custom tone mapping
      color = customToneMap(color);
      
      // Output color space conversion
      if (outputColorSpace == 0) {
        color = linearToSrgb(color);
      }
      
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

/**
 * ToneMappingPass class
 */
export class ToneMappingPass extends Pass {
  /**
   * @param {Object} options - Tone mapping options
   */
  constructor(options = {}) {
    super();

    this.name = "ToneMappingPass";
    this.needsSwap = true;
    this.clear = false;
    this.renderToScreen = false;

    // Settings
    this.exposure = options.exposure || 1.0;
    this.toneMapping = options.toneMapping || THREE.ACESFilmicToneMapping;
    this.outputColorSpace = options.outputColorSpace || THREE.SRGBColorSpace;

    // Map Three.js tone mapping enum to our shader indices
    this._toneMappingMap = {
      [THREE.NoToneMapping]: -1,
      [THREE.LinearToneMapping]: -1,
      [THREE.ReinhardToneMapping]: 1,
      [THREE.CineonToneMapping]: 3, // Custom
      [THREE.ACESFilmicToneMapping]: 0,
      [THREE.AgXToneMapping]: 3,
      [THREE.NeutralToneMapping]: 3,
      [THREE.CustomToneMapping]: 3,
    };

    // Additional color grading
    this.whitePoint = 1.0;
    this.contrast = 1.0;
    this.saturation = 1.0;
    this.colorBalance = new THREE.Vector3(1, 1, 1);
    this.lift = new THREE.Vector3(0, 0, 0);
    this.gamma = 2.2;

    // Internal
    this._shaderPass = null;
    this._fsQuad = new THREE.FullScreenQuad(null);

    this._init();
  }

  /**
   * Initialize shader pass
   * @private
   */
  _init() {
    this._shaderPass = new ShaderPass(ToneMappingShader);

    // Set initial uniforms
    this._shaderPass.material.uniforms.exposure.value = this.exposure;
    this._shaderPass.material.uniforms.toneMapping.value =
      this._getToneMappingIndex(this.toneMapping);
    this._shaderPass.material.uniforms.whitePoint.value = this.whitePoint;
    this._shaderPass.material.uniforms.contrast.value = this.contrast;
    this._shaderPass.material.uniforms.saturation.value = this.saturation;
    this._shaderPass.material.uniforms.colorBalance.value = this.colorBalance;
    this._shaderPass.material.uniforms.lift.value = this.lift;
    this._shaderPass.material.uniforms.gamma.value = this.gamma;
    this._shaderPass.material.uniforms.outputColorSpace.value =
      this.outputColorSpace === THREE.SRGBColorSpace ? 0 : 1;
  }

  /**
   * Map Three.js tone mapping to shader index
   * @private
   */
  _getToneMappingIndex(toneMapping) {
    return this._toneMappingMap[toneMapping] ?? 0;
  }

  /**
   * Render the pass
   */
  render(renderer, writeBuffer, readBuffer) {
    if (!this.enabled) {
      if (this.renderToScreen) {
        renderer.setRenderTarget(null);
        renderer.copyFramebufferToTexture(readBuffer);
      }
      return;
    }

    this._shaderPass.render(renderer, writeBuffer, readBuffer);
  }

  /**
   * Set exposure
   * @param {number} exposure - Exposure value
   */
  setExposure(exposure) {
    this.exposure = exposure;
    if (this._shaderPass) {
      this._shaderPass.material.uniforms.exposure.value = exposure;
    }
  }

  /**
   * Set tone mapping operator
   * @param {number} toneMapping - Three.js tone mapping constant
   */
  setToneMapping(toneMapping) {
    this.toneMapping = toneMapping;
    if (this._shaderPass) {
      this._shaderPass.material.uniforms.toneMapping.value =
        this._getToneMappingIndex(toneMapping);
    }
  }

  /**
   * Set white point
   * @param {number} whitePoint - White point
   */
  setWhitePoint(whitePoint) {
    this.whitePoint = whitePoint;
    if (this._shaderPass) {
      this._shaderPass.material.uniforms.whitePoint.value = whitePoint;
    }
  }

  /**
   * Set contrast
   * @param {number} contrast - Contrast (1.0 = neutral)
   */
  setContrast(contrast) {
    this.contrast = contrast;
    if (this._shaderPass) {
      this._shaderPass.material.uniforms.contrast.value = contrast;
    }
  }

  /**
   * Set saturation
   * @param {number} saturation - Saturation (1.0 = neutral)
   */
  setSaturation(saturation) {
    this.saturation = saturation;
    if (this._shaderPass) {
      this._shaderPass.material.uniforms.saturation.value = saturation;
    }
  }

  /**
   * Set color balance (white balance)
   * @param {THREE.Vector3} balance - RGB balance factors
   */
  setColorBalance(balance) {
    this.colorBalance.copy(balance);
    if (this._shaderPass) {
      this._shaderPass.material.uniforms.colorBalance.value.copy(balance);
    }
  }

  /**
   * Set lift (shadow tint)
   * @param {THREE.Vector3} lift - RGB lift values
   */
  setLift(lift) {
    this.lift.copy(lift);
    if (this._shaderPass) {
      this._shaderPass.material.uniforms.lift.value.copy(lift);
    }
  }

  /**
   * Set gamma
   * @param {number} gamma - Gamma value
   */
  setGamma(gamma) {
    this.gamma = gamma;
    if (this._shaderPass) {
      this._shaderPass.material.uniforms.gamma.value = gamma;
    }
  }

  /**
   * Set output color space
   * @param {number} colorSpace - THREE.SRGBColorSpace or THREE.LinearSRGBColorSpace
   */
  setOutputColorSpace(colorSpace) {
    this.outputColorSpace = colorSpace;
    if (this._shaderPass) {
      this._shaderPass.material.uniforms.outputColorSpace.value =
        colorSpace === THREE.SRGBColorSpace ? 0 : 1;
    }
  }

  /**
   * Get current settings
   * @returns {Object}
   */
  getSettings() {
    return {
      exposure: this.exposure,
      toneMapping: this.toneMapping,
      whitePoint: this.whitePoint,
      contrast: this.contrast,
      saturation: this.saturation,
      colorBalance: this.colorBalance.clone(),
      lift: this.lift.clone(),
      gamma: this.gamma,
      outputColorSpace: this.outputColorSpace,
    };
  }

  /**
   * Apply settings object
   * @param {Object} settings - Settings from getSettings()
   */
  applySettings(settings) {
    if (settings.exposure !== undefined) this.setExposure(settings.exposure);
    if (settings.toneMapping !== undefined)
      this.setToneMapping(settings.toneMapping);
    if (settings.whitePoint !== undefined)
      this.setWhitePoint(settings.whitePoint);
    if (settings.contrast !== undefined) this.setContrast(settings.contrast);
    if (settings.saturation !== undefined)
      this.setSaturation(settings.saturation);
    if (settings.colorBalance !== undefined)
      this.setColorBalance(settings.colorBalance);
    if (settings.lift !== undefined) this.setLift(settings.lift);
    if (settings.gamma !== undefined) this.setGamma(settings.gamma);
    if (settings.outputColorSpace !== undefined)
      this.setOutputColorSpace(settings.outputColorSpace);
  }

  /**
   * Dispose of resources
   */
  dispose() {
    if (this._shaderPass) {
      this._shaderPass.dispose();
      this._shaderPass = null;
    }
    if (this._fsQuad) {
      this._fsQuad.dispose();
    }
  }
}

/**
 * Tone mapping presets for quick setup
 */
export const ToneMappingPresets = {
  default: {
    exposure: 1.0,
    toneMapping: THREE.ACESFilmicToneMapping,
    whitePoint: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    colorBalance: new THREE.Vector3(1, 1, 1),
    lift: new THREE.Vector3(0, 0, 0),
    gamma: 2.2,
  },
  cinematic: {
    exposure: 1.2,
    toneMapping: THREE.ACESFilmicToneMapping,
    whitePoint: 1.1,
    contrast: 1.15,
    saturation: 0.9,
    colorBalance: new THREE.Vector3(1.02, 0.99, 0.97),
    lift: new THREE.Vector3(0.01, 0.005, 0),
    gamma: 2.2,
  },
  vibrant: {
    exposure: 1.0,
    toneMapping: THREE.ACESFilmicToneMapping,
    whitePoint: 1.0,
    contrast: 1.1,
    saturation: 1.25,
    colorBalance: new THREE.Vector3(1, 1, 1),
    lift: new THREE.Vector3(0, 0, 0),
    gamma: 2.2,
  },
  moody: {
    exposure: 0.8,
    toneMapping: THREE.ACESFilmicToneMapping,
    whitePoint: 0.9,
    contrast: 1.2,
    saturation: 0.7,
    colorBalance: new THREE.Vector3(0.98, 0.96, 1.02),
    lift: new THREE.Vector3(0.02, 0.015, 0.03),
    gamma: 2.4,
  },
  hdr: {
    exposure: 1.5,
    toneMapping: THREE.ACESFilmicToneMapping,
    whitePoint: 2.0,
    contrast: 1.0,
    saturation: 1.0,
    colorBalance: new THREE.Vector3(1, 1, 1),
    lift: new THREE.Vector3(0, 0, 0),
    gamma: 2.2,
  },
};

export default ToneMappingPass;
