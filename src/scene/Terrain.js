/**
 * @file Terrain — Height-mapped ground plane with dirt/grass texture
 *
 * Creates a large terrain plane below the dance floor with:
 *   - Vertex displacement via noise for rolling hills
 *   - Flat central area where the dance floor sits
 *   - Ground texture with dirt, grass patches, and pebbles
 *   - Shadow receiving and casting
 *
 * The terrain provides the "ground" that was previously missing —
 * the dance floor now sits ON this terrain rather than floating.
 *
 * @dependency three — PlaneGeometry, Mesh, BufferAttribute
 * @dependency three/tsl — Fn, vec3, positionWorld, uv, triNoise3D
 * @dependency ../shaders/GroundTextureNode — createGroundTextureNode
 * @dependency ../materials/MaterialLibrary — default
 */

import { PlaneGeometry, Mesh } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { Fn, vec3, positionWorld, uv, triNoise3D, float } from 'three/tsl';
import { createGroundTextureNode } from '../shaders/GroundTextureNode.js';

/**
 * Adds a height-mapped terrain plane to the scene.
 * @param {import('three').Scene} scene
 */
export function createTerrain( scene ) {

	// ── Geometry ───────────────────────────────────────────────────
	// Large plane with enough segments for smooth hills
	const size = 100;
	const segments = 200;
	const geo = new PlaneGeometry( size, size, segments, segments );
	geo.rotateX( -Math.PI / 2 );

	// ── Vertex displacement for hills ──────────────────────────────
	// CPU-side displacement for actual geometry deformation
	const positions = geo.attributes.position;
	const flatRadius = 30; // flat area radius for dance floor

	for ( let i = 0; i < positions.count; i++ ) {
		const x = positions.getX( i );
		const z = positions.getZ( i );
		const dist = Math.sqrt( x * x + z * z );

		let y = 0;

		if ( dist > flatRadius ) {
			// Rolling hills outside the flat zone
			// Use layered sine waves for organic terrain
			const h1 = Math.sin( x * 0.05 ) * Math.cos( z * 0.07 ) * 1.5;
			const h2 = Math.sin( x * 0.12 + z * 0.09 ) * 0.8;
			const h3 = Math.sin( x * 0.03 ) * Math.cos( z * 0.04 ) * 2.0;
			const h4 = Math.sin( x * 0.2 + 1.3 ) * Math.cos( z * 0.15 + 0.7 ) * 0.4;

			// Blend from flat to hilly at the transition zone
			const transition = Math.max( 0, Math.min( 1, ( dist - flatRadius ) / 8 ) );
			y = ( h1 + h2 + h3 + h4 ) * transition;

			// Steeper slopes near edges for mountain base integration
			const edgeBoost = Math.max( 0, ( dist - 40 ) / 10 );
			y += edgeBoost * edgeBoost * 2;
		}

		positions.setY( i, y );
	}

	positions.needsUpdate = true;
	geo.computeVertexNormals();

	// ── Material with procedural ground texture ────────────────────
	const groundTexture = createGroundTextureNode( {
		mossAmount: 0.35,
	} );

	const mat = new MeshPhysicalNodeMaterial();
	mat.name = 'Terrain';
	mat.roughness = 0.9;
	mat.metalness = 0.0;
	mat.clearcoat = 0;

	// Apply ground texture using world position for consistent mapping
	const groundColorFn = Fn( () => {
		// Use world position XZ as UV for consistent ground texture
		const worldPos = positionWorld;
		const texUV = vec3( worldPos.x, worldPos.z, float( 0 ) );
		return groundTexture( uv(), worldPos );
	} );

	mat.colorNode = groundColorFn();

	// ── Create mesh ────────────────────────────────────────────────
	const terrain = new Mesh( geo, mat );
	terrain.position.y = -1.5; // below the dance floor
	terrain.name = 'Terrain';
	terrain.receiveShadow = true;
	terrain.castShadow = false; // terrain doesn't cast shadows on itself

	scene.add( terrain );

	console.log( '[Terrain] Created with', positions.count, 'vertices' );

	return terrain;
}