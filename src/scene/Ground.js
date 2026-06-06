/**
 * Ground - Dancing Floor with Animated Lights
 *
 * Creates a stylized dance floor with:
 * - Tile-based pattern with grooves
 * - Animated light effects
 * - PBR materials with wear/scratches
 * - Reflective surface
 *
 * @module scene/Ground
 * @version 1.0.0
 */

import * as THREE from "three";
import { ProceduralTextures } from "../utils/ProceduralTextures.js";
import { GroundMaterial } from "../materials/GroundMaterial.js";

/**
 * Ground configuration options
 * @typedef {Object} GroundOptions
 * @property {number} size - Ground plane size
 * @property {string} quality - Quality preset
 * @property {boolean} enableAnimatedLights - Enable animated lights
 * @property {number} tileSize - Size of each tile
 * @property {number} grooveWidth - Width of grooves between tiles
 * @property {number} segments - Geometry segments
 */

/**
 * Ground class for the dancing floor
 */
export class Ground {
  /**
   * @param {GroundOptions} options - Ground options
   */
  constructor(options = {}) {
    this.options = {
      size: 200,
      quality: "high",
      enableAnimatedLights: true,
      tileSize: 8,
      grooveWidth: 0.3,
      segments: 100,
      ...options,
    };

    /** @type {THREE.Mesh} */
    this.mesh = null;
    /** @type {GroundMaterial} */
    this.material = null;
    /** @type {THREE.DataTexture3D} */
    this.animatedLightsTexture = null;

    /** @type {Object} */
    this._animationState = {
      time: 0,
      lightPhase: 0,
      strobeActive: false,
      beatTime: 0,
    };

    /** @type {THREE.Object3D[]} */
    this._lightObjects = [];
    /** @type {THREE.PointLight[]} */
    this._pointLights = [];
  }

  /**
   * Build the ground mesh
   * @returns {Promise<void>}
   */
  async build() {
    console.log("[Ground] Building dancing floor...");

    // Generate procedural textures
    this._generateTextures();

    // Create material
    this._createMaterial();

    // Create geometry
    const geometry = this._createGeometry();

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = "DanceFloor";
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;

    // Add animated point lights if enabled
    if (this.options.enableAnimatedLights) {
      this._createAnimatedLights();
    }

    console.log("[Ground] Dancing floor built successfully");
  }

  /**
   * Generate procedural textures
   * @private
   */
  _generateTextures() {
    const size = this._getTextureSize();

    // Main dance floor pattern texture
    this.danceFloorTexture = ProceduralTextures.generateDanceFloor(size, {
      tileSize: Math.floor((size * this.options.tileSize) / this.options.size),
      grooveWidth: Math.max(
        1,
        Math.floor((size * this.options.grooveWidth) / this.options.size),
      ),
      tileColor1: [0.12, 0.12, 0.18],
      tileColor2: [0.08, 0.08, 0.12],
      grooveColor: [0.03, 0.03, 0.06],
      reflectivity: 0.4,
    });

    // Wear/scratch texture
    this.wearTexture = ProceduralTextures.generateWear(512, {
      scratchCount: 300,
      scratchWidth: 0.0015,
      scratchLength: 0.4,
      dustDensity: 0.03,
      edgeWear: 0.4,
    });

    // Animated lights texture (3D for animation)
    if (this.options.enableAnimatedLights) {
      this.animatedLightsTexture = ProceduralTextures.generateAnimatedLights(
        128,
        64,
      );
    }

    // Normal map for tile grooves
    this.normalTexture = this._generateNormalMap(size);
  }

  /**
   * Get texture size based on quality
   * @private
   */
  _getTextureSize() {
    const sizes = { low: 256, medium: 512, high: 1024, ultra: 2048 };
    return sizes[this.options.quality] || 1024;
  }

  /**
   * Generate normal map for tile grooves
   * @private
   */
  _generateNormalMap(size) {
    const data = new Float32Array(size * size * 4);
    const tilePixels = Math.floor(
      (size * this.options.tileSize) / this.options.size,
    );
    const groovePixels = Math.max(
      1,
      Math.floor((size * this.options.grooveWidth) / this.options.size),
    );

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const inTileX = x % tilePixels;
        const inTileY = y % tilePixels;

        const inGrooveX =
          inTileX < groovePixels || inTileX >= tilePixels - groovePixels;
        const inGrooveY =
          inTileY < groovePixels || inTileY >= tilePixels - groovePixels;

        const idx = (y * size + x) * 4;

        if (inGrooveX || inGrooveY) {
          // Groove - normal points down with slight variation
          data[idx] = 0.5; // R - x normal
          data[idx + 1] = 0.5; // G - y normal
          data[idx + 2] = 1.0; // B - z normal (up)
          data[idx + 3] = 0.2; // A - depth
        } else {
          // Flat tile with subtle variation
          data[idx] = 0.5 + (Math.random() - 0.5) * 0.02;
          data[idx + 1] = 0.5 + (Math.random() - 0.5) * 0.02;
          data[idx + 2] = 1.0;
          data[idx + 3] = 0.0;
        }
      }
    }

    const texture = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    texture.name = "GroundNormalMap";

    return texture;
  }

  /**
   * Create ground material
   * @private
   */
  _createMaterial() {
    this.material = new GroundMaterial({
      map: this.danceFloorTexture,
      normalMap: this.normalTexture,
      wearMap: this.wearTexture,
      animatedLightsMap: this.animatedLightsTexture,
      roughness: 0.3,
      metalness: 0.1,
      clearcoat: 0.3,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.0,
      reflectivity: 0.5,
      enableAnimatedLights: this.options.enableAnimatedLights,
    });
  }

  /**
   * Create ground geometry
   * @private
   */
  _createGeometry() {
    const segments = this._getSegments();

    // Use plane geometry with improved UV layout for tiles
    const geometry = new THREE.PlaneGeometry(
      this.options.size,
      this.options.size,
      segments,
      segments,
    );

    geometry.rotateX(-Math.PI / 2);
    geometry.name = "DanceFloorGeometry";

    // Enhance UV coordinates for better tile mapping
    this._enhanceUVs(geometry);

    return geometry;
  }

  /**
   * Get segment count based on quality
   * @private
   */
  _getSegments() {
    const segments = { low: 32, medium: 64, high: 100, ultra: 200 };
    return segments[this.options.quality] || 100;
  }

  /**
   * Enhance UV coordinates for tile-based texturing
   * @private
   */
  _enhanceUVs(geometry) {
    const uv = geometry.attributes.uv;
    const size = this.options.size;
    const tileSize = this.options.tileSize;
    const tilesPerSide = size / tileSize;

    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);

      // Scale UV to tile count
      uv.setXY(i, u * tilesPerSide, v * tilesPerSide);
    }

    uv.needsUpdate = true;
  }

  /**
   * Create animated point lights for dance floor
   * @private
   */
  _createAnimatedLights() {
    const lightCount = this._getLightCount();
    const radius = this.options.size * 0.35;

    const colors = [
      [1.0, 0.2, 0.6], // Magenta
      [0.2, 1.0, 0.8], // Cyan
      [1.0, 0.8, 0.1], // Gold
      [0.6, 0.2, 1.0], // Purple
      [1.0, 0.4, 0.1], // Orange
      [0.1, 1.0, 0.4], // Green
    ];

    for (let i = 0; i < lightCount; i++) {
      const angle = (i / lightCount) * Math.PI * 2;
      const color = new THREE.Color(...colors[i % colors.length]);

      const light = new THREE.PointLight(color, 0, radius * 0.5);
      light.position.set(Math.cos(angle) * radius, 5, Math.sin(angle) * radius);
      light.castShadow = false;
      light.decay = 2;

      this.mesh.add(light);
      this._pointLights.push(light);

      // Visual representation
      const spriteMaterial = new THREE.SpriteMaterial({
        color: color,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.setScalar(2);
      sprite.position.copy(light.position);
      this.mesh.add(sprite);
      this._lightObjects.push(sprite);
    }

    // Center pulsing light
    const centerLight = new THREE.PointLight(0xffffff, 0, radius * 0.8);
    centerLight.position.set(0, 8, 0);
    centerLight.decay = 2;
    this.mesh.add(centerLight);
    this._pointLights.push(centerLight);
  }

  /**
   * Get light count based on quality
   * @private
   */
  _getLightCount() {
    const counts = { low: 4, medium: 8, high: 12, ultra: 16 };
    return counts[this.options.quality] || 12;
  }

  /**
   * Update ground animation
   * @param {number} deltaTime - Frame delta time
   * @param {number} elapsedTime - Total elapsed time
   */
  update(deltaTime, elapsedTime) {
    this._animationState.time = elapsedTime;
    this._animationState.lightPhase += deltaTime * 2.0;
    this._animationState.beatTime += deltaTime;

    // Update material time uniform
    if (this.material && this.material.uniforms) {
      this.material.uniforms.time.value = elapsedTime;
      this.material.uniforms.lightPhase.value = this._animationState.lightPhase;
    }

    // Beat detection simulation (every ~0.5 seconds)
    if (this._animationState.beatTime > 0.5) {
      this._animationState.beatTime = 0;
      this._animationState.strobeActive = true;
    }

    if (this._animationState.strobeActive) {
      this._animationState.strobeActive = false;
      // Trigger strobe effect in material
      if (this.material && this.material.uniforms) {
        this.material.uniforms.strobeTrigger.value = elapsedTime;
      }
    }

    // Animate point lights
    this._animatePointLights(elapsedTime);
  }

  /**
   * Animate point lights
   * @private
   */
  _animatePointLights(elapsedTime) {
    const lightCount = this._pointLights.length;
    const radius = this.options.size * 0.35;
    const beatFreq = 0.5;

    this._pointLights.forEach((light, i) => {
      if (i === lightCount - 1) {
        // Center light - pulsing
        const pulse = Math.sin(elapsedTime * 4.0) * 0.5 + 0.5;
        light.intensity = pulse * 10;
        light.distance = radius * 0.8 * (0.8 + pulse * 0.4);
      } else {
        // Perimeter lights - rotating intensity
        const phase = (i * Math.PI * 2) / (lightCount - 1);
        const intensity = Math.sin(elapsedTime * 3.0 + phase) * 0.5 + 0.5;
        const beatPulse =
          Math.sin(elapsedTime * Math.PI * 2 * beatFreq) > 0.9 ? 2.0 : 1.0;
        light.intensity = intensity * 8 * beatPulse;
        light.distance = radius * 0.5 * (0.7 + intensity * 0.5);
      }
    });

    // Animate sprites
    this._lightObjects.forEach((sprite, i) => {
      if (i < this._pointLights.length - 1) {
        const light = this._pointLights[i];
        const intensity = light.intensity / 8;
        sprite.scale.setScalar(1.5 + intensity);
        sprite.material.opacity = 0.4 + intensity * 0.6;
      }
    });
  }

  /**
   * Enable/disable animated lights
   * @param {boolean} enabled
   */
  setAnimatedLights(enabled) {
    this.options.enableAnimatedLights = enabled;

    if (this.material) {
      this.material.setAnimatedLights(enabled);
    }

    this._pointLights.forEach((light) => {
      light.visible = enabled;
    });
    this._lightObjects.forEach((obj) => {
      obj.visible = enabled;
    });
  }

  /**
   * Set quality level
   * @param {string} quality - Quality preset
   */
  setQuality(quality) {
    this.options.quality = quality;
    // Would need to rebuild geometry/textures for full quality change
    console.log("[Ground] Quality change requires rebuild:", quality);
  }

  /**
   * Set beat tempo (BPM)
   * @param {number} bpm - Beats per minute
   */
  setTempo(bpm) {
    this._animationState.beatInterval = 60 / bpm;
  }

  /**
   * Trigger manual beat/strobe
   */
  triggerBeat() {
    this._animationState.strobeActive = true;
    this._animationState.beatTime = 0;
  }

  /**
   * Dispose of resources
   */
  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (this.material) this.material.dispose();
    }

    this._pointLights.forEach((light) => {
      if (light.parent) light.parent.remove(light);
    });
    this._lightObjects.forEach((obj) => {
      if (obj.parent) obj.parent.remove(obj);
      if (obj.material) obj.material.dispose();
    });

    if (this.danceFloorTexture) this.danceFloorTexture.dispose();
    if (this.wearTexture) this.wearTexture.dispose();
    if (this.normalTexture) this.normalTexture.dispose();
    if (this.animatedLightsTexture) this.animatedLightsTexture.dispose();
  }
}

export default Ground;
