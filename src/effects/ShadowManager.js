/**
 * @file ShadowManager — Directional and spot light shadows
 *
 * Sets up shadow-casting lights for the scene:
 *   - Main directional light (sun) with PCFSoft shadow map
 *   - A warm fill light from the opposite side
 *
 * Uses Three.js's built-in ShadowNode for WebGPU-compatible shadows.
 *
 * @dependency three — DirectionalLight, SpotLight, PCFSoftShadowMap
 */

import { DirectionalLight, PCFSoftShadowMap } from 'three';

/**
 * Adds shadow-casting lights to the scene.
 * @param {import('three').Scene} scene
 * @param {Object} [options]
 * @param {number} [options.shadowMapSize=2048] — Shadow resolution.
 */
export function createShadows( scene, options = {} ) {

	const mapSize = options.shadowMapSize || 2048;

	// ── Main directional light (sun) ───────────────────────────────
	const sun = new DirectionalLight( 0xffeedd, 2.0 );
	sun.position.set( 30, 50, -30 );
	sun.name = 'SunLight';

	// Shadow setup
	sun.castShadow = true;
	sun.shadow.mapSize.width = mapSize;
	sun.shadow.mapSize.height = mapSize;
	sun.shadow.camera.near = 0.1;
	sun.shadow.camera.far = 100;
	sun.shadow.camera.left = -40;
	sun.shadow.camera.right = 40;
	sun.shadow.camera.top = 40;
	sun.shadow.camera.bottom = -40;
	sun.shadow.bias = -0.001;
	sun.shadow.normalBias = 0.02; // reduces shadow acne

	scene.add( sun );

	// ── Warm fill light from the back ──────────────────────────────
	const fill = new DirectionalLight( 0xffaa88, 0.6 );
	fill.position.set( -20, 30, 40 );
	fill.name = 'FillLight';
	scene.add( fill );

	// ── Cool rim light ─────────────────────────────────────────────
	const rim = new DirectionalLight( 0x88bbff, 0.4 );
	rim.position.set( -30, 10, -30 );
	rim.name = 'RimLight';
	scene.add( rim );

	// ── Enable shadow map type ─────────────────────────────────────
	// Note: The renderer's shadow map type should be set to PCFSoftShadowMap
	// for the best quality/performance balance on WebGPU.
	return { sun, fill, rim };
}