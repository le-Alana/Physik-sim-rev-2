# Architecture — Physik Sim WebGPU Renderer

## Overview
This is a **WebGPU-only** 3D rendering engine built on Three.js 0.185.0's Node Material System (TSL).  
It renders an overgrown Rayman-style fantasy scene with ultra-realistic PBR shading.

## Core Stack
- **Renderer**: `WebGPURenderer` (Node-only variant from `three/webgpu`)
- **Shading**: `MeshPhysicalNodeMaterial` with custom TSL nodes for wear, overgrowth, and stylized colors
- **Post-Processing**: Built-in TSL nodes: SSR, GTAO, Bloom, Tone Mapping
- **Shadows**: `ShadowNode` with PCFSoft shadow maps

## Module Dependency Graph
```
main.js
  ├── engine/Engine.js          ← WebGPURenderer + backend init
  ├── engine/SceneManager.js    ← Scene, fog, background
  ├── engine/PostProcessing.js  ← SSR + GTAO + Bloom pipeline
  ├── scene/TestScene.js        ← Orchestrates all scene objects
  │   ├── scene/Sky.js
  │   ├── scene/Clouds.js
  │   ├── scene/Ground.js
  │   ├── scene/Mountains.js
  │   ├── scene/Overgrowth.js
  │   ├── scene/Foliage.js
  │   ├── scene/Cubey.js
  │   └── scene/Environment.js
  ├── materials/MaterialLibrary.js
  │   ├── materials/PBRMaterialBuilder.js
  │   ├── materials/WearLayer.js
  │   └── materials/OvergrowthLayer.js
  ├── effects/ShadowManager.js
  └── effects/AnimatedLights.js
```

## Data Flow
1. `main.js` creates `Engine` → gets `renderer`, `scene`, `camera`
2. `TestScene` builds all objects using `MaterialLibrary`
3. `PostProcessing` wraps the render output with SSR/GTAO/Bloom
4. Render loop: update Cubey (arrow keys) → update animated lights → render

## Key Design Decisions
- **No WebGL fallback** — pure WebGPU for maximum quality
- **Node-only materials** — all materials use `MeshPhysicalNodeMaterial` for TSL compatibility
- **Procedural everything** — no texture files needed, all patterns via TSL noise nodes
- **Mobile-friendly** — quality settings scale based on device capabilities