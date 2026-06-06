/**
 * ProceduralTextures - Runtime Texture Generation
 * 
 * Generates procedural textures for noise, wear, scratches,
 * clouds, and other effects without external assets.
 * 
 * @module utils/ProceduralTextures
 * @version 1.0.0
 */

import * as THREE from 'three';

/**
 * ProceduralTextures - Static utility for generating textures
 */
export class ProceduralTextures {
  /**
   * Generate simplex/perlin noise texture
   * @param {number} size - Texture size (power of 2)
   * @param {Object} options - Noise options
   * @returns {THREE.DataTexture}
   */
  static generateNoise(size = 256, options = {}) {
    const {
      octaves = 4,
      persistence = 0.5,
      scale = 1.0,
      seed = Math.random() * 10000,
      type = THREE.FloatType,
      format = THREE.RedFormat
    } = options;

    const data = new Float32Array(size * size);
    const prng = this._createPRNG(seed);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let value = 0;
        let amplitude = 1;
        let frequency = scale / size;
        let maxValue = 0;

        for (let o = 0; o < octaves; o++) {
          const nx = x * frequency;
          const ny = y * frequency;
          value += this._perlin2D(nx, ny, prng) * amplitude;
          maxValue += amplitude;
          amplitude *= persistence;
          frequency *= 2;
        }

        data[y * size + x] = value / maxValue;
      }
    }

    const texture = new THREE.DataTexture(data, size, size, format, type);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    texture.name = 'ProceduralNoise';

    return texture;
  }

  /**
   * Generate 3D noise texture (for volumetric effects)
   * @param {number} size - Texture size
   * @param {Object} options - Noise options
   * @returns {THREE.DataTexture3D}
   */
  static generateNoise3D(size = 64, options = {}) {
    const {
      octaves = 3,
      persistence = 0.5,
      scale = 1.0,
      seed = Math.random() * 10000
    } = options;

    const data = new Float32Array(size * size * size);
    const prng = this._createPRNG(seed);

    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let value = 0;
          let amplitude = 1;
          let frequency = scale / size;
          let maxValue = 0;

          for (let o = 0; o < octaves; o++) {
            const nx = x * frequency;
            const ny = y * frequency;
            const nz = z * frequency;
            value += this._perlin3D(nx, ny, nz, prng) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
          }

          data[(z * size + y) * size + x] = value / maxValue;
        }
      }
    }

    const texture = new THREE.DataTexture3D(data, size, size, size);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.wrapR = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    texture.name = 'ProceduralNoise3D';

    return texture;
  }

  /**
   * Generate wear/scratch texture
   * @param {number} size - Texture size
   * @param {Object} options - Wear options
   * @returns {THREE.DataTexture}
   */
  static generateWear(size = 512, options = {}) {
    const {
      scratchCount = 200,
      scratchWidth = 0.002,
      scratchLength = 0.3,
      dustDensity = 0.05,
      edgeWear = 0.3,
      seed = Math.random() * 10000
    } = options;

    const data = new Uint8Array(size * size * 4);
    const prng = this._createPRNG(seed);

    // Base layer - subtle noise
    for (let i = 0; i < size * size; i++) {
      const noise = this._hash(prng(), prng()) * 0.1;
      data[i * 4] = Math.floor(noise * 255);     // R - wear amount
      data[i * 4 + 1] = Math.floor(noise * 255); // G - scratch mask
      data[i * 4 + 2] = 0;                        // B - reserved
      data[i * 4 + 3] = 255;                      // A - valid
    }

    // Add scratches
    for (let i = 0; i < scratchCount; i++) {
      const cx = prng() * size;
      const cy = prng() * size;
      const angle = prng() * Math.PI * 2;
      const length = scratchLength * size * (0.5 + prng() * 0.5);
      const width = Math.max(1, scratchWidth * size);

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      for (let l = 0; l < length; l++) {
        const x = Math.floor(cx + cosA * l + (prng() - 0.5) * 2);
        const y = Math.floor(cy + sinA * l + (prng() - 0.5) * 2);

        for (let w = -width; w <= width; w++) {
          const px = Math.floor(x + sinA * w);
          const py = Math.floor(y - cosA * w);

          if (px >= 0 && px < size && py >= 0 && py < size) {
            const idx = (py * size + px) * 4;
            // Scratch intensity falls off from center
            const falloff = 1.0 - Math.abs(w) / (width + 1);
            data[idx + 1] = Math.min(255, data[idx + 1] + Math.floor(falloff * 200));
          }
        }
      }
    }

    // Add dust speckles
    const dustCount = Math.floor(size * size * dustDensity);
    for (let i = 0; i < dustCount; i++) {
      const x = Math.floor(prng() * size);
      const y = Math.floor(prng() * size);
      const idx = (y * size + x) * 4;
      const intensity = prng() * 100;
      data[idx] = Math.min(255, data[idx] + Math.floor(intensity));
    }

    // Edge wear
    const edgeDist = Math.floor(size * edgeWear);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const distX = Math.min(x, size - 1 - x);
        const distY = Math.min(y, size - 1 - y);
        const dist = Math.min(distX, distY);
        
        if (dist < edgeDist) {
          const idx = (y * size + x) * 4;
          const factor = 1.0 - dist / edgeDist;
          data[idx] = Math.min(255, data[idx] + Math.floor(factor * 150));
        }
      }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    texture.name = 'ProceduralWear';

    return texture;
  }

  /**
   * Generate curvature/ambient occlusion texture from height map
   * @param {THREE.Texture} heightMap - Input height map
   * @param {number} size - Output size
   * @returns {THREE.DataTexture}
   */
  static generateCurvature(heightMap, size = 512) {
    // This would require reading the height map pixels
    // For now, generate a procedural approximation
    return this.generateNoise(size, { octaves: 6, persistence: 0.6, scale: 2.0 });
  }

  /**
   * Generate cloud noise texture (for volumetric clouds)
   * @param {number} size - Texture size
   * @param {Object} options - Cloud options
   * @returns {THREE.DataTexture}
   */
  static generateCloudNoise(size = 256, options = {}) {
    const {
      octaves = 5,
      persistence = 0.5,
      lacunarity = 2.0,
      gain = 0.5,
      seed = Math.random() * 10000
    } = options;

    const data = new Float32Array(size * size);
    const prng = this._createPRNG(seed);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1.0 / size;
        let maxValue = 0;

        for (let o = 0; o < octaves; o++) {
          const nx = x * frequency;
          const ny = y * frequency;
          // Ridged noise for cloud-like shapes
          const n = Math.abs(this._perlin2D(nx, ny, prng));
          value += (1.0 - n) * amplitude;
          maxValue += amplitude;
          amplitude *= persistence;
          frequency *= lacunarity;
        }

        // Apply gain for contrast
        const normalized = value / maxValue;
        data[y * size + x] = Math.pow(normalized, gain);
      }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.FloatType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    texture.name = 'ProceduralCloudNoise';

    return texture;
  }

  /**
   * Generate 3D cloud noise (for volumetric rendering)
   * @param {number} size - Texture size
   * @param {Object} options - Cloud options
   * @returns {THREE.DataTexture3D}
   */
  static generateCloudNoise3D(size = 64, options = {}) {
    const {
      octaves = 4,
      persistence = 0.5,
      lacunarity = 2.0,
      seed = Math.random() * 10000
    } = options;

    const data = new Float32Array(size * size * size);
    const prng = this._createPRNG(seed);

    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let value = 0;
          let amplitude = 1;
          let frequency = 1.0 / size;
          let maxValue = 0;

          for (let o = 0; o < octaves; o++) {
            const nx = x * frequency;
            const ny = y * frequency;
            const nz = z * frequency;
            const n = Math.abs(this._perlin3D(nx, ny, nz, prng));
            value += (1.0 - n) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
          }

          data[(z * size + y) * size + x] = value / maxValue;
        }
      }
    }

    const texture = new THREE.DataTexture3D(data, size, size, size);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.wrapR = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    texture.name = 'ProceduralCloudNoise3D';

    return texture;
  }

  /**
   * Generate dance floor pattern texture
   * @param {number} size - Texture size
   * @param {Object} options - Pattern options
   * @returns {THREE.DataTexture}
   */
  static generateDanceFloor(size = 512, options = {}) {
    const {
      tileSize = 64,
      grooveWidth = 2,
      tileColor1 = [0.15, 0.15, 0.2],
      tileColor2 = [0.1, 0.1, 0.15],
      grooveColor = [0.05, 0.05, 0.1],
      reflectivity = 0.3,
      seed = Math.random() * 10000
    } = options;

    const data = new Float32Array(size * size * 4);
    const prng = this._createPRNG(seed);
    const tilesPerRow = Math.floor(size / tileSize);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const tileX = Math.floor(x / tileSize);
        const tileY = Math.floor(y / tileSize);
        const inTileX = x % tileSize;
        const inTileY = y % tileSize;

        // Check if in groove
        const inGrooveX = inTileX < grooveWidth || inTileX >= tileSize - grooveWidth;
        const inGrooveY = inTileY < grooveWidth || inTileY >= tileSize - grooveWidth;

        const idx = (y * size + x) * 4;

        if (inGrooveX || inGrooveY) {
          // Groove
          data[idx] = grooveColor[0];
          data[idx + 1] = grooveColor[1];
          data[idx + 2] = grooveColor[2];
          data[idx + 3] = 0.1; // Low roughness in grooves
        } else {
          // Tile - alternating pattern
          const isEven = (tileX + tileY) % 2 === 0;
          const color = isEven ? tileColor1 : tileColor2;
          
          // Add subtle variation per tile
          const variation = (prng() - 0.5) * 0.02;
          
          data[idx] = color[0] + variation;
          data[idx + 1] = color[1] + variation;
          data[idx + 2] = color[2] + variation;
          data[idx + 3] = reflectivity + (prng() - 0.5) * 0.1; // Metallic/roughness variation
        }
      }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    texture.needsUpdate = true;
    texture.name = 'ProceduralDanceFloor';

    return texture;
  }

  /**
   * Generate animated light texture for dance floor
   * @param {number} size - Texture size
   * @param {number} frames - Number of animation frames
   * @returns {THREE.DataTexture3D}
   */
  static generateAnimatedLights(size = 256, frames = 32) {
    const data = new Float32Array(size * size * frames * 4);

    for (let f = 0; f < frames; f++) {
      const time = f / frames * Math.PI * 2;
      
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const ux = x / size;
          const uy = y / size;
          
          // Multiple moving lights
          let emission = 0;
          
          // Circular moving lights
          for (let i = 0; i < 8; i++) {
            const angle = time + i * Math.PI / 4;
            const radius = 0.3 + 0.2 * Math.sin(time * 2 + i);
            const lx = 0.5 + radius * Math.cos(angle);
            const ly = 0.5 + radius * Math.sin(angle);
            
            const dx = ux - lx;
            const dy = uy - ly;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            emission += Math.exp(-dist * 30) * (0.5 + 0.5 * Math.sin(time * 5 + i));
          }
          
          // Pulsing center
          const cx = ux - 0.5;
          const cy = uy - 0.5;
          const centerDist = Math.sqrt(cx * cx + cy * cy);
          emission += Math.exp(-centerDist * 20) * (0.5 + 0.5 * Math.sin(time * 3));
          
          // Strobe effects
          if (Math.sin(time * 20) > 0.9) {
            emission += 2.0;
          }

          const idx = ((f * size + y) * size + x) * 4;
          data[idx] = emission;     // R - emission intensity
          data[idx + 1] = emission; // G 
          data[idx + 2] = emission; // B
          data[idx + 3] = 1.0;      // A
        }
      }
    }

    const texture = new THREE.DataTexture3D(data, size, size, frames);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.wrapR = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    texture.name = 'ProceduralAnimatedLights';

    return texture;
  }

  /**
   * Generate mountain heightmap
   * @param {number} size - Texture size
   * @param {Object} options - Mountain options
   * @returns {THREE.DataTexture}
   */
  static generateMountainHeightmap(size = 1024, options = {}) {
    const {
      baseFrequency = 0.005,
      octaves = 8,
      persistence = 0.5,
      lacunarity = 2.0,
      heightScale = 1.0,
      ridgeFactor = 0.8,
      valleyDepth = 0.2,
      seed = Math.random() * 10000
    } = options;

    const data = new Float32Array(size * size);
    const prng = this._createPRNG(seed);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let value = 0;
        let amplitude = 1;
        let frequency = baseFrequency;
        let maxValue = 0;

        for (let o = 0; o < octaves; o++) {
          const nx = x * frequency;
          const ny = y * frequency;
          
          // Ridged multifractal for mountain ridges
          const n = this._perlin2D(nx, ny, prng);
          const ridged = Math.abs(n);
          value += (1.0 - ridged) * amplitude * ridgeFactor;
          
          maxValue += amplitude;
          amplitude *= persistence;
          frequency *= lacunarity;
        }

        // Normalize and apply valley depth
        value = value / maxValue;
        value = Math.pow(value, 1.5); // Sharpen peaks
        value = value * (1.0 - valleyDepth) + valleyDepth;
        value *= heightScale;

        // Add some base elevation
        value = Math.max(value, 0.1);

        data[y * size + x] = value;
      }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.FloatType);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    texture.name = 'ProceduralMountainHeightmap';

    return texture;
  }

  /**
   * Generate mountain color texture (tri-planar friendly)
   * @param {number} size - Texture size
   * @param {Object} options - Color options
   * @returns {THREE.DataTexture}
   */
  static generateMountainColor(size = 512, options = {}) {
    const {
      baseColor = [0.45, 0.35, 0.25],
      highlightColor = [0.55, 0.45, 0.35],
      shadowColor = [0.3, 0.25, 0.2],
      snowColor = [0.95, 0.95, 0.98],
      snowLine = 0.7,
      snowTransition = 0.1,
      seed = Math.random() * 10000
    } = options;

    const data = new Float32Array(size * size * 4);
    const prng = this._createPRNG(seed);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Generate noise for variation
        const noise = this._perlin2D(x * 0.01, y * 0.01, prng);
        const noise2 = this._perlin2D(x * 0.05, y * 0.05, prng);
        
        // Simulate height from noise
        const height = (noise + 1) * 0.5;
        
        // Base color with variation
        const variation = (noise2 + 1) * 0.5 * 0.1 - 0.05;
        
        let r = baseColor[0] + variation;
        let g = baseColor[1] + variation;
        let b = baseColor[2] + variation;

        // Snow blend
        if (height > snowLine - snowTransition) {
          const t = Math.min(1, (height - (snowLine - snowTransition)) / snowTransition);
          r = THREE.MathUtils.lerp(r, snowColor[0], t);
          g = THREE.MathUtils.lerp(g, snowColor[1], t);
          b = THREE.MathUtils.lerp(b, snowColor[2], t);
        }

        // Highlight/shadow based on slope (approximated from noise derivative)
        const slope = (noise + 1) * 0.5;
        if (slope > 0.6) {
          r = THREE.MathUtils.lerp(r, highlightColor[0], (slope - 0.6) * 2.5);
          g = THREE.MathUtils.lerp(g, highlightColor[1], (slope - 0.6) * 2.5);
          b = THREE.MathUtils.lerp(b, highlightColor[2], (slope - 0.6) * 2.5);
        } else if (slope < 0.4) {
          r = THREE.MathUtils.lerp(r, shadowColor[0], (0.4 - slope) * 2.5);
          g = THREE.MathUtils.lerp(g, shadowColor[1], (0.4 - slope) * 2.5);
          b = THREE.MathUtils.lerp(b, shadowColor[2], (0.4 - slope) * 2.5);
        }

        const idx = (y * size + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 1.0;
      }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    texture.name = 'ProceduralMountainColor';

    return texture;
  }

  /**
   * Generate sky gradient texture
   * @param {number} width - Width
   * @param {number} height - Height
   * @param {Object} options - Sky options
   * @returns {THREE.DataTexture}
   */
  static generateSkyGradient(width = 512, height = 256, options = {}) {
    const {
      zenithColor = [0.3, 0.5, 0.8],
      horizonColor = [0.9, 0.7, 0.5],
      groundColor = [0.2, 0.25, 0.3],
      sunPosition = 0.5, // 0-1 horizontal position
      sunSize = 0.1,
      sunIntensity = 2.0
    } = options;

    const data = new Float32Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      const v = y / (height - 1); // 0 at top (zenith), 1 at bottom (horizon)
      
      for (let x = 0; x < width; x++) {
        const u = x / (width - 1);
        
        // Base gradient
        const t = Math.pow(v, 0.7); // Non-linear for more natural look
        let r = THREE.MathUtils.lerp(zenithColor[0], horizonColor[0], t);
        let g = THREE.MathUtils.lerp(zenithColor[1], horizonColor[1], t);
        let b = THREE.MathUtils.lerp(zenithColor[2], horizonColor[2], t);

        // Sun
        const sunU = sunPosition;
        const sunV = 0.85; // Near horizon
        const du = u - sunU;
        const dv = v - sunV;
        const sunDist = Math.sqrt(du * du * 4 + dv * dv); // Elliptical
        
        if (sunDist < sunSize) {
          const intensity = Math.pow(1 - sunDist / sunSize, 4) * sunIntensity;
          r += intensity * 1.0;
          g += intensity * 0.8;
          b += intensity * 0.4;
        }

        // Ground fade
        if (v > 0.9) {
          const gt = (v - 0.9) / 0.1;
          r = THREE.MathUtils.lerp(r, groundColor[0], gt);
          g = THREE.MathUtils.lerp(g, groundColor[1], gt);
          b = THREE.MathUtils.lerp(b, groundColor[2], gt);
        }

        const idx = (y * width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 1.0;
      }
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    texture.name = 'ProceduralSkyGradient';

    return texture;
  }

  /**
   * 2D Perlin noise
   * @private
   */
  static _perlin2D(x, y, prng) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = this._fade(x);
    const v = this._fade(y);

    // Generate permutation table on first call
    if (!this._permutation) {
      this._permutation = this._generatePermutation(prng);
    }
    const p = this._permutation;

    const A = p[X] + Y;
    const B = p[X + 1] + Y;

    const grad00 = this._grad2D(p[A], x, y);
    const grad10 = this._grad2D(p[B], x - 1, y);
    const grad01 = this._grad2D(p[A + 1], x, y - 1);
    const grad11 = this._grad2D(p[B + 1], x - 1, y - 1);

    return this._lerp(this._lerp(grad00, grad10, u), this._lerp(grad01, grad11, u), v);
  }

  /**
   * 3D Perlin noise
   * @private
   */
  static _perlin3D(x, y, z, prng) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = this._fade(x);
    const v = this._fade(y);
    const w = this._fade(z);

    if (!this._permutation) {
      this._permutation = this._generatePermutation(prng);
    }
    const p = this._permutation;

    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    return this._lerp(
      this._lerp(
        this._lerp(this._grad3D(p[AA], x, y, z), this._grad3D(p[BA], x - 1, y, z), u),
        this._lerp(this._grad3D(p[AB], x, y - 1, z), this._grad3D(p[BB], x - 1, y - 1, z), u),
        v
      ),
      this._lerp(
        this._lerp(this._grad3D(p[AA + 1], x, y, z - 1), this._grad3D(p[BA + 1], x - 1, y, z - 1), u),
        this._lerp(this._grad3D(p[AB + 1], x, y - 1, z - 1), this._grad3D(p[BB + 1], x - 1, y - 1, z - 1), u),
        v
      ),
      w
    );
  }

  static _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  static _lerp(a, b, t) { return a + t * (b - a); }

  static _grad2D(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  static _grad3D(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  static _hash(a, b) {
    return this._hashSingle(a * 31 + b);
  }

  static _hashSingle(x) {
    x = (x ^ 61) ^ (x >>> 16);
    x = x + (x << 3);
    x = x ^ (x >>> 4);
    x = x * 0x27d4eb2d;
    x = x ^ (x >>> 15);
    return (x >>> 0) / 4294967296;
  }

  static _createPRNG(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  static _generatePermutation(prng) {
    const p = new Array(512);
    const perm = new Array(256);
    
    for (let i = 0; i < 256; i++) perm[i] = i;
    
    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    
    for (let i = 0; i < 512; i++) {
      p[i] = perm[i & 255];
    }
    
    return p;
  }
}

export default ProceduralTextures;