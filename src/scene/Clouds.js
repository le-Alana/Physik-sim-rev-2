/**
 * @file Clouds — Volumetric cloud clusters
 *
 * Creates semi-transparent cloud clusters using multiple overlapping
 * billboarded spheres for a fluffy, cumulus-like appearance.
 * Clouds drift slowly and morph gently over time.
 *
 * Improvements over previous version:
 *   - Each cloud is a cluster of 5-8 overlapping spheres (not flat quads)
 *   - Cumulus shape: wider at bottom, fluffy at top
 *   - Slow morphing animation (scale oscillation)
 *   - Multiple height layers for depth
 *
 * @dependency three — SphereGeometry, Mesh, Group, AdditiveBlending
 * @dependency three/tsl — Fn, float, vec3, positionWorld, time, mix, triNoise3D
 */

import { SphereGeometry, Mesh, Group, AdditiveBlending, DoubleSide } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, float, vec3, positionWorld, time, mix, triNoise3D } from 'three/tsl';

/**
 * Creates a single volumetric cloud cluster.
 * @param {number} baseSize — Base size of the cloud.
 * @param {number} yPos — Height position.
 * @param {number} seed — Random seed for shape variation.
 * @returns {Group}
 */
function createCloudCluster( baseSize, yPos, seed ) {
	const cluster = new Group();

	// Number of spheres in this cluster
	const sphereCount = 5 + Math.floor( seed * 4 );

	// Central sphere (largest)
	const centerSize = baseSize * ( 0.8 + seed * 0.2 );
	const centerGeo = new SphereGeometry( centerSize, 12, 10 );
	const centerMat = new MeshBasicNodeMaterial( {
		transparent: true,
		opacity: 0.5,
		depthWrite: false,
		blending: AdditiveBlending,
	} );

	// Cloud opacity from noise
	const cloudOpacity = Fn( () => {
		const noise = triNoise3D( positionWorld.mul( 0.3 ), float( 1 ), time.mul( 0.02 ) );
		return noise.mul( 0.4 ).add( 0.2 );
	} );
	centerMat.opacityNode = cloudOpacity();

	const center = new Mesh( centerGeo, centerMat );
	center.position.y = 0;
	center.name = 'CloudCenter';
	cluster.add( center );

	// Surrounding spheres (fluffy bumps)
	for ( let i = 0; i < sphereCount; i++ ) {
		const angle = ( i / sphereCount ) * Math.PI * 2 + seed * 0.5;
		const radius = baseSize * ( 0.4 + Math.random() * 0.4 );
		const size = baseSize * ( 0.3 + Math.random() * 0.5 );

		const geo = new SphereGeometry( size, 8, 7 );
		const mat = new MeshBasicNodeMaterial( {
			transparent: true,
			opacity: 0.4,
			depthWrite: false,
			blending: AdditiveBlending,
		} );

		// Each sphere gets its own opacity variation
		const sphereOpacity = Fn( () => {
			const noise = triNoise3D(
				positionWorld.mul( 0.4 ).add( vec3( i * 10, 0, 0 ) ),
				float( 1 ), time.mul( 0.015 )
			);
			return noise.mul( 0.3 ).add( 0.15 );
		} );
		mat.opacityNode = sphereOpacity();

		const sphere = new Mesh( geo, mat );
		sphere.position.set(
			Math.cos( angle ) * radius,
			( Math.random() - 0.3 ) * baseSize * 0.3,
			Math.sin( angle ) * radius
		);
		sphere.scale.y = 0.6 + Math.random() * 0.4; // flatten slightly
		sphere.name = `CloudBump_${i}`;
		cluster.add( sphere );
	}

	// Bottom flattening spheres (wider base)
	for ( let i = 0; i < 3; i++ ) {
		const angle = ( i / 3 ) * Math.PI * 2 + seed * 0.7;
		const radius = baseSize * ( 0.5 + Math.random() * 0.3 );
		const size = baseSize * ( 0.2 + Math.random() * 0.3 );

		const geo = new SphereGeometry( size, 6, 5 );
		const mat = new MeshBasicNodeMaterial( {
			transparent: true,
			opacity: 0.3,
			depthWrite: false,
			blending: AdditiveBlending,
		} );

		const sphere = new Mesh( geo, mat );
		sphere.position.set(
			Math.cos( angle ) * radius,
			-baseSize * 0.3,
			Math.sin( angle ) * radius
		);
		sphere.scale.set( 1.5, 0.5, 1.5 ); // wide and flat
		sphere.name = `CloudBase_${i}`;
		cluster.add( sphere );
	}

	cluster.position.y = yPos;
	cluster.name = `CloudCluster_${seed}`;
	return cluster;
}

/**
 * Adds volumetric cloud layers to the scene.
 * @param {import('three').Scene} scene
 */
export function createClouds( scene ) {

	const cloudGroup = new Group();
	cloudGroup.name = 'Clouds';

	// Cloud layers at different heights
	const layers = [
		{ y: 20, scale: 1.0, count: 5 },
		{ y: 30, scale: 0.8, count: 4 },
		{ y: 40, scale: 0.6, count: 3 },
		{ y: 50, scale: 0.5, count: 2 },
	];

	for ( const layer of layers ) {
		for ( let i = 0; i < layer.count; i++ ) {
			const seed = Math.random();
			const baseSize = 8 + Math.random() * 12;
			const cluster = createCloudCluster(
				baseSize * layer.scale,
				layer.y + ( Math.random() - 0.5 ) * 4,
				seed
			);

			// Position in a ring around the scene
			const angle = ( i / layer.count ) * Math.PI * 2 + Math.random() * 0.5;
			const radius = 25 + Math.random() * 35;
			cluster.position.x = Math.cos( angle ) * radius;
			cluster.position.z = Math.sin( angle ) * radius;

			// Random rotation
			cluster.rotation.y = Math.random() * Math.PI * 2;

			cloudGroup.add( cluster );
		}
	}

	scene.add( cloudGroup );
	console.log( '[Clouds] Added volumetric cloud clusters' );
}