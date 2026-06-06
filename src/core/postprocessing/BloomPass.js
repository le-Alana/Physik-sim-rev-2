/**
 * BloomPass - Unreal Bloom Effect with Custom Controls
 * 
 * Enhanced bloom pass with:
 * - Separate threshold/strength/radius controls
 * - Color-weighted bloom (color channels can bloom differently)
 * - Anamorphic bloom option
 * - Dirt lens texture support
 * - Quality presets for mobile/desktop
 * 
 * @module core/postprocessing/BloomPass
 * @version 1.0.0
 */

import * as THREE from 'three';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Bloom configuration options
 * @typedef {Object} BloomPassOptions
 * @property {number} strength - Bloom intensity
 * @property {number} radius - Bloom radius
 * @property {number} threshold - Luminance threshold
 * @property {number} mipLevel - Mip level for downsampling (0=full, higher=more blur)
 * @property {boolean} anamorphic - Enable anamorphic (horizontal) bloom
 * @property {THREE.Texture} dirtTexture - Lens dirt texture
 * @property {number} dirtIntensity - Dirt texture intensity
 * @property {THREE.Vector3} colorWeight - RGB weight for bloom channels
 */

/**
 * Brightness extraction shader
 */
const BrightnessShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'threshold': { value: 0.85 },
    'thresholdFade': { value: 0.01 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float threshold;
    uniform float thresholdFade;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      float mask = smoothstep(threshold - thresholdFade, threshold + thresholdFade, luminance);
      gl_FragColor = vec4(color.rgb * mask, mask);
    }
  `
};

/**
 * Blur shader (separable horizontal/vertical)
 */
const BlurShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'direction': { value: new THREE.Vector2(1, 0) },
    'kernelSize': { value: 9 },
    'sigma': { value: 4.0 },
    'mipLevel': { value: 0 },
    'anamorphic': { value: 0 }
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
    
    uniform sampler2D tDiffuse;
    uniform vec2 direction;
    uniform int kernelSize;
    uniform float sigma;
    uniform int mipLevel;
    uniform int anamorphic;
    
    varying vec2 vUv;
    
    // Gaussian weight
    float gaussian(float x, float sigma) {
      return exp(-0.5 * x * x / (sigma * sigma)) / (sigma * sqrt(2.0 * PI));
    }
    
    void main() {
      vec2 texelSize = direction * (1.0 / textureSize(tDiffuse, mipLevel));
      
      vec3 color = texture2D(tDiffuse, vUv).rgb * gaussian(0.0, sigma);
      float weightSum = gaussian(0.0, sigma);
      
      int taps = kernelSize;
      float halfTaps = float(taps) * 0.5;
      
      for (int i = 1; i < 16; i++) {
        if (i > taps) break;
        
        float offset = float(i);
        float w = gaussian(offset, sigma);
        
        if (anamorphic == 1 && direction.y == 0.0) {
          // Anamorphic: wider horizontal blur
          w *= 1.5;
        }
        
        vec2 uvOffset = texelSize * offset;
        color += texture2D(tDiffuse, vUv + uvOffset).rgb * w;
        color += texture2D(tDiffuse, vUv - uvOffset).rgb * w;
        weightSum += 2.0 * w;
      }
      
      gl_FragColor = vec4(color / weightSum, 1.0);
    }
  `
};

/**
 * Composite shader - combine bloom with original
 */
const CompositeShader = {
  uniforms: {
    'tDiffuse': { value: null },      // Original scene
    'tBloom': { value: null },        // Bloom texture
    'tDirt': { value: null },         // Dirt texture
    'strength': { value: 1.0 },
    'radius': { value: 1.0 },
    'dirtIntensity': { value: 0.0 },
    'colorWeight': { value: new THREE.Vector3(1, 1, 1) },
    'exposure': { value: 1.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tBloom;
    uniform sampler2D tDirt;
    uniform float strength;
    uniform float radius;
    uniform float dirtIntensity;
    uniform vec3 colorWeight;
    uniform float exposure;
    
    varying vec2 vUv;
    
    // Tonemap
    vec3 tonemap(vec3 color) {
      const float a = 2.51;
      const float b = 0.03;
      const float c = 2.43;
      const float d = 0.59;
      const float e = 0.14;
      color = (color * (a * color + b)) / (color * (c * color + d) + e);
      return clamp(color, 0.0, 1.0);
    }
    
    void main() {
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec3 bloom = texture2D(tBloom, vUv).rgb;
      
      // Apply color weight to bloom
      bloom *= colorWeight;
      
      // Exposure adjustment
      base *= exposure;
      bloom *= exposure;
      
      // Additive bloom
      vec3 color = base + bloom * strength * radius;
      
      // Lens dirt
      if (dirtIntensity > 0.0) {
        vec3 dirt = texture2D(tDirt, vUv * 4.0).rgb;
        color = mix(color, color * dirt, dirtIntensity);
      }
      
      // Tonemap
      color = tonemap(color);
      
      // Gamma correction
      color = pow(color, vec3(1.0 / 2.2));
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

/**
 * BloomPass - Enhanced bloom with quality presets
 */
export class BloomPass extends Pass {
  /**
   * @param {Object} options - Bloom options
   */
  constructor(options = {}) {
    super();
    
    this.name = 'BloomPass';
    this.needsSwap = true;
    
    // Options
    this.strength = options.strength ?? 1.0;
    this.radius = options.radius ?? 0.5;
    this.threshold = options.threshold ?? 0.85;
    this.mipLevel = options.mipLevel ?? 0;
    this.anamorphic = options.anamorphic ?? false;
    this.dirtIntensity = options.dirtIntensity ?? 0.0;
    this.customColorWeight = options.colorWeight ?? new THREE.Vector3(1, 1, 1);
    
    // Render targets
    this._renderTargetBright = null;
    this._renderTargetBlurH1 = null;
    this._renderTargetBlurV1 = null;
    this._renderTargetBlurH2 = null;
    this._renderTargetBlurV2 = null;
    this._renderTargetBlurH3 = null;
    this._renderTargetBlurV3 = null;
    this._renderTargetComposite = null;
    
    // Materials
    this._brightnessMaterial = null;
    this._blurHMaterial = null;
    this._blurVMaterial = null;
    this._compositeMaterial = null;
    this._copyMaterial = null;
    
    // Full-screen quad
    this._fsQuad = new THREE.FullScreenQuad(null);
    
    // Dirt texture
    this._dirtTexture = options.dirtTexture || this._createDefaultDirtTexture();
    
    // Quality presets
    this._qualityPresets = {
      low: { mipLevel: 3, blurPasses: 1, kernelSize: 7 },
      medium: { mipLevel: 2, blurPasses: 2, kernelSize: 9 },
      high: { mipLevel: 1, blurPasses: 2, kernelSize: 11 },
      ultra: { mipLevel: 0, blurPasses: 3, kernelSize: 15 }
    };
    
    this._currentQuality = 'high';
    this._qualitySettings = this._qualityPresets.high;
    
    this._init();
  }

  /**
   * Initialize render targets and materials
   * @private
   */
  _init() {
    // Will be sized on first render
    this._createMaterials();
  }

  /**
   * Create shader materials
   * @private
   */
  _createMaterials() {
    // Brightness extraction
    this._brightnessMaterial = new THREE.ShaderMaterial({
      name: 'Bloom.Brightness',
      uniforms: THREE.UniformsUtils.clone(BrightnessShader.uniforms),
      vertexShader: BrightnessShader.vertexShader,
      fragmentShader: BrightnessShader.fragmentShader
    });

    // Horizontal blur
    this._blurHMaterial = new THREE.ShaderMaterial({
      name: 'Bloom.BlurH',
      uniforms: THREE.UniformsUtils.clone(BlurShader.uniforms),
      vertexShader: BlurShader.vertexShader,
      fragmentShader: BlurShader.fragmentShader
    });
    this._blurHMaterial.uniforms.direction.value.set(1, 0);

    // Vertical blur
    this._blurVMaterial = new THREE.ShaderMaterial({
      name: 'Bloom.BlurV',
      uniforms: THREE.UniformsUtils.clone(BlurShader.uniforms),
      vertexShader: BlurShader.vertexShader,
      fragmentShader: BlurShader.fragmentShader
    });
    this._blurVMaterial.uniforms.direction.value.set(0, 1);

    // Composite
    this._compositeMaterial = new THREE.ShaderMaterial({
      name: 'Bloom.Composite',
      uniforms: THREE.UniformsUtils.clone(CompositeShader.uniforms),
      vertexShader: CompositeShader.vertexShader,
      fragmentShader: CompositeShader.fragmentShader
    });
    
    // Set dirt texture
    this._compositeMaterial.uniforms.tDirt.value = this._dirtTexture;
  }

  /**
   * Create default dirt lens texture
   * @private
   */
  _createDefaultDirtTexture() {
    const size = 512;
    const data = new Uint8Array(size * size * 3);
    
    // Smoothstep helper (GLSL function in JS)
    const smoothstep = (edge0, edge1, x) => {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    };
    
    // Generate organic noise for lens dirt
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        
        // Multiple octaves of noise
        let noise = 0;
        let amp = 1;
        let freq = 1;
        
        for (let o = 0; o < 5; o++) {
          const nx = u * freq;
          const ny = v * freq;
          // Simple hash-based noise
          const n = Math.sin(nx * 12.9898 + ny * 78.233) * 43758.5453;
          noise += (Math.abs(n % 1) * 2 - 1) * amp;
          amp *= 0.5;
          freq *= 2;
        }
        
        // Circular vignette
        const dx = u - 0.5;
        const dy = v - 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const vignette = smoothstep(0.7, 1.0, dist);
        
        // Dust particles
        const dust = Math.random() > 0.995 ? 1.0 : 0.0;
        
        const val = Math.max(0, noise * 0.5 + 0.5 - vignette * 0.3 + dust * 0.5);
        const idx = (y * size + x) * 3;
        data[idx] = Math.floor(val * 255);
        data[idx + 1] = Math.floor(val * 255);
        data[idx + 2] = Math.floor(val * 255);
      }
    }
    
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBFormat, THREE.UnsignedByteType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    texture.name = 'Bloom.DirtTexture';
    
    return texture;
  }

  /**
   * Ensure render targets are created with correct size
   * @private
   */
  _ensureRenderTargets(renderer) {
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;
    
    const mipW = Math.max(1, width >> this._qualitySettings.mipLevel);
    const mipH = Math.max(1, height >> this._qualitySettings.mipLevel);
    
    // Bright pass target
    if (!this._renderTargetBright || this._renderTargetBright.width !== width) {
      this._disposeRenderTargets();
      this._createRenderTargets(width, height, mipW, mipH);
    }
  }

  /**
   * Create all render targets
   * @private
   */
  _createRenderTargets(width, height, mipW, mipH) {
    const rtOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.SRGBColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false
    };
    
    this._renderTargetBright = new THREE.WebGLRenderTarget(width, height, rtOptions);
    this._renderTargetBright.texture.name = 'Bloom.Bright';
    
    // Blur targets for multiple passes
    this._renderTargetBlurH1 = new THREE.WebGLRenderTarget(mipW, mipH, rtOptions);
    this._renderTargetBlurH1.texture.name = 'Bloom.BlurH1';
    
    this._renderTargetBlurV1 = new THREE.WebGLRenderTarget(mipW, mipH, rtOptions);
    this._renderTargetBlurV1.texture.name = 'Bloom.BlurV1';
    
    this._renderTargetBlurH2 = new THREE.WebGLRenderTarget(mipW, mipH, rtOptions);
    this._renderTargetBlurH2.texture.name = 'Bloom.BlurH2';
    
    this._renderTargetBlurV2 = new THREE.WebGLRenderTarget(mipW, mipH, rtOptions);
    this._renderTargetBlurV2.texture.name = 'Bloom.BlurV2';
    
    this._renderTargetBlurH3 = new THREE.WebGLRenderTarget(mipW, mipH, rtOptions);
    this._renderTargetBlurH3.texture.name = 'Bloom.BlurH3';
    
    this._renderTargetBlurV3 = new THREE.WebGLRenderTarget(mipW, mipH, rtOptions);
    this._renderTargetBlurV3.texture.name = 'Bloom.BlurV3';
    
    this._renderTargetComposite = new THREE.WebGLRenderTarget(width, height, rtOptions);
    this._renderTargetComposite.texture.name = 'Bloom.Composite';
  }

  /**
   * Dispose of render targets
   * @private
   */
  _disposeRenderTargets() {
    const targets = [
      this._renderTargetBright,
      this._renderTargetBlurH1,
      this._renderTargetBlurV1,
      this._renderTargetBlurH2,
      this._renderTargetBlurV2,
      this._renderTargetBlurH3,
      this._renderTargetBlurV3,
      this._renderTargetComposite
    ];
    
    targets.forEach(target => {
      if (target) {
        target.dispose();
      }
    });
    
    this._renderTargetBright = null;
    this._renderTargetBlurH1 = null;
    this._renderTargetBlurV1 = null;
    this._renderTargetBlurH2 = null;
    this._renderTargetBlurV2 = null;
    this._renderTargetBlurH3 = null;
    this._renderTargetBlurV3 = null;
    this._renderTargetComposite = null;
  }

  /**
   * Main render method
   * @param {THREE.WebGLRenderer} renderer 
   * @param {THREE.WebGLRenderTarget} writeBuffer 
   * @param {THREE.WebGLRenderTarget} readBuffer 
   * @param {number} deltaTime 
   * @param {boolean} maskActive 
   */
  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    // Ensure render targets are correct size
    this._ensureRenderTargets(renderer);
    
    // Update uniforms
    this._updateUniforms();
    
    // Get quality settings
    const blurPasses = this._qualitySettings.blurPasses;
    
    // 1. Extract bright areas
    renderer.setRenderTarget(this._renderTargetBright);
    renderer.clear();
    this._fsQuad.material = this._brightnessMaterial;
    this._brightnessMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    this._fsQuad.render(renderer);
    
    // 2. Downsample to mip level
    let blurInput = this._renderTargetBright;
    
    // If mipLevel > 0, we need to downsample first
    if (this._qualitySettings.mipLevel > 0) {
      // Simple downsample via bilinear filtering - just use the first blur pass at mip level
      renderer.setRenderTarget(this._renderTargetBlurH1);
      renderer.clear();
      this._fsQuad.material = this._blurHMaterial;
      this._blurHMaterial.uniforms.tDiffuse.value = blurInput.texture;
      this._blurHMaterial.uniforms.kernelSize.value = 1;
      this._blurHMaterial.uniforms.sigma.value = 0.5;
      this._blurHMaterial.uniforms.mipLevel.value = this._qualitySettings.mipLevel;
      this._blurHMaterial.uniforms.anamorphic.value = 0;
      this._fsQuad.render(renderer);
      
      blurInput = this._renderTargetBlurH1;
    }
    
    let currentH = this._renderTargetBlurH1;
    let currentV = this._renderTargetBlurV1;
    let nextH = this._renderTargetBlurH2;
    let nextV = this._renderTargetBlurV2;
    let nextH3 = this._renderTargetBlurH3;
    let nextV3 = this._renderTargetBlurV3;
    
    // 3. Multiple blur passes
    for (let pass = 0; pass < blurPasses; pass++) {
      // Select appropriate render targets for this pass
      let targetH, targetV, inputTexture;
      
      if (pass === 0) {
        targetH = this._renderTargetBlurH1;
        targetV = this._renderTargetBlurV1;
        inputTexture = blurInput.texture;
      } else if (pass === 1) {
        targetH = this._renderTargetBlurH2;
        targetV = this._renderTargetBlurV2;
        inputTexture = this._renderTargetBlurV1.texture;
      } else {
        targetH = this._renderTargetBlurH3;
        targetV = this._renderTargetBlurV3;
        inputTexture = this._renderTargetBlurV2.texture;
      }
      
      // Horizontal blur
      renderer.setRenderTarget(targetH);
      renderer.clear();
      this._fsQuad.material = this._blurHMaterial;
      this._blurHMaterial.uniforms.tDiffuse.value = inputTexture;
      this._blurHMaterial.uniforms.kernelSize.value = this._qualitySettings.kernelSize;
      this._blurHMaterial.uniforms.sigma.value = this.radius * 2.0;
      this._blurHMaterial.uniforms.mipLevel.value = this._qualitySettings.mipLevel;
      this._blurHMaterial.uniforms.anamorphic.value = this.anamorphic ? 1 : 0;
      this._fsQuad.render(renderer);
      
      // Vertical blur
      renderer.setRenderTarget(targetV);
      renderer.clear();
      this._fsQuad.material = this._blurVMaterial;
      if (pass === 0) {
        this._blurVMaterial.uniforms.tDiffuse.value = targetH.texture;
      } else if (pass === 1) {
        this._blurVMaterial.uniforms.tDiffuse.value = targetH.texture;
      } else {
        this._blurVMaterial.uniforms.tDiffuse.value = targetH.texture;
      }
      this._blurVMaterial.uniforms.kernelSize.value = this._qualitySettings.kernelSize;
      this._blurVMaterial.uniforms.sigma.value = this.radius * 2.0;
      this._blurVMaterial.uniforms.mipLevel.value = this._qualitySettings.mipLevel;
      this._blurVMaterial.uniforms.anamorphic.value = this.anamorphic ? 1 : 0;
      this._fsQuad.render(renderer);
    }
    
    // Determine final blur output
    let finalBlurTexture;
    if (blurPasses === 1) {
      finalBlurTexture = this._renderTargetBlurV1.texture;
    } else if (blurPasses === 2) {
      finalBlurTexture = this._renderTargetBlurV2.texture;
    } else {
      finalBlurTexture = this._renderTargetBlurV3.texture;
    }
    
    // 4. Composite with original
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
    }
    renderer.clear();
    
    this._fsQuad.material = this._compositeMaterial;
    this._compositeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    this._compositeMaterial.uniforms.tBloom.value = finalBlurTexture;
    this._fsQuad.render(renderer);
  }

  /**
   * Get or create copy material
   * @private
   */
  _getCopyMaterial() {
    if (!this._copyMaterial) {
      this._copyMaterial = new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(tDiffuse, vUv);
          }
        `
      });
    }
    return this._copyMaterial;
  }

  /**
   * Update shader uniforms
   * @private
   */
  _updateUniforms() {
    // Brightness
    this._brightnessMaterial.uniforms.threshold.value = this.threshold;
    this._brightnessMaterial.uniforms.thresholdFade.value = 0.01;
    
    // Blur
    this._blurHMaterial.uniforms.sigma.value = this.radius * 2.0;
    this._blurVMaterial.uniforms.sigma.value = this.radius * 2.0;
    
    // Composite
    this._compositeMaterial.uniforms.strength.value = this.strength;
    this._compositeMaterial.uniforms.radius.value = this.radius;
    this._compositeMaterial.uniforms.dirtIntensity.value = this.dirtIntensity;
    this._compositeMaterial.uniforms.colorWeight.value.copy(this.customColorWeight);
  }

  /**
   * Set quality preset
   * @param {string} quality - Quality preset
   */
  setQuality(quality) {
    if (this._qualityPresets[quality]) {
      this._currentQuality = quality;
      this._qualitySettings = this._qualityPresets[quality];
      
      // Update mip level for blur materials
      this._blurHMaterial.uniforms.mipLevel.value = this._qualitySettings.mipLevel;
      this._blurVMaterial.uniforms.mipLevel.value = this._qualitySettings.mipLevel;
      
      console.log('[BloomPass] Quality set to:', quality);
    }
  }

  /**
   * Set bloom parameters
   * @param {Object} params - Parameters
   */
  setParams(params) {
    if (params.strength !== undefined) this.strength = params.strength;
    if (params.radius !== undefined) this.radius = params.radius;
    if (params.threshold !== undefined) this.threshold = params.threshold;
    if (params.anamorphic !== undefined) this.anamorphic = params.anamorphic;
    if (params.dirtIntensity !== undefined) this.dirtIntensity = params.dirtIntensity;
    if (params.colorWeight !== undefined) this.customColorWeight.copy(params.colorWeight);
  }

  /**
   * Set resolution
   * @param {number} width 
   * @param {number} height 
   */
  setSize(width, height) {
    // Targets will be recreated on next render
    this._disposeRenderTargets();
  }

  /**
   * Set anamorphic bloom
   * @param {boolean} enabled 
   */
  setAnamorphic(enabled) {
    this.anamorphic = enabled;
  }

  /**
   * Set dirt texture
   * @param {THREE.Texture} texture 
   */
  setDirtTexture(texture) {
    this._dirtTexture = texture;
    this._compositeMaterial.uniforms.tDirt.value = texture;
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this._disposeRenderTargets();
    
    [this._brightnessMaterial, this._blurHMaterial, this._blurVMaterial, this._compositeMaterial, this._copyMaterial, this._dirtTexture]
      .forEach(obj => obj?.dispose?.());
    
    this._fsQuad?.dispose();
  }
}

export default BloomPass;