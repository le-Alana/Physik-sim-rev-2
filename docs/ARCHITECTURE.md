# Architecture Documentation

## Overview

This project is an ultra-realistic 3D WebGPU rendering engine built with Three.js r184 and modern ES modules. It features a Rayman-style open-air test scene with volumetric clouds, a dancing floor with animated lights, and procedural mountains with tri-planar mapping.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │   main.js   │──│  Engine.js   │──│   SceneManager.js     │  │
│  │  (bootstrap)│  │ (renderer,   │  │ (scene lifecycle,     │  │
│  │  render loop)│  │  fallback,   │  │  groups, loading)     │  │
│  └─────────────┘  │   resize)    │  └───────────────────────┘  │
│                   └──────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Core Systems                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ CameraController │  │  PostProcessing  │  │   Lighting    │  │
│  │ (OrbitControls,  │  │ (EffectComposer  │  │ (CSM shadows, │  │
│  │  cinematic anim) │  │  pipeline)       │  │  dynamic LOD) │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Scene Modules                             │
│  ┌───────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐  │
│  │ Sky.js    │ │ Ground.js│ │ Mountains.js│ │ TestScene.js  │  │
│  │ Volumetric│ │ Dancing  │ │ Procedural │ │ (orchestrator,│  │
│  │ clouds    │ │ floor    │ │ mountains  │ │  day cycle)   │  │
│  └───────────┘ └──────────┘ └────────────┘ └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Materials                                 │
│  ┌───────────────┐ ┌────────────────┐ ┌────────────────────┐  │
│  │ PBRMaterial   │ │ GroundMaterial │ │  CloudMaterial     │  │
│  │ (base + wear) │ │ (animated lts) │ │ (ray-marched vol)  │  │
│  └───────────────┘ └────────────────┘ └────────────────────┘  │
│  ┌────────────────┐                                           │
│  │ MountainMaterial                                           │
│  │ (tri-planar, snow,                                          │
│  │  vegetation)                                               │  │
│  └────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Post-Processing Pipeline                    │
│  RenderPass → SSRPass → SSAOPass → BloomPass → ToneMappingPass │
│                          → FXAAPass → OutputPass                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Utilities                                │
│  ┌────────────────┐ ┌──────────────────┐ ┌────────────────────┐│
│  │ProceduralTex  │ │ MobileDetector   │ │  TextureLoader     ││
│  │ (noise, wear, │ │ (device caps,    │ │ (async, fallbacks, ││
│  │  clouds, floor)│  │  quality tiers)  │  │   compression)   ││
│  └────────────────┘ └──────────────────┘ └────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Module Responsibilities

### Core Layer

| Module | Responsibility |
|--------|---------------|
| `Engine.js` | WebGPU renderer initialization with WebGL2 fallback, resize handling, render loop integration |
| `SceneManager.js` | Scene graph management, object groups (opaque, transparent, post-process), loading states |
| `CameraController.js` | OrbitControls wrapper with cinematic auto-rotation, damping, zoom limits |
| `PostProcessing.js` | EffectComposer orchestration, pass management, quality preset application |
| `Lighting.js` | Dynamic lighting setup: sun (CSM), hemisphere, ambient, animated dance floor lights |

### Scene Layer

| Module | Responsibility |
|--------|---------------|
| `TestScene.js` | Scene orchestrator: creates sky, ground, mountains, lighting; manages day/night cycle |
| `Sky.js` | Atmospheric scattering (preetham), volumetric cloud layer, sun disk, stars |
| `Ground.js` | Dancing floor geometry, animated light texture generation, beat-reactive updates |
| `Mountains.js` | Procedural mountain generation (noise displacement), LOD meshes, tri-planar UVs |

### Materials Layer

| Module | Responsibility |
|--------|---------------|
| `PBRMaterial.js` | Base physical material with wear system (scratches, edge wear, curvature AO, dust) |
| `GroundMaterial.js` | Dance floor: tile pattern, animated 3D light texture, strobe/beat effects, groove clearcoat |
| `MountainMaterial.js` | Tri-planar mapping, height-based snow/vegetation, displacement, slope shading, wind animation |
| `CloudMaterial.js` | Volumetric ray-marching, Henyey-Greenstein scattering, silver lining, temporal reprojection |

### Post-Processing Layer

| Pass | Purpose |
|------|--------|
| `RenderPass` | Base scene render to render target |
| `SSRPass` | Screen-space reflections with temporal accumulation |
| `SSAOPass` | Screen-space ambient occlusion with bilateral blur |
| `BloomPass` | Unreal bloom with anamorphic option, lens dirt, quality presets |
| `ToneMappingPass` | ACES/Reinhard/Uncharted2 operators, exposure, color grading |
| `FXAAPass` | Fast approximate anti-aliasing |
| `OutputPass` | sRGB conversion, final output |

### Utilities

| Module | Responsibility |
|--------|---------------|
| `ProceduralTextures.js` | Perlin/simplex noise, wear/scratch maps, cloud noise, dance floor patterns, terrain heightmaps |
| `MobileDetector.js` | Device capability detection (GPU tier, memory, WebGPU support), quality preset mapping |
| `TextureLoader.js` | Async loading with fallbacks, KTX2/BasisU compression, mipmap generation |

### Shaders (`src/shaders/`)

| File | Contents |
|------|----------|
| `wear.glsl` | Shared wear/scratch functions: curvature, edge wear, dust, anisotropic highlights |
| `clouds.glsl` | Volumetric cloud functions: fBm noise, curl noise, HG phase, ray-cloud bounds, temporal AA |
| `dancefloor.glsl` | Tile patterns, animated lights, strobe/beat effects, gobo patterns, groove clearcoat |

## Data Flow

### Render Frame
```
1. Engine.requestAnimationFrame()
2. Update: CameraController, Lighting, Scene (day cycle), Materials (time uniforms)
3. PostProcessing.render(scene, camera)
   ├─ RenderPass → renderTarget1
   ├─ SSRPass (reads depth/normal from renderTarget1)
   ├─ SSAOPass (reads depth/normal)
   ├─ BloomPass (brightness extraction → blur → composite)
   ├─ ToneMappingPass
   ├─ FXAAPass
   └─ OutputPass → screen
4. Stats update, next frame
```

### Quality Scaling
```
MobileDetector.detect() → qualityTier ('low'|'medium'|'high'|'ultra')
       │
       ▼
PostProcessing.setQuality(qualityTier)
       │
       ├── SSRPass: samples, thickness, resolutionScale
       ├── SSAOPass: samples, radius
       ├── BloomPass: mipLevel, blurPasses, kernelSize
       ├── CloudMaterial: samples, stepScale
       ├── MountainMaterial: triplanarBlend, displacementScale
       └── RenderTarget: renderScale (0.75-1.0)
```

## Extension Points

### Adding a New Post-Processing Pass
1. Create `src/core/postprocessing/NewPass.js` extending `Pass`
2. Import in `PostProcessing.js`
3. Add to `_init()` pipeline at correct position
4. Add quality preset parameters to `QUALITY_PRESETS`
5. Handle in `setQuality()`, `setSize()`, `dispose()`

### Adding a New Material
1. Create `src/materials/NewMaterial.js` extending `THREE.MeshPhysicalMaterial` or `ShaderMaterial`
2. Use `onBeforeCompile` for shader injection
3. Store custom uniforms in `this.customUniforms`
4. Provide setter methods for runtime control
5. Add procedural texture generation to `ProceduralTextures.js` if needed

### Adding a New Scene Element
1. Create `src/scene/NewElement.js`
2. Accept `sceneManager`, `options` in constructor
3. Implement `update(deltaTime, elapsedTime)` for animation
4. Implement `dispose()` for cleanup
5. Register in `TestScene.js` or `SceneManager`

## Shader Injection Pattern

All custom materials use `onBeforeCompile` for shader modification:

```javascript
this.onBeforeCompile = (shader) => {
  // 1. Add uniforms
  Object.assign(shader.uniforms, this.customUniforms);
  
  // 2. Inject vertex varyings
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>\nvarying vec3 vWorldPosition;`
  );
  
  // 3. Inject vertex computations
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>\nvWorldPosition = ...;`
  );
  
  // 4. Inject fragment header (uniforms, varyings, helper functions)
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    customFragmentHeader
  );
  
  // 5. Modify specific shader sections
  shader.fragmentShader = shader.fragmentShader.replace(
    'vec3 diffuseColor = vec3( 1.0 );',
    'vec3 diffuseColor = vec3( 1.0 );\n// custom logic'
  );
};
```

## Performance Considerations

- **Render Target Scaling**: Quality presets control internal resolution (0.75x-1.0x)
- **Shader LOD**: Materials have `setQuality()` to reduce complexity
- **Instancing**: Repeated geometry (mountain chunks) uses `InstancedMesh`
- **Texture Streaming**: Procedural textures generated on-demand, cached
- **Temporal Accumulation**: SSR and clouds use history buffers for noise reduction
- **Frustum Culling**: Automatic via Three.js, mountain chunks use custom bounds

## File Naming Conventions

- Classes: PascalCase (`PBRMaterial.js`)
- Functions/Variables: camelCase
- Shader files: kebab-case with `.glsl` extension
- Private methods: `_` prefix (`_init()`)
- Constants: UPPER_SNAKE_CASE (`QUALITY_PRESETS`)