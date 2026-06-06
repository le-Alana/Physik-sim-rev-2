# Physik Sim - Ultra-Realistic WebGPU 3D Rendering Engine

**Version**: 1.0.0 | **Three.js**: 0.184.0 | **Renderer**: WebGPU + WebGL2 fallback

A cutting-edge 3D rendering engine built for the web, featuring a Rayman-style open-air test scene with volumetric clouds, procedurally textured PBR materials with wear/scratch systems, screen-space reflections, and a full post-processing pipeline. Designed to run on both desktop and mobile devices with automatic quality scaling.

## Features

- **WebGPU Renderer** with automatic WebGL2 fallback for maximum compatibility
- **PBR Materials** with procedural wear, scratches, edge wear, curvature AO, and dust accumulation
- **Screen-Space Reflections (SSR)** with temporal accumulation for realistic mirror/water effects
- **Screen-Space Ambient Occlusion (SSAO)** with bilateral blur for contact shadows
- **Volumetric Clouds** with ray-marching, Henyey-Greenstein scattering, silver lining, and temporal reprojection
- **Rayman-Style Mountains** with tri-planar mapping, height-based snow/vegetation, slope shading, and wind animation
- **Dancing Floor** with animated 3D light textures, beat-reactive strobe effects, tile patterns, and grooved clearcoat
- **Full Post-Processing Pipeline**: SSR → SSAO → Bloom (anamorphic + lens dirt) → ToneMapping → FXAA
- **Dynamic Lighting** with CSM (Cascaded Shadow Maps), hemisphere, and animated dance floor lights
- **Mobile Optimization** with automatic device detection, 4 quality tiers, and adaptive resolution scaling
- **Day/Night Cycle** with atmospheric scattering, sunrise/sunset cloud colors, and star field
- **Cinematic Camera** with OrbitControls, auto-rotation, damping, and zoom limits

## Quick Start

### Prerequisites

- **Node.js** >= 24.15.0
- **npm** (ships with Node.js)
- **Browser**: Chrome 128+ (WebGPU) or any modern browser (WebGL2 fallback)

### Install

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

This starts a local server at `http://localhost:5173` using `serve`.

### Open in Browser

Navigate to `http://localhost:5173` in your browser.

- **WebGPU**: Chrome 128+ (enable at `chrome://flags/#enable-webgpu-developer-features`)
- **WebGL2**: All modern browsers (automatic fallback)
- **Mobile**: Works on Android Chrome and iOS Safari 18+

## Project Structure

```
physik-sim/
├── package.json              # Dependencies and scripts
├── vercel.json               # Vercel deployment config (COOP/COEP headers)
├── index.html                # Entry point with loading screen and stats overlay
├── src/
│   ├── main.js               # App bootstrap, render loop, initialization
│   ├── core/
│   │   ├── Engine.js         # WebGPU/WebGL2 renderer with fallback
│   │   ├── SceneManager.js   # Scene lifecycle, object groups
│   │   ├── CameraController.js # OrbitControls with cinematic animation
│   │   ├── PostProcessing.js # EffectComposer pipeline manager
│   │   └── Lighting.js       # Dynamic lighting with CSM shadows
│   ├── scene/
│   │   ├── TestScene.js      # Scene orchestrator with day cycle
│   │   ├── Sky.js            # Atmospheric scattering + volumetric clouds
│   │   ├── Ground.js         # Dance floor with animated lights
│   │   └── Mountains.js      # Procedural Rayman-style mountains
│   ├── materials/
│   │   ├── PBRMaterial.js    # Base PBR with wear/scratch system
│   │   ├── GroundMaterial.js # Dance floor with animated lights
│   │   ├── MountainMaterial.js # Tri-planar mountain material
│   │   └── CloudMaterial.js  # Volumetric cloud material
│   ├── postprocessing/
│   │   ├── SSRPass.js        # Screen-space reflections
│   │   ├── SSAOPass.js       # Screen-space ambient occlusion
│   │   ├── BloomPass.js      # Unreal bloom with anamorphic + dirt
│   │   └── ToneMappingPass.js # ACES/Reinhard tone mapping
│   ├── shaders/
│   │   ├── wear.glsl         # Shared wear/scratch shader chunks
│   │   ├── clouds.glsl       # Volumetric cloud shader chunks
│   │   └── dancefloor.glsl   # Animated floor shader chunks
│   └── utils/
│       ├── MobileDetector.js # Device capability detection
│       ├── TextureLoader.js  # Async texture loading with fallbacks
│       └── ProceduralTextures.js # Noise, wear, cloud generators
├── docs/
│   ├── ARCHITECTURE.md       # Code organization and module graph
│   ├── SHADERS.md            # Shader documentation and conventions
│   └── MOBILE.md             # Mobile optimization guide
└── public/
    ├── textures/             # PBR textures, normal maps, scratch maps
    └── models/               # GLTF models
```

## Features Breakdown

### Post-Processing Pipeline

```
RenderPass → SSRPass → SSAOPass → BloomPass → ToneMappingPass → FXAAPass → OutputPass
```

Each pass can be individually toggled and quality-scaled:

| Pass | Description | Mobile Impact |
|------|-------------|---------------|
| SSR | Screen-space reflections with temporal accumulation | Heavy - disable on low-end |
| SSAO | Ambient occlusion with bilateral blur | Medium |
| Bloom | Unreal bloom with anamorphic option + lens dirt | Light |
| ToneMapping | ACES Filmic / Reinhard / Uncharted 2 | Very Light |
| FXAA | Fast approximate anti-aliasing | Light |

### Materials

- **PBRMaterial**: MeshPhysicalMaterial with procedural wear map (R=wear, G=scratches, B=curvature AO, A=edge wear). Scratches catch light anisotropically with temporal shimmer.
- **GroundMaterial**: Dance floor with animated 3D light texture, strobe/beat effects, tile groove clearcoat.
- **MountainMaterial**: Tri-planar mapped with height-based snow caps, vegetation zones, wind animation.
- **CloudMaterial**: Volumetric ray-marching through domain-warped noise with HG scattering and silver lining.

### Quality Presets

The engine auto-detects device capability and selects appropriate quality tier:

| Tier | Render Scale | SSR Samples | Cloud Steps | Shadows |
|------|-------------|-------------|-------------|---------|
| Low | 0.75x | 8 | 16 | 1024² |
| Medium | 0.85x | 16 | 32 | 2048² |
| High | 1.0x | 24 | 64 | 4096² |
| Ultra | 1.0x | 32 | 96 | 8192² |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on `localhost:5173` |
| `npm run build` | Verify project structure (no build step - native ES modules) |
| `npm run preview` | Start preview server |
| `npm run lint` | Run ESLint on source files |
| `npm run format` | Format source files with Prettier |

## Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Module graph, data flow, extension points
- **[SHADERS.md](docs/SHADERS.md)** - Shader injection patterns, uniform/varying conventions, GLSL function reference
- **[MOBILE.md](docs/MOBILE.md)** - Optimization strategies, quality tiers, battery/thermal management

## Browser Support

| Browser | WebGPU | WebGL2 | Status |
|---------|--------|--------|--------|
| Chrome 128+ | ✅ | ✅ | Full support |
| Edge 128+ (Chromium) | ✅ | ✅ | Full support |
| Firefox | ❌ | ✅ | WebGL2 fallback |
| Safari 18+ | ✅ (A17+/M-series) | ✅ | Limited WebGPU |
| Samsung Internet | ❌ | ✅ | WebGL2 fallback |

## Deployment

### Vercel (Recommended)

The project includes a `vercel.json` with COOP/COEP headers required for SharedArrayBuffer (needed by WebGPU):

```bash
npx vercel deploy
```

### Static Hosting

For any static host, ensure the following headers are set:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- ESLint 10.4.1 with recommended config
- Prettier 3.8.1 for formatting
- JSDoc comments for all public methods
- PascalCase for classes, camelCase for functions/variables
- Private methods prefixed with `_`

## License

MIT - See [LICENSE](LICENSE) for details.

## Acknowledgments

- [Three.js](https://threejs.org/) - r184 WebGPU/WebGL framework
- [Rayman](https://en.wikipedia.org/wiki/Rayman) - Art style inspiration for procedural mountains
- [serve](https://github.com/vercel/serve) - Static file server for development