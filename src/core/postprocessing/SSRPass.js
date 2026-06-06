/**
 * SSRPass - Screen Space Reflections Pass
 *
 * Implements screen-space reflections using ray-marching in view space.
 * Supports temporal accumulation for noise reduction.
 *
 * @module core/postprocessing/SSRPass
 * @version 1.0.0
 */

import * as THREE from "three";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";

/**
 * SSR Shader - Handles screen-space reflection calculation
 */
const SSRShader = {
  name: "SSRShader",
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    tDepth: { value: null },
    tMetalness: { value: null },
    tRoughness: { value: null },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 1000 },
    resolution: { value: new THREE.Vector2(1, 1) },
    projectionMatrix: { value: new THREE.Matrix4() },
    inverseProjectionMatrix: { value: new THREE.Matrix4() },
    cameraMatrixWorld: { value: new THREE.Matrix4() },
    thickness: { value: 0.06 },
    maxDistance: { value: 100 },
    samples: { value: 24 },
    binarySearchSteps: { value: 16 },
    fresnelBias: { value: 0.1 },
    fresnelPower: { value: 2.0 },
    fresnelScale: { value: 1.0 },
    temporal: { value: 0 },
    tPrevious: { value: null },
    jitter: { value: new THREE.Vector2(0, 0) },
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
    uniform sampler2D tMetalness;
    uniform sampler2D tRoughness;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform vec2 resolution;
    uniform mat4 projectionMatrix;
    uniform mat4 inverseProjectionMatrix;
    uniform mat4 cameraMatrixWorld;
    uniform float thickness;
    uniform float maxDistance;
    uniform int samples;
    uniform int binarySearchSteps;
    uniform float fresnelBias;
    uniform float fresnelPower;
    uniform float fresnelScale;
    uniform float temporal;
    uniform sampler2D tPrevious;
    uniform vec2 jitter;

    // Hash function for random noise
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    // Blue noise sampling pattern
    vec2 blueNoise(vec2 uv, float seed) {
      float r = hash(uv + seed);
      float angle = r * 6.28318530718;
      return vec2(cos(angle), sin(angle));
    }

    // Reconstruct view-space position from depth
    vec3 getViewPosition(vec2 uv, float depth) {
      vec4 clipSpace = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 viewSpace = inverseProjectionMatrix * clipSpace;
      return viewSpace.xyz / viewSpace.w;
    }

    // Get linear depth from depth buffer
    float getLinearDepth(vec2 uv) {
      float depth = texture2D(tDepth, uv).r;
      return cameraNear * cameraFar / (cameraFar - depth * (cameraFar - cameraNear));
    }

    // View-space normal from normal buffer
    vec3 getViewNormal(vec2 uv) {
      vec3 normal = texture2D(tNormal, uv).xyz * 2.0 - 1.0;
      return normalize(normal);
    }

    // Ray-march for screen-space reflections
    vec3 rayMarchSSR(vec3 viewPos, vec3 viewDir, float roughness) {
      float traceDistance = maxDistance;
      float stepSize = traceDistance / float(samples);
      float currentDistance = thickness;
      
      // Jittered starting position to reduce banding
      currentDistance += hash(vUv + temporal) * stepSize;
      
      vec3 currentPos = viewPos + viewDir * currentDistance;
      vec3 hitPos = vec3(0.0);
      bool hit = false;
      
      // Roughness affects step size - rougher surfaces need fewer steps
      float adaptiveStep = mix(1.0, 0.5, roughness);
      
      for (int i = 0; i < 64; i++) {
        if (i >= samples) break;
        
        // Project current position to screen space
        vec4 clipSpace = projectionMatrix * vec4(currentPos, 1.0);
        vec2 ndc = clipSpace.xy / clipSpace.w;
        vec2 uv = ndc * 0.5 + 0.5;
        
        // Check if we're still in screen bounds
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || clipSpace.w <= 0.0) {
          break;
        }
        
        // Get scene depth at this screen position
        float sceneDepth = getLinearDepth(uv);
        float currentDepth = -currentPos.z;
        
        // Check for intersection
        if (currentDepth >= sceneDepth - thickness) {
          hit = true;
          hitPos = currentPos;
          break;
        }
        
        currentDistance += stepSize * adaptiveStep;
        currentPos = viewPos + viewDir * currentDistance;
        
        // Early exit if too far
        if (currentDistance > traceDistance) break;
      }
      
      if (!hit) return vec3(0.0);
      
      // Binary search for precise intersection
      float low = currentDistance - stepSize;
      float high = currentDistance;
      
      for (int i = 0; i < 16; i++) {
        if (i >= binarySearchSteps) break;
        
        float mid = (low + high) * 0.5;
        vec3 midPos = viewPos + viewDir * mid;
        
        vec4 clipSpace = projectionMatrix * vec4(midPos, 1.0);
        vec2 ndc = clipSpace.xy / clipSpace.w;
        vec2 uv = ndc * 0.5 + 0.5;
        
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || clipSpace.w <= 0.0) {
          high = mid;
          continue;
        }
        
        float sceneDepth = getLinearDepth(uv);
        float currentDepth = -midPos.z;
        
        if (currentDepth >= sceneDepth) {
          high = mid;
          hitPos = midPos;
        } else {
          low = mid;
        }
      }
      
      // Project hit position to screen space for color sampling
      vec4 hitClip = projectionMatrix * vec4(hitPos, 1.0);
      vec2 hitNdc = hitClip.xy / hitClip.w;
      vec2 hitUv = hitNdc * 0.5 + 0.5;
      
      if (hitUv.x < 0.0 || hitUv.x > 1.0 || hitUv.y < 0.0 || hitUv.y > 1.0) {
        return vec3(0.0);
      }
      
      return texture2D(tDiffuse, hitUv).rgb;
    }

    // Fresnel term for reflection intensity
    float fresnel(vec3 viewDir, vec3 normal, float roughness) {
      float cosTheta = abs(dot(normalize(viewDir), normal));
      float f = fresnelBias + (1.0 - fresnelBias) * pow(1.0 - cosTheta, fresnelPower);
      return f * fresnelScale * (1.0 - roughness);
    }

    void main() {
      // Get scene data at current pixel
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      vec3 normal = getViewNormal(vUv);
      float depth = getLinearDepth(vUv);
      float metalness = texture2D(tMetalness, vUv).r;
      float roughness = texture2D(tRoughness, vUv).r;
      
      // Skip if not reflective enough
      float reflectivity = mix(0.04, 1.0, metalness) * (1.0 - roughness);
      if (reflectivity < 0.02) {
        gl_FragColor = vec4(color, 1.0);
        return;
      }
      
      // Reconstruct view-space position
      vec3 viewPos = getViewPosition(vUv, texture2D(tDepth, vUv).r);
      vec3 viewDir = normalize(viewPos);
      
      // Calculate reflection direction
      vec3 reflectDir = reflect(viewDir, normal);
      
      // SSR ray march
      vec3 ssrColor = rayMarchSSR(viewPos, reflectDir, roughness);
      
      // Fresnel term
      float fresnelTerm = fresnel(viewDir, normal, roughness);
      
      // Combine SSR with base color
      vec3 finalColor = mix(color, ssrColor, fresnelTerm * reflectivity);
      
      // Temporal accumulation
      if (temporal > 0.5) {
        vec3 prevColor = texture2D(tPrevious, vUv).rgb;
        finalColor = mix(prevColor, finalColor, 0.1);
      }
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};

/**
 * SSRPass class
 */
export class SSRPass extends Pass {
  /**
   * @param {Object} options - SSR options
   */
  constructor(options = {}) {
    super();

    this.name = "SSRPass";
    this.needsSwap = true;
    this.clear = false;
    this.renderToScreen = false;

    // Options
    this.renderer = options.renderer;
    this.scene = options.scene;
    this.camera = options.camera;
    this.width = options.width || 1920;
    this.height = options.height || 1080;
    this.thickness = options.thickness || 0.06;
    this.maxDistance = options.maxDistance || 100;
    this.samples = options.samples || 24;
    this.resolutionScale = options.resolutionScale || 1.0;

    // Internal state
    this._temporalFrame = 0;
    this._previousTexture = null;
    this._jitterIndex = 0;
    this._jitterOffsets = this._generateJitterOffsets(8);

    // Render targets
    this._normalDepthTarget = null;
    this._metalRoughTarget = null;
    this._ssrTarget = null;
    this._previousTarget = null;

    // Materials
    this._normalDepthMaterial = null;
    this._metalRoughMaterial = null;
    this._ssrMaterial = null;
    this._copyMaterial = null;

    // Mesh for full-screen quad
    this._fsQuad = new THREE.FullScreenQuad(null);

    this._init();
  }

  /**
   * Initialize render targets and materials
   * @private
   */
  _init() {
    const width = Math.floor(this.width * this.resolutionScale);
    const height = Math.floor(this.height * this.resolutionScale);

    // Normal + Depth render target (RGBA32F for precision)
    this._normalDepthTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this._normalDepthTarget.texture.name = "SSR.NormalDepth";

    // Metalness + Roughness render target
    this._metalRoughTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    this._metalRoughTarget.texture.name = "SSR.MetalRough";

    // SSR output target
    this._ssrTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.SRGBColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this._ssrTarget.texture.name = "SSR.Output";

    // Previous frame for temporal accumulation
    this._previousTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.SRGBColorSpace,
    });
    this._previousTarget.texture.name = "SSR.Previous";

    // Normal + Depth material - renders view-space normals and depth
    this._normalDepthMaterial = new THREE.ShaderMaterial({
      name: "SSR.NormalDepth",
      uniforms: {
        cameraNear: { value: this.camera.near },
        cameraFar: { value: this.camera.far },
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
          // Encode view-space normal in RGB
          vec3 normal = normalize(vViewNormal) * 0.5 + 0.5;
          // Encode linear depth in A
          float depth = -vViewPosition.z;
          float linearDepth = depth / cameraFar;
          gl_FragColor = vec4(normal, linearDepth);
        }
      `,
    });

    // Metalness + Roughness material
    this._metalRoughMaterial = new THREE.ShaderMaterial({
      name: "SSR.MetalRough",
      uniforms: {},
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          // This will be overridden by material properties
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        }
      `,
    });

    // SSR material using our custom shader
    this._ssrMaterial = new THREE.ShaderMaterial({
      name: "SSR",
      uniforms: THREE.UniformsUtils.clone(SSRShader.uniforms),
      vertexShader: SSRShader.vertexShader,
      fragmentShader: SSRShader.fragmentShader,
      defines: {
        MAX_SAMPLES: 64,
        BINARY_SEARCH_STEPS: 16,
      },
    });

    // Copy material for temporal accumulation
    this._copyMaterial = new THREE.ShaderMaterial({
      name: "SSR.Copy",
      uniforms: {
        tDiffuse: { value: null },
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
      `,
    });

    this._fsQuad.material = this._ssrMaterial;
  }

  /**
   * Generate jitter offsets for temporal anti-aliasing
   * @param {number} count - Number of offsets
   * @returns {THREE.Vector2[]}
   * @private
   */
  _generateJitterOffsets(count) {
    const offsets = [];
    for (let i = 0; i < count; i++) {
      // Halton sequence for better distribution
      const x = this._halton(i, 2) - 0.5;
      const y = this._halton(i, 3) - 0.5;
      offsets.push(new THREE.Vector2(x, y));
    }
    return offsets;
  }

  /**
   * Halton sequence generator
   * @param {number} index - Index
   * @param {number} base - Base
   * @returns {number}
   * @private
   */
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
   * Render the SSR pass
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.WebGLRenderTarget} writeBuffer
   * @param {THREE.WebGLRenderTarget} readBuffer
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

    // 1. Render normal + depth buffer
    this._renderNormalDepth(renderer);

    // 2. Render metalness + roughness buffer
    this._renderMetalRough(renderer);

    // 3. Render SSR
    this._renderSSR(renderer, readBuffer);

    // 4. Output to writeBuffer or screen
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
    }

    this._fsQuad.material = this._copyMaterial;
    this._copyMaterial.uniforms.tDiffuse.value = this._ssrTarget.texture;
    this._fsQuad.render(renderer);

    // Swap previous frame for temporal accumulation
    const temp = this._previousTarget;
    this._previousTarget = this._ssrTarget;
    this._ssrTarget = temp;
    this._temporalFrame++;
  }

  /**
   * Render normal + depth buffer
   * @private
   */
  _renderNormalDepth(renderer) {
    renderer.setRenderTarget(this._normalDepthTarget);
    renderer.clear();

    // Override materials for all meshes
    const originalMaterials = new Map();
    this.scene.traverse((object) => {
      if (object.isMesh && object.material) {
        originalMaterials.set(object, object.material);
        object.material = this._normalDepthMaterial;
      }
    });

    renderer.render(this.scene, this.camera);

    // Restore materials
    originalMaterials.forEach((material, object) => {
      object.material = material;
    });
  }

  /**
   * Render metalness + roughness buffer
   * @private
   */
  _renderMetalRough(renderer) {
    renderer.setRenderTarget(this._metalRoughTarget);
    renderer.clear();

    const originalMaterials = new Map();
    this.scene.traverse((object) => {
      if (object.isMesh && object.material) {
        originalMaterials.set(object, object.material);

        // Create a material that outputs metalness/roughness
        const mat = object.material;
        if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
          const mrMaterial = new THREE.ShaderMaterial({
            uniforms: {
              metalness: { value: mat.metalness },
              roughness: { value: mat.roughness },
              metalnessMap: { value: mat.metalnessMap },
              roughnessMap: { value: mat.roughnessMap },
            },
            vertexShader: `
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform float metalness;
              uniform float roughness;
              uniform sampler2D metalnessMap;
              uniform sampler2D roughnessMap;
              varying vec2 vUv;
              void main() {
                float m = metalness;
                float r = roughness;
                if (metalnessMap) m *= texture2D(metalnessMap, vUv).r;
                if (roughnessMap) r *= texture2D(roughnessMap, vUv).g;
                gl_FragColor = vec4(m, r, 0.0, 1.0);
              }
            `,
          });
          object.material = mrMaterial;
          originalMaterials.set(object, mat); // Store original for restoration
        }
      }
    });

    renderer.render(this.scene, this.camera);

    // Restore materials
    originalMaterials.forEach((material, object) => {
      object.material = material;
    });
  }

  /**
   * Render SSR effect
   * @private
   */
  _renderSSR(renderer, readBuffer) {
    renderer.setRenderTarget(this._ssrTarget);
    renderer.clear();

    const uniforms = this._ssrMaterial.uniforms;
    uniforms.tDiffuse.value = readBuffer.texture;
    uniforms.tNormal.value = this._normalDepthTarget.texture;
    uniforms.tDepth.value = this._normalDepthTarget.texture;
    uniforms.tMetalness.value = this._metalRoughTarget.texture;
    uniforms.tRoughness.value = this._metalRoughTarget.texture;
    uniforms.cameraNear.value = this.camera.near;
    uniforms.cameraFar.value = this.camera.far;
    uniforms.resolution.value.set(this.width, this.height);
    uniforms.projectionMatrix.value.copy(this.camera.projectionMatrix);
    uniforms.inverseProjectionMatrix.value.copy(
      this.camera.projectionMatrixInverse,
    );
    uniforms.cameraMatrixWorld.value.copy(this.camera.matrixWorld);
    uniforms.thickness.value = this.thickness;
    uniforms.maxDistance.value = this.maxDistance;
    uniforms.samples.value = this.samples;
    uniforms.temporal.value = this._temporalFrame > 1 ? 1.0 : 0.0;
    uniforms.tPrevious.value = this._previousTarget.texture;

    // Apply jitter for TAA
    const jitter =
      this._jitterOffsets[this._jitterIndex % this._jitterOffsets.length];
    uniforms.jitter.value.set(jitter.x / this.width, jitter.y / this.height);
    this._jitterIndex++;

    this._fsQuad.material = this._ssrMaterial;
    this._fsQuad.render(renderer);
  }

  /**
   * Update temporal state
   * @param {number} deltaTime - Delta time
   */
  update(deltaTime) {
    // Could update temporal accumulation weight here
  }

  /**
   * Handle resize
   * @param {number} width - New width
   * @param {number} height - New height
   */
  setSize(width, height) {
    this.width = width;
    this.height = height;

    const scaledWidth = Math.floor(width * this.resolutionScale);
    const scaledHeight = Math.floor(height * this.resolutionScale);

    const targets = [
      this._normalDepthTarget,
      this._metalRoughTarget,
      this._ssrTarget,
      this._previousTarget,
    ];
    targets.forEach((target) => {
      if (target) {
        target.setSize(scaledWidth, scaledHeight);
      }
    });
  }

  /**
   * Dispose of resources
   */
  dispose() {
    const targets = [
      this._normalDepthTarget,
      this._metalRoughTarget,
      this._ssrTarget,
      this._previousTarget,
    ];
    targets.forEach((target) => {
      if (target) target.dispose();
    });

    const materials = [
      this._normalDepthMaterial,
      this._metalRoughMaterial,
      this._ssrMaterial,
      this._copyMaterial,
    ];
    materials.forEach((mat) => {
      if (mat) mat.dispose();
    });

    if (this._fsQuad) {
      this._fsQuad.dispose();
    }
  }
}

export default SSRPass;
