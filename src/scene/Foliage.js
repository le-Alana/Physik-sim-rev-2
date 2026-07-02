/**
 * @file Foliage — Grass tufts and stylized trees
 *
 * Adds billboarded grass tufts and simple stylized trees.
 * Grass sways gently using a vertex-based animation.
 * Trees are simple cone-and-cylinder constructions in Rayman style.
 *
 * @dependency three — PlaneGeometry, Mesh, MeshBasicNodeMaterial, Group, ConeGeometry, CylinderGeometry
 * @dependency three/tsl — Fn, float, vec3, positionLocal, time, sin
 * @dependency ../materials/MaterialLibrary — default
 */

import { PlaneGeometry, Mesh, Group, ConeGeometry, CylinderGeometry, DoubleSide, AdditiveBlending } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, float, vec3, positionLocal, time, sin } from 'three/tsl';
import materialLib from '../materials/MaterialLibrary.js';

/**
 * Adds grass tufts and stylized trees to the scene.
 * @param {import('three').Scene} scene
 */
export function createFoliage( scene ) {

	const group = new Group();
	group.name = 'Foliage';

	// ── Grass tufts (billboarded quads) ────────────────────────────
	const grassMat = new MeshBasicNodeMaterial( {
		color: 0x66cc88,
		transparent: true,
		opacity: 0.8,
		side: DoubleSide,
		depthWrite: false,
	} );

	// TSL sway animation for grass vertices
	const grassSway = Fn( () => {
		const sway = sin( positionLocal.x.mul( 2 ).add( time.mul( 1.5 ) ) ).mul( 0.1 );
		return positionLocal.y.mul( sway );
	} );

	for ( let i = 0; i < 60; i++ ) {
		const width = 0.3 + Math.random() * 0.5;
		const height = 0.5 + Math.random() * 1.0;
		const geo = new PlaneGeometry( width, height, 2, 4 );
		// Deform top vertices for natural shape
		const positions = geo.attributes.position;
		for ( let j = 0; j < positions.count; j++ ) {
			const x = positions.getX( j );
			const y = positions.getY( j );
			if ( y > 0 ) {
				// Taper the top
				const taper = 1 - y;
				positions.setX( j, x * ( 0.3 + taper * 0.7 ) );
			}
		}
		positions.needsUpdate = true;
		geo.computeVertexNormals();

		const grass = new Mesh( geo, grassMat );
		const angle = Math.random() * Math.PI * 2;
		const dist = 3 + Math.random() * 20;
		grass.position.set(
			Math.cos( angle ) * dist,
			-1,
			Math.sin( angle ) * dist
		);
		grass.rotation.y = Math.random() * Math.PI;
		grass.name = `Grass_${i}`;
		group.add( grass );
	}

	// ── Stylized trees ────────────────────────────────────────────
	// Simple cone + cylinder trees in Rayman pastel colours
	for ( let i = 0; i < 8; i++ ) {
		const trunkHeight = 1.5 + Math.random() * 2;
		const trunkRadius = 0.15 + Math.random() * 0.15;
		const crownRadius = 1.0 + Math.random() * 1.5;

		// Trunk
		const trunkGeo = new CylinderGeometry( trunkRadius * 0.5, trunkRadius, trunkHeight, 6 );
		const trunkMat = materialLib.getVineMaterial();
		const trunk = new Mesh( trunkGeo, trunkMat );
		trunk.position.y = trunkHeight / 2;

		// Crown (cone)
		const crownGeo = new ConeGeometry( crownRadius, crownRadius * 2, 8 );
		const crownMat = materialLib.getMountainMaterial().clone();
		const pastelColors = [
			0x88ddbb, 0xaadd88, 0x88ccdd, 0xdd88aa, 0xccddaa,
		];
		crownMat.color.set( pastelColors[ i % pastelColors.length ] );
		const crown = new Mesh( crownGeo, crownMat );
		crown.position.y = trunkHeight + crownRadius;

		const tree = new Group();
		tree.add( trunk );
		tree.add( crown );

		const angle = Math.random() * Math.PI * 2;
		const dist = 12 + Math.random() * 18;
		tree.position.set(
			Math.cos( angle ) * dist,
			-1,
			Math.sin( angle ) * dist
		);
		tree.scale.setScalar( 0.8 + Math.random() * 0.6 );
		tree.name = `Tree_${i}`;

		group.add( tree );
	}

	scene.add( group );
}