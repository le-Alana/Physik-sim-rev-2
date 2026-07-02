/**
 * @file Engine — WebGPU Renderer initialisation
 *
 * Creates the WebGPURenderer with optimal settings for the target device.
 * Detects mobile vs desktop and adjusts quality settings accordingly.
 *
 * @dependency three/webgpu — WebGPURenderer, WebGPUBackend
 */

import { WebGPURenderer } from 'three/webgpu';

/**
 * Detects if the current device is likely mobile based on user agent.
 * @returns {boolean}
 */
function isMobile() {
	return /Mobi|Android|iPhone|iPad|iPod/i.test( navigator.userAgent );
}

/**
 * Core engine wrapper.
 * Manages the WebGPU renderer, device pixel ratio, and resize behaviour.
 */
export default class Engine {

	/**
	 * @param {HTMLCanvasElement|OffscreenCanvas} canvas — The target canvas element.
	 * @param {Object} [options] — Optional overrides.
	 * @param {boolean} [options.antialias=true] — Enable MSAA.
	 * @param {number} [options.samples] — MSAA sample count (auto if omitted).
	 */
	constructor( canvas, options = {} ) {

		// ── Determine quality tier ──────────────────────────────────
		const mobile = isMobile();
		const samples = options.samples || ( mobile ? 2 : 4 );

		// ── Create the WebGPU renderer (Node-only variant) ──────────
		// WebGPURenderer from three/webgpu targets WebGPU by default
		// and falls back to WebGL2 if unavailable.
		this.renderer = new WebGPURenderer( {
			canvas,
			antialias: options.antialias !== false,
			samples,
			alpha: false,
			depth: true,
			stencil: false,
			powerPreference: 'high-performance',
			// Use HalfFloatType for the output buffer → HDR pipeline
			outputType: undefined, // let renderer choose device-preferred format
		} );

		// ── Store quality info for other modules ────────────────────
		/** @type {boolean} */
		this.isMobile = mobile;

		/** @type {number} */
		this.qualityScale = mobile ? 0.75 : 1.0;

		/** @type {number} */
		this.shadowMapSize = mobile ? 1024 : 2048;

		/** @type {number} */
		this.msaaSamples = samples;

		// Bind resize handler
		this._onResize = this._onResize.bind( this );
		window.addEventListener( 'resize', this._onResize );
	}

	/**
	 * Initialises the renderer (must be awaited before rendering).
	 * @returns {Promise<void>}
	 */
	async init() {
		await this.renderer.init();
		this._onResize();
	}

	/**
	 * Returns a pixel ratio safe for performance (≤2 on mobile, ≤devicePixelRatio on desktop).
	 * @returns {number}
	 */
	getPixelRatio() {
		const dpr = window.devicePixelRatio || 1;
		return this.isMobile ? Math.min( dpr, 2 ) : Math.min( dpr, 2 );
	}

	/**
	 * Handles canvas resize to fill the viewport.
	 * @private
	 */
	_onResize() {
		const w = window.innerWidth;
		const h = window.innerHeight;
		this.renderer.setSize( w, h );
		this.renderer.setPixelRatio( this.getPixelRatio() );
	}

	/**
	 * Cleans up event listeners and disposes the renderer.
	 */
	dispose() {
		window.removeEventListener( 'resize', this._onResize );
		this.renderer.dispose();
	}
}