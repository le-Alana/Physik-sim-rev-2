/**
 * GroundMaterial - Dancing Floor PBR Material with Animated Lights
 * 
 * Custom material for the dance floor featuring:
 * - Tile-based pattern with normal-mapped grooves
 * - Procedural wear and scratches
 * - Animated light textures (3D texture for frame animation)
 * - Clearcoat for glossy tile surface
 * - Strobe/beat-reactive effects
 * 
 * @module materials/GroundMaterial
 * @version 1.0.0
 */

import * as THREE from 'three';

/**
 * GroundMaterial configuration options
 * @typedef {Object} GroundMaterialOptions
 * @property {THREE.Texture} map - Base color/dance floor pattern texture
 * @property {THREE.Texture} normalMap - Normal map for tile grooves
 * @property {THREE.Texture} wearMap - Wear/scratch texture
 * @property {THREE.DataTexture3D} animatedLightsMap - 3D texture for animated lights
 * @property {number} roughness - Base roughness
 * @property {number} metalness - Base metalness
 * @property {number} clearcoat - Clearcoat intensity
 * @property {number} clearcoatRoughness - Clearcoat roughness
 * @property {number} envMapIntensity - Environment map intensity
 * @property {number} reflectivity - Surface reflectivity
 * @property {boolean} enableAnimatedLights - Enable animated light effects
 */

/**
 * GroundMaterial - Extends MeshPhysicalMaterial with custom shader chunks
 */
export class GroundMaterial extends THREE.MeshPhysicalMaterial {
  /**
   * @param {GroundMaterialOptions} options - Material options
   */
  constructor(options = {}) {
    // Default uniforms for custom effects
    const customUniforms = {
      time: { value: 0 },
      lightPhase: { value: 0 },
      strobeTrigger: { value: 0 },
      strobeIntensity: { value: 0 },
      wearIntensity: { value: 1.0 },
      animatedLightsEnabled: { value: 1.0 },
      animatedLightsSpeed: { value: 1.0 },
      animatedLightsIntensity: { value: 2.0 },
      tileScale: { value: 1.0 },
      grooveDepth: { value: 0.02 }
    };

    super({
      color: 0xffffff,
      roughness: options.roughness ?? 0.3,
      metalness: options.metalness ?? 0.1,
      clearcoat: options.clearcoat ?? 0.3,
      clearcoatRoughness: options.clearcoatRoughness ?? 0.2,
      envMapIntensity: options.envMapIntensity ?? 1.0,
      reflectivity: options.reflectivity ?? 0.5,
      transparent: false,
      depthWrite: true,
      side: THREE.FrontSide,
      ...options
    });

    this.name = 'GroundMaterial';

    // Store custom uniforms
    this.customUniforms = customUniforms;

    // Set provided textures
    if (options.map) this.map = options.map;
    if (options.normalMap) this.normalMap = options.normalMap;
    if (options.wearMap) this.wearMap = options.wearMap;
    if (options.animatedLightsMap) this.userData.animatedLightsMap = options.animatedLightsMap;

    // Configure texture properties
    this._configureTextures();

    // Inject custom shader chunks
    this._injectShaderChunks();

    // Enable animated lights
    this.setAnimatedLights(options.enableAnimatedLights ?? true);
  }

  /**
   * Configure texture properties
   * @private
   */
  _configureTextures() {
    const textures = [
      { tex: this.map, name: 'map' },
      { tex: this.normalMap, name: 'normalMap' },
      { tex: this.wearMap, name: 'wearMap' }
    ];

    textures.forEach(({ tex, name }) => {
      if (tex) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        if (name === 'normalMap') {
          tex.colorSpace = THREE.LinearSRGBColorSpace;
        } else if (name === 'wearMap') {
          tex.colorSpace = THREE.LinearSRGBColorSpace;
        }
      }
    });
  }

  /**
   * Inject custom shader chunks for wear, animated lights, and strobe effects
   * @private
   */
  _injectShaderChunks() {
    // Store original onBeforeCompile
    const originalOnBeforeCompile = this.onBeforeCompile;
    
    this.onBeforeCompile = (shader) => {
      // Add custom uniforms
      Object.assign(shader.uniforms, this.customUniforms);
      
      if (this.userData.animatedLightsMap) {
        shader.uniforms.animatedLightsMap = { value: this.userData.animatedLightsMap };
      }

      // Vertex shader: pass world position and normal
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying vec2 vUv;
        varying vec3 vViewPosition;`
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize(normalMatrix * normal);
        vUv = uv;
        vViewPosition = (viewMatrix * vec4(vWorldPosition, 1.0)).xyz;`
      );

      // Fragment shader: add custom logic before lighting
      const customFragmentHeader = `
        #include <common>
        #include <packing>
        
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        varying vec2 vUv;
        varying vec3 vViewPosition;
        
        uniform float time;
        uniform float lightPhase;
        uniform float strobeTrigger;
        uniform float strobeIntensity;
        uniform float wearIntensity;
        uniform float animatedLightsEnabled;
        uniform float animatedLightsSpeed;
        uniform float animatedLightsIntensity;
        uniform float tileScale;
        uniform float grooveDepth;
        
        uniform sampler2D wearMap;
        uniform sampler2D animatedLightsMap;
        
        // Hash function for noise
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        // Strobe effect
        float getStrobe() {
          float timeSinceStrobe = time - strobeTrigger;
          if (timeSinceStrobe < 0.0 || timeSinceStrobe > 0.15) return 0.0;
          float pulse = sin(timeSinceStrobe * 100.0) * 0.5 + 0.5;
          return pulse * strobeIntensity * exp(-timeSinceStrobe * 20.0);
        }
        
        // Animated lights sampling
        vec3 getAnimatedLights(vec2 uv) {
          if (animatedLightsEnabled < 0.5) return vec3(0.0);
          
          // Animate through 3D texture layers
          float frame = fract(time * animatedLightsSpeed * 0.5);
          float layer = frame * 63.0;
          float layer0 = floor(layer);
          float layer1 = ceil(layer);
          float blend = fract(layer);
          
          vec3 color0 = texture(animatedLightsMap, vec3(uv, layer0 / 63.0)).rgb;
          vec3 color1 = texture(animatedLightsMap, vec3(uv, layer1 / 63.0)).rgb;
          
          return mix(color0, color1, blend) * animatedLightsIntensity;
        }
        
        // Wear/scratch effect
        vec3 getWearColor(vec2 uv, vec3 baseColor) {
          vec4 wearData = texture2D(wearMap, uv);
          float wear = wearData.r * wearIntensity;
          float scratches = wearData.g * wearIntensity;
          
          // Darken for wear
          vec3 wornColor = baseColor * (1.0 - wear * 0.5);
          
          // Add scratch highlights (catch light)
          float scratchHighlight = scratches * max(dot(normalize(vViewPosition), vWorldNormal), 0.0) * 0.3;
          wornColor += vec3(scratchHighlight);
          
          return wornColor;
        }
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        customFragmentHeader
      );

      // Modify the base color calculation to include wear and animated lights
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 diffuseColor = vec3( 1.0 );',
        `vec3 diffuseColor = vec3( 1.0 );
         // Apply animated lights as emission
         vec3 animatedEmission = getAnimatedLights(vUv * tileScale);
         // Apply wear to base color
         diffuseColor = getWearColor(vUv * tileScale, diffuseColor);`
      );

      // Add emission from animated lights and strobe
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         // Add animated lights to emissive
         totalEmissiveRadiance += animatedEmission;
         // Add strobe effect
         float strobe = getStrobe();
         totalEmissiveRadiance += vec3(strobe) * 5.0;`
      );

      // Modify clearcoat for tile grooves
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clearcoat_fragment>',
        `#include <clearcoat_fragment>
         // Reduce clearcoat in grooves
         vec4 normalData = texture2D(normalMap, vUv * tileScale);
         float grooveFactor = 1.0 - normalData.a * 2.0;
         clearcoat *= grooveFactor;`
      );

      // Call original onBeforeCompile if exists
      if (originalOnBeforeCompile) {
        originalOnBeforeCompile(shader);
      }
    };
  }

  /**
   * Enable/disable animated lights
   * @param {boolean} enabled 
   */
  setAnimatedLights(enabled) {
    this.customUniforms.animatedLightsEnabled.value = enabled ? 1.0 : 0.0;
    this.needsUpdate = true;
  }

  /**
   * Set wear intensity
   * @param {number} intensity - Wear intensity (0-1)
   */
  setWearIntensity(intensity) {
    this.customUniforms.wearIntensity.value = THREE.MathUtils.clamp(intensity, 0, 2);
    this.needsUpdate = true;
  }

  /**
   * Set animated lights speed
   * @param {number} speed - Animation speed multiplier
   */
  setAnimatedLightsSpeed(speed) {
    this.customUniforms.animatedLightsSpeed.value = speed;
  }

  /**
   * Set animated lights intensity
   * @param {number} intensity - Light intensity multiplier
   */
  setAnimatedLightsIntensity(intensity) {
    this.customUniforms.animatedLightsIntensity.value = intensity;
  }

  /**
   * Trigger strobe/beat effect
   * @param {number} time - Current time
   * @param {number} intensity - Strobe intensity
   */
  triggerStrobe(time, intensity = 1.0) {
    this.customUniforms.strobeTrigger.value = time;
    this.customUniforms.strobeIntensity.value = intensity;
  }

  /**
   * Set tile scale
   * @param {number} scale - UV scale multiplier
   */
  setTileScale(scale) {
    this.customUniforms.tileScale.value = scale;
    if (this.map) this.map.repeat.set(scale, scale);
    if (this.normalMap) this.normalMap.repeat.set(scale, scale);
    if (this.wearMap) this.wearMap.repeat.set(scale, scale);
  }

  /**
   * Dispose of material resources
   */
  dispose() {
    super.dispose();
    // Custom uniforms don't need special disposal
  }
}

export default GroundMaterial;