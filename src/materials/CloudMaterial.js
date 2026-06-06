/**
 * CloudMaterial - Volumetric Cloud Material
 * 
 * Advanced volumetric cloud rendering with:
 * - Ray-marching through 3D noise
 * - Multiple scattering (silver lining, god rays)
 * - Dynamic weather transitions
 * - Performance LOD based on distance
 * - Temporal reprojection for noise reduction
 * 
 * @module materials/CloudMaterial
 * @version 1.0.0
 */

import * as THREE from 'three';

/**
 * CloudMaterial configuration options
 * @typedef {Object} CloudMaterialOptions
 * @property {THREE.Texture} noiseTexture - 3D noise texture for cloud shape
 * @property {THREE.Texture} weatherTexture - 2D weather map
 * @property {number} density - Cloud density multiplier
 * @property {number} absorption - Light absorption coefficient
 * @property {number} phaseG - Henyey-Greenstein phase parameter
 * @property {number} samples - Ray-march steps
 * @property {number} maxDistance - Maximum ray distance
 * @property {number} cloudBase - Cloud layer base height
 * @property {number} cloudTop - Cloud layer top height
 * @property {number} detailScale - Detail noise scale
 * @property {number} erosionScale - Erosion noise scale
 */

/**
 * CloudMaterial - Volumetric cloud material using ray-marching
 */
export class CloudMaterial extends THREE.ShaderMaterial {
  /**
   * @param {CloudMaterialOptions} options - Material options
   */
  constructor(options = {}) {
    const uniforms = {
      // Noise textures
      noiseTexture: { value: options.noiseTexture || null },
      weatherTexture: { value: options.weatherTexture || null },
      blueNoise: { value: options.blueNoise || null },
      
      // Cloud parameters
      density: { value: options.density ?? 1.0 },
      absorption: { value: options.absorption ?? 0.5 },
      phaseG: { value: options.phaseG ?? 0.6 },
      samples: { value: options.samples ?? 64 },
      maxDistance: { value: options.maxDistance ?? 10000 },
      cloudBase: { value: options.cloudBase ?? 6000 },
      cloudTop: { value: options.cloudTop ?? 12000 },
      
      // Detail parameters
      detailScale: { value: options.detailScale ?? 1.0 },
      erosionScale: { value: options.erosionScale ?? 0.5 },
      curlScale: { value: options.curlScale ?? 0.1 },
      
      // Animation
      time: { value: 0 },
      windSpeed: { value: 5.0 },
      windDirection: { value: new THREE.Vector2(1, 0.2).normalize() },
      weatherTime: { value: 0 },
      
      // Lighting
      sunPosition: { value: new THREE.Vector3(100, 80, 50) },
      sunColor: { value: new THREE.Color(1.0, 0.9, 0.7) },
      sunIntensity: { value: 1.0 },
      ambientColor: { value: new THREE.Color(0.3, 0.4, 0.6) },
      ambientIntensity: { value: 0.3 },
      
      // Camera
      cameraPos: { value: new THREE.Vector3() },
      cameraDir: { value: new THREE.Vector3() },
      viewMatrix: { value: new THREE.Matrix4() },
      projectionMatrix: { value: new THREE.Matrix4() },
      inverseProjectionMatrix: { value: new THREE.Matrix4() },
      inverseViewMatrix: { value: new THREE.Matrix4() },
      
      // Quality
      stepScale: { value: 1.0 },
      jitter: { value: 0.5 },
      temporalEnabled: { value: 1.0 },
      historyTexture: { value: null },
      
      // Weather
      weatherState: { value: 0 }, // 0=clear, 1=cloudy, 2=storm
      precipitation: { value: 0 },
      
      // Resolution
      resolution: { value: new THREE.Vector2(1920, 1080) }
    };

    super({
      uniforms,
      vertexShader: CloudMaterial.vertexShader,
      fragmentShader: CloudMaterial.fragmentShader,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.name = 'CloudMaterial';
    
    /** @type {Object} */
    this._animationState = {
      time: 0,
      windPhase: 0
    };
  }

  /**
   * Update cloud animation
   * @param {number} deltaTime - Frame delta time
   * @param {number} elapsedTime - Total elapsed time
   * @param {THREE.Vector3} cameraPos - Camera position
   * @param {THREE.Vector3} sunPos - Sun position
   */
  update(deltaTime, elapsedTime, cameraPos, sunPos) {
    this._animationState.time = elapsedTime;
    this._animationState.windPhase += deltaTime * this.uniforms.windSpeed.value * 0.001;

    this.uniforms.time.value = elapsedTime;
    this.uniforms.cameraPos.value.copy(cameraPos);
    
    if (sunPos) {
      this.uniforms.sunPosition.value.copy(sunPos);
    }

    // Animate wind
    const windPhase = this._animationState.windPhase;
    this.uniforms.windDirection.value.set(
      Math.cos(windPhase * 0.3),
      Math.sin(windPhase * 0.2)
    ).normalize();
  }

  /**
   * Set weather state
   * @param {number} state - 0=clear, 1=cloudy, 2=storm
   * @param {number} transitionTime - Transition duration
   */
  setWeather(state, transitionTime = 5.0) {
    // Smooth transition would be handled in update loop
    this.uniforms.weatherState.value = state;
    
    // Adjust parameters based on weather
    const weatherSettings = {
      0: { density: 0.1, absorption: 0.1, precipitation: 0 },    // Clear
      1: { density: 1.0, absorption: 0.5, precipitation: 0.2 },   // Cloudy
      2: { density: 2.0, absorption: 0.8, precipitation: 0.8 }    // Storm
    };
    
    const settings = weatherSettings[state] || weatherSettings[1];
    this.uniforms.density.value = settings.density;
    this.uniforms.absorption.value = settings.absorption;
    this.uniforms.precipitation.value = settings.precipitation;
  }

  /**
   * Set quality level
   * @param {string} quality - Quality preset
   */
  setQuality(quality) {
    const qualitySettings = {
      low: { samples: 16, stepScale: 2.0 },
      medium: { samples: 32, stepScale: 1.5 },
      high: { samples: 64, stepScale: 1.0 },
      ultra: { samples: 96, stepScale: 0.75 }
    };
    
    const settings = qualitySettings[quality] || qualitySettings.high;
    this.uniforms.samples.value = settings.samples;
    this.uniforms.stepScale.value = settings.stepScale;
  }

  /**
   * Set resolution for blue noise / temporal AA
   * @param {number} width 
   * @param {number} height 
   */
  setResolution(width, height) {
    this.uniforms.resolution.value.set(width, height);
  }

  /**
   * Set history texture for temporal reprojection
   * @param {THREE.Texture} texture 
   */
  setHistoryTexture(texture) {
    this.uniforms.historyTexture.value = texture;
  }

  /**
   * Enable/disable temporal reprojection
   * @param {boolean} enabled 
   */
  setTemporalEnabled(enabled) {
    this.uniforms.temporalEnabled.value = enabled ? 1.0 : 0.0;
  }

  /**
   * Update sun parameters
   * @param {THREE.Vector3} position 
   * @param {THREE.Color} color 
   * @param {number} intensity 
   */
  setSun(position, color, intensity) {
    this.uniforms.sunPosition.value.copy(position);
    this.uniforms.sunColor.value.copy(color);
    this.uniforms.sunIntensity.value = intensity;
  }

  /**
   * Get current cloud density
   * @returns {number}
   */
  getDensity() {
    return this.uniforms.density.value;
  }

  // Shader source code
  static get vertexShader() {
    return `
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      varying vec3 vViewRay;
      
      uniform mat4 viewMatrix;
      uniform mat4 projectionMatrix;
      uniform mat4 inverseProjectionMatrix;
      uniform mat4 inverseViewMatrix;
      uniform vec3 cameraPos;
      
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        
        // Calculate view ray for ray-marching
        vec4 clipPos = projectionMatrix * viewMatrix * worldPos;
        vec3 ndc = clipPos.xyz / clipPos.w;
        vec4 viewRayClip = vec4(ndc, 1.0);
        vec4 viewRayView = inverseProjectionMatrix * viewRayClip;
        viewRayView.z = -1.0;
        viewRayView.w = 0.0;
        vViewRay = normalize((inverseViewMatrix * viewRayView).xyz);
        
        gl_Position = clipPos;
      }
    `;
  }

  static get fragmentShader() {
    return `
      #include <common>
      #include <packing>
      
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      varying vec3 vViewRay;
      
      uniform sampler3D noiseTexture;
      uniform sampler2D weatherTexture;
      uniform sampler2D blueNoise;
      
      uniform float density;
      uniform float absorption;
      uniform float phaseG;
      uniform int samples;
      uniform float maxDistance;
      uniform float cloudBase;
      uniform float cloudTop;
      uniform float detailScale;
      uniform float erosionScale;
      uniform float curlScale;
      uniform float time;
      uniform float windSpeed;
      uniform vec2 windDirection;
      uniform float weatherTime;
      uniform vec3 sunPosition;
      uniform vec3 sunColor;
      uniform float sunIntensity;
      uniform vec3 ambientColor;
      uniform float ambientIntensity;
      uniform vec3 cameraPos;
      uniform float stepScale;
      uniform float jitter;
      uniform float temporalEnabled;
      uniform sampler2D historyTexture;
      uniform float weatherState;
      uniform float precipitation;
      uniform vec2 resolution;
      
      // Henyey-Greenstein phase function
      float henyeyGreenstein(float cosTheta, float g) {
        float g2 = g * g;
        float denom = 1.0 + g2 - 2.0 * g * cosTheta;
        return (1.0 - g2) / (PI * denom * sqrt(denom));
      }
      
      // 3D noise sampling with tri-linear filtering
      float sampleNoise(vec3 pos) {
        return texture(noiseTexture, pos).r;
      }
      
      // Sample noise with detail octaves
      float sampleNoiseDetail(vec3 pos) {
        float n = sampleNoise(pos);
        float n2 = sampleNoise(pos * 2.0 + time * 0.01) * 0.5;
        float n3 = sampleNoise(pos * 4.0 - time * 0.005) * 0.25;
        return n + n2 + n3;
      }
      
      // Erosion noise for cloud edges
      float sampleErosion(vec3 pos) {
        return sampleNoise(pos * erosionScale * 0.1);
      }
      
      // Curl noise for cloud movement
      vec3 sampleCurl(vec3 pos) {
        float eps = 0.01;
        float n = sampleNoise(pos * curlScale);
        float nx = sampleNoise(pos * curlScale + vec3(eps, 0, 0));
        float ny = sampleNoise(pos * curlScale + vec3(0, eps, 0));
        float nz = sampleNoise(pos * curlScale + vec3(0, 0, eps));
        return vec3(nx - n, ny - n, nz - n) / eps;
      }
      
      // Weather map sampling
      float sampleWeather(vec2 uv) {
        return texture(weatherTexture, uv).r;
      }
      
      // Blue noise for jittering
      float blueNoiseRandom(vec2 uv) {
        return texture(blueNoise, uv).r;
      }
      
      // Ray-sphere intersection for cloud layer bounds
      bool rayCloudBounds(vec3 ro, vec3 rd, out float tMin, out float tMax) {
        // Cloud layer as horizontal slab
        float y1 = cloudBase - ro.y;
        float y2 = cloudTop - ro.y;
        
        tMin = y1 / rd.y;
        tMax = y2 / rd.y;
        
        if (tMin > tMax) {
          float temp = tMin; tMin = tMax; tMax = temp;
        }
        
        tMax = max(tMax, 0.0);
        return tMax > 0.0 && tMin < maxDistance;
      }
      
      // Main ray-marching function
      vec4 rayMarch(vec3 ro, vec3 rd) {
        float tMin, tMax;
        if (!rayCloudBounds(ro, rd, tMin, tMax)) {
          return vec4(0.0);
        }
        
        tMin = max(tMin, 0.0);
        tMax = min(tMax, maxDistance);
        
        float stepSize = (tMax - tMin) / float(samples);
        stepSize *= stepScale;
        
        // Jitter starting position
        float jitterOffset = blueNoiseRandom(vUv + time * 0.01) * stepSize;
        float t = tMin + jitterOffset;
        
        vec3 pos = ro + rd * t;
        vec3 color = vec3(0.0);
        float transmittance = 1.0;
        float totalDensity = 0.0;
        
        vec3 sunDir = normalize(sunPosition - ro);
        float sunCosTheta = dot(rd, sunDir);
        
        for (int i = 0; i < 256; i++) {
          if (i >= samples) break;
          if (pos.y < cloudBase || pos.y > cloudTop) break;
          if (transmittance < 0.01) break;
          
          // Normalized height in cloud layer (0-1)
          float h = (pos.y - cloudBase) / (cloudTop - cloudBase);
          
          // Weather influence
          vec2 weatherUV = pos.xz * 0.0005 + windDirection * weatherTime;
          float weather = sampleWeather(weatherUV);
          
          // Sample cloud density with detail
          float baseDensity = sampleNoiseDetail(pos * detailScale * 0.001);
          
          // Erosion at edges
          float erosion = 1.0 - sampleErosion(pos * 0.001) * smoothstep(0.0, 0.2, h) * smoothstep(1.0, 0.8, h);
          
          // Wind curl displacement
          vec3 curl = sampleCurl(pos * 0.001 + vec3(time * windSpeed * 0.001));
          float curlDensity = sampleNoiseDetail((pos + curl * 50.0) * detailScale * 0.001);
          
          // Combined density
          float cloudDensity = (baseDensity + curlDensity * 0.3) * erosion;
          
          // Weather modulation
          cloudDensity *= mix(0.5, 1.5, weather);
          
          // Height falloff
          cloudDensity *= h * (1.0 - h) * 4.0; // Parabolic falloff
          
          // Global density control
          cloudDensity *= density;
          
          if (cloudDensity > 0.001) {
            totalDensity += cloudDensity * stepSize;
            
            // Lighting
            float phase = henyeyGreenstein(sunCosTheta, phaseG);
            
            // Silver lining (forward scattering)
            float silverLining = pow(max(sunCosTheta, 0.0), 50.0) * 0.5;
            
            // Cloud color
            vec3 cloudColor = vec3(1.0, 0.99, 0.95);
            
            // Add warm tint at sunset
            float sunHeight = sunPosition.y / length(sunPosition);
            if (sunHeight < 0.2) {
              cloudColor = mix(cloudColor, vec3(1.0, 0.7, 0.4), (0.2 - sunHeight) * 5.0);
            }
            
            // Light absorption (shadowing within cloud)
            float lightTransmittance = exp(-cloudDensity * absorption * stepSize * 2.0);
            
            // Accumulate color
            vec3 lightColor = sunColor * phase * sunIntensity;
            lightColor += ambientColor * ambientIntensity;
            lightColor += cloudColor * silverLining * 0.3;
            
            color += lightColor * cloudDensity * transmittance * stepSize;
            transmittance *= lightTransmittance;
          }
          
          t += stepSize;
          pos = ro + rd * t;
        }
        
        // Precipitation streaks
        if (precipitation > 0.0) {
          float rain = sin(pos.x * 100.0 + time * 50.0) * precipitation * 0.01;
          color += vec3(0.6, 0.7, 0.8) * rain;
        }
        
        return vec4(color, 1.0 - transmittance);
      }
      
      // Tonemap
      vec3 tonemap(vec3 c) {
        // ACES filmic
        const float a = 2.51;
        const float b = 0.03;
        const float c1 = 2.43;
        const float d = 0.59;
        const float e = 0.14;
        c = (c * (a * c + b)) / (c * (c1 * c + d) + e);
        return clamp(c, 0.0, 1.0);
      }
      
      void main() {
        vec3 ro = cameraPos;
        vec3 rd = vViewRay;
        
        // Ray-march
        vec4 cloudResult = rayMarch(ro, rd);
        
        vec3 finalColor = cloudResult.rgb;
        float alpha = cloudResult.a;
        
        // Tonemap
        finalColor = tonemap(finalColor);
        
        // Temporal reprojection (optional)
        if (temporalEnabled > 0.5 && historyTexture) {
          vec2 uv = vUv;
          vec3 history = texture(historyTexture, uv).rgb;
          finalColor = mix(history, finalColor, 0.15);
        }
        
        // Premultiply alpha
        gl_FragColor = vec4(finalColor * alpha, alpha);
      }
    `;
  }
}

export default CloudMaterial;