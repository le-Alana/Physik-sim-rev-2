# Mobile Optimization Guide

## Overview

This document outlines the mobile optimization strategies used in the Physik Sim rendering engine. The engine automatically detects device capabilities and adjusts quality settings to maintain 30+ FPS on mid-range smartphones while preserving visual fidelity on high-end devices.

## Device Detection

### MobileDetector (`src/utils/MobileDetector.js`)

The detector analyzes the following device characteristics:

| Capability | Detection Method | Used For |
|-----------|-----------------|----------|
| **GPU Tier** | WebGL renderer info, vendor/GPU strings, `WEBGL_debug_renderer_info` | Shader complexity, sample counts |
| **Memory** | `navigator.deviceMemory` API (Chrome) | Texture resolution, cache sizes |
| **Screen DPI** | `window.devicePixelRatio` | Render target scaling |
| **Touch Support** | `navigator.maxTouchPoints` | UI layout, control scheme |
| **Battery** | `navigator.getBattery()` (Chrome) | Performance throttling at low battery |
| **WebGPU Support** | Try-create `WebGPURenderer` | Renderer selection |

### Quality Tiers

```javascript
low:     // Budget Android phones (e.g., Galaxy A-series)
  - Render scale: 0.75x
  - SSR samples: 8
  - SSAO samples: 8
  - Bloom mipLevel: 4 (aggressive downsample)
  - Cloud samples: 16
  - Shadow map: 1024x1024
  - No SSR temporal accumulation
  - No SSAO bilateral blur

medium:  // Mid-range phones (e.g., Pixel 6, Galaxy S22)
  - Render scale: 0.85x
  - SSR samples: 16
  - SSAO samples: 12
  - Bloom mipLevel: 2
  - Cloud samples: 32
  - Shadow map: 2048x2048
  - SSR temporal: 2 frames
  - SSAO bilateral: 3x3

high:    // High-end phones (e.g., Galaxy S24 Ultra, iPhone 16 Pro)
  - Render scale: 1.0x
  - SSR samples: 24
  - SSAO samples: 16
  - Bloom mipLevel: 1
  - Cloud samples: 64
  - Shadow map: 4096x4096
  - SSR temporal: 4 frames
  - SSAO bilateral: 5x5

ultra:   // Desktop GPUs / iPad Pro
  - Render scale: 1.0x
  - SSR samples: 32
  - SSAO samples: 32
  - Bloom mipLevel: 0 (full res)
  - Cloud samples: 96
  - Shadow map: 8192x8192
  - SSR temporal: 8 frames
  - SSAO bilateral: 7x7
```

## Performance Budget

### Target Frame Times (60 FPS = 16.67ms)

| Operation | Budget (low) | Budget (medium) | Budget (high) | Budget (ultra) |
|-----------|-------------|-----------------|---------------|----------------|
| **Draw Calls** | ≤ 100 | ≤ 200 | ≤ 500 | ≤ 1000 |
| **Triangle Count** | ≤ 200K | ≤ 500K | ≤ 1M | ≤ 3M |
| **Unique Materials** | ≤ 10 | ≤ 20 | ≤ 30 | ≤ 50 |
| **Post-Processing Passes** | 3 | 4 | 6 | 7 |
| **Cloud Ray-March Steps** | 16 | 32 | 64 | 96 |
| **Shadow Map Resolution** | 1024² | 2048² | 4096² | 8192² |
| **Render Target Scale** | 0.75x | 0.85x | 1.0x | 1.0x |

### Frame Budget Allocation (medium tier, 33ms target = 30 FPS)

```
├── Scene Rendering: ~12ms
│   ├── Geometry/shadows: ~6ms
│   ├── Materials/Textures: ~4ms
│   └── Sky/Clouds: ~2ms
├── Post-Processing: ~15ms
│   ├── SSR: ~5ms
│   ├── SSAO: ~3ms
│   ├── Bloom: ~4ms
│   ├── ToneMap: ~1ms
│   └── FXAA: ~2ms
├── JavaScript overhead: ~4ms
└── Buffer: ~2ms
```

## Shader Optimizations

### Quality Branching Pattern

```glsl
// Avoid dynamic branching with uniform-based loop limits
uniform int qualitySamples;

void main() {
    float total = 0.0;
    for (int i = 0; i < MAX_SAMPLES; i++) {
        if (i >= qualitySamples) break;
        total += doSample(i);
    }
}
```

### Precision Hints

```glsl
// Mobile-optimized precision
precision highp float;  // For position/depth
// or
precision mediump float; // For color/normal (saves 2x ALU cycles)

// Varying precision
varying highp vec3 vWorldPosition;  // Needs high precision
varying mediump vec2 vUv;           // OK for textures
```

### Optimized Functions

| Full | Mobile Opt | Savings |
|------|-----------|---------|
| `henyeyGreenstein()` | `schlickPhase()` | ~40% ALU |
| `fbm(warped noise)` | `valueNoise()` 3 octaves | ~60% ALU |
| `triplanarSample()` | Single planar (Y-up) | ~66% texture reads |
| `getScratchHighlights()` | Skip if scratches < 0.01 | Early exit |

## Render Target Management

### Dynamic Resolution Scaling

```javascript
// In main render loop
const targetFPS = 30;
const currentFPS = getCurrentFPS();

if (currentFPS < targetFPS) {
  // Gradually reduce resolution
  renderScale = Math.max(0.5, renderScale - 0.05);
  // Recreate render target at new scale
  recreateRenderTarget();
} else if (currentFPS > targetFPS + 10 && renderScale < 1.0) {
  // Recover resolution when headroom exists
  renderScale = Math.min(1.0, renderScale + 0.05);
}
```

### HALF_FLOAT vs FULL_FLOAT

- Use `THREE.HalfFloatType` for all intermediate render targets
- Switches to `THREE.FloatType` only for depth/normal buffers needed by SSR
- Saves 50% memory bandwidth

## Post-Processing Toggles

Passes can be toggled individually:

```javascript
// In main.js, based on mobile detection
const quality = MobileDetector.getQuality();
const ppOptions = {
  enableSSR: quality !== 'low',      // SSR is expensive
  enableSSAO: quality !== 'low',     // SSAO helps on all tiers
  enableBloom: true,                 // Bloom is relatively cheap
  enableToneMapping: true,           // Required for HDR
  enableFXAA: quality !== 'ultra',   // FXAA only on non-ultra
};

// SSR quality settings
if (quality === 'low') {
  ppOptions.ssrSamples = 8;
  ppOptions.ssrThickness = 0.15;
}
```

## Shadow Optimizations

### CSM on Mobile

```javascript
const csmConfig = {
  low: { cascades: 2, resolution: 1024, maxDistance: 30 },
  medium: { cascades: 3, resolution: 2048, maxDistance: 50 },
  high: { cascades: 4, resolution: 4096, maxDistance: 80 },
  ultra: { cascades: 5, resolution: 8192, maxDistance: 100 },
};
```

### Blur-Shadow Optimization

- Low/medium: PCF soft shadows (3x3)
- High/ultra: VSM (Variance Shadow Maps) with blur
- Low battery: Disable shadows entirely

## Texture Compression

### Recommended Formats

| Platform | Format | Extension |
|----------|--------|-----------|
| Android (Mali) | ETC2 + ASTC | `.ktx2` |
| Android (Adreno) | ETC2 + ASTC | `.ktx2` |
| iOS | PVRTC + ASTC | `.ktx2` |
| Desktop | BC7 + BC5 | `.ktx2` |

### Mipmap Strategy

- Generate mipmaps on GPU after upload
- Limit maxLOD based on quality:
  - low: maxLOD=5 (32x32 minimum)
  - medium: maxLOD=7 (128x128 minimum)
  - high/ultra: full mip chain

## Battery Consideration

### Adaptive Performance

```javascript
// Check battery status every 30 seconds
if (navigator.getBattery) {
  const battery = await navigator.getBattery();
  
  battery.addEventListener('levelchange', () => {
    if (battery.level < 0.2 && !battery.charging) {
      setQuality('low');
      showBatterySaverNotification();
    }
  });
}
```

### Thermal Throttling Detection

```javascript
let frameTimes = [];
let throttleLevel = 0;

function detectThrottling() {
  const now = performance.now();
  frameTimes.push(now);
  
  // Keep last 60 frames
  if (frameTimes.length > 60) frameTimes.shift();
  
  if (frameTimes.length >= 2) {
    const recent = frameTimes.slice(-10);
    const deltas = recent.map((t, i) => i > 0 ? t - recent[i-1] : 0);
    const avgDelta = deltas.reduce((a, b) => a + b) / deltas.length;
    
    // If FPS dropped by 40% or more, throttle
    const currentFPS = 1000 / avgDelta;
    if (currentFPS < targetFPS * 0.6) {
      throttleLevel = Math.min(2, throttleLevel + 1);
      applyThrottle(throttleLevel);
    }
  }
}
```

## Memory Management

### Texture Budget

```javascript
const textureBudgets = {
  low:    64 * 1024 * 1024,    // 64 MB
  medium: 128 * 1024 * 1024,   // 128 MB
  high:   256 * 1024 * 1024,   // 256 MB
  ultra:  512 * 1024 * 1024,   // 512 MB
};
```

### Object Pooling

- Reuse Three.js objects (Vector3, Matrix4) via pools
- Pre-allocate geometry buffers
- Dispose materials/render targets when not in use

## Testing Checklist

### Test Devices

- [ ] iPhone SE (2nd gen) - Low tier
- [ ] iPhone 16 Pro - High tier
- [ ] Galaxy A54 - Low/Medium
- [ ] Galaxy S24 Ultra - High/Ultra
- [ ] Pixel 6a - Medium
- [ ] iPad Pro M4 - Ultra

### Test Conditions

- [ ] Initial load on 4G connection
- [ ] Smooth 30 FPS on medium devices
- [ ] Stable after 10 minutes of use (thermal)
- [ ] WebGPU fallback to WebGL2
- [ ] Touch controls work (orbit, pinch zoom)
- [ ] 60 FPS on high-end desktop
- [ ] Battery saver triggers correctly
- [ ] Resolution scaling responsive

## Profiling Tips

### Chrome DevTools on Mobile

1. Connect via USB debugging
2. Open `chrome://inspect`
3. Profile with `Performance` tab
4. Look for:
   - Long frames (>33ms for 30 FPS)
   - Excessive GC pauses
   - Shader compilation spikes
   - Texture upload stalls

### GPU Profiling

- `about:gpu` in Chrome shows GPU info
- `WEBGL_debug_renderer_info` for GPU vendor
- `EXT_disjoint_timer_query` for GPU timing (WebGL2)
- FPS meter in top-right corner during development (toggle via stats overlay)

## Known Limitations

### Mobile Browser Differences

| Browser | WebGPU | WebGL2 | Notes |
|---------|--------|--------|-------|
| Chrome Android | ✅ r128+ | ✅ | Best WebGPU support |
| Safari iOS | ✅ iOS 18+ | ✅ | WebGPU limited to M-series iPads |
| Firefox Android | ❌ | ✅ | No WebGPU yet |
| Samsung Internet | ❌ | ✅ | Chromium-based, behind on WebGPU |

### WebGPU-Specific

- iOS: WebGPU only on A17+ (iPhone 16 Pro) and M-series iPads
- SharedArrayBuffer: Requires COOP/COEP headers (configured in vite.config.js)
- Compute shaders: Not used (compatibility with WebGL fallback)