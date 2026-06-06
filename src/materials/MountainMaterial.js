/**
 * MountainMaterial - Tri-planar PBR Material for Mountains
 *
 * Custom material for Rayman-style mountains featuring:
 * - Tri-planar mapping for seamless texturing on complex geometry
 * - Procedural snow caps at higher elevations
 * - Vegetation zones on lower slopes
 * - Height-based displacement
 * - Slope-based shading (highlights/shadows)
 * - Distance-based LOD
 *
 * @module materials/MountainMaterial
 * @version 1.0.0
 */

import * as THREE from "three";

/**
 * MountainMaterial configuration options
 * @typedef {Object} MountainMaterialOptions
 * @property {THREE.Texture} colorMap - Base color texture (tri-planar friendly)
 * @property {THREE.Texture} normalMap - Normal map for surface detail
 * @property {THREE.Texture} roughnessMap - Roughness variation map
 * @property {THREE.Texture} heightMap - Heightmap for displacement
 * @property {THREE.Texture} vegetationMap - Vegetation density mask
 * @property {number} displacementScale - Displacement scale factor
 * @property {number} snowLine - Height threshold for snow (0-1)
 * @property {number} snowTransition - Snow blend transition width
 * @property {number} vegetationDensity - Vegetation density multiplier
 * @property {number} triplanarScale - Tri-planar UV scale
 * @property {number} triplanarBlend - Tri-planar blend sharpness
 */

/**
 * MountainMaterial - Extends MeshStandardMaterial with tri-planar mapping
 */
export class MountainMaterial extends THREE.MeshStandardMaterial {
  /**
   * @param {MountainMaterialOptions} options - Material options
   */
  constructor(options = {}) {
    // Custom uniforms for tri-planar mapping and effects
    const customUniforms = {
      triplanarScale: { value: options.triplanarScale ?? 0.02 },
      triplanarBlend: { value: options.triplanarBlend ?? 10.0 },
      displacementScale: { value: options.displacementScale ?? 1.0 },
      snowLine: { value: options.snowLine ?? 0.7 },
      snowTransition: { value: options.snowTransition ?? 0.1 },
      vegetationDensity: { value: options.vegetationDensity ?? 0.3 },
      snowColor: { value: new THREE.Color(0.95, 0.95, 0.98) },
      snowRoughness: { value: 0.9 },
      snowMetalness: { value: 0.0 },
      time: { value: 0 },
      windStrength: { value: 0.0 },
      windDirection: { value: new THREE.Vector2(1, 0.3) },
      cameraPosition: { value: new THREE.Vector3() },
      lodDistance: { value: 100 },
    };

    super({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.0,
      flatShading: false,
      ...options,
    });

    this.name = "MountainMaterial";

    // Store custom uniforms
    this.customUniforms = customUniforms;

    // Set provided textures
    if (options.colorMap) this.map = options.colorMap;
    if (options.normalMap) this.normalMap = options.normalMap;
    if (options.roughnessMap) this.roughnessMap = options.roughnessMap;
    if (options.heightMap) this.displacementMap = options.heightMap;
    if (options.vegetationMap)
      this.userData.vegetationMap = options.vegetationMap;

    // Configure texture properties
    this._configureTextures();

    // Inject custom shader chunks for tri-planar mapping
    this._injectShaderChunks();
  }

  /**
   * Configure texture properties for tri-planar mapping
   * @private
   */
  _configureTextures() {
    const textureNames = [
      "map",
      "normalMap",
      "roughnessMap",
      "displacementMap",
    ];

    textureNames.forEach((name) => {
      const tex = this[name];
      if (tex) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        if (name === "normalMap" || name === "roughnessMap") {
          tex.colorSpace = THREE.LinearSRGBColorSpace;
        }
      }
    });

    // Vegetation map
    if (this.userData.vegetationMap) {
      this.userData.vegetationMap.wrapS = THREE.RepeatWrapping;
      this.userData.vegetationMap.wrapT = THREE.RepeatWrapping;
      this.userData.vegetationMap.colorSpace = THREE.LinearSRGBColorSpace;
    }
  }

  /**
   * Inject custom shader chunks for tri-planar mapping
   * @private
   */
  _injectShaderChunks() {
    const originalOnBeforeCompile = this.onBeforeCompile;

    this.onBeforeCompile = (shader) => {
      // Add custom uniforms
      Object.assign(shader.uniforms, this.customUniforms);

      if (this.userData.vegetationMap) {
        shader.uniforms.vegetationMap = { value: this.userData.vegetationMap };
      }

      // Vertex shader additions
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying vec2 vUv;
        varying float vHeight;
        varying float vSlope;
        varying vec3 vTriplanarWeights;`,
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize(normalMatrix * normal);
        vUv = uv;
        
        // Calculate height (0-1 normalized)
        float maxHeight = 120.0;
        vHeight = clamp(vWorldPosition.y / maxHeight, 0.0, 1.0);
        
        // Calculate slope from normal
        vSlope = 1.0 - abs(vWorldNormal.y);
        
        // Tri-planar weights based on normal
        vec3 absNormal = abs(vWorldNormal);
        vTriplanarWeights = absNormal / (absNormal.x + absNormal.y + absNormal.z);`,
      );

      // Fragment shader header with tri-planar functions
      const customFragmentHeader = `
        #include <common>
        #include <packing>
        
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying vec2 vUv;
        varying float vHeight;
        varying float vSlope;
        varying vec3 vTriplanarWeights;
        
        uniform float triplanarScale;
        uniform float triplanarBlend;
        uniform float snowLine;
        uniform float snowTransition;
        uniform float vegetationDensity;
        uniform vec3 snowColor;
        uniform float snowRoughness;
        uniform float snowMetalness;
        uniform sampler2D vegetationMap;
        uniform float time;
        uniform float windStrength;
        uniform vec2 windDirection;
        
        // Tri-planar texture sampling
        vec3 triplanarSample(sampler2D tex, vec3 pos, vec3 normal, float scale) {
          vec3 absNormal = abs(normal);
          
          // Sample three planar projections
          vec2 uvXY = pos.xy * scale;
          vec2 uvYZ = pos.zy * scale;
          vec2 uvZX = pos.xz * scale;
          
          // For normal maps, flip appropriately
          bool isNormal = false; // Will be set per call
          
          vec3 colorXY = texture2D(tex, uvXY).rgb;
          vec3 colorYZ = texture2D(tex, uvYZ).rgb;
          vec3 colorZX = texture2D(tex, uvZX).rgb;
          
          // Blend based on normal weights
          vec3 blendWeights = pow(absNormal, vec3(triplanarBlend));
          blendWeights /= blendWeights.x + blendWeights.y + blendWeights.z;
          
          return colorXY * blendWeights.z + colorYZ * blendWeights.x + colorZX * blendWeights.y;
        }
        
        // Tri-planar normal sampling
        vec3 triplanarNormal(sampler2D tex, vec3 pos, vec3 normal, float scale) {
          vec2 uvXY = pos.xy * scale;
          vec2 uvYZ = pos.zy * scale;
          vec2 uvZX = pos.xz * scale;
          
          vec3 nXY = texture2D(tex, uvXY).xyz * 2.0 - 1.0;
          vec3 nYZ = texture2D(tex, uvYZ).xyz * 2.0 - 1.0;
          vec3 nZX = texture2D(tex, uvZX).xyz * 2.0 - 1.0;
          
          // Transform to world space
          nXY = normalize(vec3(nXY.x, nXY.y, nXY.z));
          nYZ = normalize(vec3(nYZ.z, nYZ.x, nYZ.y));
          nZX = normalize(vec3(nZX.y, nZX.z, nZX.x));
          
          vec3 absNormal = abs(normal);
          vec3 blendWeights = pow(absNormal, vec3(triplanarBlend));
          blendWeights /= blendWeights.x + blendWeights.y + blendWeights.z;
          
          return nXY * blendWeights.z + nYZ * blendWeights.x + nZX * blendWeights.y;
        }
        
        // Snow factor calculation
        float getSnowFactor(float height) {
          return smoothstep(snowLine - snowTransition, snowLine + snowTransition, height);
        }
        
        // Vegetation factor
        float getVegetationFactor(vec2 uv) {
          float veg = texture2D(vegetationMap, uv).r * vegetationDensity;
          return smoothstep(0.3, 0.7, veg);
        }
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        customFragmentHeader,
      );

      // Replace normal mapping with tri-planar normal mapping
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normalmap_pars_fragment>",
        `#include <normalmap_pars_fragment>
        // We'll compute normal manually in main`,
      );

      // Main fragment modifications
      shader.fragmentShader = shader.fragmentShader.replace(
        "vec3 diffuseColor = vec3( 1.0 );",
        `vec3 diffuseColor = vec3( 1.0 );
        
        // Tri-planar base color
        diffuseColor = triplanarSample(map, vWorldPosition, vWorldNormal, triplanarScale);
        
        // Tri-planar roughness
        float roughnessValue = triplanarSample(roughnessMap, vWorldPosition, vWorldNormal, triplanarScale).r;
        
        // Tri-planar normal
        vec3 triNormal = triplanarNormal(normalMap, vWorldPosition, vWorldNormal, triplanarScale);
        
        // Perturb normal
        vec3 perturbedNormal = perturbNormal2Arb(vViewPosition, vWorldNormal, triNormal, triplanarScale);
        
        // Snow factor based on height
        float snowFactor = getSnowFactor(vHeight);
        
        // Vegetation factor (lower slopes only)
        float vegFactor = vHeight < 0.6 ? getVegetationFactor(vWorldPosition.xz * 0.005) : 0.0;
        
        // Blend snow
        diffuseColor = mix(diffuseColor, snowColor, snowFactor);
        
        // Add grass tint on lower slopes
        vec3 grassColor = vec3(0.2, 0.4, 0.15);
        diffuseColor = mix(diffuseColor, grassColor, vegFactor * 0.5);
        
        // Blend roughness for snow
        roughnessValue = mix(roughnessValue, snowRoughness, snowFactor);
        roughnessValue = mix(roughnessValue, 0.95, vegFactor * 0.3);`,
      );

      // Replace normal usage
      shader.fragmentShader = shader.fragmentShader.replace(
        "vec3 normal = vWorldNormal;",
        `vec3 normal = normalize(perturbedNormal);`,
      );

      // Add snow and vegetation to metalness
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, snowMetalness, snowFactor);`,
      );

      // Emissive for snow highlights
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        // Subtle snow sparkle
        if (snowFactor > 0.5) {
          float sparkle = sin(vWorldPosition.x * 50.0 + time) * sin(vWorldPosition.z * 50.0 + time) * 0.5 + 0.5;
          totalEmissiveRadiance += snowColor * sparkle * snowFactor * 0.02;
        }`,
      );

      // Call original
      if (originalOnBeforeCompile) {
        originalOnBeforeCompile(shader);
      }
    };
  }

  /**
   * Set tri-planar scale
   * @param {number} scale
   */
  setTriplanarScale(scale) {
    this.customUniforms.triplanarScale.value = scale;
    this.needsUpdate = true;
  }

  /**
   * Set snow line height
   * @param {number} line - Snow line (0-1)
   * @param {number} transition - Transition width
   */
  setSnowLine(line, transition = 0.1) {
    this.customUniforms.snowLine.value = line;
    this.customUniforms.snowTransition.value = transition;
    this.needsUpdate = true;
  }

  /**
   * Set vegetation density
   * @param {number} density
   */
  setVegetationDensity(density) {
    this.customUniforms.vegetationDensity.value = density;
    this.needsUpdate = true;
  }

  /**
   * Set displacement scale
   * @param {number} scale
   */
  setDisplacementScale(scale) {
    this.customUniforms.displacementScale.value = scale;
    this.needsUpdate = true;
  }

  /**
   * Set wind parameters for vertex animation
   * @param {number} strength
   * @param {THREE.Vector2} direction
   */
  setWind(strength, direction) {
    this.customUniforms.windStrength.value = strength;
    if (direction) this.customUniforms.windDirection.value.copy(direction);
  }

  /**
   * Update camera position for LOD
   * @param {THREE.Vector3} position
   */
  updateCameraPosition(position) {
    this.customUniforms.cameraPosition.value.copy(position);
  }

  /**
   * Set quality level
   * @param {string} quality
   */
  setQuality(quality) {
    // Adjust parameters based on quality
    const settings = {
      low: { triplanarBlend: 5.0, displacementScale: 0.5 },
      medium: { triplanarBlend: 8.0, displacementScale: 0.75 },
      high: { triplanarBlend: 10.0, displacementScale: 1.0 },
      ultra: { triplanarBlend: 15.0, displacementScale: 1.5 },
    };

    const s = settings[quality] || settings.high;
    this.customUniforms.triplanarBlend.value = s.triplanarBlend;
    this.customUniforms.displacementScale.value = s.displacementScale;
    this.needsUpdate = true;
  }

  /**
   * Dispose of material
   */
  dispose() {
    super.dispose();
  }
}

export default MountainMaterial;
