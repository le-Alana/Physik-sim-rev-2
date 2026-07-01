/**
 * @file Ground — Reflective dancing floor
 *
 * A large reflective plane that acts as a dance floor.
 * Features:
 *   - Reflective surface using ReflectorNode
 *   - Animated checkerboard pattern
 *   - PBR material with wear scratches
 *
 * @dependency three — PlaneGeometry, Mesh
 * @dependency three/tsl — ReflectorNode, Fn, vec2, vec3, uv, time, sin, floor, mix
 * @dependency ../materials/MaterialLibrary — default
 */

import { PlaneGeometry, Mesh } from 'three';
import { Fn, vec2, vec3, uv, time, sin, floor, mix } from 'three/tsl';
import { ReflectorNode } from 'three/webgpu';
import materialLib from '../materials/MaterialLibrary.js';

/**
 * Creates the reflective dance floor.
 * @param {import('three').Scene} scene
 */
export function createGround( scene ) {

	const baseMat = materialLib.getDanceFloorMaterial();

	// ── Animated checkerboard pattern using TSL ─────────────────────
	const checkerFn = Fn( () => {

		const scale = 4;
		const cUv = uv().mul( scale );
		const grid = floor( cUv.x ).add( floor( cUv.y ) );
		const pattern = grid.mod( 2 ).abs();

		// Animate with slow colour pulse
		const pulse = sin( time.mul( 0.3 ) ).mul( 0.1 ).add( 0.9 );
		const colorA = vec3( 0.4, 0.6, 1.0 ).mul( pulse );
		const colorB = vec3( 0.2, 0.3, 0.6 ).mul( pulse );

		return mix( colorA, colorB, pattern );

	} );

	// Blend checkerboard with the base PBR colour
	const groundColor = Fn( () => {
		const checker = checkerFn();
		const base = baseMat.colorNode;
		return mix( checker, base, 0.3 );
	} );

	baseMat.colorNode = groundColor();

	// ── Geometry ───────────────────────────────────────────────────
	const geo = new PlaneGeometry( 60, 60 );
	const ground = new Mesh( geo, baseMat );
	ground.rotation.x = -Math.PI / 2;
	ground.position.y = -1;
	ground.name = 'DanceFloor';
	ground.receiveShadow = true;

	scene.add( ground );

	// ── Reflective plane overlay ────────────────────────────────────
	// Use ReflectorNode for mirror-like reflections on the floor
	const reflector = new ReflectorNode();
	const reflectorMat = baseMat.clone();
	reflectorMat.colorNode = mix( reflector, baseMat.colorNode, 0.5 );

	const reflectorMesh = new Mesh( geo, reflectorMat );
	reflectorMesh.rotation.x = -Math.PI / 2;
	reflectorMesh.position.y = -0.99; // slightly above the floor
	reflectorMesh.name = 'FloorReflector';
	scene.add( reflectorMesh );
}