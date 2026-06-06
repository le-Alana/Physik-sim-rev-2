/**
 * Sky - Procedural Sky with Volumetric Clouds
 * 
 * Implements a physically-based sky model with:
 * - Rayleigh/Mie scattering for atmospheric effects
 * - Volumetric 3D clouds using ray-marching
 * - Dynamic sun positioning
 * - Time-of-day transitions
 * 
 * @module scene/Sky
 * @version 1.0.0
 */

import * as THREE from 'three';
import { ProceduralTextures } from '../utils/ProceduralTextures.js';

/**
 * Sky configuration options
 * @typedef {Object} SkyOptions
 * @property {number} radius - Sky dome radius
 * @property {string} quality - Quality preset
 * @property {THREE.Vector3} sunPosition - Sun position
 * @property {number} turbidity - Atmospheric turbidity
 * @property {number} rayleigh - Rayleigh scattering coefficient
 * @property {number} mieCoefficient - Mie scattering coefficient
 * @property {number} mieDirectionalG - Mie directional factor
 */

/**
 * Sky shader for atmospheric scattering
 */
const SkyShader = {
  uniforms: {
    'sunPosition': { value: new THREE.Vector3(0, 1, 0) },
    'turbidity': { value: 2.0 },
    'rayleigh': { value: 1.0 },
    'mieCoefficient': { value: 0.005 },
    'mieDirectionalG': { value: 0.8 },
    'luminance': { value: 1.0 },
    'saturation': { value: 1.0 },
    'groundColor': { value: new THREE.Color(0.3, 0.35, 0.4) },
    'cameraPos': { value: new THREE.Vector3() },
    'time': { value: 0 },
    'cloudTexture': { value: null },
    'cloudOffset': { value: new THREE.Vector2(0, 0) },
    'cloudScale': { value: 1.0 },
    'cloudSpeed': { value: 0.5 }
  },

  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,

  fragmentShader: `
    #include <common>
    
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    uniform vec3 sunPosition;
    uniform float turbidity;
    uniform float rayleigh;
    uniform float mieCoefficient;
    uniform float mieDirectionalG;
    uniform float luminance;
    uniform float saturation;
    uniform vec3 groundColor;
    uniform vec3 cameraPos;
    uniform float time;
    uniform sampler2D cloudTexture;
    uniform vec2 cloudOffset;
    uniform float cloudScale;
    uniform float cloudSpeed;

    // Constants for atmospheric scattering
    const vec3 lambda = vec3(680E-9, 550E-9, 450E-9); // RGB wavelengths in meters
    const vec3 betaR = vec3(5.8E-6, 13.5E-6, 33.1E-6); // Rayleigh scattering coefficients
    const float n = 1.0003; // Refractive index of air
    const float N = 2.545E25; // Number density of air molecules

    // Mie scattering phase function
    float miePhase(float cosTheta, float g) {
      float g2 = g * g;
      float denom = 1.0 + g2 - 2.0 * g * cosTheta;
      return (1.0 - g2) / (denom * sqrt(denom));
    }

    // Rayleigh phase function
    float rayleighPhase(float cosTheta) {
      return 0.75 * (1.0 + cosTheta * cosTheta);
    }

    // Optical depth calculation
    float getOpticalDepth(float altitude, float scaleHeight) {
      return exp(-altitude / scaleHeight);
    }

    // Sample clouds
    vec3 sampleClouds(vec3 rayDir, vec3 rayOrigin) {
      // Project ray to cloud layer
      float cloudAltitude = 8000.0; // Cloud layer height
      float t = (cloudAltitude - rayOrigin.y) / rayDir.y;
      
      if (t <= 0.0) return vec3(0.0);
      
      vec3 cloudPos = rayOrigin + rayDir * t;
      vec2 cloudUv = cloudPos.xz * cloudScale * 0.001 + cloudOffset + time * cloudSpeed * 0.001;
      
      float cloudDensity = texture2D(cloudTexture, cloudUv).r;
      
      // Add 3D detail using multiple octaves
      float detail1 = texture2D(cloudTexture, cloudUv * 2.0 + time * 0.0005).r;
      float detail2 = texture2D(cloudTexture, cloudUv * 4.0 - time * 0.0003).r;
      cloudDensity = mix(cloudDensity, detail1, 0.5);
      cloudDensity = mix(cloudDensity, detail2, 0.25);
      
      // Cloud color - white with slight blue tint from sky
      vec3 cloudColor = vec3(1.0, 0.98, 0.95);
      
      // Silver lining effect
      float sunDot = max(dot(normalize(rayDir), normalize(sunPosition)), 0.0);
      float silverLining = pow(sunDot, 32.0) * 0.3;
      cloudColor += vec3(silverLining);
      
      return cloudColor * cloudDensity * cloudDensity;
    }

    // Tonemap
    vec3 tonemap(vec3 color) {
      // ACES filmic approximation
      const float a = 2.51;
      const float b = 0.03;
      const float c = 2.43;
      const float d = 0.59;
      const float e = 0.14;
      
      color = (color * (a * color + b)) / (color * (c * color + d) + e);
      return clamp(color, 0.0, 1.0);
    }

    void main() {
      vec3 viewDir = normalize(vWorldPosition - cameraPos);
      vec3 sunDir = normalize(sunPosition);
      
      // Cosine of angle between view and sun
      float cosTheta = dot(viewDir, sunDir);
      
      // Distance to sky dome
      float distance = length(vWorldPosition - cameraPos);
      
      // Altitude-based density
      float altitude = max(vWorldPosition.y - cameraPos.y, 0.0);
      
      // Rayleigh scattering
      vec3 betaRTotal = betaR * rayleigh;
      float rayleighPhaseVal = rayleighPhase(cosTheta);
      vec3 rayleighColor = betaRTotal * rayleighPhaseVal;
      
      // Mie scattering
      float miePhaseVal = miePhase(cosTheta, mieDirectionalG);
      vec3 mieColor = vec3(mieCoefficient) * miePhaseVal;
      
      // Combined scattering
      vec3 scatterColor = (rayleighColor + mieColor) * luminance;
      
      // Apply optical depth (atmosphere thins with altitude)
      float opticalDepth = getOpticalDepth(altitude, 8000.0);
      scatterColor *= opticalDepth;
      
      // Ground color reflection (for viewing downward)
      float viewDown = dot(viewDir, vec3(0, -1, 0));
      vec3 color = scatterColor;
      
      if (viewDown > 0.0) {
        // Looking at ground - blend with ground color
        color = mix(scatterColor, groundColor, viewDown * 0.5);
      }
      
      // Sun disk
      float sunDisk = smoothstep(0.9999, 0.99999, cosTheta);
      color += vec3(1.0, 0.9, 0.7) * sunDisk * 100.0 * luminance;
      
      // Sun glow
      float sunGlow = smoothstep(0.95, 0.999, cosTheta);
      color += vec3(1.0, 0.8, 0.5) * sunGlow * 5.0 * luminance;
      
      // Sample volumetric clouds
      vec3 cloudColor = sampleClouds(viewDir, cameraPos);
      color += cloudColor * luminance;
      
      // Cloud shadows on sky
      if (cloudColor.r > 0.1) {
        color *= 0.7; // Darken sky behind thick clouds
      }
      
      // Saturation
      float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(lum), color, saturation);
      
      // Tonemap
      color = tonemap(color);
      
      // Gamma correction
      color = pow(color, vec3(1.0 / 2.2));
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

/**
 * Volumetric Cloud Shader - For 3D cloud rendering
 */
const CloudVolumeShader = {
  uniforms: {
    'cameraPos': { value: new THREE.Vector3() },
    'sunPosition': { value: new THREE.Vector3(0, 1, 0) },
    'cloudTexture': { value: null },
    'weatherTexture': { value: null },
    'time': { value: 0 },
    'cloudScale': { value: 1.0 },
    'cloudSpeed': { value: 1.0 },
    'density': { value: 1.0 },
    'absorption': { value: 0.5 },
    'phaseG': { value: 0.6 },
    'samples': { value: 64 },
    'maxDistance': { value: 10000 },
    'cloudBase': { value: 6000 },
    'cloudTop': { value: 12000 }
  },

  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,

  fragmentShader: `
    #include <common>
    
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    uniform vec3 cameraPos;
    uniform vec3 sunPosition;
    uniform sampler2D cloudTexture;
    uniform sampler2D weatherTexture;
    uniform float time;
    uniform float cloudScale;
    uniform float cloudSpeed;
    uniform float density;
    uniform float absorption;
    uniform float phaseG;
    uniform int samples;
    uniform float maxDistance;
    uniform float cloudBase;
    uniform float cloudTop;

    // Henyey-Greenstein phase function
    float henyeyGreenstein(float cosTheta, float g) {
      float g2 = g * g;
      float denom = 1.0 + g2 - 2.0 * g * cosTheta;
      return (1.0 - g2) / (PI * denom * sqrt(denom));
    }

    // Sample 3D noise from 2D texture (pseudo-3D)
    float sampleWeather(vec3 pos) {
      vec2 uv1 = pos.xz * 0.001 + time * 0.0001;
      vec2 uv2 = pos.xz * 0.002 - time * 0.00005;
      float n1 = texture2D(weatherTexture, uv1).r;
      float n2 = texture2D(weatherTexture, uv2).r;
      // Add height variation
      float heightFactor = smoothstep(cloudBase, cloudTop, pos.y);
      return (n1 + n2 * 0.5) * heightFactor;
    }

    // Ray-march through cloud volume
    vec4 rayMarch(vec3 rayOrigin, vec3 rayDir) {
      vec3 sunDir = normalize(sunPosition);
      
      // Find entry point to cloud layer
      float tEntry = (cloudBase - rayOrigin.y) / rayDir.y;
      float tExit = (cloudTop - rayOrigin.y) / rayDir.y;
      
      if (tExit <= 0.0 || tEntry > tExit) {
        return vec4(0.0);
      }
      
      tEntry = max(tEntry, 0.0);
      vec3 pos = rayOrigin + rayDir * tEntry;
      
      float stepSize = (tExit - tEntry) / float(samples);
      vec3 color = vec3(0.0);
      float transmittance = 1.0;
      
      for (int i = 0; i < 128; i++) {
        if (i >= samples) break;
        if (pos.y > cloudTop) break;
        if (transmittance < 0.01) break;
        
        // Sample cloud density
        float cloudDensity = sampleWeather(pos) * density;
        
        if (cloudDensity > 0.01) {
          // Lighting
          float cosTheta = max(dot(-rayDir, sunDir), 0.0);
          float phase = henyeyGreenstein(cosTheta, phaseG);
          
          // Silver lining
          float silverLining = pow(cosTheta, 50.0) * 0.5;
          
          // Cloud color
          vec3 cloudColor = vec3(1.0, 0.99, 0.95) + vec3(silverLining);
          
          // Light absorption through cloud
          float lightTransmittance = exp(-cloudDensity * absorption * stepSize);
          
          // Accumulate
          color += cloudColor * cloudDensity * phase * transmittance * stepSize;
          transmittance *= lightTransmittance;
        }
        
        pos += rayDir * stepSize;
      }
      
      return vec4(color, 1.0 - transmittance);
    }

    void main() {
      vec3 rayDir = normalize(vWorldPosition - cameraPos);
      vec4 cloudColor = rayMarch(cameraPos, rayDir);
      
      // Premultiply alpha
      gl_FragColor = vec4(cloudColor.rgb * cloudColor.a, cloudColor.a);
    }
  `
};

/**
 * Sky class for atmospheric sky with volumetric clouds
 */
export class Sky {
  /**
   * @param {SkyOptions} options - Sky options
   */
  constructor(options = {}) {
    this.options = {
      radius: 5000,
      quality: 'high',
      sunPosition: new THREE.Vector3(100, 80, 50),
      turbidity: 2.0,
      rayleigh: 1.0,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.8,
      ...options
    };

    /** @type {THREE.Mesh} */
    this.mesh = null;
    /** @type {THREE.Mesh} */
    this.cloudMesh = null;
    /** @type {THREE.ShaderMaterial} */
    this.skyMaterial = null;
    /** @type {THREE.ShaderMaterial} */
    this.cloudMaterial = null;
    /** @type {THREE.Texture} */
    this.cloudTexture = null;
    /** @type {THREE.Texture} */
    this.weatherTexture = null;
    
    /** @type {Object} */
    this._animationState = {
      time: 0,
      cloudOffset: new THREE.Vector2(0, 0),
      sunAngle: 0
    };
  }

  /**
   * Build the sky and clouds
   * @returns {Promise<void>}
   */
  async build() {
    console.log('[Sky] Building sky dome and volumetric clouds...');

    // Generate procedural textures
    this._generateTextures();

    // Create sky dome material
    this._createSkyMaterial();

    // Create cloud volume material
    this._createCloudMaterial();

    // Create meshes
    this._createMeshes();

    console.log('[Sky] Sky built successfully');
  }

  /**
   * Generate procedural textures for clouds
   * @private
   */
  _generateTextures() {
    const qualitySettings = {
      low: { cloudSize: 128, weatherSize: 64 },
      medium: { cloudSize: 256, weatherSize: 128 },
      high: { cloudSize: 512, weatherSize: 256 },
      ultra: { cloudSize: 1024, weatherSize: 512 }
    };

    const settings = qualitySettings[this.options.quality] || qualitySettings.high;

    // Cloud noise texture (2D for sky dome)
    this.cloudTexture = ProceduralTextures.generateCloudNoise(settings.cloudSize, {
      octaves: 5,
      persistence: 0.5,
      lacunarity: 2.0,
      gain: 0.5
    });

    // Weather map for volumetric clouds (3D-like)
    this.weatherTexture = ProceduralTextures.generateNoise(settings.weatherSize, {
      octaves: 6,
      persistence: 0.55,
      scale: 2.0
    });

    // Also create 3D noise for higher quality volumetric clouds
    if (this.options.quality === 'high' || this.options.quality === 'ultra') {
      this.cloudVolumeTexture = ProceduralTextures.generateCloudNoise3D(
        this.options.quality === 'ultra' ? 64 : 48,
        { octaves: 4, persistence: 0.5 }
      );
    }
  }

  /**
   * Create sky dome shader material
   * @private
   */
  _createSkyMaterial() {
    this.skyMaterial = new THREE.ShaderMaterial({
      name: 'SkyAtmosphere',
      uniforms: THREE.UniformsUtils.clone(SkyShader.uniforms),
      vertexShader: SkyShader.vertexShader,
      fragmentShader: SkyShader.fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });

    // Set initial uniforms
    this.skyMaterial.uniforms.sunPosition.value.copy(this.options.sunPosition);
    this.skyMaterial.uniforms.turbidity.value = this.options.turbidity;
    this.skyMaterial.uniforms.rayleigh.value = this.options.rayleigh;
    this.skyMaterial.uniforms.mieCoefficient.value = this.options.mieCoefficient;
    this.skyMaterial.uniforms.mieDirectionalG.value = this.options.mieDirectionalG;
    this.skyMaterial.uniforms.cloudTexture.value = this.cloudTexture;
  }

  /**
   * Create volumetric cloud shader material
   * @private
   */
  _createCloudMaterial() {
    this.cloudMaterial = new THREE.ShaderMaterial({
      name: 'VolumetricClouds',
      uniforms: THREE.UniformsUtils.clone(CloudVolumeShader.uniforms),
      vertexShader: CloudVolumeShader.vertexShader,
      fragmentShader: CloudVolumeShader.fragmentShader,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      fog: false
    });

    // Set initial uniforms
    const cloudUniforms = this.cloudMaterial.uniforms;
    cloudUniforms.sunPosition.value.copy(this.options.sunPosition);
    cloudUniforms.cloudTexture.value = this.cloudTexture;
    cloudUniforms.weatherTexture.value = this.weatherTexture;
    cloudUniforms.cloudBase.value = this.options.radius * 0.8;
    cloudUniforms.cloudTop.value = this.options.radius;
    
    // Quality-based sample count
    const sampleCounts = { low: 16, medium: 32, high: 64, ultra: 96 };
    cloudUniforms.samples.value = sampleCounts[this.options.quality] || 64;
  }

  /**
   * Create sky and cloud meshes
   * @private
   */
  _createMeshes() {
    // Sky dome - large sphere
    const skyGeometry = new THREE.SphereGeometry(this.options.radius, 32, 32);
    this.mesh = new THREE.Mesh(skyGeometry, this.skyMaterial);
    this.mesh.name = 'SkyDome';
    this.mesh.frustumCulled = false;

    // Cloud volume - slightly larger sphere for clouds
    const cloudGeometry = new THREE.SphereGeometry(this.options.radius * 1.02, 32, 32);
    this.cloudMesh = new THREE.Mesh(cloudGeometry, this.cloudMaterial);
    this.cloudMesh.name = 'CloudVolume';
    this.cloudMesh.frustumCulled = false;
    this.cloudMesh.renderOrder = -1; // Render before sky dome

    // Add cloud mesh as child of sky mesh for unified transform
    this.mesh.add(this.cloudMesh);
  }

  /**
   * Update sky animation
   * @param {number} deltaTime - Frame delta time
   * @param {number} elapsedTime - Total elapsed time
   */
  update(deltaTime, elapsedTime) {
    this._animationState.time = elapsedTime;

    // Animate cloud movement
    this._animationState.cloudOffset.x += deltaTime * 0.0001;
    this._animationState.cloudOffset.y += deltaTime * 0.00005;

    // Update sky material uniforms
    if (this.skyMaterial) {
      this.skyMaterial.uniforms.time.value = elapsedTime;
      this.skyMaterial.uniforms.cloudOffset.value.copy(this._animationState.cloudOffset);
    }

    // Update cloud material uniforms
    if (this.cloudMaterial) {
      this.cloudMaterial.uniforms.time.value = elapsedTime;
      this.cloudMaterial.uniforms.cameraPos.value.copy(
        this.mesh.parent?.worldToLocal?.(new THREE.Vector3()) || new THREE.Vector3()
      );
    }
  }

  /**
   * Set sun position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} z - Z position
   */
  setSunPosition(x, y, z) {
    this.options.sunPosition.set(x, y, z);
    
    if (this.skyMaterial) {
      this.skyMaterial.uniforms.sunPosition.value.set(x, y, z);
    }
    if (this.cloudMaterial) {
      this.cloudMaterial.uniforms.sunPosition.value.set(x, y, z);
    }
  }

  /**
   * Set sun position from vector
   * @param {THREE.Vector3} position - Sun position
   */
  setSunPositionVec(position) {
    this.setSunPosition(position.x, position.y, position.z);
  }

  /**
   * Set atmospheric parameters
   * @param {Object} params - Atmospheric parameters
   */
  setAtmosphere(params) {
    if (this.skyMaterial) {
      if (params.turbidity !== undefined) this.skyMaterial.uniforms.turbidity.value = params.turbidity;
      if (params.rayleigh !== undefined) this.skyMaterial.uniforms.rayleigh.value = params.rayleigh;
      if (params.mieCoefficient !== undefined) this.skyMaterial.uniforms.mieCoefficient.value = params.mieCoefficient;
      if (params.mieDirectionalG !== undefined) this.skyMaterial.uniforms.mieDirectionalG.value = params.mieDirectionalG;
      if (params.luminance !== undefined) this.skyMaterial.uniforms.luminance.value = params.luminance;
      if (params.saturation !== undefined) this.skyMaterial.uniforms.saturation.value = params.saturation;
      if (params.groundColor !== undefined) this.skyMaterial.uniforms.groundColor.value.copy(params.groundColor);
    }
  }

  /**
   * Set cloud parameters
   * @param {Object} params - Cloud parameters
   */
  setClouds(params) {
    if (this.cloudMaterial) {
      if (params.density !== undefined) this.cloudMaterial.uniforms.density.value = params.density;
      if (params.absorption !== undefined) this.cloudMaterial.uniforms.absorption.value = params.absorption;
      if (params.phaseG !== undefined) this.cloudMaterial.uniforms.phaseG.value = params.phaseG;
      if (params.speed !== undefined) this.cloudMaterial.uniforms.cloudSpeed.value = params.speed;
      if (params.scale !== undefined) this.cloudMaterial.uniforms.cloudScale.value = params.scale;
    }
  }

  /**
   * Set quality level
   * @param {string} quality - Quality preset
   */
  setQuality(quality) {
    this.options.quality = quality;
    
    // Update sample count
    const sampleCounts = { low: 16, medium: 32, high: 64, ultra: 96 };
    if (this.cloudMaterial) {
      this.cloudMaterial.uniforms.samples.value = sampleCounts[quality] || 64;
    }
  }

  /**
   * Get current sun position
   * @returns {THREE.Vector3}
   */
  getSunPosition() {
    return this.options.sunPosition.clone();
  }

  /**
   * Dispose of resources
   */
  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (this.skyMaterial) this.skyMaterial.dispose();
    }
    if (this.cloudMesh) {
      this.cloudMesh.geometry.dispose();
      if (this.cloudMaterial) this.cloudMaterial.dispose();
    }
    if (this.cloudTexture) this.cloudTexture.dispose();
    if (this.weatherTexture) this.weatherTexture.dispose();
    if (this.cloudVolumeTexture) this.cloudVolumeTexture.dispose();
  }
}

export default Sky;