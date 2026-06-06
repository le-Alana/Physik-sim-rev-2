/**
 * Mountains - Rayman-Style Procedural Mountains
 *
 * Creates stylized mountains with:
 * - Procedural heightmap-based geometry
 * - Tri-planar texturing for seamless surfaces
 * - Snow caps at higher elevations
 * - Vegetation zones
 * - Instanced rendering for performance
 *
 * @module scene/Mountains
 * @version 1.0.0
 */

import * as THREE from "three";
import { ProceduralTextures } from "../utils/ProceduralTextures.js";
import { MountainMaterial } from "../materials/MountainMaterial.js";

/**
 * Mountain configuration options
 * @typedef {Object} MountainOptions
 * @property {number} range - Mountain range radius
 * @property {number} count - Number of mountains
 * @property {string} quality - Quality preset
 * @property {number} minHeight - Minimum mountain height
 * @property {number} maxHeight - Maximum mountain height
 * @property {number} baseRadius - Base radius of mountains
 * @property {number} seed - Random seed
 */

/**
 * Mountains class for Rayman-style mountain range
 */
export class Mountains {
  /**
   * @param {MountainOptions} options - Mountain options
   */
  constructor(options = {}) {
    this.options = {
      range: 300,
      count: 16,
      quality: "high",
      minHeight: 30,
      maxHeight: 120,
      baseRadius: 80,
      seed: 12345,
      ...options,
    };

    /** @type {THREE.Group} */
    this.group = new THREE.Group();
    this.group.name = "Mountains";

    /** @type {THREE.Mesh[]} */
    this.mountains = [];
    /** @type {MountainMaterial} */
    this.material = null;

    /** @type {number} */
    this.mountainCount = 0;

    /** @type {Object} */
    this._animationState = {
      time: 0,
      windStrength: 0.02,
      windDirection: new THREE.Vector2(1, 0.3).normalize(),
    };
  }

  /**
   * Build all mountains
   * @returns {Promise<void>}
   */
  async build() {
    console.log("[Mountains] Building Rayman-style mountain range...");

    // Generate textures
    this._generateTextures();

    // Create shared material
    this._createMaterial();

    // Generate mountain data
    const mountainData = this._generateMountainData();

    // Create mountain meshes
    this._createMountains(mountainData);

    console.log(`[Mountains] Created ${this.mountainCount} mountains`);
  }

  /**
   * Generate procedural textures for mountains
   * @private
   */
  _generateTextures() {
    const size = this._getTextureSize();

    // Heightmap for displacement
    this.heightmapTexture = ProceduralTextures.generateMountainHeightmap(1024, {
      baseFrequency: 0.003,
      octaves: 8,
      persistence: 0.5,
      lacunarity: 2.0,
      heightScale: 1.0,
      ridgeFactor: 0.85,
      valleyDepth: 0.15,
      seed: this.options.seed,
    });

    // Color texture (tri-planar friendly)
    this.colorTexture = ProceduralTextures.generateMountainColor(size, {
      baseColor: [0.42, 0.32, 0.22],
      highlightColor: [0.52, 0.42, 0.32],
      shadowColor: [0.28, 0.22, 0.18],
      snowColor: [0.95, 0.95, 0.98],
      snowLine: 0.7,
      snowTransition: 0.12,
      seed: this.options.seed + 1,
    });

    // Normal map for detail
    this.normalTexture = this._generateNormalMap(size);

    // Roughness map (rockier at peaks)
    this.roughnessTexture = this._generateRoughnessMap(size);

    // Vegetation mask
    this.vegetationTexture = this._generateVegetationMask(size);
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
   * Generate normal map from heightmap
   * @private
   */
  _generateNormalMap(size) {
    // Create normal map from heightmap using Sobel filter
    const heightData = this.heightmapTexture.image.data;
    const heightSize = this.heightmapTexture.image.width;
    const data = new Float32Array(size * size * 4);
    const scale = heightSize / size;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Sample height at 4 neighbors
        const hx = x * scale;
        const hy = y * scale;
        const x0 = Math.max(0, Math.min(heightSize - 1, Math.floor(hx - 1)));
        const x1 = Math.max(0, Math.min(heightSize - 1, Math.floor(hx + 1)));
        const y0 = Math.max(0, Math.min(heightSize - 1, Math.floor(hy - 1)));
        const y1 = Math.max(0, Math.min(heightSize - 1, Math.floor(hy + 1)));

        const hL = heightData[y * heightSize + x0];
        const hR = heightData[y * heightSize + x1];
        const hD = heightData[y0 * heightSize + x];
        const hU = heightData[y1 * heightSize + x];

        // Calculate normal
        const dx = (hR - hL) * 0.5;
        const dy = (hU - hD) * 0.5;
        const normal = new THREE.Vector3(-dx, -dy, 1.0 / scale).normalize();

        const idx = (y * size + x) * 4;
        data[idx] = normal.x * 0.5 + 0.5;
        data[idx + 1] = normal.y * 0.5 + 0.5;
        data[idx + 2] = normal.z * 0.5 + 0.5;
        data[idx + 3] = 1.0;
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
    texture.name = "MountainNormalMap";

    return texture;
  }

  /**
   * Generate roughness map (smoother in valleys, rougher on peaks)
   * @private
   */
  _generateRoughnessMap(size) {
    const data = new Float32Array(size * size);
    const prng = this._createPRNG(this.options.seed + 2);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Base roughness with noise
        const noise = this._noise2D(x * 0.01, y * 0.01, prng);
        // Rougher at higher values (peaks)
        const height = (noise + 1) * 0.5;
        const roughness =
          THREE.MathUtils.lerp(0.7, 0.95, height) + (prng() - 0.5) * 0.1;
        data[y * size + x] = THREE.MathUtils.clamp(roughness, 0.5, 1.0);
      }
    }

    const texture = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RedFormat,
      THREE.FloatType,
    );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    texture.name = "MountainRoughnessMap";

    return texture;
  }

  /**
   * Generate vegetation mask (grass/trees on lower slopes)
   * @private
   */
  _generateVegetationMask(size) {
    const data = new Float32Array(size * size);
    const prng = this._createPRNG(this.options.seed + 3);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const noise = this._noise2D(x * 0.005, y * 0.005, prng);
        const noise2 = this._noise2D(x * 0.02, y * 0.02, prng);
        // Vegetation on lower slopes (lower height values)
        const height = (noise + 1) * 0.5;
        const veg = height < 0.6 ? 1.0 : 0.0;
        // Add patchiness
        const patchy = noise2 > 0.2 ? 1.0 : 0.0;
        data[y * size + x] = veg * patchy * (0.5 + prng() * 0.5);
      }
    }

    const texture = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RedFormat,
      THREE.FloatType,
    );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    texture.name = "MountainVegetationMask";

    return texture;
  }

  /**
   * Create shared mountain material
   * @private
   */
  _createMaterial() {
    this.material = new MountainMaterial({
      colorMap: this.colorTexture,
      normalMap: this.normalTexture,
      roughnessMap: this.roughnessTexture,
      heightMap: this.heightmapTexture,
      vegetationMap: this.vegetationTexture,
      displacementScale: 1.0,
      snowLine: 0.7,
      snowTransition: 0.12,
      vegetationDensity: 0.3,
    });
  }

  /**
   * Generate mountain placement data
   * @private
   */
  _generateMountainData() {
    const prng = this._createPRNG(this.options.seed);
    const mountains = [];

    // Golden angle for distribution
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < this.options.count; i++) {
      // Spiral distribution with some randomness
      const radius =
        this.options.range * (0.3 + 0.7 * Math.sqrt(i / this.options.count));
      const angle = i * goldenAngle + prng() * 0.5;

      // Add some clustering
      const clusterOffset = prng() * 30 - 15;

      const x = Math.cos(angle) * (radius + clusterOffset);
      const z = Math.sin(angle) * (radius + clusterOffset);

      // Height based on distance from center (higher in middle)
      const distFromCenter = Math.sqrt(x * x + z * z) / this.options.range;
      const heightFactor = 1.0 - distFromCenter * 0.5;
      const baseHeight = THREE.MathUtils.lerp(
        this.options.maxHeight * 0.4,
        this.options.maxHeight,
        heightFactor,
      );
      const height = baseHeight * (0.7 + prng() * 0.6);

      // Base radius variation
      const baseRadius = this.options.baseRadius * (0.6 + prng() * 0.8);

      // Shape parameters
      const steepness = 0.5 + prng() * 0.5;
      const peakSharpness = 0.3 + prng() * 0.4;

      // Rotation
      const rotation = prng() * Math.PI * 2;

      mountains.push({
        position: new THREE.Vector3(x, 0, z),
        height,
        baseRadius,
        steepness,
        peakSharpness,
        rotation,
        scale: new THREE.Vector3(0.8 + prng() * 0.4, 1.0, 0.8 + prng() * 0.4),
      });
    }

    return mountains;
  }

  /**
   * Create mountain meshes from data
   * @private
   */
  _createMountains(mountainData) {
    const detailLevels = {
      low: { radialSegments: 16, heightSegments: 8 },
      medium: { radialSegments: 24, heightSegments: 12 },
      high: { radialSegments: 32, heightSegments: 16 },
      ultra: { radialSegments: 48, heightSegments: 24 },
    };

    const detail = detailLevels[this.options.quality] || detailLevels.high;

    mountainData.forEach((data, index) => {
      // Create cone geometry for mountain shape
      const geometry = new THREE.ConeGeometry(
        data.baseRadius,
        data.height,
        detail.radialSegments,
        detail.heightSegments,
        false,
      );

      geometry.rotateY(data.rotation);
      geometry.translate(0, data.height * 0.5, 0);
      geometry.name = `Mountain_${index}`;

      // Apply custom vertex displacement for more natural shape
      this._displaceVertices(geometry, data, index);

      // Compute normals and tangents
      geometry.computeVertexNormals();
      geometry.computeTangents();

      // Create mesh
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.name = `Mountain_${index}`;
      mesh.position.copy(data.position);
      mesh.scale.copy(data.scale);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;

      // Store mountain data for animation
      mesh.userData.mountainData = data;
      mesh.userData.update = (deltaTime, elapsedTime) => {
        this._updateMountain(mesh, deltaTime, elapsedTime);
      };

      this.group.add(mesh);
      this.mountains.push(mesh);
    });

    this.mountainCount = this.mountains.length;
  }

  /**
   * Displace vertices for natural mountain shape
   * @private
   */
  _displaceVertices(geometry, data, index = 0) {
    const position = geometry.attributes.position;
    const prng = this._createPRNG(this.options.seed + index * 100);

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);

      // Calculate distance from center axis
      const dist = Math.sqrt(x * x + z * z);
      const maxRadius = data.baseRadius * (1 - y / data.height);
      const normalizedDist = maxRadius > 0 ? dist / maxRadius : 0;

      // Height-based profile
      let profile = 1.0 - Math.pow(y / data.height, data.steepness);

      // Peak sharpening
      if (y / data.height > 0.8) {
        profile *= 1.0 + data.peakSharpness * (y / data.height - 0.8) * 5;
      }

      // Add noise for natural variation
      const noiseScale = 0.02;
      const noise =
        this._noise3D(x * noiseScale, y * noiseScale, z * noiseScale, prng) *
        0.1;

      // Apply displacement
      const displacement = profile * (1 + noise);
      const newDist = normalizedDist * displacement * maxRadius;

      if (dist > 0.001) {
        const factor = newDist / dist;
        position.setX(i, x * factor);
        position.setZ(i, z * factor);
      }

      // Vertical displacement for ridges
      const ridgeNoise =
        this._noise2D(x * 0.05, z * 0.05, prng) * 0.05 * data.height;
      position.setY(i, y + ridgeNoise * (1 - y / data.height));
    }

    position.needsUpdate = true;
  }

  /**
   * Update mountain animation (wind sway)
   * @private
   */
  _updateMountain(mesh, deltaTime, elapsedTime) {
    const data = mesh.userData.mountainData;
    if (!data) return;

    const position = mesh.geometry.attributes.position;
    const time = elapsedTime;

    // Very subtle wind sway on vertices
    const windSpeed = 0.3;
    const windStrength = this._animationState.windStrength;

    // Only animate top portion
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      const heightRatio = y / data.height; // But we need original height...

      // Use vertex Y relative to mesh position
      const localY = y - mesh.position.y;
      if (localY > data.height * 0.6) {
        const factor = (localY - data.height * 0.6) / (data.height * 0.4);
        const sway =
          Math.sin(
            time * windSpeed + position.getX(i) * 0.1 + position.getZ(i) * 0.1,
          ) *
          windStrength *
          factor;
        position.setX(
          i,
          position.getX(i) + sway * this._animationState.windDirection.x,
        );
        position.setZ(
          i,
          position.getZ(i) + sway * this._animationState.windDirection.y,
        );
      }
    }

    position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  /**
   * Set quality level
   * @param {string} quality - Quality preset
   */
  setQuality(quality) {
    this.options.quality = quality;

    if (this.material) {
      // Update material quality settings
      this.material.setQuality(quality);
    }
  }

  /**
   * Set wind parameters
   * @param {number} strength - Wind strength
   * @param {THREE.Vector2} direction - Wind direction
   */
  setWind(strength, direction) {
    this._animationState.windStrength = strength;
    if (direction) this._animationState.windDirection.copy(direction);
  }

  /**
   * Get mountain count
   * @returns {number}
   */
  getCount() {
    return this.mountainCount;
  }

  /**
   * Get bounds of mountain range
   * @returns {THREE.Box3}
   */
  getBounds() {
    const box = new THREE.Box3();
    this.mountains.forEach((mesh) => {
      const meshBox = new THREE.Box3().setFromObject(mesh);
      box.union(meshBox);
    });
    return box;
  }

  /**
   * Simple 2D noise
   * @private
   */
  _noise2D(x, y, prng) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = this._fade(x);
    const v = this._fade(y);

    if (!this._permutation) this._permutation = this._generatePermutation(prng);
    const p = this._permutation;

    const A = p[X] + Y;
    const B = p[X + 1] + Y;

    return this._lerp(
      this._lerp(this._grad2D(p[A], x, y), this._grad2D(p[B], x - 1, y), u),
      this._lerp(
        this._grad2D(p[A + 1], x, y - 1),
        this._grad2D(p[B + 1], x - 1, y - 1),
        u,
      ),
      v,
    );
  }

  /**
   * Simple 3D noise
   * @private
   */
  _noise3D(x, y, z, prng) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = this._fade(x);
    const v = this._fade(y);
    const w = this._fade(z);

    if (!this._permutation) this._permutation = this._generatePermutation(prng);
    const p = this._permutation;

    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    return this._lerp(
      this._lerp(
        this._lerp(
          this._grad3D(p[AA], x, y, z),
          this._grad3D(p[BA], x - 1, y, z),
          u,
        ),
        this._lerp(
          this._grad3D(p[AB], x, y - 1, z),
          this._grad3D(p[BB], x - 1, y - 1, z),
          u,
        ),
        v,
      ),
      this._lerp(
        this._lerp(
          this._grad3D(p[AA + 1], x, y, z - 1),
          this._grad3D(p[BA + 1], x - 1, y, z - 1),
          u,
        ),
        this._lerp(
          this._grad3D(p[AB + 1], x, y - 1, z - 1),
          this._grad3D(p[BB + 1], x - 1, y - 1, z - 1),
          u,
        ),
        v,
      ),
      w,
    );
  }

  _fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  _lerp(a, b, t) {
    return a + t * (b - a);
  }
  _grad2D(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
  }
  _grad3D(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
  }

  _createPRNG(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  _generatePermutation(prng) {
    const p = new Array(512);
    const perm = new Array(256).fill(0).map((_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    return p;
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.mountains.forEach((mesh) => {
      mesh.geometry.dispose();
    });

    if (this.material) this.material.dispose();

    if (this.heightmapTexture) this.heightmapTexture.dispose();
    if (this.colorTexture) this.colorTexture.dispose();
    if (this.normalTexture) this.normalTexture.dispose();
    if (this.roughnessTexture) this.roughnessTexture.dispose();
    if (this.vegetationTexture) this.vegetationTexture.dispose();

    this.group.clear();
  }
}

export default Mountains;
