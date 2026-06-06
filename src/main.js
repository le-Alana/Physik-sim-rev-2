/**
 * Main Entry Point - Physik Sim WebGPU Engine
 *
 * This file initializes the engine, creates the test scene,
 * and starts the render loop. It serves as the application bootstrap.
 *
 * Architecture:
 * - Engine: Core WebGPU renderer management
 * - SceneManager: Scene lifecycle and object management
 * - CameraController: Input handling and camera movement
 * - PostProcessing: Full post-processing pipeline
 * - TestScene: Rayman-style scene builder
 *
 * @module main
 */

import { Engine } from "./core/Engine.js";
import { SceneManager } from "./core/SceneManager.js";
import { CameraController } from "./core/CameraController.js";
import { PostProcessing } from "./core/PostProcessing.js";
import { TestScene } from "./scene/TestScene.js";
import { MobileDetector } from "./utils/MobileDetector.js";

/**
 * Application state container
 * @typedef {Object} AppState
 * @property {Engine} engine - Core rendering engine
 * @property {SceneManager} sceneManager - Scene management
 * @property {CameraController} cameraController - Camera input handling
 * @property {PostProcessing} postProcessing - Post-processing pipeline
 * @property {TestScene} testScene - Current test scene
 * @property {boolean} isRunning - Render loop state
 * @property {number} lastFrameTime - Previous frame timestamp
 */

/** @type {AppState} */
const appState = {
  engine: null,
  sceneManager: null,
  cameraController: null,
  postProcessing: null,
  testScene: null,
  isRunning: false,
  lastFrameTime: 0,
};

/**
 * DOM elements for UI feedback
 */
const loadingEl = document.getElementById("loading");
const loadingTextEl = document.getElementById("loading-text");
const statsEl = document.getElementById("stats");
const statFpsEl = document.getElementById("stat-fps");
const statFrameEl = document.getElementById("stat-frame");
const statDrawEl = document.getElementById("stat-draw");
const statTrisEl = document.getElementById("stat-tris");
const statMemEl = document.getElementById("stat-mem");
const statRendererEl = document.getElementById("stat-renderer");

/**
 * Update loading screen text
 * @param {string} text - Status message
 */
function updateLoading(text) {
  if (loadingTextEl) loadingTextEl.textContent = text;
}

/**
 * Hide loading screen
 */
function hideLoading() {
  if (loadingEl) loadingEl.classList.add("hidden");
}

/**
 * Show stats panel
 */
function showStats() {
  if (statsEl) statsEl.classList.remove("hidden");
}

/**
 * Update performance stats display
 * @param {Object} stats - Three.js renderer info
 * @param {number} fps - Current FPS
 * @param {number} frameTime - Frame time in ms
 * @param {string} rendererType - WebGPU or WebGL
 */
function updateStats(stats, fps, frameTime, rendererType) {
  if (statFpsEl) statFpsEl.textContent = fps.toFixed(1);
  if (statFrameEl) statFrameEl.textContent = frameTime.toFixed(2);
  if (statDrawEl) statDrawEl.textContent = stats.render.calls;
  if (statTrisEl) statTrisEl.textContent = stats.render.triangles;
  if (statMemEl)
    statMemEl.textContent = (
      stats.memory.geometries + stats.memory.textures
    ).toFixed(1);
  if (statRendererEl) statRendererEl.textContent = rendererType;
}

/**
 * Main render loop
 * @param {number} time - Current timestamp from requestAnimationFrame
 */
function renderLoop(time) {
  if (!appState.isRunning) return;

  const deltaTime = (time - appState.lastFrameTime) * 0.001; // Convert to seconds
  appState.lastFrameTime = time;

  // Update camera controller
  if (appState.cameraController) {
    appState.cameraController.update(deltaTime);
  }

  // Update scene animations
  if (appState.testScene) {
    appState.testScene.update(deltaTime, time * 0.001);
  }

  // Update post-processing (time uniforms, etc.)
  if (appState.postProcessing) {
    appState.postProcessing.update(deltaTime, time * 0.001);
  }

  // Render through post-processing pipeline
  if (appState.postProcessing && appState.sceneManager && appState.engine) {
    appState.postProcessing.render(
      appState.sceneManager.scene,
      appState.cameraController.camera,
    );
  } else if (
    appState.engine &&
    appState.sceneManager &&
    appState.cameraController
  ) {
    // Fallback direct render
    appState.engine.renderer.render(
      appState.sceneManager.scene,
      appState.cameraController.camera,
    );
  }

  // Update stats
  if (appState.engine && appState.engine.renderer) {
    const rendererInfo = appState.engine.renderer.info;
    const fps = 1 / deltaTime;
    const frameTime = deltaTime * 1000;
    const rendererType = appState.engine.isWebGPU ? "WebGPU" : "WebGL2";
    updateStats(rendererInfo, fps, frameTime, rendererType);
  }

  requestAnimationFrame(renderLoop);
}

/**
 * Handle window resize
 */
function onResize() {
  if (appState.engine && appState.cameraController) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    appState.engine.setSize(width, height);
    appState.cameraController.setAspect(width / height);

    if (appState.postProcessing) {
      appState.postProcessing.setSize(width, height);
    }
  }
}

/**
 * Initialize the application
 */
async function init() {
  try {
    updateLoading("Detecting device capabilities...");
    const mobileInfo = MobileDetector.detect();
    console.log("[Main] Device info:", mobileInfo);

    updateLoading("Initializing WebGPU Engine...");
    appState.engine = new Engine({
      preferWebGPU: true,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });

    await appState.engine.init();
    console.log(
      "[Main] Engine initialized:",
      appState.engine.isWebGPU ? "WebGPU" : "WebGL2",
    );

    // Attach renderer to DOM
    const container = document.getElementById("app");
    container.appendChild(appState.engine.renderer.domElement);

    updateLoading("Setting up Scene Manager...");
    appState.sceneManager = new SceneManager();

    updateLoading("Creating Camera Controller...");
    appState.cameraController = new CameraController(
      appState.engine.renderer.domElement,
      {
        enableDamping: true,
        dampingFactor: 0.05,
        minDistance: 5,
        maxDistance: 200,
        minPolarAngle: 0.1,
        maxPolarAngle: Math.PI / 2 - 0.05,
      },
    );

    // Set initial camera position for Rayman-style view
    appState.cameraController.setPosition(0, 30, 60);
    appState.cameraController.setTarget(0, 5, 0);

    updateLoading("Building Post-Processing Pipeline...");
    appState.postProcessing = new PostProcessing(
      appState.engine.renderer,
      appState.sceneManager.scene,
      appState.cameraController.camera,
      {
        enableSSR: true,
        enableSSAO: true,
        enableBloom: true,
        enableToneMapping: true,
        enableFXAA: true,
        quality: mobileInfo.isMobile ? "low" : "high",
      },
    );

    updateLoading("Building Test Scene (Rayman Style)...");
    appState.testScene = new TestScene(appState.sceneManager, {
      quality: mobileInfo.isMobile ? "low" : "high",
      enableAnimatedLights: true,
    });
    await appState.testScene.build();

    updateLoading("Finalizing...");
    // Handle resize
    window.addEventListener("resize", onResize);
    onResize();

    // Start render loop
    appState.isRunning = true;
    appState.lastFrameTime = performance.now();
    requestAnimationFrame(renderLoop);

    hideLoading();
    showStats();

    console.log("[Main] Application started successfully");
  } catch (error) {
    console.error("[Main] Initialization failed:", error);
    updateLoading("Error: " + error.message);
    if (loadingEl) loadingEl.style.borderTopColor = "#ff4444";
  }
}

// Start the application
init();

// Export for debugging
window.__PHYSIK_SIM__ = appState;
