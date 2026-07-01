/**
 * @file Clouds — Drifting cloud layers
 *
 * Creates semi-transparent cloud layers using billboarded quads
 * with procedural noise-driven opacity. Clouds drift slowly with
 * the wind (animated via time node).
 *
 * @dependency three — PlaneGeometry, Mesh, MeshBasicNodeMaterial, AdditiveBlending
 * @dependency three/tsl — Fn, float, vec3, positionWorld, time, mix
 * @dependency ../shaders/CloudNoiseNode — createCloudNoiseNode
 */

import { PlaneGeometry, Mesh, AdditiveBlending, DoubleSide, Group } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, float, vec3, positionWorld, time, mix } from 'three/tsl';
import { createCloudNoiseNode } from '../shaders/CloudNoiseNode.js';

/**
 * Adds drifting cloud layers to the scene.
 * @param {import('three').Scene} scene
 */
export function createClouds( scene ) {

	const cloudGroup = new Group();
	cloudGroup.name = 'Clouds';

	// Create several cloud layers at different heights
	const layers = [
		{ y: 25, scale: 1.0, density: 0.45, count: 6 },
		{ y: 35, scale: 0.7, density: 0.5, count: 4 },
		{ y: 45, scale: 0.5, density: 0.55, count: 3 },
	];

	// Shared cloud noise function
	const cloudNoise = createCloudNoiseNode( { detail: 4, scale: 0.6, density: 0.5 } );

	for ( const layer of layers ) {

		for ( let i = 0; i < layer.count; i++ ) {

			// Each cloud is a large plane with a noise-driven opacity mask
			const size = 20 + Math.random() * 30;
			const geo = new PlaneGeometry( size, size * 0.6 );

			const mat = new MeshBasicNodeMaterial( {
				transparent: true,
				opacity: 0.6,
				depthWrite: false,
				blending: AdditiveBlending,
				side: DoubleSide,
			} );

			// TSL: cloud opacity from noise
			const cloudOpacity = Fn( () => {

				// Sample noise at world position
				const density = cloudNoise( positionWorld );
				// Soft step for cloud edges
				return density.mul( 0.6 );

			} );

			mat.opacityNode = cloudOpacity();

			const cloud = new Mesh( geo, mat );
			cloud.name = `Cloud_${layer.y}_${i}`;

			// Random position in a ring around the scene
			const angle = ( i / layer.count ) * Math.PI * 2 + Math.random() * 0.5;
			const radius = 30 + Math.random() * 40;
			cloud.position.set(
				Math.cos( angle ) * radius,
				layer.y + Math.random() * 5,
				Math.sin( angle ) * radius
			);
			cloud.rotation.z = Math.random() * 0.3;
			cloud.rotation.y = Math.random() * Math.PI;

			cloudGroup.add( cloud );
		}
	}

	scene.add( cloudGroup );
}