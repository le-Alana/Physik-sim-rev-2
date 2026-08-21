/**
 * @file Ground — Reflective dancing floor with running lights
 *
 * Creates the dance floor that sits ON the terrain:
 *   - Grid of individual floor plates with gaps
 *   - Animated running lights between plates (emissive strips)
 *   - Reflective surface using ReflectorNode
 *   - PBR material with wear scratches
 *   - Edge transition blending into terrain
 *
 * @dependency three — PlaneGeometry, BoxGeometry, Mesh, Group
 * @dependency three/tsl — Fn, vec2, vec3, uv, time, sin, floor, mix, ReflectorNode
 * @dependency ../materials/MaterialLibrary — default
 */

import { PlaneGeometry, BoxGeometry, Mesh, Group, AdditiveBlending } from 'three';
import { MeshPhysicalNodeMaterial, ReflectorNode } from 'three/webgpu';
import { Fn, vec2, vec3, uv, time, sin, floor, mix, float } from 'three/tsl';
import materialLib from '../materials/MaterialLibrary.js';

/**
 * Creates the reflective dance floor with running lights.
 * @param {import('three').Scene} scene
 */
export function createGround( scene ) {

	const group = new Group();
	group.name = 'DanceFloor';

	const baseMat = materialLib.getDanceFloorMaterial();

	// ── Floor plate grid ──────────────────────────────────────────
	// Create individual plates with gaps for running lights
	const plateCount = 10; // 10x10 grid
	const plateSize = 2.5;
	const gapSize = 0.15;
	const totalSize = plateCount * plateSize + ( plateCount - 1 ) * gapSize;
	const halfTotal = totalSize / 2;

	for ( let ix = 0; ix < plateCount; ix++ ) {
		for ( let iz = 0; iz < plateCount; iz++ ) {
			const plateGeo = new BoxGeometry( plateSize, 0.1, plateSize );
			const plate = new Mesh( plateGeo, baseMat.clone() );
			plate.position.set(
				ix * ( plateSize + gapSize ) - halfTotal + plateSize / 2,
				-0.5, // sits on terrain
				iz * ( plateSize + gapSize ) - halfTotal + plateSize / 2
			);
			plate.name = `FloorPlate_${ix}_${iz}`;
			plate.receiveShadow = true;
			plate.castShadow = true;
			group.add( plate );
		}
	}

	// ── Running lights between plates ─────────────────────────────
	// Emissive strips that animate around the grid
	const lightMat = new MeshPhysicalNodeMaterial();
	lightMat.name = 'RunningLight';
	lightMat.roughness = 0.1;
	lightMat.metalness = 0.0;
	lightMat.emissiveIntensity = 2.0;

	// Animated emissive color for running lights
	const lightColorFn = Fn( () => {
		// Create a traveling wave pattern
		// uv() must be called as a function — it returns the UV node
		const u = uv();
		const wave = sin( time.mul( 2 ).sub( u.x.mul( 10 ) ).sub( u.y.mul( 10 ) ) ).mul( 0.5 ).add( 0.5 );
		const color = vec3( 0.2, 0.5, 1.0 ).mul( wave );
		return color;
	} );
	lightMat.emissiveNode = lightColorFn();

	// Horizontal light strips (between rows)
	for ( let i = 0; i < plateCount - 1; i++ ) {
		const stripGeo = new PlaneGeometry( totalSize, gapSize * 0.5 );
		const strip = new Mesh( stripGeo, lightMat );
		strip.position.set(
			0,
			-0.45,
			i * ( plateSize + gapSize ) - halfTotal + plateSize + gapSize / 2
		);
		strip.rotation.x = -Math.PI / 2;
		strip.name = `LightStrip_H_${i}`;
		group.add( strip );
	}

	// Vertical light strips (between columns)
	for ( let i = 0; i < plateCount - 1; i++ ) {
		const stripGeo = new PlaneGeometry( gapSize * 0.5, totalSize );
		const strip = new Mesh( stripGeo, lightMat );
		strip.position.set(
			i * ( plateSize + gapSize ) - halfTotal + plateSize + gapSize / 2,
			-0.45,
			0
		);
		strip.rotation.x = -Math.PI / 2;
		strip.name = `LightStrip_V_${i}`;
		group.add( strip );
	}

	// ── Reflective overlay ────────────────────────────────────────
	// Use ReflectorNode for mirror-like reflections
	const reflector = new ReflectorNode( {
		resolutionScale: 0.5,
		generateMipmaps: true,
	} );

	// Create a single reflective plane over the entire floor
	const reflectorMat = new MeshPhysicalNodeMaterial();
	reflectorMat.name = 'FloorReflector';
	reflectorMat.transparent = true;
	reflectorMat.opacity = 0.3;

	// Mix reflection with floor color
	const reflectColorFn = Fn( () => {
		const reflection = reflector;
		const floorColor = vec3( 0.3, 0.5, 0.8 );
		return mix( floorColor, reflection, float( 0.5 ) );
	} );
	reflectorMat.colorNode = reflectColorFn();

	const reflectorGeo = new PlaneGeometry( totalSize + 1, totalSize + 1 );
	const reflectorMesh = new Mesh( reflectorGeo, reflectorMat );
	reflectorMesh.position.y = -0.4;
	reflectorMesh.rotation.x = -Math.PI / 2;
	reflectorMesh.name = 'FloorReflector';
	group.add( reflectorMesh );

	scene.add( group );

	console.log( '[Ground] Created dance floor with running lights' );
}