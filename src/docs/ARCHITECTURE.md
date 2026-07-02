# Architecture — Physik Sim WebGPU Renderer

## Overview
This is a **WebGPU-only** 3D rendering engine built on Three.js 0.185.1's Node Material System (TSL).  
It renders an overgrown Rayman-style fantasy scene with ultra-realistic PBR shading.

## Core Stack
- **Renderer**: `WebGPURenderer` (Node-only variant from `three/webgpu`)
- **Shading**: `MeshPhysicalNodeMaterial` with custom TSL nodes for textures, wear, and overgrowth
- **Post-Processing**: Built-in TSL nodes: SSR, GTAO, Bloom, Tone Mapping
- **Shadows**: `DirectionalLight` with `PCFSoftShadowMap`
- **Reflections**: `ReflectorNode` for planar reflections + SSR for screen-space

## Module Dependency Graph
```
main.js
  ├── engine/Engine.js              ← WebGPURenderer + backend init
  ├── engine/SceneManager.js        ← Scene, fog, background, camera, controls
  ├── engine/PostProcessing.js      ← SSR + GTAO + Bloom pipeline (fixed for three@0.185.1)
  ├── scene/TestScene.js            ← Orchestrates all scene objects
  │   ├── scene/Environment.js      ← HemisphereLight, AmbientLight, fog color
  │   ├── scene/Terrain.js          ← Height-mapped ground with dirt texture (NEW)
  │   ├── scene/Sky.js              ← Gradient sky dome + glowing sun disc
  │   ├── scene/Clouds.js           ← Volumetric cloud clusters (rewritten)
  │   ├── scene/Mountains.js        ← Organic floating mountains (rewritten)
  │   ├── scene/Ground.js           ← Dance floor with running lights (rewritten)
  │   ├── scene/Overgrowth.js       ← Organic pillars, faceted rocks, mushrooms (rewritten)
  │   ├── scene/NatureDetails.js    ← Roots, logs, flowers, vines, moss (NEW)
  │   ├── scene/Foliage.js          ← Blade grass, branched trees, shrubs (rewritten)
  │   └── scene/Cubey.js            ← Beveled player cube (improved)
  ├── materials/MaterialLibrary.js  ← New: grass, leaf, bark, ground, root materials
  │   ├── materials/PBRMaterialBuilder.js  ← Now with normal perturbation
  │   ├── shaders/GrassTextureNode.js      ← Procedural blade texture (NEW)
  │   ├── shaders/LeafTextureNode.js       ← Procedural leaf veins (NEW)
  │   ├── shaders/GroundTextureNode.js     ← Procedural dirt/soil (NEW)
  │   ├── shaders/BarkTextureNode.js       ← Procedural bark grain (NEW)
  │   ├── shaders/NormalPerturbationNode.js← Micro-detail normal noise (NEW)
  │   ├── shaders/WearNode.js       ← Procedural scratch pattern
  │   ├── shaders/OvergrowthNode.js ← Moss/vine pattern
  │   ├── shaders/CloudNoiseNode.js ← Cloud noise helper
  │   └── shaders/MountainColorNode.js ← Rayman pastel gradient
  ├── effects/ShadowManager.js      ← Directional + fill + rim lights
  └── effects/AnimatedLights.js     ← Orbiting color-cycling point lights
```

## Data Flow
1. `main.js` creates `Engine` → gets `renderer`, `scene`, `camera`
2. `TestScene` builds all objects in order:
   - Environment → Terrain → Sky → Clouds → Mountains → Ground → Overgrowth → NatureDetails → Foliage → Cubey
3. `PostProcessing` wraps the render output with SSR/GTAO/Bloom via TSL
4. Render loop: update Cubey (arrow keys) → update animated lights → render

## Key Design Decisions
- **No WebGL fallback** — pure WebGPU for maximum quality
- **Node-only materials** — all materials use `MeshPhysicalNodeMaterial` for TSL compatibility
- **Procedural everything** — no texture files needed, all patterns via TSL noise nodes
- **No transparent grass** — grass uses opaque blade geometry with 3D mesh
- **Organic over primitives** — all objects use vertex deformation for natural shapes
- **Mobile-friendly** — quality settings scale based on device capabilities

## New Texture Nodes (Procedural)
| Node | Purpose | Pattern |
|------|---------|---------|
| `GrassTextureNode` | Grass blade color | Vertical veins, tip yellowing, blade variation |
| `LeafTextureNode` | Leaf color | Central vein, branching side veins, edge browning |
| `GroundTextureNode` | Dirt/soil color | Brown base, speckles, moss patches, pebbles |
| `BarkTextureNode` | Tree bark color | Vertical grain, crevices, knot rings, moss |
| `NormalPerturbationNode` | Micro-surface detail | High-frequency noise perturbs surface normals |

## Scene Object Improvements
| Object | Before | After |
|--------|--------|-------|
| Mountains | Plain spheres | Organic vertex displacement, flat bottoms |
| Ground | Flat plane | Grid of plates with running lights, ReflectorNode |
| Terrain | None | Height-mapped hills, flat center for dance floor |
| Grass | Transparent quads | Opaque 3D blade geometry, grass texture |
| Trees | Cone crowns | Branched structure, leaf clusters, bark texture |
| Rocks | Deformed spheres | Faceted icosahedrons |
| Pillars | Perfect cylinders | Irregular bulges with vertex displacement |
| Mushrooms | Cone-on-cylinder | Curved stems, organic caps, spots |
| Cubey | Sharp box | Rounded/beveled corners, squash/stretch |
| Clouds | Flat quad billboards | Volumetric sphere clusters |