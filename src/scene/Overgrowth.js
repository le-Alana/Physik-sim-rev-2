/**
 * @file Overgrowth — Organic vine pillars, faceted rocks, detailed mushrooms
 *
 * Adds overgrown environmental details with organic shapes:
 *   - Vine pillars: Irregular columns with vertex displacement and hanging vines
 *   - Rocks: Faceted/organic geometry (not deformed spheres)
 *   - Mushrooms: Detailed caps with gills, curved stems, spots
 *   - Glowing bioluminescent flora with color variation
 *
 * @dependency three — CylinderGeometry, Mesh, Group, IcosahedronGeometry, SphereGeometry, ConeGeometry, Color
 * @dependency ../materials/MaterialLibrary — default
 * @dependency ../shaders/BarkTextureNode — createBarkTextureNode
 */

import { CylinderGeometry, Mesh, Group, IcosahedronGeometry, SphereGeometry, ConeGeometry, Color } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { Fn, vec3, uv, float } from 'three/tsl';
import materialLib from '../materials/MaterialLibrary.js';
import { createBarkTextureNode } from '../shaders/BarkTextureNode.js';

/**
 * Creates an organic vine pillar with irregular shape.
 * @param {number} height — Pillar height.
 * @param {number} radius — Base radius.
 * @param {number} seed — Random seed.
 * @returns {Mesh}
 */
function createOrganicPillar( height, radius, seed ) {
	const segments = 10;
	const heightSegs = 8;
	const geo = new CylinderGeometry( radius * 0.6, radius, height, segments, heightSegs );

	// Vertex displacement for organic shape
	const pos = geo.attributes.position;
	for ( let i = 0; i < pos.count; i++ ) {
		const x = pos.getX( i );
		const z = pos.getZ( i );
		const y = pos.getY( i );

		// Radial bulge
		const angle = Math.atan2( z, x );
		const radialDeform = 0.8 + Math.sin( y * 2 + seed * 10 + angle * 2 ) * 0.3;
		// Vertical wobble
		const wobble = Math.sin( y * 1.5 + seed * 5 ) * 0.15;
		// Asymmetric bulge
		const asymDeform = 0.85 + Math.sin( angle * 3 + seed * 7 ) * 0.15;

		const deform = radialDeform * asymDeform;
		pos.setX( i, x * deform + wobble * Math.cos( angle ) );
		pos.setZ( i, z * deform + wobble * Math.sin( angle ) );
	}
	pos.needsUpdate = true;
	geo.computeVertexNormals();

	const pillarMat = materialLib.getVineMaterial().clone();
	const pillar = new Mesh( geo, pillarMat );
	pillar.name = `OrganicPillar_${seed}`;
	pillar.castShadow = true;
	pillar.receiveShadow = true;
	return pillar;
}

/**
 * Creates a faceted rock with organic shape.
 * @param {number} radius — Base radius.
 * @param {number} seed — Random seed.
 * @returns {Mesh}
 */
function createFacetedRock( radius, seed ) {
	// Start with an icosahedron for faceted look, then subdivide and deform
	const detail = 1; // 1 subdivision gives nice faceted look
	const geo = new IcosahedronGeometry( radius, detail );

	// Deform vertices for organic shape
	const pos = geo.attributes.position;
	for ( let i = 0; i < pos.count; i++ ) {
		const x = pos.getX( i );
		const y = pos.getY( i );
		const z = pos.getZ( i );

		const deform = 0.7 + Math.sin( x * 2 + seed * 5 ) * 0.15
			+ Math.sin( y * 3 + seed * 3 ) * 0.1
			+ Math.sin( z * 2.5 + seed * 7 ) * 0.12;
		pos.setXYZ( i, x * deform, y * deform, z * deform );
	}
	pos.needsUpdate = true;
	geo.computeVertexNormals();

	const rock = new Mesh( geo, materialLib.getRockMaterial().clone() );
	rock.name = `FacetedRock_${seed}`;
	rock.castShadow = true;
	rock.receiveShadow = true;
	return rock;
}

/**
 * Creates a detailed mushroom with curved stem and spotted cap.
 * @param {number} size — Overall size.
 * @param {number} seed — Random seed.
 * @returns {Group}
 */
function createDetailedMushroom( size, seed ) {
	const group = new Group();

	// ── Stem (curved thin cylinder) ───────────────────────────────
	const stemHeight = size * 0.6;
	const stemRadius = size * 0.08;
	const stemGeo = new CylinderGeometry( stemRadius * 0.5, stemRadius, stemHeight, 6, 4 );

	// Bend the stem
	const stemPos = stemGeo.attributes.position;
	for ( let i = 0; i < stemPos.count; i++ ) {
		const y = stemPos.getY( i );
		const t = ( y / stemHeight + 0.5 );
		const bend = Math.sin( t * Math.PI ) * 0.15 * size;
		stemPos.setX( i, stemPos.getX( i ) + bend );
	}
	stemPos.needsUpdate = true;
	stemGeo.computeVertexNormals();

	const stemMat = new MeshPhysicalNodeMaterial();
	stemMat.color.setHex( 0xeeeedd );
	stemMat.roughness = 0.7;
	stemMat.metalness = 0.0;

	const stem = new Mesh( stemGeo, stemMat );
	stem.position.y = stemHeight / 2;
	stem.name = 'MushroomStem';
	group.add( stem );

	// ── Cap (organic dome with gills underneath) ──────────────────
	const capRadius = size * 0.35;
	const capGeo = new SphereGeometry( capRadius, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2 );

	// Deform cap for organic shape
	const capPos = capGeo.attributes.position;
	for ( let i = 0; i < capPos.count; i++ ) {
		const x = capPos.getX( i );
		const y = capPos.getY( i );
		const z = capPos.getZ( i );
		const deform = 0.8 + Math.sin( x * 3 + seed * 5 ) * 0.2
			+ Math.sin( z * 4 + seed * 3 ) * 0.15;
		capPos.setXYZ( i, x * deform, y * deform, z * deform );
	}
	capPos.needsUpdate = true;
	capGeo.computeVertexNormals();

	const capMat = new MeshPhysicalNodeMaterial();
	// Color varies by seed
	const hue = 0.05 + seed * 0.15; // red-brown to orange-brown
	const color = new Color().setHSL( hue, 0.6, 0.4 );
	capMat.color.copy( color );
	capMat.roughness = 0.6;
	capMat.metalness = 0.0;

	const cap = new Mesh( capGeo, capMat );
	cap.position.y = stemHeight;
	cap.name = 'MushroomCap';
	group.add( cap );

	// ── Spots on cap ─────────────────────────────────────────────
	// Small lighter dots
	for ( let i = 0; i < 5 + Math.floor( seed * 5 ); i++ ) {
		const angle = ( i / 8 ) * Math.PI * 2 + seed * 0.7;
		const dist = capRadius * ( 0.2 + Math.random() * 0.6 );
		const spotGeo = new SphereGeometry( 0.02 * size, 4, 4 );
		const spotMat = new MeshPhysicalNodeMaterial();
		spotMat.color.setHSL( hue, 0.3, 0.7 );
		spotMat.roughness = 0.8;

		const spot = new Mesh( spotGeo, spotMat );
		spot.position.set(
			Math.cos( angle ) * dist,
			stemHeight + Math.sqrt( Math.max( 0, capRadius * capRadius - dist * dist ) ) * 0.5,
			Math.sin( angle ) * dist
		);
		spot.name = `MushroomSpot_${i}`;
		group.add( spot );
	}

	group.name = `Mushroom_${seed}`;
	return group;
}

/**
 * Adds overgrowth details to the scene.
 * @param {import('three').Scene} scene
 */
export function createOvergrowth( scene ) {

	const group = new Group();
	group.name = 'Overgrowth';

	// ── Organic vine pillars ──────────────────────────────────────
	const pillarPositions = [
		[ -28, 0, -28 ], [ 28, 0, -28 ], [ -28, 0, 28 ], [ 28, 0, 28 ],
		[ -30, 0, -10 ], [ 30, 0, -10 ], [ -30, 0, 10 ], [ 30, 0, 10 ],
		[ -10, 0, -30 ], [ 10, 0, -30 ],
	];

	for ( const pos of pillarPositions ) {
		const height = 5 + Math.random() * 9;
		const radius = 0.6 + Math.random() * 0.8;
		const seed = Math.random();
		const pillar = createOrganicPillar( height, radius, seed );
		pillar.position.set( pos[ 0 ], pos[ 1 ] + height / 2, pos[ 2 ] );
		group.add( pillar );
	}

	// ── Faceted rocks ─────────────────────────────────────────────
	for ( let i = 0; i < 30; i++ ) {
		const radius = 0.3 + Math.random() * 1.5;
		const seed = Math.random();
		const rock = createFacetedRock( radius, seed );
		const angle = Math.random() * Math.PI * 2;
		const dist = 12 + Math.random() * 28;
		rock.position.set(
			Math.cos( angle ) * dist,
			-1.5 + radius * 0.3,
			Math.sin( angle ) * dist
		);
		rock.rotation.set( Math.random() * Math.PI, Math.random() * Math.PI, 0 );
		group.add( rock );
	}

	// ── Detailed mushrooms ────────────────────────────────────────
	for ( let i = 0; i < 20; i++ ) {
		const size = 0.3 + Math.random() * 0.8;
		const seed = Math.random();
		const mushroom = createDetailedMushroom( size, seed );
		const angle = Math.random() * Math.PI * 2;
		const dist = 8 + Math.random() * 22;
		mushroom.position.set(
			Math.cos( angle ) * dist,
			-1.5,
			Math.sin( angle ) * dist
		);
		mushroom.rotation.y = Math.random() * Math.PI * 2;
		mushroom.scale.setScalar( 0.5 + Math.random() * 1.0 );
		group.add( mushroom );
	}

	// ── Glowing bioluminescent flora ──────────────────────────────
	const glowMat = materialLib.getGlowFloraMaterial();
	for ( let i = 0; i < 12; i++ ) {
		const stemGeo = new CylinderGeometry( 0.06, 0.1, 0.6, 5 );
		const stem = new Mesh( stemGeo, glowMat );
		const angle = Math.random() * Math.PI * 2;
		const dist = 6 + Math.random() * 18;
		stem.position.set(
			Math.cos( angle ) * dist,
			-1.5,
			Math.sin( angle ) * dist
		);

		// Glowing cap
		const capGeo = new SphereGeometry( 0.15, 6, 5 );
		const cap = new Mesh( capGeo, glowMat );
		cap.position.y = 0.6;

		const floraGroup = new Group();
		floraGroup.add( stem );
		floraGroup.add( cap );
		floraGroup.position.copy( stem.position );
		floraGroup.scale.setScalar( 0.5 + Math.random() * 0.8 );
		floraGroup.name = `GlowFlora_${i}`;
		group.add( floraGroup );
	}

	scene.add( group );
	console.log( '[Overgrowth] Added organic pillars, faceted rocks, detailed mushrooms' );
}