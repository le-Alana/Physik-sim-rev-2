# API Documentation — Physik Sim WebGPU

## Engine
### `Engine` (engine/Engine.js)
- `constructor(canvas)` — Creates WebGPURenderer with automatic desktop/mobile config
- `renderer` — The `WebGPURenderer` instance
- `getDevicePixelRatio()` — Returns appropriate pixel ratio for device

### `SceneManager` (engine/SceneManager.js)
- `constructor(renderer)` — Creates scene, camera, fog
- `scene` — The `Scene` instance
- `camera` — The `PerspectiveCamera` instance
- `updateAspect(width, height)` — Resize handler

### `PostProcessing` (engine/PostProcessing.js)
- `constructor(renderer, scene, camera)` — Builds SSR + GTAO + Bloom pipeline
- `outputNode` — The final composited output node
- `setSize(width, height)` — Update render target sizes

## Materials
### `PBRMaterialBuilder` (materials/PBRMaterialBuilder.js)
- `createMaterial(config)` — Returns `MeshPhysicalNodeMaterial`
  - `config.color`, `config.roughness`, `config.metalness`, `config.normalStrength`
  - `config.wear` — Apply wear layer?
  - `config.overgrowth` — Apply overgrowth layer?

### `WearLayer` (materials/WearLayer.js)
- `createWearNode()` — Returns TSL node for procedural scratches

### `OvergrowthLayer` (materials/OvergrowthLayer.js)
- `createOvergrowthNode(config)` — Returns TSL node for moss/vine overlay

### `MaterialLibrary` (materials/MaterialLibrary.js)
- `get(name)` — Returns cached material by name
- `getDanceFloorMaterial()` — Reflective ground material
- `getMountainMaterial()` — Rayman gradient material
- `getRockMaterial()` — Mossy rock material
- `getVineMaterial()` — Overgrown vine pillar material
- `getCubeyMaterial()` — Player cube material with wear

## Scene Objects
### `Sky` (scene/Sky.js)
- `create(scene)` — Adds gradient sky + sun disc

### `Clouds` (scene/Clouds.js)
- `create(scene)` — Adds drifting cloud layers

### `Ground` (scene/Ground.js)
- `create(scene, materialLib)` — Creates reflective dance floor

### `Mountains` (scene/Mountains.js)
- `create(scene, materialLib)` — Creates floating Rayman-style mountains

### `Overgrowth` (scene/Overgrowth.js)
- `create(scene, materialLib)` — Vine pillars + mossy rocks + glowing flora

### `Foliage` (scene/Foliage.js)
- `create(scene, materialLib)` — Grass tufts + stylized trees

### `Cubey` (scene/Cubey.js)
- `constructor(scene, materialLib)` — Creates player cube
- `update(deltaTime)` — Handles arrow key movement

### `Environment` (scene/Environment.js)
- `create(scene)` — Sets up ambient, hemisphere, fog

## Effects
### `ShadowManager` (effects/ShadowManager.js)
- `create(scene)` — Adds directional + spot lights with shadows

### `AnimatedLights` (effects/AnimatedLights.js)
- `constructor(scene)` — Creates orbiting animated lights
- `update(time)` — Animates position + color of lights