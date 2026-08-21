/**
 * @file Mountains — Rayman-style floating mountains with organic shapes
 *
 * Creates smooth, organic floating mountains with:
 *   - Vertex displacement via noise for organic silhouette
 *   - Flat bottom (floating island look)
 *   - Pastel gradient colors via MountainColorNode
 *   - Hanging root attachment points
 *
 * These are NOT primitives — each mountain is uniquely deformed
 * from a sphere using layered noise displacement.
 *
 * @dependency three — SphereGeometry, Mesh, Group, BufferAttribute
 * @dependency three/tsl — Fn, vec3, positionLocal, normalLocal
 * @dependency ./MountainColorNode — createMountainColorNode
 * @dependency ../materials/MaterialLibrary — default
 */

import { SphereGeometry, Mesh, Group } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { Fn, vec3, positionLocal } from 'three/tsl';
import { createMountainColorNode } from '../shaders/MountainColorNode.js';
import materialLib from '../materials/MaterialLibrary.js';

/**
 * Applies organic vertex displacement to a sphere geometry.
 * @param {SphereGeometry} geo
 * @param {number} seed — Random seed for unique deformation.
 * @param {number} amplitude — Displacement strength.
 */
function deformGeometry( geo, seed, amplitude ) {
	const positions = geo.attributes.position;
	const normals = geo.attributes.normal;
	const newPos = [];

	for ( let i = 0; i < positions.count; i++ ) {
		const x = positions.getX( i );
		const y = positions.getY( i );
		const z = positions.getZ( i );

		const nx = normals.getX( i );
		const ny = normals.getY( i );
		const nz = normals.getZ( i );

		// Normalize position (for a unit sphere at origin)
		const len = Math.sqrt( x * x + y * y + z * z );

		// ── Organic displacement using layered sine/noise ──────────
		// We use sine combinations since we can't access triNoise3D on CPU
		let displacement = 0;

		// Low-frequency shape (mountains bulge)
		displacement += Math.sin( x * 1.5 + seed ) * Math.cos( z * 1.3 + seed * 2 ) * 0.25;
		displacement += Math.sin( x * 2.7 + z * 1.1 + seed * 3 ) * 0.15;
		displacement += Math.cos( x * 0.8 + z * 2.2 + seed * 5 ) * 0.2;

		// Medium-frequency bumps
		displacement += Math.sin( x * 4.1 + seed * 1.3 ) * Math.cos( z * 3.7 + seed * 2.7 ) * 0.1;
		displacement += Math.sin( ( x + z ) * 3.3 + seed * 4.1 ) * 0.08;

		// High-frequency detail
		displacement += Math.sin( x * 8.0 + seed * 5.0 ) * Math.cos( z * 7.0 + seed * 3.0 ) * 0.04;

		// ── Flatten bottom ─────────────────────────────────────────
		// Points below the equator get pushed to flat bottom
		const height = y; // y is the up direction
		if ( height < -0.1 ) {
			// Gradually flatten toward the bottom
			const flatFactor = Math.max( 0, Math.min( 1, ( -height - 0.1 ) / 0.9 ) );
			displacement = displacement * ( 1 - flatFactor ) + -0.8 * flatFactor;
		}

		// ── Top peak stretching ────────────────────────────────────
		if ( height > 0.5 ) {
			const peakFactor = ( height - 0.5 ) * 2;
			displacement += 0.3 * peakFactor;
		}

		// Apply displacement along normal
		const scale = amplitude * ( 1 + displacement );
		newPos.push( x * scale, y * scale, z * scale );
	}

	// Set new positions
	for ( let i = 0; i < positions.count; i++ ) {
		positions.setXYZ( i, newPos[ i * 3 ], newPos[ i * 3 + 1 ], newPos[ i * 3 + 2 ] );
	}
	positions.needsUpdate = true;
	geo.computeVertexNormals();
}

/**
 * Adds organic floating mountains to the scene.
 * @param {import('three').Scene} scene
 * @returns {Array} Mountain positions for root attachment.
 */
export function createMountains( scene ) {

	const mountainGroup = new Group();
	mountainGroup.name = 'Mountains';

	// Mountain configurations: position, scale, seed, amplitude
	const configs = [
		{ pos: [ -25, 2, -30 ], scale: [ 5, 6, 5 ], seed: 0.1, amp: 0.8 },
		{ pos: [ 20, 3, -35 ], scale: [ 7, 8, 7 ], seed: 0.4, amp: 1.0 },
		{ pos: [ -30, 4, -20 ], scale: [ 4.5, 5, 4.5 ], seed: 0.7, amp: 0.6 },
		{ pos: [ 35, 2.5, -25 ], scale: [ 6, 7, 6 ], seed: 0.2, amp: 0.9 },
		{ pos: [ 0, 8, -40 ], scale: [ 9, 10, 9 ], seed: 0.9, amp: 1.2 },
		{ pos: [ -15, 14, -35 ], scale: [ 4, 4.5, 4 ], seed: 0.3, amp: 0.7 },
		{ pos: [ 25, 12, -30 ], scale: [ 5, 4.5, 5 ], seed: 0.6, amp: 0.7 },
		{ pos: [ 10, 2, -45 ], scale: [ 4, 5, 4 ], seed: 0.5, amp: 0.6 },
	];

	// Store mountain positions for nature details
	const mountainPositions = [];

	// Create gradient colour node
	const mountainColor = createMountainColorNode( { speed: 0.15 } );

	for ( const cfg of configs ) {
		// ── Create geometry with organic deformation ───────────────
		const geo = new SphereGeometry( 1, 64, 48 );
		deformGeometry( geo, cfg.seed, cfg.amp );

		// ── Material with gradient color ───────────────────────────
		const mat = materialLib.getMountainMaterial().clone();
		mat.name = `Mountain_${cfg.seed}`;

		// Apply gradient colour based on local height
		const colorFn = Fn( () => {
			const h = positionLocal.y;
			return mountainColor( h, cfg.seed );
		} );
		mat.colorNode = colorFn();

		// ── Create mesh ────────────────────────────────────────────
		const mesh = new Mesh( geo, mat );
		mesh.name = `Mountain_${cfg.seed}`;
		mesh.position.set( cfg.pos[ 0 ], cfg.pos[ 1 ], cfg.pos[ 2 ] );
		mesh.scale.set( cfg.scale[ 0 ], cfg.scale[ 1 ], cfg.scale[ 2 ] );
		mesh.rotation.y = cfg.seed * 10;
		mesh.rotation.z = ( cfg.seed - 0.5 ) * 0.2;

		mesh.castShadow = true;
		mesh.receiveShadow = true;

		mountainGroup.add( mesh );
		mountainPositions.push( mesh.position );
	}

	scene.add( mountainGroup );

	console.log( `[Mountains] Created ${configs.length} organic mountains` );

	return mountainPositions;
}