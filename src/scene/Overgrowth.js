/**
 * @file Overgrowth — Vine pillars, mossy rocks, and glowing flora
 *
 * Adds overgrown environmental details to the scene:
 *   - Tall vine-covered pillars at the scene edges
 *   - Mossy rocks scattered around
 *   - Glowing bioluminescent mushrooms/plants
 *   - Floating sparkle particles
 *
 * These details give the scene a lush, overgrown feel fitting
 * the Rayman fantasy style.
 *
 * @dependency three — CylinderGeometry, SphereGeometry, Mesh, Group
 * @dependency ../materials/MaterialLibrary — default
 */

import { CylinderGeometry, SphereGeometry, Mesh, Group, ConeGeometry, CircleGeometry } from 'three';
import materialLib from '../materials/MaterialLibrary.js';

/**
 * Adds overgrown environment details.
 * @param {import('three').Scene} scene
 */
export function createOvergrowth( scene ) {

	const group = new Group();
	group.name = 'Overgrowth';

	// ── Vine pillars ───────────────────────────────────────────────
	// Tall, slightly tapered cylinders at scene corners
	const vineMat = materialLib.getVineMaterial();
	const pillarPositions = [
		[ -28, 0, -28 ], [ 28, 0, -28 ], [ -28, 0, 28 ], [ 28, 0, 28 ],
		[ -30, 0, -10 ], [ 30, 0, -10 ], [ -30, 0, 10 ], [ 30, 0, 10 ],
		[ -10, 0, -30 ], [ 10, 0, -30 ],
	];

	for ( const pos of pillarPositions ) {
		const height = 6 + Math.random() * 8;
		const radius = 0.8 + Math.random() * 0.6;
		const geo = new CylinderGeometry( radius * 0.7, radius, height, 8 );
		const pillar = new Mesh( geo, vineMat );
		pillar.position.set( pos[ 0 ], pos[ 1 ] + height / 2, pos[ 2 ] );
		pillar.name = `VinePillar_${pos[0]}_${pos[2]}`;
		pillar.castShadow = true;
		pillar.receiveShadow = true;
		group.add( pillar );
	}

	// ── Mossy rocks ────────────────────────────────────────────────
	const rockMat = materialLib.getRockMaterial();
	for ( let i = 0; i < 20; i++ ) {
		const radius = 0.5 + Math.random() * 1.5;
		const geo = new SphereGeometry( radius, 12, 10 );
		// Slightly deform for organic look
		const positions = geo.attributes.position;
		for ( let j = 0; j < positions.count; j++ ) {
			const x = positions.getX( j );
			const y = positions.getY( j );
			const z = positions.getZ( j );
			const deform = 0.8 + Math.random() * 0.4;
			positions.setXYZ( j, x * deform, y * ( 0.6 + Math.random() * 0.4 ), z * deform );
		}
		positions.needsUpdate = true;
		geo.computeVertexNormals();

		const rock = new Mesh( geo, rockMat );
		const angle = Math.random() * Math.PI * 2;
		const dist = 15 + Math.random() * 25;
		rock.position.set(
			Math.cos( angle ) * dist,
			-1 + radius * 0.5,
			Math.sin( angle ) * dist
		);
		rock.rotation.set( Math.random(), Math.random(), 0 );
		rock.name = `Rock_${i}`;
		rock.castShadow = true;
		rock.receiveShadow = true;
		group.add( rock );
	}

	// ── Glowing flora (bioluminescent mushrooms) ───────────────────
	const glowMat = materialLib.getGlowFloraMaterial();
	for ( let i = 0; i < 15; i++ ) {
		// Mushroom stem
		const stemGeo = new CylinderGeometry( 0.08, 0.15, 0.8, 6 );
		const stem = new Mesh( stemGeo, glowMat );
		const angle = Math.random() * Math.PI * 2;
		const dist = 8 + Math.random() * 20;
		stem.position.set(
			Math.cos( angle ) * dist,
			-0.6,
			Math.sin( angle ) * dist
		);
		stem.name = `FloraStem_${i}`;

		// Mushroom cap
		const capGeo = new ConeGeometry( 0.3, 0.2, 8 );
		const cap = new Mesh( capGeo, glowMat );
		cap.position.y = 0.8;
		cap.name = `FloraCap_${i}`;

		const floraGroup = new Group();
		floraGroup.add( stem );
		floraGroup.add( cap );
		floraGroup.position.copy( stem.position );
		floraGroup.scale.setScalar( 0.5 + Math.random() * 1.0 );
		floraGroup.name = `GlowFlora_${i}`;

		group.add( floraGroup );
	}

	scene.add( group );
}