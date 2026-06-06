/**
 * TestScene - Rayman-Style Open Air Scene Builder
 * 
 * Creates a complete test scene with:
 * - Procedural sky with volumetric clouds
 * - Dancing floor with animated lights
 * - Rayman-style mountains surrounding the area
 * - Dynamic lighting setup
 * 
 * @module scene/TestScene
 * @version 1.0.0
 */

import * as THREE from 'three';
import { Sky } from './Sky.js';
import { Ground } from './Ground.js';
import { Mountains } from './Mountains.js';
import { Lighting } from './Lighting.js';
import { ProceduralTextures } from '../utils/ProceduralTextures.js';

/**
 * TestScene configuration options
 * @typedef {Object} TestSceneOptions
 * @property {string} quality - Quality preset: 'low' | 'medium' | 'high' | 'ultra'
 * @property {boolean} enableAnimatedLights - Enable animated dance floor lights
 * @property {number} mountainRange - Mountain range radius
 * @property {number} groundSize - Ground plane size
 * @property {boolean} enableShadows - Enable shadow casting
 */

export class TestScene {
  /**
   * @param {SceneManager} sceneManager - Scene manager instance
   * @param {TestSceneOptions} options - Scene options
   */
  constructor(sceneManager, options = {}) {
    this.sceneManager = sceneManager;
    this.options = {
      quality: 'high',
      enableAnimatedLights: true,
      mountainRange: 300,
      groundSize: 200,
      enableShadows: true,
      ...options
    };

    /** @type {Sky} */
    this.sky = null;
    /** @type {Ground} */
    this.ground = null;
    /** @type {Mountains} */
    this.mountains = null;
    /** @type {Lighting} */
    this.lighting = null;

    /** @type {THREE.Group} */
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'TestScene';

    /** @type {Object} */
    this._animationState = {
      time: 0,
      dayCycle: 0,
      lightPhase: 0
    };

    /** @type {Map<string, THREE.Object3D>} */
    this._animatedObjects = new Map();
  }

  /**
   * Build the complete test scene
   * @returns {Promise<void>}
   */
  async build() {
    console.log('[TestScene] Building Rayman-style scene...');

    // Create all scene components
    await this._createSky();
    await this._createGround();
    await this._createMountains();
    await this._createLighting();

    // Add root group to scene
    this.sceneManager.addObject(this.rootGroup, 'testScene');

    // Setup animation callbacks
    this._setupAnimations();

    // Apply quality settings
    this._applyQualitySettings();

    console.log('[TestScene] Scene built successfully');
    this._logStats();
  }

  /**
   * Create procedural sky with volumetric clouds
   * @private
   */
  async _createSky() {
    this.sky = new Sky({
      radius: this.options.mountainRange * 1.5,
      quality: this.options.quality,
      sunPosition: new THREE.Vector3(100, 80, 50),
      turbidity: 2.0,
      rayleigh: 1.0,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.8
    });

    await this.sky.build();
    this.rootGroup.add(this.sky.mesh);
    this._animatedObjects.set('sky', this.sky);
  }

  /**
   * Create dancing floor ground
   * @private
   */
  async _createGround() {
    this.ground = new Ground({
      size: this.options.groundSize,
      quality: this.options.quality,
      enableAnimatedLights: this.options.enableAnimatedLights,
      tileSize: 8,
      grooveWidth: 0.3
    });

    await this.ground.build();
    this.ground.mesh.position.y = 0;
    this.rootGroup.add(this.ground.mesh);
    this._animatedObjects.set('ground', this.ground);
  }

  /**
   * Create Rayman-style mountains
   * @private
   */
  async _createMountains() {
    this.mountains = new Mountains({
      range: this.options.mountainRange,
      count: this._getMountainCount(),
      quality: this.options.quality,
      minHeight: 30,
      maxHeight: 120,
      baseRadius: 80,
      seed: 12345
    });

    await this.mountains.build();
    this.rootGroup.add(this.mountains.group);
    this._animatedObjects.set('mountains', this.mountains);
  }

  /**
   * Create dynamic lighting
   * @private
   */
  async _createLighting() {
    this.lighting = new Lighting({
      quality: this.options.quality,
      enableShadows: this.options.enableShadows,
      timeOfDay: 0.3, // Late afternoon
      sunIntensity: 1.5,
      ambientIntensity: 0.3
    });

    await this.lighting.build();
    
    // Add lights to scene manager
    this.lighting.lights.forEach(light => {
      this.sceneManager.addLight(light);
    });

    // Add lighting helper objects to root group
    if (this.lighting.sunHelper) {
      this.rootGroup.add(this.lighting.sunHelper);
    }

    this._animatedObjects.set('lighting', this.lighting);
  }

  /**
   * Get mountain count based on quality
   * @private
   */
  _getMountainCount() {
    const counts = {
      low: 8,
      medium: 16,
      high: 24,
      ultra: 32
    };
    return counts[this.options.quality] || 16;
  }

  /**
   * Apply quality-specific settings
   * @private
   */
  _applyQualitySettings() {
    const qualitySettings = {
      low: {
        shadowMapSize: 512,
        cloudSamples: 32,
        mountainDetail: 0.5
      },
      medium: {
        shadowMapSize: 1024,
        cloudSamples: 64,
        mountainDetail: 0.75
      },
      high: {
        shadowMapSize: 2048,
        cloudSamples: 128,
        mountainDetail: 1.0
      },
      ultra: {
        shadowMapSize: 4096,
        cloudSamples: 256,
        mountainDetail: 1.5
      }
    };

    const settings = qualitySettings[this.options.quality] || qualitySettings.high;
    
    // Apply to components
    if (this.lighting && this.lighting.sunLight) {
      this.lighting.sunLight.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
    }
  }

  /**
   * Setup animation callbacks
   * @private
   */
  _setupAnimations() {
    // Sky animation
    if (this.sky) {
      this.sky.mesh.userData.update = (deltaTime, elapsedTime) => {
        this.sky.update(deltaTime, elapsedTime);
      };
    }

    // Ground animation
    if (this.ground) {
      this.ground.mesh.userData.update = (deltaTime, elapsedTime) => {
        this.ground.update(deltaTime, elapsedTime);
      };
    }

    // Mountains subtle animation (wind)
    if (this.mountains) {
      this.mountains.group.userData.update = (deltaTime, elapsedTime) => {
        this.mountains.update(deltaTime, elapsedTime);
      };
    }

    // Lighting animation (day cycle)
    if (this.lighting) {
      this.lighting.root.userData.update = (deltaTime, elapsedTime) => {
        this.lighting.update(deltaTime, elapsedTime);
      };
    }
  }

  /**
   * Update all animated components
   * @param {number} deltaTime - Frame delta time
   * @param {number} elapsedTime - Total elapsed time
   */
  update(deltaTime, elapsedTime) {
    this._animationState.time = elapsedTime;
    this._animationState.dayCycle = (elapsedTime * 0.0001) % 1.0; // ~2.7 hour day cycle
    this._animationState.lightPhase = Math.sin(elapsedTime * 0.5) * 0.5 + 0.5;

    // Update animated objects
    this._animatedObjects.forEach((obj, name) => {
      if (obj.update) {
        obj.update(deltaTime, elapsedTime);
      }
    });

    // Update sky sun position based on day cycle
    if (this.sky) {
      this._updateDayCycle();
    }
  }

  /**
   * Update day/night cycle
   * @private
   */
  _updateDayCycle() {
    const cycle = this._animationState.dayCycle;
    const angle = cycle * Math.PI * 2;
    
    // Sun position
    const sunDistance = 300;
    const sunHeight = Math.sin(angle) * sunDistance * 0.8;
    const sunHorizontal = Math.cos(angle) * sunDistance;
    
    this.sky.setSunPosition(
      sunHorizontal,
      Math.max(5, sunHeight),
      0
    );

    // Update lighting to match
    if (this.lighting) {
      this.lighting.setTimeOfDay(cycle);
    }
  }

  /**
   * Set time of day manually (0-1)
   * @param {number} time - Time of day
   */
  setTimeOfDay(time) {
    this._animationState.dayCycle = time;
    this._updateDayCycle();
  }

  /**
   * Enable/disable animated lights
   * @param {boolean} enabled 
   */
  setAnimatedLights(enabled) {
    this.options.enableAnimatedLights = enabled;
    if (this.ground) {
      this.ground.setAnimatedLights(enabled);
    }
  }

  /**
   * Set quality at runtime
   * @param {string} quality - Quality preset
   */
  setQuality(quality) {
    this.options.quality = quality;
    this._applyQualitySettings();
    
    // Rebuild components if needed
    if (this.sky) this.sky.setQuality(quality);
    if (this.ground) this.ground.setQuality(quality);
    if (this.mountains) this.mountains.setQuality(quality);
  }

  /**
   * Get scene statistics
   * @returns {Object}
   */
  getStats() {
    return {
      triangles: this._countTriangles(),
      drawCalls: this._animatedObjects.size + 3,
      components: {
        sky: !!this.sky,
        ground: !!this.ground,
        mountains: !!this.mountains,
        lighting: !!this.lighting
      },
      mountainCount: this.mountains?.mountainCount || 0,
      animatedObjects: this._animatedObjects.size
    };
  }

  /**
   * Count total triangles in scene
   * @private
   */
  _countTriangles() {
    let count = 0;
    this.rootGroup.traverse(obj => {
      if (obj.isMesh && obj.geometry) {
        const index = obj.geometry.index;
        if (index) {
          count += index.count / 3;
        } else {
          count += obj.geometry.attributes.position.count / 3;
        }
      }
    });
    return count;
  }

  /**
   * Log scene stats
   * @private
   */
  _logStats() {
    const stats = this.getStats();
    console.group('[TestScene] Scene Statistics');
    console.log('Triangles:', stats.triangles.toLocaleString());
    console.log('Mountains:', stats.mountainCount);
    console.log('Animated Objects:', stats.animatedObjects);
    console.groupEnd();
  }

  /**
   * Dispose of all scene resources
   */
  dispose() {
    this._animatedObjects.forEach(obj => {
      if (obj.dispose) obj.dispose();
    });
    this._animatedObjects.clear();

    if (this.sky) this.sky.dispose();
    if (this.ground) this.ground.dispose();
    if (this.mountains) this.mountains.dispose();
    if (this.lighting) this.lighting.dispose();

    this.rootGroup.clear();
    this.sceneManager.removeObject('testScene');
  }
}

export default TestScene;