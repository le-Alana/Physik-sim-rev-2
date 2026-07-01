/**
 * @file Mountains — Rayman-style floating mountains
 *
 * Creates smooth, rounded floating mountains with pastel gradient colours.
 * Rayman's style features soft, organic shapes with vibrant colour gradients
 * (magenta → cyan → peach → lavender). These are NOT low-poly — they use
 * smooth sphere-like geometry with displacement.
 *
 * Each mountain is a sphere geometry with randomised scale, rotation,
 * and a colour gradient driven by the MountainColorNode.
 *
 * @dependency three — SphereGeometry, Mesh, Group
 * @dependency three/tsl — Fn, vec3, positionLocal, time, mix
 * @dependency ./MountainColorNode — createMountainColorNode
 * @dependency ../materials/MaterialLibrary — default
 */

import { SphereGeometry, Mesh, Group } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { Fn, vec3, positionLocal, normalLocal, add } from 'three/tsl';
import { createMountainColorNode } from '../shaders/MountainColorNode.js';
import materialLib from '../materials/MaterialLibrary.js';

/**
 * Adds floating Rayman-style mountains to the scene.
 * @param {import('three').Scene} scene
 */
export function createMountains( scene ) {

	const mountainGroup = new Group();
	mountainGroup.name = 'Mountains';

	// Mountain configurations: position, size, seed
	const configs = [
		{ pos: [ -25, -0.5, -30 ], scale: [ 6, 8, 6 ], seed: 0.1 },
		{ pos: [ 20, 0, -35 ], scale: [ 8, 10, 8 ], seed: 0.4 },
		{ pos: [ -30, 1, -20 ], scale: [ 5, 6, 5 ], seed: 0.7 },
		{ pos: [ 35, -0.5, -25 ], scale: [ 7, 9, 7 ], seed: 0.2 },
		{ pos: [ 0, 5, -40 ], scale: [ 10, 12, 10 ], seed: 0.9 },
		{ pos: [ -15, 10, -35 ], scale: [ 5, 7, 5 ], seed: 0.3 }, // floating high
		{ pos: [ 25, 8, -30 ], scale: [ 6, 5, 6 ], seed: 0.6 },   // floating high
	];

	// Create gradient colour node
	const mountainColor = createMountainColorNode( { speed: 0.15 } );

	for ( const cfg of configs ) {

		// Use a smooth sphere geometry — NOT low-poly
		const geo = new SphereGeometry( 1, 48, 36 );

		// Clone the base mountain material and set its colour via TSL node
		const mat = materialLib.getMountainMaterial().clone();
		mat.name = `Mountain_${cfg.seed}`;

		// Apply gradient colour based on local height
		const colorFn = Fn( () => {
			// Normalise Y from [-1, 1] relative to the unscaled sphere
			const h = positionLocal.y;
			return mountainColor( h, cfg.seed );
		} );

		mat.colorNode = colorFn();

		const mesh = new Mesh( geo, mat );
		mesh.name = `Mountain_${cfg.seed}`;
		mesh.position.set( cfg.pos[ 0 ], cfg.pos[ 1 ], cfg.pos[ 2 ] );
		mesh.scale.set( cfg.scale[ 0 ], cfg.scale[ 1 ], cfg.scale[ 2 ] );
		mesh.rotation.z = ( Math.random() - 0.5 ) * 0.3;

		// Random rotation for variety
		mesh.rotation.y = Math.random() * Math.PI;

		mesh.castShadow = true;
		mesh.receiveShadow = true;

		mountainGroup.add( mesh );
	}

	scene.add( mountainGroup );
}