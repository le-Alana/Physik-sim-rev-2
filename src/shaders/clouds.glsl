/**
 * clouds.glsl - Volumetric Cloud Shader Chunks
 * 
 * Reusable GLSL functions for ray-marched volumetric clouds.
 * Used by CloudMaterial for atmospheric cloud rendering.
 * 
 * @module shaders/clouds
 * @version 1.0.0
 */

#ifndef CLOUDS_GLSL
#define CLOUDS_GLSL

// ============================================================================
// CLOUD NOISE FUNCTIONS
// ============================================================================

/**
 * Hash function for noise generation
 * @param {vec3} p - 3D position
 * @returns {float} Pseudo-random value [0, 1]
 */
float hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453);
}

/**
 * Value noise with trilinear interpolation
 * @param {vec3} p - 3D position
 * @returns {float} Noise value [0, 1]
 */
float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // Smoothstep
    
    float n = 0.0;
    n = mix(n, hash33(i + vec3(0,0,0)), (1.0-f.x)*(1.0-f.y)*(1.0-f.z));
    n = mix(n, hash33(i + vec3(1,0,0)), f.x*(1.0-f.y)*(1.0-f.z));
    n = mix(n, hash33(i + vec3(0,1,0)), (1.0-f.x)*f.y*(1.0-f.z));
    n = mix(n, hash33(i + vec3(1,1,0)), f.x*f.y*(1.0-f.z));
    n = mix(n, hash33(i + vec3(0,0,1)), (1.0-f.x)*(1.0-f.y)*f.z);
    n = mix(n, hash33(i + vec3(1,0,1)), f.x*(1.0-f.y)*f.z);
    n = mix(n, hash33(i + vec3(0,1,1)), (1.0-f.x)*f.y*f.z);
    n = mix(n, hash33(i + vec3(1,1,1)), f.x*f.y*f.z);
    
    return n;
}

/**
 * Fractal Brownian Motion (fBm) for layered noise
 * @param {vec3} p - 3D position
 * @param {int} octaves - Number of octaves
 * @param {float} lacunarity - Frequency multiplier
 * @param {float} gain - Amplitude multiplier
 * @returns {float} fBm value
 */
float fbm(vec3 p, int octaves, float lacunarity, float gain) {
    float sum = 0.0;
    float amp = 1.0;
    float maxAmp = 0.0;
    
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        sum += amp * valueNoise(p);
        maxAmp += amp;
        amp *= gain;
        p *= lacunarity;
    }
    
    return sum / maxAmp;
}

/**
 * Domain-warped noise for more organic shapes
 * @param {vec3} p - 3D position
 * @param {float} time - Animation time
 * @returns {float} Warped noise value
 */
float domainWarpedNoise(vec3 p, float time) {
    // First warp
    vec3 q = vec3(
        fbm(p + vec3(0.0, 0.0, time * 0.01), 4, 2.0, 0.5),
        fbm(p + vec3(5.2, 1.3, time * 0.01), 4, 2.0, 0.5),
        fbm(p + vec3(2.1, 4.7, time * 0.01), 4, 2.0, 0.5)
    );
    
    // Second warp
    vec3 r = vec3(
        fbm(p + q * 2.0 + vec3(1.7, 3.4, 0.0), 4, 2.0, 0.5),
        fbm(p + q * 2.0 + vec3(4.3, 2.1, 0.0), 4, 2.0, 0.5),
        fbm(p + q * 2.0 + vec3(0.9, 5.6, 0.0), 4, 2.0, 0.5)
    );
    
    return fbm(p + r * 3.0, 5, 2.0, 0.5);
}

/**
 * Curl noise for cloud movement (incompressible flow)
 * @param {vec3} p - 3D position
 * @returns {vec3} Curl noise vector
 */
vec3 curlNoise(vec3 p) {
    const float eps = 0.01;
    
    float n = valueNoise(p);
    float nx = valueNoise(p + vec3(eps, 0.0, 0.0));
    float ny = valueNoise(p + vec3(0.0, eps, 0.0));
    float nz = valueNoise(p + vec3(0.0, 0.0, eps));
    
    // ∇ × (valueNoise * constant) for incompressible field
    return vec3(nz - ny, nx - nz, ny - nx) / eps;
}

// ============================================================================
// CLOUD DENSITY FUNCTIONS
// ============================================================================

/**
 * Calculate cloud density at position with erosion
 * @param {vec3} pos - World position
 * @param {float} cloudBase - Cloud layer base height
 * @param {float} cloudTop - Cloud layer top height
 * @param {float} detailScale - Detail noise scale
 * @param {float} erosionScale - Erosion scale
 * @param {float} time - Animation time
 * @param {vec2} windDirection - Wind direction
 * @param {float} windSpeed - Wind speed
 * @returns {float} Cloud density [0, 1]
 */
float getCloudDensity(
    vec3 pos,
    float cloudBase,
    float cloudTop,
    float detailScale,
    float erosionScale,
    float time,
    vec2 windDirection,
    float windSpeed
) {
    // Normalized height in cloud layer (0-1)
    float h = (pos.y - cloudBase) / (cloudTop - cloudBase);
    if (h <= 0.0 || h >= 1.0) return 0.0;
    
    // Height falloff - parabolic, peaking in middle
    float heightFalloff = h * (1.0 - h) * 4.0;
    
    // Base noise position with wind movement
    vec3 noisePos = pos * detailScale * 0.001;
    noisePos.xz += windDirection * time * windSpeed * 0.001;
    
    // Main cloud shape
    float baseDensity = domainWarpedNoise(noisePos, time);
    
    // Erosion at top and bottom edges
    float bottomErosion = smoothstep(0.0, 0.2, h);
    float topErosion = smoothstep(1.0, 0.8, h);
    float erosion = 1.0 - valueNoise(pos * erosionScale * 0.01) * bottomErosion * topErosion;
    
    // Curl noise displacement for organic movement
    vec3 curl = curlNoise(pos * 0.001 + vec3(time * windSpeed * 0.001));
    float curlDensity = domainWarpedNoise((pos + curl * 50.0) * detailScale * 0.001, time);
    
    // Combined density
    float density = (baseDensity + curlDensity * 0.3) * erosion * heightFalloff;
    
    return max(density, 0.0);
}

/**
 * Sample weather map for macro-scale cloud variation
 * @param {sampler2D} weatherTexture - Weather map texture
 * @param {vec3} pos - World position
 * @param {vec2} windDirection - Wind direction
 * @param {float} weatherTime - Weather animation time
 * @returns {float} Weather factor [0.5, 1.5]
 */
float sampleWeather(sampler2D weatherTexture, vec3 pos, vec2 windDirection, float weatherTime) {
    vec2 uv = pos.xz * 0.0005 + windDirection * weatherTime;
    return texture2D(weatherTexture, uv).r;
}

// ============================================================================
// LIGHTING FUNCTIONS
// ============================================================================

/**
 * Henyey-Greenstein phase function for volumetric scattering
 * @param {float} cosTheta - Cosine of view-sun angle
 * @param {float} g - Anisotropy parameter (-1 to 1, positive = forward scattering)
 * @returns {float} Phase function value
 */
float henyeyGreenstein(float cosTheta, float g) {
    float g2 = g * g;
    float denom = 1.0 + g2 - 2.0 * g * cosTheta;
    return max((1.0 - g2) / (PI * denom * sqrt(denom)), 0.0);
}

/**
 * Schlick phase function approximation (faster)
 * @param {float} cosTheta - Cosine of view-sun angle
 * @param {float} g - Anisotropy parameter
 * @returns {float} Approximate phase value
 */
float schlickPhase(float cosTheta, float g) {
    float k = (g + 1.0) * (g + 1.0) / 8.0;
    float denom = 1.0 + k * (cosTheta - 1.0);
    return (1.0 - k) * (1.0 - k) / (denom * denom);
}

/**
 * Multiple scattering approximation for silver lining
 * @param {float} cosTheta - Cosine of view-sun angle
 * @param {float} density - Cloud density at sample point
 * @param {float} extinction - Total extinction along ray
 * @returns {float} Silver lining factor
 */
float silverLining(float cosTheta, float density, float extinction) {
    // Forward scattering peak (silver lining)
    float forward = pow(max(cosTheta, 0.0), 50.0) * 0.5;
    
    // Back scattering (glory)
    float backward = pow(max(-cosTheta, 0.0), 100.0) * 0.1;
    
    // Modulate by density and optical depth
    return (forward + backward) * density * exp(-extinction * 0.5);
}

/**
 * Cloud color based on sun position (sunrise/sunset colors)
 * @param {vec3} baseColor - Base cloud color (white)
 * @param {vec3} sunPosition - Sun world position
 * @returns {vec3} Tinted cloud color
 */
vec3 getCloudColor(vec3 baseColor, vec3 sunPosition) {
    vec3 color = baseColor;
    
    // Sun height determines color temperature
    float sunHeight = sunPosition.y / length(sunPosition);
    
    if (sunHeight < 0.3) {
        // Sunrise/sunset - warm colors
        float t = (0.3 - sunHeight) / 0.3;
        vec3 warmColor = vec3(1.0, 0.7, 0.4);
        vec3 hotColor = vec3(1.0, 0.4, 0.2);
        color = mix(color, mix(warmColor, hotColor, t), t);
    } else if (sunHeight < 0.5) {
        // Morning/evening - slight warmth
        float t = (0.5 - sunHeight) / 0.2;
        vec3 mildWarm = vec3(1.0, 0.95, 0.85);
        color = mix(color, mildWarm, t * 0.5);
    }
    
    return color;
}

// ============================================================================
// RAY MARCHING HELPERS
// ============================================================================

/**
 * Ray-cloud layer intersection (horizontal slab)
 * @param {vec3} ro - Ray origin
 * @param {vec3} rd - Ray direction
 * @param {float} cloudBase - Cloud layer base
 * @param {float} cloudTop - Cloud layer top
 * @param {inout float} tMin - Entry distance
 * @param {inout float} tMax - Exit distance
 * @returns {bool} True if ray intersects cloud layer
 */
bool rayCloudBounds(vec3 ro, vec3 rd, float cloudBase, float cloudTop, inout float tMin, inout float tMax) {
    float y1 = cloudBase - ro.y;
    float y2 = cloudTop - ro.y;
    
    tMin = y1 / rd.y;
    tMax = y2 / rd.y;
    
    if (tMin > tMax) {
        float temp = tMin; tMin = tMax; tMax = temp;
    }
    
    tMax = max(tMax, 0.0);
    return tMax > 0.0 && tMin < tMax;
}

/**
 * Blue noise sample for temporal jitter
 * @param {sampler2D} blueNoise - Blue noise texture
 * @param {vec2} uv - Screen UV
 * @param {float} time - Animation time
 * @returns {float} Blue noise value [0, 1]
 */
float blueNoiseRandom(sampler2D blueNoise, vec2 uv, float time) {
    return texture2D(blueNoise, uv + time * 0.01).r;
}

/**
 * Temporal reprojection blend factor
 * @param {float} temporalEnabled - Enable flag
 * @param {sampler2D} historyTexture - Previous frame
 * @param {vec2} uv - Screen UV
 * @param {inout vec3} currentColor - Current frame color
 * @param {float} blend - Blend factor (0.1-0.2)
 */
void temporalReproject(
    float temporalEnabled,
    sampler2D historyTexture,
    vec2 uv,
    inout vec3 currentColor,
    float blend
) {
    if (temporalEnabled > 0.5) {
        vec3 history = texture2D(historyTexture, uv).rgb;
        currentColor = mix(history, currentColor, blend);
    }
}

// ============================================================================
// PRECIPITATION
// ============================================================================

/**
 * Rain streak effect
 * @param {vec3} pos - World position
 * @param {float} time - Animation time
 * @param {float} precipitation - Precipitation intensity [0, 1]
 * @returns {vec3} Rain color contribution
 */
vec3 precipitationStreaks(vec3 pos, float time, float precipitation) {
    if (precipitation <= 0.0) return vec3(0.0);
    
    // Procedural rain streaks
    float streak = sin(pos.x * 80.0 + pos.y * 20.0 + time * 60.0) * 0.5 + 0.5;
    streak = pow(streak, 10.0) * precipitation;
    
    return vec3(0.6, 0.7, 0.85) * streak * 0.02;
}

#endif // CLOUDS_GLSL