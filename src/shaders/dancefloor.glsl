/**
 * dancefloor.glsl - Animated Dance Floor Shader Chunks
 * 
 * Reusable GLSL functions for the Rayman-style dancing floor with
 * animated lights, strobe effects, and tile patterns.
 * 
 * @module shaders/dancefloor
 * @version 1.0.0
 */

#ifndef DANCEFLOOR_GLSL
#define DANCEFLOOR_GLSL

// ============================================================================
// TILE PATTERN FUNCTIONS
// ============================================================================

/**
 * Generate tile UV coordinates with grout lines
 * @param {vec2} uv - Base UV coordinates
 * @param {float} tileScale - Number of tiles per unit
 * @param {float} groutWidth - Width of grout lines (0-1)
 * @returns {vec2} Tile UV with grout offset
 */
vec2 getTileUV(vec2 uv, float tileScale, float groutWidth) {
    vec2 tileUV = uv * tileScale;
    vec2 tileID = floor(tileUV);
    vec2 tileLocal = fract(tileUV);
    
    // Add grout lines
    vec2 groutMask = step(1.0 - groutWidth, tileLocal);
    float grout = max(groutMask.x, groutMask.y);
    
    return tileLocal;
}

/**
 * Tile pattern with alternating colors (checkerboard)
 * @param {vec2} uv - Base UV coordinates
 * @param {float} tileScale - Tile scale
 * @returns {float} Pattern value [0, 1]
 */
float checkerPattern(vec2 uv, float tileScale) {
    vec2 tileUV = uv * tileScale;
    vec2 tileID = floor(tileUV);
    return mod(tileID.x + tileID.y, 2.0);
}

/**
 * Animated tile highlight (pulse on beat)
 * @param {vec2} uv - Base UV coordinates
 * @param {float} tileScale - Tile scale
 * @param {float} time - Animation time
 * @param {float} beatPhase - Beat phase (0-1)
 * @param {float} intensity - Pulse intensity
 * @returns {float} Highlight factor
 */
float tilePulse(vec2 uv, float tileScale, float time, float beatPhase, float intensity) {
    vec2 tileUV = uv * tileScale;
    vec2 tileID = floor(tileUV);
    
    // Pseudo-random tile phase based on tile ID
    float tilePhase = fract(sin(dot(tileID, vec2(127.1, 311.7))) * 43758.5453);
    
    // Pulse wave
    float pulse = sin(beatPhase * 6.28318 + tilePhase * 6.28318) * 0.5 + 0.5;
    pulse = pow(pulse, 4.0); // Sharp pulse
    
    return pulse * intensity;
}

// ============================================================================
// ANIMATED LIGHT FUNCTIONS
// ============================================================================

/**
 * Sample 3D animated lights texture with temporal interpolation
 * @param {sampler3D} lightsTexture - 3D texture (layers = animation frames)
 * @param {vec2} uv - Base UV coordinates
 * @param {float} time - Animation time
 * @param {float} speed - Animation speed
 * @param {int} numLayers - Number of animation frames
 * @returns {vec3} Animated light color
 */
vec3 sampleAnimatedLights(sampler3D lightsTexture, vec2 uv, float time, float speed, int numLayers) {
    // Animate through layers
    float frame = fract(time * speed * 0.5);
    float layerFloat = frame * float(numLayers);
    int layer0 = int(floor(layerFloat));
    int layer1 = int(ceil(layerFloat)) % numLayers;
    float blend = fract(layerFloat);
    
    // Sample two adjacent frames
    vec3 color0 = texture(lightsTexture, vec3(uv, float(layer0) / float(numLayers))).rgb;
    vec3 color1 = texture(lightsTexture, vec3(uv, float(layer1) / float(numLayers))).rgb;
    
    return mix(color0, color1, blend);
}

/**
 * Moving light beams (scanner effect)
 * @param {vec2} uv - Base UV coordinates
 * @param {float} time - Animation time
 * @param {float} speed - Beam speed
 * @param {float} beamWidth - Beam width
 * @param {int} numBeams - Number of beams
 * @returns {float} Beam brightness
 */
float movingBeams(vec2 uv, float time, float speed, float beamWidth, int numBeams) {
    float beams = 0.0;
    
    for (int i = 0; i < 8; i++) {
        if (i >= numBeams) break;
        
        float beamPhase = float(i) / float(numBeams) * 6.28318;
        float beamPos = fract(time * speed + beamPhase);
        
        // Vertical beam
        float dist = abs(uv.y - beamPos);
        float beam = smoothstep(beamWidth, 0.0, dist);
        
        // Add diagonal component
        float distDiag = abs(uv.x + uv.y - beamPos);
        float beamDiag = smoothstep(beamWidth * 0.5, 0.0, distDiag);
        
        beams += beam + beamDiag * 0.5;
    }
    
    return clamp(beams, 0.0, 1.0);
}

/**
 * Rotating gobo patterns (projected light shapes)
 * @param {vec2} uv - Base UV coordinates
 * @param {float} time - Animation time
 * @param {float} rotationSpeed - Rotation speed
 * @param {float} scale - Pattern scale
 * @returns {vec3} Gobo color
 */
vec3 rotatingGobo(vec2 uv, float time, float rotationSpeed, float scale) {
    // Center UV
    vec2 centered = (uv - 0.5) * scale;
    
    // Rotation
    float angle = time * rotationSpeed;
    float cosA = cos(angle);
    float sinA = sin(angle);
    vec2 rotated = vec2(
        centered.x * cosA - centered.y * sinA,
        centered.x * sinA + centered.y * cosA
    );
    
    // Multiple gobo patterns
    float pattern = 0.0;
    
    // Star pattern
    float star = 0.0;
    for (int i = 0; i < 5; i++) {
        float a = float(i) * 1.25664; // 2π/5
        float proj = rotated.x * cos(a) + rotated.y * sin(a);
        star += smoothstep(0.1, 0.0, abs(proj));
    }
    
    // Circular rings
    float rings = sin(length(rotated) * 3.0 - time * 4.0) * 0.5 + 0.5;
    rings = pow(rings, 8.0);
    
    // Spoke pattern
    float spokes = 0.0;
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7854 + time * 0.5; // 2π/8
        float proj = rotated.x * cos(a) + rotated.y * sin(a);
        spokes += smoothstep(0.05, 0.0, abs(proj));
    }
    
    vec3 color = vec3(star * 0.3 + rings * 0.4 + spokes * 0.3);
    return color;
}

// ============================================================================
// STROBE / BEAT REACTIVE EFFECTS
// ============================================================================

/**
 * Strobe flash effect
 * @param {float} time - Current time
 * @param {float} strobeTime - Time when strobe was triggered
 * @param {float} duration - Strobe duration
 * @param {float} intensity - Flash intensity
 * @returns {float} Strobe factor [0, 1]
 */
float strobeEffect(float time, float strobeTime, float duration, float intensity) {
    float elapsed = time - strobeTime;
    if (elapsed < 0.0 || elapsed > duration) return 0.0;
    
    // Sharp attack, exponential decay
    float attack = min(elapsed / 0.01, 1.0);
    float decay = exp(-elapsed * 15.0);
    
    // Flicker
    float flicker = sin(elapsed * 200.0) * 0.5 + 0.5;
    
    return attack * decay * flicker * intensity;
}

/**
 * Beat-synced pulse
 * @param {float} time - Current time
 * @param {float} bpm - Beats per minute
 * @param {float} phase - Phase offset (0-1)
 * @param {int} subdivision - Beat subdivision (1=quarter, 2=eighth, etc.)
 * @returns {float} Pulse value [0, 1]
 */
float beatPulse(float time, float bpm, float phase, int subdivision) {
    float beatInterval = 60.0 / (bpm * float(subdivision));
    float beatTime = mod(time + phase * beatInterval, beatInterval);
    float beatProgress = beatTime / beatInterval;
    
    // Sharp pulse on beat
    float pulse = smoothstep(0.0, 0.1, beatProgress) * smoothstep(0.3, 0.1, beatProgress);
    return pulse;
}

/**
 * Build-up effect (riser)
 * @param {float} time - Current time
 * @param {float} triggerTime - Build-up start time
 * @param {float} duration - Build-up duration
 * @returns {float} Build-up factor [0, 1]
 */
float buildUp(float time, float triggerTime, float duration) {
    float elapsed = time - triggerTime;
    if (elapsed < 0.0 || elapsed > duration) return 0.0;
    
    float progress = elapsed / duration;
    // Exponential curve for tension
    return pow(progress, 0.3);
}

// ============================================================================
// GROOVE / NORMAL MAP EFFECTS
// ============================================================================

/**
 * Tile groove effect for clearcoat variation
 * @param {vec2} uv - Texture coordinates
 * @param {float} tileScale - Tile scale
 * @param {sampler2D} normalMap - Normal map texture
 * @returns {float} Groove factor (0 in grooves, 1 on tiles)
 */
float getGrooveFactor(vec2 uv, float tileScale, sampler2D normalMap) {
    vec2 tileUV = uv * tileScale;
    vec4 normalData = texture2D(normalMap, tileUV);
    
    // Grooves have lower normal magnitude (flatter)
    float groove = 1.0 - normalData.a * 2.0;
    return clamp(groove, 0.0, 1.0);
}

/**
 * Reflective tile surface with non-reflective grout
 * @param {float} clearcoat - Base clearcoat value
 * @param {float} grooveFactor - Groove factor from getGrooveFactor
 * @returns {float} Modified clearcoat
 */
float applyGrooveClearcoat(float clearcoat, float grooveFactor) {
    return clearcoat * grooveFactor;
}

// ============================================================================
// EMISSIVE LIGHT PATTERNS
// ============================================================================

/**
 * Pulsing grid lines
 * @param {vec2} uv - Base UV coordinates
 * @param {float} tileScale - Tile scale
 * @param {float} time - Animation time
 * @param {float} lineWidth - Line thickness
 * @param {float} intensity - Emission intensity
 * @returns {vec3} Emissive color
 */
vec3 pulsingGrid(vec2 uv, float tileScale, float time, float lineWidth, float intensity) {
    vec2 tileUV = uv * tileScale;
    vec2 tileLocal = fract(tileUV);
    
    // Grid lines
    float linesX = 1.0 - smoothstep(0.0, lineWidth, abs(tileLocal.x - 0.5));
    float linesY = 1.0 - smoothstep(0.0, lineWidth, abs(tileLocal.y - 0.5));
    float grid = max(linesX, linesY);
    
    // Pulse animation
    float pulse = sin(time * 3.0) * 0.5 + 0.5;
    grid *= pulse;
    
    return vec3(grid * intensity);
}

/**
 * Color-cycling edge glow
 * @param {vec2} uv - Base UV coordinates
 * @param {float} tileScale - Tile scale
 * @param {float} time - Animation time
 * @param {float} speed - Color cycle speed
 * @returns {vec3} RGB cycling color
 */
vec3 colorCycle(vec2 uv, float tileScale, float time, float speed) {
    // HSV to RGB conversion for smooth color cycling
    float hue = fract(time * speed + uv.x * 0.1 + uv.y * 0.1);
    
    vec3 rgb = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    rgb = rgb * rgb * (3.0 - 2.0 * rgb); // Smoothstep
    
    return rgb;
}

// ============================================================================
// WEAR INTEGRATION
// ============================================================================

/**
 * Apply dance floor wear (scuffed tiles, worn grooves)
 * @param {vec3} baseColor - Tile color
 * @param {vec2} uv - Texture coordinates
 * @param {float} tileScale - Tile scale
 * @param {sampler2D} wearMap - Wear texture
 * @param {float} wearIntensity - Wear strength
 * @returns {vec3} Worn color
 */
vec3 applyDanceFloorWear(vec3 baseColor, vec2 uv, float tileScale, sampler2D wearMap, float wearIntensity) {
    vec2 tileUV = uv * tileScale;
    vec4 wearData = texture2D(wearMap, tileUV);
    
    float wear = wearData.r * wearIntensity;
    float scratches = wearData.g * wearIntensity;
    
    // Worn tiles are darker and less saturated
    vec3 wornColor = baseColor * (1.0 - wear * 0.3);
    
    // Scratches catch light
    float scratchHighlight = scratches * 0.2;
    wornColor += vec3(scratchHighlight);
    
    return wornColor;
}

#endif // DANCEFLOOR_GLSL