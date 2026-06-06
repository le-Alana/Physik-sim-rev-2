# Shader Documentation

## Overview

This document describes the shader architecture, uniform/varying conventions, chunk injection patterns, and shared GLSL functions used across the project's custom materials and post-processing passes.

## Shader Injection Pattern

All custom materials extend Three.js base materials and use `onBeforeCompile` for shader modification:

```typescript
onBeforeCompile = (shader) => {
  // 1. Inject uniforms
  Object.assign(shader.uniforms, this.customUniforms);
  
  // 2. Vertex: add varyings in #include <common>
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>
    varying vec3 vWorldPosition;
    varying vec3 vWorldNormal;
    varying vec2 vUv;`
  );
  
  // 3. Vertex: compute varyings in #include <begin_vertex>
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorldNormal = normalize(normalMatrix * normal);
    vUv = uv;`
  );
  
  // 4. Fragment: inject header with uniforms, varyings, helpers
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    customFragmentHeader
  );
  
  // 5. Modify specific sections by replacing known markers
  shader.fragmentShader = shader.fragmentShader.replace(
    'vec3 diffuseColor = vec3( 1.0 );',
    'vec3 diffuseColor = vec3( 1.0 );\n// custom logic here'
  );
};
```

## Shared Shader Chunks (`src/shaders/`)

### wear.glsl

**Purpose**: Procedural wear, scratches, edge wear, curvature AO, dust accumulation

**Functions**:

| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `getWearData` | `sampler2D wearMap, vec2 uv` | `vec4` | Samples RGBA wear map (R=wear, G=scratches, B=curvature, A=edge) |
| `getCurvature` | `vec3 normal` | `float` | Approximate curvature from normal derivatives |
| `applyWear` | baseColor, uv, normal, viewDir, wearMap, intensities... | `vec3` | Applies wear darkening, edge wear, curvature AO, dust |
| `getScratchHighlights` | uv, normal, viewDir, lightDir, wearMap, intensity, time... | `vec3` | Anisotropic scratch highlights with temporal shimmer |
| `applyWearToRoughness` | roughness, uv, wearMap, intensity | `float` | Increases roughness based on wear |
| `applyWearToMetalness` | metalness, uv, wearMap, intensity | `float` | Exposes metal at deep wear |
| `getEdgeFactor` | normal, viewDir | `float` | Fresnel-like edge detection |
| `applyEdgeWear` | color, edgeFactor, intensity, edgeColor | `vec3` | Brightens worn edges |

**Wear Map Channels**:
- **R**: General wear (abrasion, fading) - darkens color, increases roughness
- **G**: Scratch density - catches highlights anisotropically
- **B**: Curvature/contact AO - darkens crevices, accumulates dust
- **A**: Edge wear - sharp corners/edges get additional wear

### clouds.glsl

**Purpose**: Volumetric cloud ray-marching, noise, lighting, temporal AA

**Noise Functions**:
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `hash33` | `vec3 p` | `float` | 3D hash for noise |
| `valueNoise` | `vec3 p` | `float` | Trilinear interpolated value noise |
| `fbm` | `vec3 p, int octaves, float lacunarity, float gain` | `float` | Fractal Brownian Motion |
| `domainWarpedNoise` | `vec3 p, float time` | `float` | Domain-warped for organic shapes |
| `curlNoise` | `vec3 p` | `vec3` | Incompressible flow for cloud movement |

**Density Functions**:
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `getCloudDensity` | pos, base, top, detailScale, erosionScale, time, windDir, windSpeed | `float` | Complete cloud density with erosion, curl, height falloff |
| `sampleWeather` | weatherTexture, pos, windDir, weatherTime | `float` | Macro-scale weather map sampling |

**Lighting Functions**:
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `henyeyGreenstein` | `float cosTheta, float g` | `float` | Physically-based phase function |
| `schlickPhase` | `float cosTheta, float g` | `float` | Fast phase approximation |
| `silverLining` | cosTheta, density, extinction | `float` | Forward/back scattering for silver lining |
| `getCloudColor` | baseColor, sunPosition | `vec3` | Sunrise/sunset color temperature |

**Ray Marching Helpers**:
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `rayCloudBounds` | ro, rd, base, top, tMin, tMax | `bool` | Ray-slab intersection |
| `blueNoiseRandom` | blueNoise, uv, time | `float` | Temporal jitter |
| `temporalReproject` | enabled, historyTexture, uv, color, blend | `void` | Temporal AA blend |

**Precipitation**:
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `precipitationStreaks` | pos, time, precipitation | `vec3` | Rain streak effect |

### dancefloor.glsl

**Purpose**: Tile patterns, animated lights, strobe/beat effects, groove clearcoat

**Tile Patterns**:
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `getTileUV` | uv, tileScale, groutWidth | `vec2` | Tile-local UV with grout detection |
| `checkerPattern` | uv, tileScale | `float` | Alternating tile pattern |
| `tilePulse` | uv, tileScale, time, beatPhase, intensity | `float` | Per-tile animated pulse |

**Animated Lights**:
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `sampleAnimatedLights` | lightsTexture3D, uv, time, speed, numLayers | `vec3` | 3D texture frame interpolation |
| `movingBeams` | uv, time, speed, width, numBeams | `float` | Scanner beam effect |
| `rotatingGobo` | uv, time, rotationSpeed, scale | `vec3` | Projected shape patterns |

**Strobe/Beat**:
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `strobeEffect` | time, strobeTime, duration, intensity | `float` | Sharp attack, exponential decay, flicker |
| `beatPulse` | time, bpm, phase, subdivision | `float` | Quantized beat pulse |
| `buildUp` | time, triggerTime, duration | `float` | Exponential tension buildup |

**Groove Effects**:
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `getGrooveFactor` | uv, tileScale, normalMap | `float` | 0 in grooves, 1 on tiles |
| `applyGrooveClearcoat` | clearcoat, grooveFactor | `float` | Reduces clearcoat in grout |

**Emissive Patterns**:
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `pulsingGrid` | uv, tileScale, time, width, intensity | `vec3` | Animated grid lines |
| `colorCycle` | uv, tileScale, time, speed | `vec3` | HSV color cycling |

**Wear Integration**:
| Function | Parameters | Returns | Description |
|----------|------------|---------|-------------|
| `applyDanceFloorWear` | baseColor, uv, tileScale, wearMap, intensity | `vec3` | Scuffed tiles, scratch highlights |

## Uniform Conventions

### Naming
- **Time**: `time` (seconds), `deltaTime` (frame delta)
- **Matrices**: `modelMatrix`, `viewMatrix`, `projectionMatrix`, `normalMatrix`
- **Camera**: `cameraPos`, `cameraDir`, `viewMatrix`, `projectionMatrix`
- **Lighting**: `sunPosition`, `sunColor`, `sunIntensity`, `ambientColor`
- **Quality**: `samples`, `stepScale`, `resolutionScale`
- **Animation**: `speed`, `phase`, `intensity`, `enabled` (float 0/1)

### Standard Uniforms (auto-injected by Three.js)
```glsl
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
// ... plus many more from Three.js chunks
```

### Custom Uniforms (per material)
Each material defines `this.customUniforms` object with:
```javascript
{
  time: { value: 0 },
  wearIntensity: { value: 1.0 },
  // ... material-specific uniforms
}
```

## Varying Conventions

### Standard Varyings (injected in vertex)
```glsl
varying vec3 vWorldPosition;  // World-space position
varying vec3 vWorldNormal;    // World-space normal
varying vec2 vUv;             // UV coordinates
varying vec3 vViewPosition;   // View-space position (for viewDir)
```

### Material-Specific Varyings
| Material | Additional Varyings |
|----------|---------------------|
| MountainMaterial | `vHeight` (0-1), `vSlope`, `vTriplanarWeights` |
| CloudMaterial | `vViewRay` (ray direction for ray-marching) |
| GroundMaterial | All standard + uses `vUv` for tile patterns |

## Post-Processing Pass Shaders

### BloomPass Shaders
- **BrightnessShader**: Luminance threshold extraction with smoothstep fade
- **BlurShader**: Separable Gaussian blur (H/V), anamorphic option, mip-level support
- **CompositeShader**: Additive blend with color weight, lens dirt, exposure, ACES tonemap

### SSRPass
- Screen-space ray-marching in view space
- Temporal accumulation with jitter
- Denoising via bilateral/spatial filter

### SSAOPass
- Hemisphere sampling with noise texture
- Bilateral blur (depth/normal aware)
- Configurable radius, bias, intensity

### ToneMappingPass
Supports multiple operators:
- **ACES Filmic** (default)
- **Reinhard**
- **Uncharted 2**
- **Linear** (passthrough)
- **Custom** (user LUT)

## Including Shared Chunks

In material `onBeforeCompile`, include shared functions by prepending to fragment header:

```javascript
const fragmentHeader = `
  #include <common>
  #include <packing>
  
  // Paste shared functions here OR use #pragma include (not supported)
  // Best practice: copy-paste needed functions into header
  
  varying vec3 vWorldPosition;
  // ... rest of header
`;
```

**Note**: Three.js doesn't support `#include` for custom files. Functions must be inlined in the injected header string.

## Quality-Based Shader Branching

Materials implement `setQuality(quality)` to adjust shader complexity:

```javascript
setQuality(quality) {
  const settings = {
    low: { samples: 16, triplanarBlend: 5.0 },
    medium: { samples: 32, triplanarBlend: 8.0 },
    high: { samples: 64, triplanarBlend: 10.0 },
    ultra: { samples: 96, triplanarBlend: 15.0 }
  };
  // Update uniforms
  this.customUniforms.samples.value = settings[quality].samples;
  // Force shader recompile
  this.needsUpdate = true;
}
```

In shader, use uniform to branch:
```glsl
uniform int samples;
for (int i = 0; i < 256; i++) {
  if (i >= samples) break;
  // ...
}
```

## Debugging Shaders

### Common Issues
1. **Uniform not found**: Check `onBeforeCompile` injection order, ensure `needsUpdate = true`
2. **Varying mismatch**: Vertex and fragment must declare same varyings
3. **Precision errors**: Use `highp` for world positions, `mediump` for colors
4. **Loop unrolling**: GLSL requires constant loop bounds; use `for (int i = 0; i < 256; i++) { if (i >= samples) break; }`

### Debug Tips
- Output values as color: `gl_FragColor = vec4(debugValue, 0, 0, 1);`
- Use `gl_FragColor.rgb = vec3(stepValue);` for step visualization
- Console log uniforms: `console.log(material.customUniforms)`

## Performance Guidelines

1. **Minimize texture samples** - Combine channels, use fewer lookups
2. **Branch on uniforms** - Quality settings control loop counts
3. **Precompute in vertex** - Move calculations from fragment to vertex when possible
4. **Use built-ins** - `fwidth()`, `dFdx()`, `smoothstep()` are hardware-accelerated
5. **Avoid dependent reads** - Sample textures with non-uniform coords sparingly
6. **Pack data** - Use RGBA channels efficiently (wear map packs 4 channels)

## Version Compatibility

- **Three.js**: r184 (0.184.0)
- **GLSL**: 300 ES (WebGL2) / WGSL (WebGPU via Three.js translation)
- **Chunks**: Uses Three.js built-in chunks (`#include <common>`, `<packing>`, etc.)

## Extending with New Chunks

1. Create `src/shaders/newchunk.glsl` with header guard
2. Document all functions with JSDoc-style comments
3. Import in materials that need it (copy-paste into fragment header)
4. Add to this documentation
5. Consider adding to `ProceduralTextures.js` if texture generation needed