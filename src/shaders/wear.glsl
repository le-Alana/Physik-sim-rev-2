/**
 * wear.glsl - Shared Wear/Scratch Shader Chunks
 * 
 * Reusable GLSL functions for procedural wear and scratch effects.
 * Used by PBRMaterial and GroundMaterial via onBeforeCompile injection.
 * 
 * @module shaders/wear
 * @version 1.0.0
 */

#ifndef WEAR_GLSL
#define WEAR_GLSL

// ============================================================================
// WEAR MAP CHANNELS
// R = General wear (abrasion, fading)
// G = Scratch density (directional highlights)
// B = Curvature/AO (crevices, contact points)
// A = Edge wear (sharp edges, corners)
// ============================================================================

/**
 * Sample wear map data
 * @param {sampler2D} wearMap - Wear texture (RGBA)
 * @param {vec2} uv - Texture coordinates
 * @returns {vec4} wearData (R=wear, G=scratches, B=curvature, A=edge)
 */
vec4 getWearData(sampler2D wearMap, vec2 uv) {
    return texture2D(wearMap, uv);
}

/**
 * Calculate surface curvature from normal derivatives
 * @param {vec3} normal - Surface normal
 * @returns {float} Approximate curvature magnitude
 */
float getCurvature(vec3 normal) {
    vec3 ddx = dFdx(normal);
    vec3 ddy = dFdy(normal);
    return length(ddx) + length(ddy);
}

/**
 * Apply wear effects to base color
 * @param {vec3} baseColor - Original diffuse color
 * @param {vec2} uv - Texture coordinates
 * @param {vec3} normal - Surface normal
 * @param {vec3} viewDir - View direction (world space)
 * @param {sampler2D} wearMap - Wear texture
 * @param {float} wearIntensity - Global wear multiplier
 * @param {float} scratchIntensity - Scratch highlight multiplier
 * @param {float} edgeWearIntensity - Edge wear multiplier
 * @param {float} curvatureAOIntensity - Curvature AO strength
 * @param {float} dustIntensity - Dust accumulation strength
 * @returns {Worn color with scratches and dust}
 */
vec3 applyWear(
    vec3 baseColor,
    vec2 uv,
    vec3 normal,
    vec3 viewDir,
    sampler2D wearMap,
    float wearIntensity,
    float scratchIntensity,
    float edgeWearIntensity,
    float curvatureAOIntensity,
    float dustIntensity
) {
    vec4 wearData = getWearData(wearMap, uv);
    
    float wear = wearData.r * wearIntensity;
    float scratches = wearData.g * scratchIntensity;
    float curvature = wearData.b * curvatureAOIntensity;
    float edge = wearData.a * edgeWearIntensity;
    
    // Base wear - darken and desaturate
    vec3 wornColor = baseColor * (1.0 - wear * 0.4);
    
    // Edge wear - additional darkening at sharp edges
    wornColor *= (1.0 - edge * 0.3);
    
    // Curvature AO - darken crevices and contact points
    float curv = getCurvature(normal);
    wornColor *= (1.0 - curvature * curvatureAOIntensity * 0.2);
    
    // Dust accumulation in crevices (less on worn surfaces)
    float dustMask = smoothstep(0.0, 0.5, curvature) * (1.0 - wear);
    vec3 dustColor = vec3(0.32, 0.29, 0.26); // Warm dust color
    wornColor = mix(wornColor, dustColor, dustMask * dustIntensity);
    
    return wornColor;
}

/**
 * Calculate anisotropic scratch highlights
 * Scratches catch light along their perpendicular direction
 * @param {vec2} uv - Texture coordinates
 * @param {vec3} normal - Surface normal
 * @param {vec3} viewDir - View direction
 * @param {vec3} lightDir - Light direction
 * @param {sampler2D} wearMap - Wear texture
 * @param {float} scratchIntensity - Scratch highlight multiplier
 * @param {float} time - Animation time
 * @param {float} scratchAnimation - Additional scratch phase
 * @returns {vec3} Scratch highlight color
 */
vec3 getScratchHighlights(
    vec2 uv,
    vec3 normal,
    vec3 viewDir,
    vec3 lightDir,
    sampler2D wearMap,
    float scratchIntensity,
    float time,
    float scratchAnimation
) {
    vec4 wearData = getWearData(wearMap, uv);
    float scratches = wearData.g;
    
    if (scratches < 0.01) return vec3(0.0);
    
    // Animate scratch highlights for shimmer
    float anim = sin(time * 2.0 + uv.x * 100.0 + scratchAnimation) * 0.5 + 0.5;
    
    // Half-vector for specular
    vec3 h = normalize(viewDir + lightDir);
    float NdotH = max(dot(normal, h), 0.0);
    
    // Anisotropic-like scratch highlight (sharp, directional)
    float scratchHighlight = pow(NdotH, 200.0) * scratches * anim * 0.5;
    
    // Multiple scratch directions for variety
    vec3 scratchDir1 = normalize(vec3(0.1, 0.0, 0.0));
    vec3 scratchDir2 = normalize(vec3(-0.1, 0.0, 0.0));
    
    float scratch1 = pow(max(dot(normal, normalize(viewDir + lightDir + scratchDir1)), 0.0), 150.0);
    float scratch2 = pow(max(dot(normal, normalize(viewDir + lightDir + scratchDir2)), 0.0), 150.0);
    
    return vec3(scratchHighlight + scratch1 + scratch2) * 0.3 * scratchIntensity;
}

/**
 * Apply wear to roughness - worn surfaces are rougher
 * @param {float} roughnessFactor - Base roughness
 * @param {vec2} uv - Texture coordinates
 * @param {sampler2D} wearMap - Wear texture
 * @param {float} wearIntensity - Wear intensity
 * @returns {float} Modified roughness
 */
float applyWearToRoughness(
    float roughnessFactor,
    vec2 uv,
    sampler2D wearMap,
    float wearIntensity
) {
    vec4 wearData = getWearData(wearMap, uv);
    return mix(roughnessFactor, min(1.0, roughnessFactor + wearData.r * 0.3), wearIntensity);
}

/**
 * Apply wear to metalness - bare metal exposed at deep scratches
 * @param {float} metalnessFactor - Base metalness
 * @param {vec2} uv - Texture coordinates
 * @param {sampler2D} wearMap - Wear texture
 * @param {float} wearIntensity - Wear intensity
 * @returns {float} Modified metalness
 */
float applyWearToMetalness(
    float metalnessFactor,
    vec2 uv,
    sampler2D wearMap,
    float wearIntensity
) {
    vec4 wearData = getWearData(wearMap, uv);
    // Deep wear exposes metal
    return mix(metalnessFactor, min(1.0, metalnessFactor + wearData.r * 0.2), wearIntensity * 0.5);
}

// ============================================================================
// EDGE WEAR HELPERS
// ============================================================================

/**
 * Calculate edge wear factor from mesh curvature/angle
 * @param {vec3} normal - Surface normal
 * @param {vec3} viewDir - View direction
 * @returns {float} Edge factor (1.0 at sharp edges facing camera)
 */
float getEdgeFactor(vec3 normal, vec3 viewDir) {
    // Fresnel-like edge detection
    float NdotV = max(dot(normal, viewDir), 0.0);
    return pow(1.0 - NdotV, 3.0);
}

/**
 * Apply edge wear to color
 * @param {vec3} color - Base color
 * @param {float} edgeFactor - Edge intensity
 * @param {float} edgeWearIntensity - Global edge wear multiplier
 * @param {vec3} edgeColor - Color of worn edges (bright metal)
 * @returns {vec3} Color with edge wear
 */
vec3 applyEdgeWear(
    vec3 color,
    float edgeFactor,
    float edgeWearIntensity,
    vec3 edgeColor
) {
    return mix(color, edgeColor, edgeFactor * edgeWearIntensity * 0.5);
}

#endif // WEAR_GLSL