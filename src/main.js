import * as THREE from 'three';
import { WebGPURenderer } from 'three/examples/jsm/renderers/webgpu/WebGPURenderer.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Lut } from 'three/examples/jsm/math/Lut.js';
import { SceneManager } from './SceneManager.js';
import { PhysicsSimulation } from './PhysicsSimulation.js';

/**
 * Main Application Class
 * Initializes WebGPU renderer and manages the 3D physics simulation
 */
class PhysikSimulation {
    constructor() {
        this.scene = new THREE.Scene();
        this.renderer = null;
        this.camera = null;
        this.controls = null;
        this.sceneManager = null;
        this.physics = null;
        this.clock = new THREE.Clock();
        this.stats = {
            fps: 0,
            frameCount: 0,
            lastTime: performance.now(),
            renderTime: 0
        };
        this.isPaused = false;
    }

    async init() {
        try {
            // Check WebGPU support
            if (!navigator.gpu) {
                throw new Error('WebGPU not supported in this browser');
            }

            const canvas = document.getElementById('canvas');

            // Initialize WebGPU Renderer
            this.renderer = new WebGPURenderer({ canvas, antialias: true });
            await this.renderer.init();
            
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setClearColor(0x0a0e27);
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.0;

            // Setup Camera
            this.camera = new THREE.PerspectiveCamera(
                75,
                window.innerWidth / window.innerHeight,
                0.1,
                1000
            );
            this.camera.position.set(0, 5, 8);
            this.camera.lookAt(0, 0, 0);

            // Setup Orbit Controls
            this.controls = new OrbitControls(this.camera, canvas);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.autoRotate = true;
            this.controls.autoRotateSpeed = 2;

            // Setup Scene Manager
            this.sceneManager = new SceneManager(this.scene);
            this.sceneManager.setupScene();

            // Setup Physics Simulation
            this.physics = new PhysicsSimulation();
            this.physics.initialize();

            // Setup event listeners
            this.setupEventListeners();

            // Update GPU Info
            this.updateGPUInfo();

            // Start animation loop
            this.animate();

            console.log('✅ Physik Simulation initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize:', error);
            this.showError(error.message);
        }
    }

    setupEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Pause/Resume with Spacebar
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.isPaused = !this.isPaused;
                console.log(this.isPaused ? '⏸️ Paused' : '▶️ Resumed');
            }
            if (e.key === 'r' || e.key === 'R') {
                this.resetScene();
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const startTime = performance.now();

        // Update physics if not paused
        if (!this.isPaused) {
            const deltaTime = this.clock.getDelta();
            this.physics.update(deltaTime, this.sceneManager.getPhysicsObjects());
        }

        // Update controls
        this.controls.update();

        // Render
        this.renderer.render(this.scene, this.camera);

        const renderTime = performance.now() - startTime;
        this.updateStats(renderTime);
    }

    updateStats(renderTime) {
        this.stats.frameCount++;
        this.stats.renderTime = renderTime;

        const currentTime = performance.now();
        const deltaTime = currentTime - this.stats.lastTime;

        if (deltaTime >= 1000) {
            this.stats.fps = this.stats.frameCount;
            this.stats.frameCount = 0;
            this.stats.lastTime = currentTime;
            this.updateUI();
        }
    }

    updateUI() {
        document.getElementById('fps').textContent = this.stats.fps;
        document.getElementById('renderTime').textContent = this.stats.renderTime.toFixed(2);
        
        const triangles = this.renderer.info.render.triangles || 0;
        document.getElementById('triangles').textContent = triangles;
    }

    updateGPUInfo() {
        const gpuInfo = document.getElementById('gpuInfo');
        if (this.renderer.info) {
            gpuInfo.textContent = `✅ WebGPU Renderer Active`;
        }
    }

    resetScene() {
        console.log('🔄 Resetting scene...');
        this.sceneManager.resetScene();
        this.physics.reset();
        this.camera.position.set(0, 5, 8);
        this.controls.reset();
    }

    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    showError(message) {
        const infoDiv = document.getElementById('info');
        infoDiv.innerHTML = `<h2>⚠️ Error</h2><p>${message}</p>`;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new PhysikSimulation();
    await app.init();
});
