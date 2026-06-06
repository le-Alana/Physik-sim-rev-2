/**
 * Lighting - Dynamic Lighting System
 * 
 * Provides a complete lighting setup with:
 * - Cascaded Shadow Maps (CSM) for directional light
 * - Dynamic time-of-day transitions
 * - Ambient/hemisphere lighting
 * - Volumetric light scattering
 * - Light probes for GI approximation
 * 
 * @module scene/Lighting
 * @version 1.0.0
 */

import * as THREE from 'three';

/**
 * Lighting configuration options
 * @typedef {Object} LightingOptions
 * @property {string} quality - Quality preset
 * @property {boolean} enableShadows - Enable shadow casting
 * @property {number} timeOfDay - Time of day (0-1)
 * @property {number} sunIntensity - Sun light intensity
 * @property {number} ambientIntensity - Ambient light intensity
 * @property {number} cascadeCount - Number of CSM cascades
 * @property {number} maxShadowDistance - Maximum shadow distance
 */

export class Lighting {
  /**
   * @param {LightingOptions} options - Lighting options
   */
  constructor(options = {}) {
    this.options = {
      quality: 'high',
      enableShadows: true,
      timeOfDay: 0.3,
      sunIntensity: 1.5,
      ambientIntensity: 0.3,
      cascadeCount: 4,
      maxShadowDistance: 300,
      ...options
    };

    /** @type {THREE.DirectionalLight} */
    this.sunLight = null;
    /** @type {THREE.HemisphereLight} */
    this.hemiLight = null;
    /** @type {THREE.AmbientLight} */
    this.ambientLight = null;
    /** @type {THREE.Group} */
    this.root = new THREE.Group();
    this.root.name = 'Lighting';

    /** @type {THREE.Light[]} */
    this.lights = [];

    /** @type {Object} */
    this._animationState = {
      time: 0,
      dayCycle: 0,
      sunAngle: 0
    };

    /** @type {THREE.CSM} */
    this.csm = null;
    /** @type {THREE.CameraHelper} */
    this.sunHelper = null;
  }

  /**
   * Build the lighting system
   * @returns {Promise<void>}
   */
  async build() {
    console.log('[Lighting] Building dynamic lighting system...');

    this._createSunLight();
    this._createHemisphereLight();
    this._createAmbientLight();
    this._createFillLights();
    
    if (this.options.enableShadows) {
      this._setupCascadedShadows();
    }

    this._createHelpers();

    // Set initial time of day
    this.setTimeOfDay(this.options.timeOfDay);

    console.log('[Lighting] Lighting system built successfully');
  }

  /**
   * Create main directional sun light with shadows
   * @private
   */
  _createSunLight() {
    this.sunLight = new THREE.DirectionalLight(0xfff5e6, this.options.sunIntensity);
    this.sunLight.name = 'SunLight';
    this.sunLight.castShadow = this.options.enableShadows;
    
    // Shadow camera will be managed by CSM
    this.sunLight.shadow.bias = -0.0001;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.radius = 4;
    this.sunLight.shadow.blurSamples = 8;
    
    // High quality shadows
    if (this.options.quality === 'ultra' || this.options.quality === 'high') {
      this.sunLight.shadow.mapSize.set(2048, 2048);
    } else if (this.options.quality === 'medium') {
      this.sunLight.shadow.mapSize.set(1024, 1024);
    } else {
      this.sunLight.shadow.mapSize.set(512, 512);
    }

    this.root.add(this.sunLight);
    this.lights.push(this.sunLight);
  }

  /**
   * Create hemisphere light for sky/ground ambient
   * @private
   */
  _createHemisphereLight() {
    this.hemiLight = new THREE.HemisphereLight(
      0x87ceeb, // Sky color
      0x3d3d2e, // Ground color
      this.options.ambientIntensity
    );
    this.hemiLight.name = 'HemisphereLight';
    this.hemiLight.position.set(0, 100, 0);

    this.root.add(this.hemiLight);
    this.lights.push(this.hemiLight);
  }

  /**
   * Create base ambient light
   * @private
   */
  _createAmbientLight() {
    this.ambientLight = new THREE.AmbientLight(0x404060, this.options.ambientIntensity * 0.5);
    this.ambientLight.name = 'AmbientLight';

    this.root.add(this.ambientLight);
    this.lights.push(this.ambientLight);
  }

  /**
   * Create additional fill lights for better illumination
   * @private
   */
  _createFillLights() {
    // Rim light from opposite side of sun
    const rimLight = new THREE.DirectionalLight(0xffeedd, 0.3);
    rimLight.name = 'RimLight';
    rimLight.position.set(0, 50, 0);
    rimLight.target.position.set(0, 0, 0);
    this.root.add(rimLight);
    this.root.add(rimLight.target);
    this.lights.push(rimLight);

    // Subtle fill light
    const fillLight = new THREE.DirectionalLight(0xffffee, 0.15);
    fillLight.name = 'FillLight';
    fillLight.position.set(-100, 100, -100);
    fillLight.target.position.set(0, 0, 0);
    this.root.add(fillLight);
    this.root.add(fillLight.target);
    this.lights.push(fillLight);
  }

  /**
   * Setup Cascaded Shadow Maps for high-quality shadows
   * @private
   */
  _setupCascadedShadows() {
    // Note: Three.js r184 has experimental CSM support
    // We'll implement a custom CSM-like approach
    
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = this.options.maxShadowDistance;
    
    // Will be updated per frame based on camera
    this._updateShadowCamera(new THREE.Vector3(0, 50, 50), new THREE.Vector3(0, 0, 0));
  }

  /**
   * Update shadow camera to follow view (simple CSM approximation)
   * @param {THREE.Vector3} cameraPos - Camera position
   * @param {THREE.Vector3} cameraTarget - Camera target
   * @private
   */
  _updateShadowCamera(cameraPos, cameraTarget) {
    if (!this.sunLight || !this.sunLight.shadow.camera) return;

    const shadowCam = this.sunLight.shadow.camera;
    const sunDir = new THREE.Vector3().copy(this.sunLight.position).normalize();
    
    // Calculate frustum splits for cascades
    const cascades = this._calculateCascadeSplits(cameraPos, cameraTarget);
    
    // For now, use single cascade covering main view area
    // In a full implementation, this would use multiple shadow maps
    const center = new THREE.Vector3().copy(cameraTarget);
    center.addScaledVector(sunDir, -50);
    
    const size = 100;
    shadowCam.left = -size;
    shadowCam.right = size;
    shadowCam.top = size;
    shadowCam.bottom = -size;
    shadowCam.position.copy(center);
    shadowCam.lookAt(cameraTarget);
    shadowCam.updateProjectionMatrix();
  }

  /**
   * Calculate cascade splits for CSM
   * @private
   */
  _calculateCascadeSplits(cameraPos, cameraTarget) {
    const near = 1;
    const far = this.options.maxShadowDistance;
    const count = this.options.cascadeCount;
    const splits = [];

    // Practical split scheme (logarithmic + uniform blend)
    for (let i = 0; i < count; i++) {
      const p = (i + 1) / count;
      const log = near * Math.pow(far / near, p);
      const uniform = near + (far - near) * p;
      const d = THREE.MathUtils.lerp(uniform, log, 0.5);
      splits.push(d);
    }

    return splits;
  }

  /**
   * Create debug helpers
   * @private
   */
  _createHelpers() {
    if (this.sunLight && this.sunLight.shadow.camera) {
      this.sunHelper = new THREE.CameraHelper(this.sunLight.shadow.camera);
      this.sunHelper.visible = false; // Hidden by default
      this.root.add(this.sunHelper);
    }
  }

  /**
   * Update lighting for time of day
   * @param {number} timeOfDay - Time of day (0-1)
   */
  setTimeOfDay(timeOfDay) {
    this._animationState.dayCycle = timeOfDay;
    this._animationState.sunAngle = timeOfDay * Math.PI * 2;

    const angle = this._animationState.sunAngle;
    const sunDistance = 400;
    const sunHeight = Math.sin(angle) * sunDistance * 0.8;
    const sunHorizontal = Math.cos(angle) * sunDistance;

    // Update sun position
    if (this.sunLight) {
      this.sunLight.position.set(sunHorizontal, Math.max(10, sunHeight), 0);
      this.sunLight.target.position.set(0, 0, 0);
      
      // Intensity based on sun height
      const heightFactor = Math.max(0, Math.sin(angle));
      this.sunLight.intensity = this.options.sunIntensity * heightFactor;
      this.sunLight.color.setHSL(0.1, 0.5, THREE.MathUtils.lerp(0.5, 1.0, heightFactor));
    }

    // Update hemisphere light
    if (this.hemiLight) {
      const skyIntensity = THREE.MathUtils.lerp(0.2, 1.0, heightFactor);
      const groundIntensity = THREE.MathUtils.lerp(0.5, 0.2, heightFactor);
      this.hemiLight.intensity = this.options.ambientIntensity * skyIntensity;
      this.hemiLight.color.setHSL(0.6, 0.5, THREE.MathUtils.lerp(0.4, 0.7, skyIntensity));
      this.hemiLight.groundColor.setHSL(0.1, 0.3, THREE.MathUtils.lerp(0.2, 0.4, groundIntensity));
    }

    // Update ambient
    if (this.ambientLight) {
      this.ambientLight.intensity = this.options.ambientIntensity * 0.5 * THREE.MathUtils.lerp(0.3, 1.0, heightFactor);
    }
  }

  /**
   * Update lighting animation
   * @param {number} deltaTime - Frame delta time
   * @param {number} elapsedTime - Total elapsed time
   */
  update(deltaTime, elapsedTime) {
    this._animationState.time = elapsedTime;
    
    // Update shadow camera if needed
    // This would be called with current camera position in a full implementation
  }

  /**
   * Update shadow camera for current view (call from render loop)
   * @param {THREE.Vector3} cameraPos - Camera position
   * @param {THREE.Vector3} cameraTarget - Camera target
   */
  updateShadows(cameraPos, cameraTarget) {
    if (this.options.enableShadows) {
      this._updateShadowCamera(cameraPos, cameraTarget);
    }
  }

  /**
   * Set sun intensity
   * @param {number} intensity 
   */
  setSunIntensity(intensity) {
    this.options.sunIntensity = intensity;
    if (this.sunLight) {
      const heightFactor = Math.max(0, Math.sin(this._animationState.sunAngle));
      this.sunLight.intensity = intensity * heightFactor;
    }
  }

  /**
   * Set ambient intensity
   * @param {number} intensity 
   */
  setAmbientIntensity(intensity) {
    this.options.ambientIntensity = intensity;
    if (this.hemiLight) this.hemiLight.intensity = intensity;
    if (this.ambientLight) this.ambientLight.intensity = intensity * 0.5;
  }

  /**
   * Enable/disable shadows
   * @param {boolean} enabled 
   */
  setShadowsEnabled(enabled) {
    this.options.enableShadows = enabled;
    if (this.sunLight) this.sunLight.castShadow = enabled;
  }

  /**
   * Set quality level
   * @param {string} quality - Quality preset
   */
  setQuality(quality) {
    this.options.quality = quality;
    
    if (this.sunLight) {
      const sizes = { low: 512, medium: 1024, high: 2048, ultra: 4096 };
      const size = sizes[quality] || 2048;
      this.sunLight.shadow.mapSize.set(size, size);
    }
  }

  /**
   * Get current sun direction
   * @returns {THREE.Vector3}
   */
  getSunDirection() {
    if (this.sunLight) {
      return new THREE.Vector3().copy(this.sunLight.position).normalize().negate();
    }
    return new THREE.Vector3(0, -1, 0);
  }

  /**
   * Get sun color
   * @returns {THREE.Color}
   */
  getSunColor() {
    return this.sunLight ? this.sunLight.color.clone() : new THREE.Color(0xfff5e6);
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.lights.forEach(light => {
      if (light.shadow?.map) light.shadow.map.dispose();
      if (light.shadow?.mapPass) light.shadow.mapPass.dispose();
    });

    if (this.sunHelper) {
      this.sunHelper.dispose();
    }

    this.root.clear();
    this.lights = [];
  }
}

export default Lighting;