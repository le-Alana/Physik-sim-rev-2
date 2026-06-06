/**
 * SceneManager - Scene Lifecycle and Object Management
 *
 * Manages the Three.js scene graph, object organization,
 * lighting setup, and scene-level operations.
 *
 * @module core/SceneManager
 * @version 1.0.0
 */

import * as THREE from "three";

/**
 * SceneManager configuration options
 * @typedef {Object} SceneManagerOptions
 * @property {THREE.Color|number|string} background - Scene background color
 * @property {boolean} fog - Enable fog
 * @property {number} fogNear - Fog near distance
 * @property {number} fogFar - Fog far distance
 * @property {THREE.Color|number|string} fogColor - Fog color
 */

/**
 * SceneManager class for scene lifecycle management
 */
export class SceneManager {
  /**
   * @param {SceneManagerOptions} options - Scene configuration
   */
  constructor(options = {}) {
    this.options = {
      background: 0x0a0a0f,
      fog: true,
      fogNear: 50,
      fogFar: 300,
      fogColor: 0x87ceeb,
      ...options,
    };

    /** @type {THREE.Scene} */
    this.scene = new THREE.Scene();
    /** @type {Map<string, THREE.Object3D>} */
    this.objects = new Map();
    /** @type {Map<string, THREE.Group>} */
    this.groups = new Map();
    /** @type {THREE.Light[]} */
    this.lights = [];
    /** @type {boolean} */
    this.isBuilt = false;

    this._setupScene();
  }

  /**
   * Initialize scene with default settings
   * @private
   */
  _setupScene() {
    // Background
    this.scene.background = new THREE.Color(this.options.background);

    // Fog for atmospheric depth
    if (this.options.fog) {
      this.scene.fog = new THREE.Fog(
        this.options.fogColor,
        this.options.fogNear,
        this.options.fogFar,
      );
    }

    // Default environment for PBR materials
    this._setupEnvironment();
  }

  /**
   * Setup default environment map for PBR reflections
   * @private
   */
  _setupEnvironment() {
    // Create a procedural environment map as fallback
    const pmremGenerator = new THREE.PMREMGenerator(
      this.renderer || new THREE.WebGLRenderer(),
    );
    pmremGenerator.compileEquirectangularShader();

    // Simple gradient environment
    const envScene = new THREE.Scene();
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x87ceeb,
      side: THREE.BackSide,
    });
    const skySphere = new THREE.Mesh(geometry, material);
    envScene.add(skySphere);

    const renderTarget = pmremGenerator.fromScene(envScene);
    this.scene.environment = renderTarget.texture;

    // Cleanup
    renderTarget.dispose();
    pmremGenerator.dispose();
  }

  /**
   * Add an object to the scene with tracking
   * @param {THREE.Object3D} object - Object to add
   * @param {string} [name] - Optional name for retrieval
   * @param {string} [group] - Optional group name
   * @returns {THREE.Object3D} The added object
   */
  addObject(object, name, group) {
    if (group) {
      let groupObj = this.groups.get(group);
      if (!groupObj) {
        groupObj = new THREE.Group();
        groupObj.name = group;
        this.scene.add(groupObj);
        this.groups.set(group, groupObj);
      }
      groupObj.add(object);
    } else {
      this.scene.add(object);
    }

    if (name) {
      this.objects.set(name, object);
    }

    return object;
  }

  /**
   * Get an object by name
   * @param {string} name - Object name
   * @returns {THREE.Object3D|undefined}
   */
  getObject(name) {
    return this.objects.get(name);
  }

  /**
   * Get a group by name
   * @param {string} name - Group name
   * @returns {THREE.Group|undefined}
   */
  getGroup(name) {
    return this.groups.get(name);
  }

  /**
   * Remove an object from the scene
   * @param {string|THREE.Object3D} nameOrObject - Name or object reference
   * @returns {boolean} True if removed
   */
  removeObject(nameOrObject) {
    let object;

    if (typeof nameOrObject === "string") {
      object = this.objects.get(nameOrObject);
      if (object) {
        this.objects.delete(nameOrObject);
      }
    } else {
      object = nameOrObject;
      // Find and remove from objects map
      for (const [key, value] of this.objects) {
        if (value === object) {
          this.objects.delete(key);
          break;
        }
      }
    }

    if (object) {
      object.removeFromParent();
      this._disposeObject(object);
      return true;
    }

    return false;
  }

  /**
   * Add a light to the scene
   * @param {THREE.Light} light - Light to add
   * @param {string} [name] - Optional name
   * @returns {THREE.Light} The added light
   */
  addLight(light, name) {
    this.scene.add(light);
    this.lights.push(light);
    if (name) {
      light.name = name;
    }
    return light;
  }

  /**
   * Remove a light from the scene
   * @param {THREE.Light|string} lightOrName - Light or name
   * @returns {boolean}
   */
  removeLight(lightOrName) {
    let light;
    if (typeof lightOrName === "string") {
      const index = this.lights.findIndex((l) => l.name === lightOrName);
      if (index !== -1) {
        light = this.lights.splice(index, 1)[0];
      }
    } else {
      light = lightOrName;
      const index = this.lights.indexOf(light);
      if (index !== -1) {
        this.lights.splice(index, 1);
      }
    }

    if (light) {
      this.scene.remove(light);
      return true;
    }
    return false;
  }

  /**
   * Get all lights
   * @returns {THREE.Light[]}
   */
  getLights() {
    return [...this.lights];
  }

  /**
   * Set scene background
   * @param {THREE.Color|number|string|THREE.Texture} background - Background value
   */
  setBackground(background) {
    this.scene.background =
      background instanceof THREE.Color
        ? background
        : new THREE.Color(background);
  }

  /**
   * Set fog parameters
   * @param {boolean} enabled - Enable/disable fog
   * @param {number} near - Near distance
   * @param {number} far - Far distance
   * @param {THREE.Color|number|string} color - Fog color
   */
  setFog(enabled, near, far, color) {
    if (enabled) {
      this.scene.fog = new THREE.Fog(
        color instanceof THREE.Color ? color : new THREE.Color(color),
        near,
        far,
      );
    } else {
      this.scene.fog = null;
    }
  }

  /**
   * Set environment map for PBR materials
   * @param {THREE.Texture} envMap - Environment map texture
   */
  setEnvironment(envMap) {
    this.scene.environment = envMap;

    // Update all PBR materials in scene
    this.scene.traverse((object) => {
      if (object.isMesh && object.material) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((mat) => {
          if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
            mat.envMap = envMap;
            mat.needsUpdate = true;
          }
        });
      }
    });
  }

  /**
   * Traverse all objects in scene
   * @param {Function} callback - Function to call for each object
   */
  traverse(callback) {
    this.scene.traverse(callback);
  }

  /**
   * Update all objects (for animations)
   * @param {number} deltaTime - Time since last frame
   * @param {number} elapsedTime - Total elapsed time
   */
  update(deltaTime, elapsedTime) {
    this.scene.traverse((object) => {
      if (object.userData?.update) {
        object.userData.update(deltaTime, elapsedTime);
      }
    });
  }

  /**
   * Dispose of an object and its resources
   * @param {THREE.Object3D} object - Object to dispose
   * @private
   */
  _disposeObject(object) {
    if (object.geometry) {
      object.geometry.dispose();
    }

    if (object.material) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => {
        material.dispose();
        // Dispose textures
        Object.values(material).forEach((value) => {
          if (value && value.isTexture) {
            value.dispose();
          }
        });
      });
    }

    // Recursively dispose children
    object.children.forEach((child) => this._disposeObject(child));
  }

  /**
   * Clear entire scene
   */
  clear() {
    // Dispose all tracked objects
    for (const object of this.objects.values()) {
      this._disposeObject(object);
    }
    this.objects.clear();

    // Dispose groups
    for (const group of this.groups.values()) {
      this._disposeObject(group);
    }
    this.groups.clear();

    // Remove lights
    this.lights.forEach((light) => this.scene.remove(light));
    this.lights = [];

    // Clear scene children (except camera if added)
    const toRemove = [];
    this.scene.traverse((object) => {
      if (object !== this.scene && !object.isCamera) {
        toRemove.push(object);
      }
    });
    toRemove.forEach((obj) => this.scene.remove(obj));

    this.isBuilt = false;
  }

  /**
   * Get scene statistics
   * @returns {Object}
   */
  getStats() {
    let geometries = 0;
    let textures = 0;
    let materials = 0;
    let meshes = 0;
    let lights = this.lights.length;

    this.scene.traverse((object) => {
      if (object.isMesh) {
        meshes++;
        if (object.geometry) geometries++;
        const mats = Array.isArray(object.material)
          ? object.material
          : [object.material];
        mats.forEach((mat) => {
          materials++;
          Object.values(mat).forEach((val) => {
            if (val && val.isTexture) textures++;
          });
        });
      }
    });

    return {
      meshes,
      geometries,
      materials,
      textures,
      lights,
      objects: this.objects.size,
      groups: this.groups.size,
    };
  }
}

export default SceneManager;
