/**
 * PBRMaterial - Base PBR Material with Wear/Scratches Support
 *
 * Extended MeshPhysicalMaterial with procedural wear system:
 * - Scratches that catch highlights
 * - Edge wear
 * - Dust/dirt accumulation
 * - Curvature-based ambient occlusion
 * - Custom clearcoat for layered materials
 *
 * @module materials/PBRMaterial
 * @version 1.0.0
 */

import * as THREE from "three";

/**
 * PBRMaterial configuration options
 * @typedef {Object} PBRMaterialOptions
 * @property {THREE.Texture} map - Base color
 * @property {THREE.Texture} normalMap - Normal map
 * @property {THREE.Texture} roughnessMap - Roughness
 * @property {THREE.Texture} metalnessMap - Metalness
 * @property {THREE.Texture} aoMap - Ambient occlusion
 * @property {THREE.Texture} wearMap - Procedural wear (R=wear, G=scratches, B=curvature, A=edge)
 * @property {THREE.Texture} clearcoatMap - Clearcoat mask
 * @property {number} wearIntensity - Global wear multiplier
 * @property {number} scratchIntensity - Scratch highlight multiplier
 * @property {number} edgeWearIntensity - Edge wear multiplier
 * @property {boolean} enableCurvatureAO - Enable curvature-based AO
 */

/**
 * PBRMaterial - Extended physical material with wear system
 */
export class PBRMaterial extends THREE.MeshPhysicalMaterial {
  /**
   * @param {PBRMaterialOptions} options - Material options
   */
  constructor(options = {}) {
    // Custom uniforms for wear system
    const customUniforms = {
      wearIntensity: { value: options.wearIntensity ?? 1.0 },
      scratchIntensity: { value: options.scratchIntensity ?? 1.0 },
      edgeWearIntensity: { value: options.edgeWearIntensity ?? 1.0 },
      curvatureAOIntensity: { value: options.enableCurvatureAO ? 1.0 : 0.0 },
      dustIntensity: { value: 0.1 },
      time: { value: 0 },
      scratchAnimation: { value: 0 },
    };

    super({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.0,
      clearcoat: 0.0,
      clearcoatRoughness: 0.2,
      ...options,
    });

    this.name = "PBRMaterial";

    // Store custom uniforms
    this.customUniforms = customUniforms;

    // Set provided textures
    if (options.map) this.map = options.map;
    if (options.normalMap) this.normalMap = options.normalMap;
    if (options.roughnessMap) this.roughnessMap = options.roughnessMap;
    if (options.metalnessMap) this.metalnessMap = options.metalnessMap;
    if (options.aoMap) this.aoMap = options.aoMap;
    if (options.clearcoatMap) this.clearcoatMap = options.clearcoatMap;
    if (options.wearMap) this.userData.wearMap = options.wearMap;

    // Configure textures
    this._configureTextures();

    // Inject wear shader chunks
    this._injectWearChunks();
  }

  /**
   * Configure texture properties
   * @private
   */
  _configureTextures() {
    const textureMap = {
      map: THREE.SRGBColorSpace,
      normalMap: THREE.LinearSRGBColorSpace,
      roughnessMap: THREE.LinearSRGBColorSpace,
      metalnessMap: THREE.LinearSRGBColorSpace,
      aoMap: THREE.LinearSRGBColorSpace,
      clearcoatMap: THREE.LinearSRGBColorSpace,
    };

    Object.entries(textureMap).forEach(([name, colorSpace]) => {
      const tex = this[name];
      if (tex) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = colorSpace;
      }
    });

    // Wear map
    if (this.userData.wearMap) {
      this.userData.wearMap.wrapS = THREE.RepeatWrapping;
      this.userData.wearMap.wrapT = THREE.RepeatWrapping;
      this.userData.wearMap.colorSpace = THREE.LinearSRGBColorSpace;
    }
  }

  /**
   * Inject wear/scratch shader chunks
   * @private
   */
  _injectWearChunks() {
    this.onBeforeCompile = (shader) => {
      // Add custom uniforms
      Object.assign(shader.uniforms, this.customUniforms);

      if (this.userData.wearMap) {
        shader.uniforms.wearMap = { value: this.userData.wearMap };
      }

      // Vertex: pass world position/normal and view direction
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying vec3 vViewPosition;`,
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize(normalMatrix * normal);
        vViewPosition = (viewMatrix * vec4(vWorldPosition, 1.0)).xyz;`,
      );

      // Fragment: wear system
      const wearFragmentHeader = `
        #include <common>
        #include <packing>
        
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying vec3 vViewPosition;
        
        uniform float wearIntensity;
        uniform float scratchIntensity;
        uniform float edgeWearIntensity;
        uniform float curvatureAOIntensity;
        uniform float dustIntensity;
        uniform float time;
        uniform float scratchAnimation;
        uniform sampler2D wearMap;
        
        // Calculate curvature (approximate)
        float getCurvature(vec3 normal) {
          // Approximate curvature from normal derivatives
          vec3 ddx = dFdx(normal);
          vec3 ddy = dFdy(normal);
          return length(ddx) + length(ddy);
        }
        
        // Wear data: R=wear, G=scratches, B=curvature, A=edge
        vec4 getWearData(vec2 uv) {
          return texture2D(wearMap, uv);
        }
        
        // Apply wear to base color
        vec3 applyWear(vec3 baseColor, vec2 uv, vec3 normal, vec3 viewDir) {
          vec4 wearData = getWearData(uv);
          
          float wear = wearData.r * wearIntensity;
          float scratches = wearData.g * scratchIntensity;
          float curvature = wearData.b * curvatureAOIntensity;
          float edge = wearData.a * edgeWearIntensity;
          
          // Base wear - darken and desaturate
          vec3 wornColor = baseColor * (1.0 - wear * 0.4);
          
          // Edge wear - additional darkening at edges
          wornColor *= (1.0 - edge * 0.3);
          
          // Curvature AO - darken crevices
          float curv = getCurvature(normal);
          wornColor *= (1.0 - curvature * curvatureAOIntensity * 0.2);
          
          // Dust accumulation in crevices
          float dustMask = smoothstep(0.0, 0.5, curvature) * (1.0 - wear);
          wornColor = mix(wornColor, vec3(0.3, 0.28, 0.25), dustMask * dustIntensity);
          
          return wornColor;
        }
        
        // Scratch highlights - anisotropic highlights along scratch direction
        vec3 getScratchHighlights(vec2 uv, vec3 normal, vec3 viewDir, vec3 lightDir) {
          vec4 wearData = getWearData(uv);
          float scratches = wearData.g;
          
          if (scratches < 0.01) return vec3(0.0);
          
          // Animate scratch highlights
          float anim = sin(time * 2.0 + uv.x * 100.0 + scratchAnimation) * 0.5 + 0.5;
          
          // Calculate highlight along scratch direction (approximated)
          vec3 h = normalize(viewDir + lightDir);
          float NdotH = max(dot(normal, h), 0.0);
          
          // Anisotropic-like scratch highlight
          float scratchHighlight = pow(NdotH, 200.0) * scratches * anim * 0.5;
          
          // Multiple scratch directions for variety
          float scratch1 = pow(max(dot(normal, normalize(viewDir + lightDir + vec3(0.1, 0, 0))), 0.0), 150.0);
          float scratch2 = pow(max(dot(normal, normalize(viewDir + lightDir + vec3(-0.1, 0, 0))), 0.0), 150.0);
          
          return vec3(scratchHighlight + scratch1 + scratch2) * 0.3;
        }
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        wearFragmentHeader,
      );

      // Apply wear to diffuse color
      shader.fragmentShader = shader.fragmentShader.replace(
        "vec3 diffuseColor = vec3( 1.0 );",
        `vec3 diffuseColor = vec3( 1.0 );
        diffuseColor = applyWear(diffuseColor, vUv, normal, normalize(-vViewPosition));`,
      );

      // Add scratch highlights to specular/clearcoat
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clearcoat_fragment>",
        `#include <clearcoat_fragment>
        // Add scratch highlights to clearcoat
        vec3 lightDir = normalize(directionalLights[0].direction);
        vec3 scratchHighlights = getScratchHighlights(vUv, normal, normalize(-vViewPosition), lightDir);
        clearcoatRadiance += scratchHighlights;`,
      );

      // Add wear to roughness (wear makes surface rougher)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        // Wear increases roughness
        vec4 wearData = getWearData(vUv);
        roughnessFactor = mix(roughnessFactor, min(1.0, roughnessFactor + wearData.r * 0.3), wearIntensity);`,
      );
    };
  }

  /**
   * Set wear intensity
   * @param {number} intensity
   */
  setWearIntensity(intensity) {
    this.customUniforms.wearIntensity.value = THREE.MathUtils.clamp(
      intensity,
      0,
      3,
    );
    this.needsUpdate = true;
  }

  /**
   * Set scratch intensity
   * @param {number} intensity
   */
  setScratchIntensity(intensity) {
    this.customUniforms.scratchIntensity.value = THREE.MathUtils.clamp(
      intensity,
      0,
      3,
    );
    this.needsUpdate = true;
  }

  /**
   * Set edge wear intensity
   * @param {number} intensity
   */
  setEdgeWearIntensity(intensity) {
    this.customUniforms.edgeWearIntensity.value = THREE.MathUtils.clamp(
      intensity,
      0,
      3,
    );
    this.needsUpdate = true;
  }

  /**
   * Enable/disable curvature AO
   * @param {boolean} enabled
   */
  setCurvatureAO(enabled) {
    this.customUniforms.curvatureAOIntensity.value = enabled ? 1.0 : 0.0;
    this.needsUpdate = true;
  }

  /**
   * Set dust intensity
   * @param {number} intensity
   */
  setDustIntensity(intensity) {
    this.customUniforms.dustIntensity.value = THREE.MathUtils.clamp(
      intensity,
      0,
      1,
    );
    this.needsUpdate = true;
  }

  /**
   * Update time for animation
   * @param {number} time
   */
  updateTime(time) {
    this.customUniforms.time.value = time;
    this.customUniforms.scratchAnimation.value = time * 0.5;
  }

  /**
   * Dispose
   */
  dispose() {
    super.dispose();
  }
}

export default PBRMaterial;
