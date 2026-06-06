/**
 * MobileDetector - Device Capability Detection
 *
 * Detects mobile devices, GPU capabilities, and provides
 * quality recommendations for rendering settings.
 *
 * @module utils/MobileDetector
 * @version 1.0.0
 */

/**
 * MobileDetector - Static utility for device detection
 */
export class MobileDetector {
  /**
   * Detect device capabilities
   * @returns {Object} Device info object
   */
  static detect() {
    const info = {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
      deviceMemory: navigator.deviceMemory || 4,
      connection: null,
      gpu: null,
      webgpu: false,
      webgl2: false,
      maxTextureSize: 0,
      supportsFloatTextures: false,
      supportsHalfFloatTextures: false,
      supportsDepthTexture: false,
      quality: "high",
      recommendedSettings: {},
    };

    // Check for mobile/tablet
    const mobileRegex =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    const tabletRegex = /iPad|Android(?!.*Mobile)/i;

    info.isMobile = mobileRegex.test(info.userAgent);
    info.isTablet = tabletRegex.test(info.userAgent);
    info.isDesktop = !info.isMobile && !info.isTablet;

    // Check connection
    if (navigator.connection) {
      info.connection = {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData,
      };
    }

    // WebGPU support
    info.webgpu = !!navigator.gpu;

    // WebGL2 support and capabilities
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (gl) {
      info.webgl2 = !!canvas.getContext("webgl2");
      info.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      info.supportsFloatTextures = !!gl.getExtension("OES_texture_float");
      info.supportsHalfFloatTextures = !!gl.getExtension(
        "OES_texture_half_float",
      );
      info.supportsDepthTexture = !!gl.getExtension("WEBGL_depth_texture");

      // GPU info
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        info.gpu = {
          vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
          renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
        };
      }
    }
    canvas.remove();

    // Determine quality tier
    info.quality = this._determineQuality(info);

    // Generate recommended settings
    info.recommendedSettings = this._getRecommendedSettings(info);

    return info;
  }

  /**
   * Determine quality tier based on device capabilities
   * @private
   */
  static _determineQuality(info) {
    let score = 0;

    // CPU cores
    if (info.hardwareConcurrency >= 8) score += 3;
    else if (info.hardwareConcurrency >= 4) score += 2;
    else score += 1;

    // Device memory
    if (info.deviceMemory >= 8) score += 3;
    else if (info.deviceMemory >= 4) score += 2;
    else score += 1;

    // GPU detection
    if (info.gpu) {
      const renderer = info.gpu.renderer.toLowerCase();
      // High-end desktop GPUs
      if (
        renderer.includes("rtx") ||
        renderer.includes("rx 6") ||
        renderer.includes("rx 7") ||
        (renderer.includes("radeon") &&
          (renderer.includes("6800") ||
            renderer.includes("6900") ||
            renderer.includes("7900")))
      ) {
        score += 4;
      }
      // Mid-range desktop GPUs
      else if (
        renderer.includes("gtx 16") ||
        renderer.includes("rtx 30") ||
        renderer.includes("rx 5") ||
        renderer.includes("rx 66")
      ) {
        score += 3;
      }
      // Integrated/entry desktop
      else if (
        renderer.includes("intel") ||
        renderer.includes("uhd") ||
        renderer.includes("iris") ||
        (renderer.includes("vega") && !renderer.includes("rx"))
      ) {
        score += 2;
      }
      // Mobile GPUs
      else if (
        renderer.includes("adreno") ||
        renderer.includes("mali") ||
        renderer.includes("apple") ||
        renderer.includes("powervr") ||
        renderer.includes("videocore")
      ) {
        score += 1;
      } else {
        score += 2; // Unknown desktop GPU
      }
    } else {
      score += 1;
    }

    // Connection quality
    if (info.connection) {
      if (
        info.connection.effectiveType === "4g" &&
        info.connection.downlink > 10
      )
        score += 1;
      else if (info.connection.effectiveType === "3g") score -= 1;
      else if (info.connection.effectiveType === "2g") score -= 2;
      if (info.connection.saveData) score -= 1;
    }

    // Mobile penalty
    if (info.isMobile) score -= 2;
    else if (info.isTablet) score -= 1;

    // WebGPU bonus
    if (info.webgpu) score += 1;

    // Clamp and map to quality tier
    score = Math.max(0, Math.min(10, score));

    if (score >= 8) return "ultra";
    if (score >= 6) return "high";
    if (score >= 4) return "medium";
    return "low";
  }

  /**
   * Get recommended settings for quality tier
   * @private
   */
  static _getRecommendedSettings(info) {
    const presets = {
      ultra: {
        renderScale: 1.0,
        shadowMapSize: 4096,
        ssrSamples: 32,
        ssrEnabled: true,
        ssaoSamples: 32,
        ssaoEnabled: true,
        bloomEnabled: true,
        toneMappingEnabled: true,
        fxaaEnabled: true,
        particleCount: 10000,
        lodBias: 0,
      },
      high: {
        renderScale: 1.0,
        shadowMapSize: 2048,
        ssrSamples: 24,
        ssrEnabled: true,
        ssaoSamples: 16,
        ssaoEnabled: true,
        bloomEnabled: true,
        toneMappingEnabled: true,
        fxaaEnabled: true,
        particleCount: 5000,
        lodBias: 0,
      },
      medium: {
        renderScale: 0.85,
        shadowMapSize: 1024,
        ssrSamples: 16,
        ssrEnabled: true,
        ssaoSamples: 12,
        ssaoEnabled: true,
        bloomEnabled: true,
        toneMappingEnabled: true,
        fxaaEnabled: true,
        particleCount: 2000,
        lodBias: 1,
      },
      low: {
        renderScale: 0.7,
        shadowMapSize: 512,
        ssrSamples: 8,
        ssrEnabled: false,
        ssaoSamples: 8,
        ssaoEnabled: false,
        bloomEnabled: false,
        toneMappingEnabled: true,
        fxaaEnabled: true,
        particleCount: 500,
        lodBias: 2,
      },
    };

    return presets[info.quality] || presets.high;
  }

  /**
   * Get quality preset by name
   * @param {string} quality - Quality name
   * @returns {Object}
   */
  static getQualityPreset(quality) {
    const presets = {
      ultra: { renderScale: 1.0, shadowMapSize: 4096, ssrSamples: 32 },
      high: { renderScale: 1.0, shadowMapSize: 2048, ssrSamples: 24 },
      medium: { renderScale: 0.85, shadowMapSize: 1024, ssrSamples: 16 },
      low: { renderScale: 0.7, shadowMapSize: 512, ssrSamples: 8 },
    };
    return presets[quality] || presets.high;
  }

  /**
   * Check if device supports a specific feature
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  static supportsFeature(feature) {
    const info = this._cachedInfo || this.detect();
    this._cachedInfo = info;

    switch (feature) {
      case "webgpu":
        return info.webgpu;
      case "webgl2":
        return info.webgl2;
      case "floatTextures":
        return info.supportsFloatTextures;
      case "halfFloatTextures":
        return info.supportsHalfFloatTextures;
      case "depthTexture":
        return info.supportsDepthTexture;
      case "computeShaders":
        return info.webgpu; // Only WebGPU has compute shaders
      case "sharedArrayBuffer":
        return typeof SharedArrayBuffer !== "undefined";
      default:
        return false;
    }
  }

  /**
   * Log device info to console
   */
  static logInfo() {
    const info = this.detect();
    console.group("[MobileDetector] Device Info");
    console.log("Platform:", info.platform);
    console.log(
      "Mobile:",
      info.isMobile,
      "| Tablet:",
      info.isTablet,
      "| Desktop:",
      info.isDesktop,
    );
    console.log("CPU Cores:", info.hardwareConcurrency);
    console.log("Memory:", info.deviceMemory, "GB");
    console.log("WebGPU:", info.webgpu);
    console.log("WebGL2:", info.webgl2);
    console.log("Max Texture Size:", info.maxTextureSize);
    console.log("GPU:", info.gpu);
    console.log("Quality Tier:", info.quality);
    console.log("Recommended Settings:", info.recommendedSettings);
    console.groupEnd();
    return info;
  }
}

// Cache for performance
MobileDetector._cachedInfo = null;

export default MobileDetector;
