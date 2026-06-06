/**
 * CameraController - Input Handling and Camera Movement
 * 
 * Provides orbital camera controls with damping, constraints,
 * and smooth interpolation for cinematic movement.
 * 
 * @module core/CameraController
 * @version 1.0.0
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * CameraController configuration options
 * @typedef {Object} CameraControllerOptions
 * @property {boolean} enableDamping - Enable smooth damping
 * @property {number} dampingFactor - Damping amount (0-1)
 * @property {boolean} enableZoom - Enable zoom
 * @property {boolean} enablePan - Enable panning
 * @property {boolean} enableRotate - Enable rotation
 * @property {number} minDistance - Minimum zoom distance
 * @property {number} maxDistance - Maximum zoom distance
 * @property {number} minPolarAngle - Minimum vertical angle (radians)
 * @property {number} maxPolarAngle - Maximum vertical angle (radians)
 * @property {number} minAzimuthAngle - Minimum horizontal angle (radians)
 * @property {number} maxAzimuthAngle - Maximum horizontal angle (radians)
 * @property {boolean} autoRotate - Auto rotate around target
 * @property {number} autoRotateSpeed - Auto rotation speed
 * @property {boolean} screenSpacePanning - Pan in screen space
 * @property {number} zoomSpeed - Zoom speed multiplier
 * @property {number} panSpeed - Pan speed multiplier
 * @property {number} rotateSpeed - Rotate speed multiplier
 */

/**
 * CameraController class wrapping OrbitControls with additional features
 */
export class CameraController {
  /**
   * @param {HTMLElement} domElement - Renderer canvas element
   * @param {CameraControllerOptions} options - Controller options
   */
  constructor(domElement, options = {}) {
    this.options = {
      enableDamping: true,
      dampingFactor: 0.05,
      enableZoom: true,
      enablePan: true,
      enableRotate: true,
      minDistance: 5,
      maxDistance: 200,
      minPolarAngle: 0.1,
      maxPolarAngle: Math.PI / 2 - 0.01,
      minAzimuthAngle: -Infinity,
      maxAzimuthAngle: Infinity,
      autoRotate: false,
      autoRotateSpeed: 0.5,
      screenSpacePanning: false,
      zoomSpeed: 1.0,
      panSpeed: 1.0,
      rotateSpeed: 1.0,
      ...options
    };

    /** @type {THREE.PerspectiveCamera} */
    this.camera = new THREE.PerspectiveCamera(
      60, // FOV
      window.innerWidth / window.innerHeight, // Aspect
      0.1, // Near
      1000 // Far
    );

    /** @type {OrbitControls} */
    this.controls = new OrbitControls(this.camera, domElement);

    /** @type {THREE.Vector3} */
    this.target = new THREE.Vector3(0, 0, 0);

    /** @type {THREE.Vector3} */
    this.position = new THREE.Vector3(0, 30, 60);

    /** @type {Object} */
    this._animationState = {
      isAnimating: false,
      startPosition: new THREE.Vector3(),
      endPosition: new THREE.Vector3(),
      startTarget: new THREE.Vector3(),
      endTarget: new THREE.Vector3(),
      startTime: 0,
      duration: 0,
      easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t // easeInOutQuad
    };

    /** @type {Map<string, Function>} */
    this._callbacks = new Map();

    this._configureControls();
    this._setupEventListeners();
  }

  /**
   * Configure OrbitControls with options
   * @private
   */
  _configureControls() {
    const c = this.controls;

    c.enableDamping = this.options.enableDamping;
    c.dampingFactor = this.options.dampingFactor;
    c.enableZoom = this.options.enableZoom;
    c.enablePan = this.options.enablePan;
    c.enableRotate = this.options.enableRotate;
    c.minDistance = this.options.minDistance;
    c.maxDistance = this.options.maxDistance;
    c.minPolarAngle = this.options.minPolarAngle;
    c.maxPolarAngle = this.options.maxPolarAngle;
    c.minAzimuthAngle = this.options.minAzimuthAngle;
    c.maxAzimuthAngle = this.options.maxAzimuthAngle;
    c.autoRotate = this.options.autoRotate;
    c.autoRotateSpeed = this.options.autoRotateSpeed;
    c.screenSpacePanning = this.options.screenSpacePanning;
    c.zoomSpeed = this.options.zoomSpeed;
    c.panSpeed = this.options.panSpeed;
    c.rotateSpeed = this.options.rotateSpeed;

    // Smooth zoom with shift key
    c.zoomToCursor = true;

    // Disable context menu on right click
    c.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };

    // Touch gestures
    c.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
  }

  /**
   * Setup event listeners for change events
   * @private
   */
  _setupEventListeners() {
    this.controls.addEventListener('change', () => {
      this.target.copy(this.controls.target);
      this.position.copy(this.camera.position);
      this._emit('change', { position: this.position, target: this.target });
    });

    this.controls.addEventListener('start', () => {
      this._emit('start', { position: this.position, target: this.target });
    });

    this.controls.addEventListener('end', () => {
      this._emit('end', { position: this.position, target: this.target });
    });
  }

  /**
   * Update controller (call in render loop)
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    this.controls.update();

    // Handle camera animation
    if (this._animationState.isAnimating) {
      const elapsed = performance.now() - this._animationState.startTime;
      const progress = Math.min(elapsed / this._animationState.duration, 1);
      const eased = this._animationState.easing(progress);

      this.camera.position.lerpVectors(
        this._animationState.startPosition,
        this._animationState.endPosition,
        eased
      );
      this.controls.target.lerpVectors(
        this._animationState.startTarget,
        this._animationState.endTarget,
        eased
      );

      if (progress >= 1) {
        this._animationState.isAnimating = false;
        this._emit('animationComplete');
      }
    }
  }

  /**
   * Set camera position directly
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} z - Z position
   */
  setPosition(x, y, z) {
    this.camera.position.set(x, y, z);
    this.position.copy(this.camera.position);
  }

  /**
   * Set camera target (look at point)
   * @param {number} x - X target
   * @param {number} y - Y target
   * @param {number} z - Z target
   */
  setTarget(x, y, z) {
    this.controls.target.set(x, y, z);
    this.target.copy(this.controls.target);
  }

  /**
   * Animate camera to new position and target
   * @param {Object} options - Animation options
   * @param {THREE.Vector3|Object} options.position - End position
   * @param {THREE.Vector3|Object} options.target - End target
   * @param {number} options.duration - Animation duration in ms
   * @param {Function} options.easing - Easing function (t => value)
   * @returns {Promise<void>}
   */
  animateTo({ position, target, duration = 2000, easing }) {
    return new Promise((resolve) => {
      this._animationState.isAnimating = true;
      this._animationState.startPosition.copy(this.camera.position);
      this._animationState.endPosition.copy(position);
      this._animationState.startTarget.copy(this.controls.target);
      this._animationState.endTarget.copy(target);
      this._animationState.startTime = performance.now();
      this._animationState.duration = duration;
      this._animationState.easing = easing || this._animationState.easing;

      const onComplete = () => {
        this._callbacks.delete('animationComplete');
        resolve();
      };

      this._callbacks.set('animationComplete', onComplete);
      this.on('animationComplete', onComplete);
    });
  }

  /**
   * Set camera aspect ratio
   * @param {number} aspect - Width / Height
   */
  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Set camera FOV
   * @param {number} fov - Field of view in degrees
   */
  setFov(fov) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Get current camera state
   * @returns {Object}
   */
  getState() {
    return {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      fov: this.camera.fov,
      aspect: this.camera.aspect,
      near: this.camera.near,
      far: this.camera.far,
      zoom: this.controls.getZoomScale()
    };
  }

  /**
   * Restore camera state
   * @param {Object} state - State from getState()
   * @param {boolean} animate - Animate to state
   * @param {number} duration - Animation duration
   */
  setState(state, animate = false, duration = 1000) {
    if (animate) {
      return this.animateTo({
        position: state.position,
        target: state.target,
        duration
      });
    }

    this.camera.position.copy(state.position);
    this.controls.target.copy(state.target);
    if (state.fov) this.camera.fov = state.fov;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  /**
   * Enable/disable auto rotation
   * @param {boolean} enabled
   */
  setAutoRotate(enabled) {
    this.controls.autoRotate = enabled;
  }

  /**
   * Set distance constraints
   * @param {number} min - Minimum distance
   * @param {number} max - Maximum distance
   */
  setDistanceLimits(min, max) {
    this.controls.minDistance = min;
    this.controls.maxDistance = max;
  }

  /**
   * Set polar angle constraints (vertical rotation)
   * @param {number} min - Minimum angle in radians
   * @param {number} max - Maximum angle in radians
   */
  setPolarLimits(min, max) {
    this.controls.minPolarAngle = min;
    this.controls.maxPolarAngle = max;
  }

  /**
   * Set azimuth angle constraints (horizontal rotation)
   * @param {number} min - Minimum angle in radians
   * @param {number} max - Maximum angle in radians
   */
  setAzimuthLimits(min, max) {
    this.controls.minAzimuthAngle = min;
    this.controls.maxAzimuthAngle = max;
  }

  /**
   * Focus on an object
   * @param {THREE.Object3D} object - Object to focus
   * @param {boolean} animate - Animate to object
   * @param {number} duration - Animation duration
   * @param {number} distance - Distance from object
   */
  focusObject(object, animate = true, duration = 1500, distance = 10) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const cameraDistance = Math.max(distance, maxDim / (2 * Math.tan(fov / 4)));

    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .normalize();

    const targetPosition = center.clone();
    const cameraPosition = targetPosition.clone().add(direction.multiplyScalar(cameraDistance));

    if (animate) {
      return this.animateTo({
        position: cameraPosition,
        target: targetPosition,
        duration
      });
    }

    this.setState({
      position: cameraPosition,
      target: targetPosition
    });
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this._callbacks.has(event)) {
      this._callbacks.set(event, []);
    }
    this._callbacks.get(event).push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this._callbacks.has(event)) {
      const callbacks = this._callbacks.get(event);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @private
   */
  _emit(event, data) {
    if (this._callbacks.has(event)) {
      this._callbacks.get(event).forEach(callback => callback(data));
    }
  }

  /**
   * Dispose of controller
   */
  dispose() {
    this.controls.dispose();
    this._callbacks.clear();
  }
}

export default CameraController;