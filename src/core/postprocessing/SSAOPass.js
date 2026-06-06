/**
 * SSAOPass - Screen Space Ambient Occlusion Pass
 * 
 * Implements SSAO using a multi-scale approach with temporal filtering
 * for high-quality ambient occlusion at reasonable performance.
 * 
 * @module core/postprocessing/SSAOPass
 * @version 1.0.0
 */

import * as THREE from 'three';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * SSAO Shader - Multi-scale ambient occlusion
 */
const SSAOShader = {
  name: 'SSAOShader',
  uniforms: {
    'tDiffuse': { value: null },
    'tNormal': { value: null },
    'tDepth': { value: null },
    'tNoise': { value: null },
    'cameraNear': { value: 0.1 },
    'cameraFar': { value: 1000 },
    'resolution': { value: new THREE.Vector2(1, 1) },
    'inverseProjectionMatrix': { value: new THREE.Matrix4() },
    'kernelRadius': { value: 1.0 },
    'intensity': { value: 1.0 },
    'bias': { value: 0.025 },
    'samples': { value: 16 },
    'radiusScale': { value: 1.0 },
    'distanceFalloff': { value: 1.0 },
    'temporal': { value: 0 },
    'tPrevious': { value: null },
    'jitter': { value: new THREE.Vector2(0, 0) }
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
    #include <packing>

    varying vec2 vUv;
    
    uniform sampler2D tDiffuse;
    uniform sampler2D tNormal;
    uniform sampler2D tDepth;
    uniform sampler2D tNoise;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform vec2 resolution;
    uniform mat4 inverseProjectionMatrix;
    uniform float kernelRadius;
    uniform float intensity;
    uniform float bias;
    uniform int samples;
    uniform float radiusScale;
    uniform float distanceFalloff;
    uniform float temporal;
    uniform sampler2D tPrevious;
    uniform vec2 jitter;

    // Reconstruct view-space position from depth
    vec3 getViewPosition(vec2 uv, float depth) {
      vec4 clipSpace = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 viewSpace = inverseProjectionMatrix * clipSpace;
      return viewSpace.xyz / viewSpace.w;
    }

    // Get linear depth
    float getLinearDepth(vec2 uv) {
      float depth = texture2D(tDepth, uv).r;
      return cameraNear * cameraFar / (cameraFar - depth * (cameraFar - cameraNear));
    }

    // Get view-space normal
    vec3 getViewNormal(vec2 uv) {
      vec3 normal = texture2D(tNormal, uv).xyz * 2.0 - 1.0;
      return normalize(normal);
    }

    // Random rotation for kernel
    mat3 getRotationMatrix(vec2 uv) {
      vec3 normal = getViewNormal(uv);
      vec3 tangent = normalize(vec3(normal.z, 0.0, -normal.x));
      vec3 bitangent = cross(normal, tangent);
      return mat3(tangent, bitangent, normal);
    }

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      vec3 normal = getViewNormal(vUv);
      float depth = getLinearDepth(vUv);
      vec3 viewPos = getViewPosition(vUv, texture2D(tDepth, vUv).r);

      // Skip if background (infinite depth)
      if (depth >= cameraFar * 0.99) {
        gl_FragColor = vec4(color, 1.0);
        return;
      }

      // Get random rotation from noise texture
      vec2 noiseUv = vUv * resolution / 4.0;
      vec3 randVec = texture2D(tNoise, noiseUv).xyz * 2.0 - 1.0;
      randVec = normalize(randVec);

      // Build TBN matrix
      mat3 tbn = getRotationMatrix(vUv);

      // SSAO kernel sampling
      float occlusion = 0.0;
      float kernelSize = float(samples);
      
      // Generate kernel samples dynamically
      for (int i = 0; i < 64; i++) {
        if (i >= samples) break;
        
        // Deterministic kernel generation using hash
        float sampleIndex = float(i) + jitter.x * 100.0;
        float theta = 6.28318530718 * fract(sin(sampleIndex * 12.9898) * 43758.5453);
        float phi = acos(1.0 - 2.0 * fract(sin(sampleIndex * 78.233) * 43758.5453));
        float radius = kernelRadius * fract(sin(sampleIndex * 45.164) * 43758.5453);
        
        // Importance sampling - more samples near center
        radius = radius * radius;
        
        vec3 sampleDir = vec3(
          sin(phi) * cos(theta),
          sin(phi) * sin(theta),
          cos(phi)
        );
        
        // Rotate to view space
        sampleDir = tbn * sampleDir;
        
        // Scale by depth for perspective correction
        float currentRadius = radius * radiusScale;
        float sampleDepth = depth + currentRadius * 0.5;
        vec3 samplePos = viewPos + sampleDir * currentRadius;
        
        // Project sample to screen space
        vec4 sampleClip = projectionMatrix * vec4(samplePos, 1.0);
        vec2 sampleNdc = sampleClip.xy / sampleClip.w;
        vec2 sampleUv = sampleNdc * 0.5 + 0.5;
        
        if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0 || sampleClip.w <= 0.0) {
          continue;
        }
        
        // Get scene depth at sample position
        float sceneDepth = getLinearDepth(sampleUv);
        
        // Check if sample is occluded
        float rangeCheck = smoothstep(0.0, 1.0, radius / kernelRadius);
        float depthDiff = sceneDepth - sampleDepth;
        float occluded = step(bias, depthDiff) * (1.0 - smoothstep(0.0, currentRadius, abs(depthDiff)));
        
        occlusion += occluded * rangeCheck;
      }

      occlusion = 1.0 - (occlusion / kernelSize);
      occlusion = pow(occlusion, 2.0); // Power for contrast

      // Distance falloff
      float distFalloff = smoothstep(cameraNear, cameraFar * distanceFalloff, depth);
      occlusion = mix(1.0, occlusion, distFalloff);

      // Apply intensity
      occlusion = mix(1.0, occlusion, intensity);

      // Temporal accumulation
      if (temporal > 0.5) {
        float prevOcclusion = texture2D(tPrevious, vUv).r;
        occlusion = mix(prevOcclusion, occlusion, 0.15);
      }

      // Apply AO to color
      vec3 finalColor = color * occlusion;

      gl_FragColor = vec4(finalColor, occlusion);
    }
  `
};

/**
 * SSAO Blur Shader - Bilateral blur for noise reduction
 */
const SSAOBlurShader = {
  name: 'SSAOBlurShader',
  uniforms: {
    'tDiffuse': { value: null },
    'tNormal': { value: null },
    'tDepth': { value: null },
    'resolution': { value: new THREE.Vector2(1, 1) },
    'cameraNear': { value: 0.1 },
    'cameraFar': { value: 1000 },
    'inverseProjectionMatrix': { value: new THREE.Matrix4() },
    'kernelRadius': { value: 4.0 },
    'direction': { value: new THREE.Vector2(1, 0) },
    'sharpness': { value: 8.0 }
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
    #include <packing>

    varying vec2 vUv;
    
    uniform sampler2D tDiffuse;
    uniform sampler2D tNormal;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform mat4 inverseProjectionMatrix;
    uniform float kernelRadius;
    uniform vec2 direction;
    uniform float sharpness;

    float getLinearDepth(vec2 uv) {
      float depth = texture2D(tDepth, uv).r;
      return cameraNear * cameraFar / (cameraFar - depth * (cameraFar - cameraNear));
    }

    vec3 getViewNormal(vec2 uv) {
      vec3 normal = texture2D(tNormal, uv).xyz * 2.0 - 1.0;
      return normalize(normal);
    }

    vec3 getViewPosition(vec2 uv, float depth) {
      vec4 clipSpace = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 viewSpace = inverseProjectionMatrix * clipSpace;
      return viewSpace.xyz / viewSpace.w;
    }

    // Bilateral weight calculation
    float bilateralWeight(vec2 centerUv, vec2 sampleUv, float centerDepth, float sampleDepth, vec3 centerNormal, vec3 sampleNormal) {
      // Spatial weight (Gaussian)
      vec2 delta = centerUv - sampleUv;
      float spatialDist = length(delta * resolution);
      float spatialWeight = exp(-spatialDist * spatialDist / (2.0 * kernelRadius * kernelRadius));

      // Depth weight
      float depthDiff = abs(centerDepth - sampleDepth);
      float depthWeight = exp(-depthDiff * sharpness);

      // Normal weight
      float normalDiff = 1.0 - dot(centerNormal, sampleNormal);
      float normalWeight = exp(-normalDiff * sharpness);

      return spatialWeight * depthWeight * normalWeight;
    }

    void main() {
      float centerDepth = getLinearDepth(vUv);
      vec3 centerNormal = getViewNormal(vUv);
      float centerAO = texture2D(tDiffuse, vUv).a;

      float aoSum = 0.0;
      float weightSum = 0.0;

      // 5-tap bilateral blur
      const int numTaps = 5;
      const float taps[numTaps] = float[]( -2.0, -1.0, 0.0, 1.0, 2.0 );

      for (int i = 0; i < numTaps; i++) {
        vec2 sampleUv = vUv + direction * taps[i] / resolution;
        
        if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) {
          continue;
        }

        float sampleDepth = getLinearDepth(sampleUv);
        vec3 sampleNormal = getViewNormal(sampleUv);
        float sampleAO = texture2D(tDiffuse, sampleUv).a;

        float weight = bilateralWeight(vUv, sampleUv, centerDepth, sampleDepth, centerNormal, sampleNormal);
        
        aoSum += sampleAO * weight;
        weightSum += weight;
      }

      float finalAO = weightSum > 0.0 ? aoSum / weightSum : centerAO;
      gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, finalAO);
    }
  `
};

/**
 * SSAOPass class
 */
export class SSAOPass extends Pass {
  /**
   * @param {THREE.Scene} scene - Scene to render
   * @param {THREE.Camera} camera - Camera
   * @param {number} width - Width
   * @param {number} height - Height
   */
  constructor(scene, camera, width, height) {
    super();

    this.name = 'SSAOPass';
    this.needsSwap = true;
    this.clear = false;
    this.renderToScreen = false;

    this.scene = scene;
    this.camera = camera;
    this.width = width;
    this.height = height;

    // Settings
    this.kernelRadius = 1.0;
    this.intensity = 1.0;
    this.bias = 0.025;
    this.samples = 16;
    this.distanceFalloff = 1.0;

    // Internal
    this._temporalFrame = 0;
    this._jitterIndex = 0;
    this._jitterOffsets = this._generateJitterOffsets(8);

    // Render targets
    this._normalDepthTarget = null;
    this._ssaoTarget = null;
    this._blurTarget = null;
    this._previousTarget = null;

    // Materials
    this._normalDepthMaterial = null;
    this._ssaoMaterial = null;
    this._blurHMaterial = null;
    this._blurVMaterial = null;
    this._copyMaterial = null;

    // Full-screen quad
    this._fsQuad = new THREE.FullScreenQuad(null);

    // Noise texture for SSAO
    this._noiseTexture = this._createNoiseTexture();

    this._init();
  }

  /**
   * Initialize render targets and materials
   * @private
   */
  _init() {
    // Normal + Depth target
    this._normalDepthTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true
    });
    this._normalDepthTarget.texture.name = 'SSAO.NormalDepth';

    // SSAO target
    this._ssaoTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });
    this._ssaoTarget.texture.name = 'SSAO.Output';

    // Blur target
    this._blurTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });
    this._blurTarget.texture.name = 'SSAO.Blur';

    // Previous frame for temporal
    this._previousTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat
    });
    this._previousTarget.texture.name = 'SSAO.Previous';

    // Normal + Depth material
    this._normalDepthMaterial = new THREE.ShaderMaterial({
      name: 'SSAO.NormalDepth',
      uniforms: {
        cameraNear: { value: this.camera.near },
        cameraFar: { value: this.camera.far }
      },
      vertexShader: `
        varying vec3 vViewPosition;
        varying vec3 vViewNormal;
        void main() {
          vViewPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          vViewNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        #include <packing>
        varying vec3 vViewPosition;
        varying vec3 vViewNormal;
        uniform float cameraNear;
        uniform float cameraFar;
        void main() {
          vec3 normal = normalize(vViewNormal) * 0.5 + 0.5;
          float depth = -vViewPosition.z;
          float linearDepth = depth / cameraFar;
          gl_FragColor = vec4(normal, linearDepth);
        }
      `
    });

    // SSAO material
    this._ssaoMaterial = new THREE.ShaderMaterial({
      name: 'SSAO',
      uniforms: THREE.UniformsUtils.clone(SSAOShader.uniforms),
      vertexShader: SSAOShader.vertexShader,
      fragmentShader: SSAOShader.fragmentShader,
      defines: {
        MAX_SAMPLES: 64
      }
    });

    // Horizontal blur
    this._blurHMaterial = new THREE.ShaderMaterial({
      name: 'SSAO.BlurH',
      uniforms: THREE.UniformsUtils.clone(SSAOBlurShader.uniforms),
      vertexShader: SSAOBlurShader.vertexShader,
      fragmentShader: SSAOBlurShader.fragmentShader
    });
    this._blurHMaterial.uniforms.direction.value.set(1.0, 0.0);

    // Vertical blur
    this._blurVMaterial = new THREE.ShaderMaterial({
      name: 'SSAO.BlurV',
      uniforms: THREE.UniformsUtils.clone(SSAOBlurShader.uniforms),
      vertexShader: SSAOBlurShader.vertexShader,
      fragmentShader: SSAOBlurShader.fragmentShader
    });
    this._blurVMaterial.uniforms.direction.value.set(0.0, 1.0);

    // Copy material
    this._copyMaterial = new THREE.ShaderMaterial({
      name: 'SSAO.Copy',
      uniforms: {
        tDiffuse: { value: null }
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
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(tDiffuse, vUv);
        }
      `
    });

    this._fsQuad.material = this._ssaoMaterial;
  }

  /**
   * Create 4x4 noise texture for SSAO
   * @returns {THREE.DataTexture}
   * @private
   */
  _createNoiseTexture() {
    const size = 4;
    const data = new Float32Array(size * size * 3);
    
    for (let i = 0; i < size * size; i++) {
      // Random vectors in hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2.0 * Math.random() - 1.0);
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      
      data[i * 3] = x;
      data[i * 3 + 1] = y;
      data[i * 3 + 2] = z;
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBFormat, THREE.FloatType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    texture.name = 'SSAO.Noise';
    return texture;
  }

  /**
   * Generate jitter offsets
   * @private
   */
  _generateJitterOffsets(count) {
    const offsets = [];
    for (let i = 0; i < count; i++) {
      const x = this._halton(i, 2) - 0.5;
      const y = this._halton(i, 3) - 0.5;
      offsets.push(new THREE.Vector2(x, y));
    }
    return offsets;
  }

  _halton(index, base) {
    let result = 0;
    let f = 1 / base;
    let i = index + 1;
    while (i > 0) {
      result += f * (i % base);
      i = Math.floor(i / base);
      f /= base;
    }
    return result;
  }

  /**
   * Render SSAO pass
   */
  render(renderer, writeBuffer, readBuffer) {
    if (!this.enabled) {
      if (this.renderToScreen) {
        renderer.setRenderTarget(null);
        this._fsQuad.material = this._copyMaterial;
        this._copyMaterial.uniforms.tDiffuse.value = readBuffer.texture;
        this._fsQuad.render(renderer);
      }
      return;
    }

    // 1. Render normal + depth
    this._renderNormalDepth(renderer);

    // 2. Render SSAO
    this._renderSSAO(renderer, readBuffer);

    // 3. Horizontal blur
    this._renderBlur(renderer, this._blurHMaterial, this._ssaoTarget, this._blurTarget);

    // 4. Vertical blur
    this._renderBlur(renderer, this._blurVMaterial, this._blurTarget, this._ssaoTarget);

    // 5. Composite with original
    this._composite(renderer, writeBuffer, readBuffer);

    // Temporal frame swap
    const temp = this._previousTarget;
    this._previousTarget = this._ssaoTarget;
    this._ssaoTarget = temp;
    this._temporalFrame++;
  }

  _renderNormalDepth(renderer) {
    renderer.setRenderTarget(this._normalDepthTarget);
    renderer.clear();

    const originalMaterials = new Map();
    this.scene.traverse((object) => {
      if (object.isMesh && object.material) {
        originalMaterials.set(object, object.material);
        object.material = this._normalDepthMaterial;
      }
    });

    renderer.render(this.scene, this.camera);

    originalMaterials.forEach((material, object) => {
      object.material = material;
    });
  }

  _renderSSAO(renderer, readBuffer) {
    renderer.setRenderTarget(this._ssaoTarget);
    renderer.clear();

    const uniforms = this._ssaoMaterial.uniforms;
    uniforms.tDiffuse.value = readBuffer.texture;
    uniforms.tNormal.value = this._normalDepthTarget.texture;
    uniforms.tDepth.value = this._normalDepthTarget.texture;
    uniforms.tNoise.value = this._noiseTexture;
    uniforms.cameraNear.value = this.camera.near;
    uniforms.cameraFar.value = this.camera.far;
    uniforms.resolution.value.set(this.width, this.height);
    uniforms.inverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);
    uniforms.kernelRadius.value = this.kernelRadius;
    uniforms.intensity.value = this.intensity;
    uniforms.bias.value = this.bias;
    uniforms.samples.value = this.samples;
    uniforms.distanceFalloff.value = this.distanceFalloff;
    uniforms.temporal.value = this._temporalFrame > 1 ? 1.0 : 0.0;
    uniforms.tPrevious.value = this._previousTarget.texture;

    // Jitter
    const jitter = this._jitterOffsets[this._jitterIndex % this._jitterOffsets.length];
    uniforms.jitter.value.set(jitter.x / this.width, jitter.y / this.height);
    this._jitterIndex++;

    this._fsQuad.material = this._ssaoMaterial;
    this._fsQuad.render(renderer);
  }

  _renderBlur(renderer, material, inputTarget, outputTarget) {
    renderer.setRenderTarget(outputTarget);
    renderer.clear();

    material.uniforms.tDiffuse.value = inputTarget.texture;
    material.uniforms.tNormal.value = this._normalDepthTarget.texture;
    material.uniforms.tDepth.value = this._normalDepthTarget.texture;
    material.uniforms.resolution.value.set(this.width, this.height);
    material.uniforms.cameraNear.value = this.camera.near;
    material.uniforms.cameraFar.value = this.camera.far;
    material.uniforms.inverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);
    material.uniforms.kernelRadius.value = this.kernelRadius * 2.0;

    this._fsQuad.material = material;
    this._fsQuad.render(renderer);
  }

  _composite(renderer, writeBuffer, readBuffer) {
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
    }

    // Composite: multiply AO with scene color
    const compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: readBuffer.texture },
        tAO: { value: this._ssaoTarget.texture }
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
        uniform sampler2D tAO;
        varying vec2 vUv;
        void main() {
          vec3 color = texture2D(tDiffuse, vUv).rgb;
          float ao = texture2D(tAO, vUv).a;
          gl_FragColor = vec4(color * ao, 1.0);
        }
      `
    });

    this._fsQuad.material = compositeMaterial;
    this._fsQuad.render(renderer);
    compositeMaterial.dispose();
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;

    const targets = [this._normalDepthTarget, this._ssaoTarget, this._blurTarget, this._previousTarget];
    targets.forEach(target => {
      if (target) target.setSize(width, height);
    });
  }

  dispose() {
    const targets = [this._normalDepthTarget, this._ssaoTarget, this._blurTarget, this._previousTarget];
    targets.forEach(target => target?.dispose());

    const materials = [this._normalDepthMaterial, this._ssaoMaterial, this._blurHMaterial, this._blurVMaterial, this._copyMaterial];
    materials.forEach(mat => mat?.dispose());

    this._noiseTexture?.dispose();
    this._fsQuad?.dispose();
  }
}

export default SSAOPass;