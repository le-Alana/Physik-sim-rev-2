/**
 * @file NatureDetails — Roots, fallen logs, flowers, vines, and moss
 *
 * Adds organic nature details to make the environment feel overgrown:
 *   - Hanging roots dangling from floating mountain bottoms
 *   - Fallen logs with broken ends and bark texture
 *   - Flower patches with petal geometry
 *   - Ground vines creeping along the terrain
 *   - Moss patches on rocks and ground
 *
 * These details transform the scene from "primitives in a field"
 * to a lush, overgrown Rayman fantasy environment.
 *
 * @dependency three — CylinderGeometry, SphereGeometry, Mesh, Group, TubeGeometry, CatmullRomCurve3
 * @dependency three/tsl — Fn, vec3, positionWorld, uv, time, sin
 * @dependency ../materials/MaterialLibrary — default
 * @dependency ../shaders/BarkTextureNode — createBarkTextureNode
 */

import { CylinderGeometry, SphereGeometry, Mesh, Group, Vector3, CatmullRomCurve3, CircleGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { Fn, vec3, positionWorld, uv, time, sin, float } from 'three/tsl';
import materialLib from '../materials/MaterialLibrary.js';
import { createBarkTextureNode } from '../shaders/BarkTextureNode.js';

/**
 * Creates a single hanging root (thin curved cylinder).
 * @param {number} length — Root length.
 * @param {number} thickness — Root thickness.
 * @param {Vector3} position — Attachment point.
 * @param {number} seed — Random seed for variation.
 * @returns {Mesh}
 */
function createRoot( length, thickness, position, seed ) {
	// Root is a thin cylinder with slight random curve
	// We deform vertices directly using sine offsets instead of a CatmullRomCurve
	// to avoid issues with curve.getPoint() t-range edge cases.
	const tubeGeo = new CylinderGeometry( thickness * 0.3, thickness, length, 4, 6 );
	const pos = tubeGeo.attributes.position;

	for ( let i = 0; i < pos.count; i++ ) {
		const x = pos.getX( i );
		const y = pos.getY( i );
		const z = pos.getZ( i );

		// Normalize y from [-length/2, length/2] to [0, 1]
		const t = Math.max( 0, Math.min( 1, ( y / length + 0.5 ) ) );

		// Sine-based curve displacement - increases toward tip
		const bendX = Math.sin( t * 2.5 + seed * 10 ) * 0.15 * t * length;
		const bendZ = Math.cos( t * 1.8 + seed * 7 ) * 0.15 * t * length;

		pos.setX( i, x + bendX );
		pos.setZ( i, z + bendZ );
	}
	pos.needsUpdate = true;
	tubeGeo.computeVertexNormals();

	const rootMat = materialLib.getRootMaterial();
	const root = new Mesh( tubeGeo, rootMat );
	root.position.copy( position );
	root.name = `Root_${seed}`;
	root.castShadow = true;
	return root;
}

/**
 * Creates a fallen log with broken ends.
 * @param {number} length — Log length.
 * @param {number} radius — Log radius.
 * @param {Vector3} position — Center position.
 * @param {number} rotation — Y rotation.
 * @param {number} seed — Random seed.
 * @returns {Mesh}
 */
function createFallenLog( length, radius, position, rotation, seed ) {
	const geo = new CylinderGeometry( radius * 0.8, radius, length, 8, 6 );
	// Deform end faces for broken look
	const pos = geo.attributes.position;
	for ( let i = 0; i < pos.count; i++ ) {
		const y = pos.getY( i );
		const isEnd = Math.abs( y ) > length * 0.45;
		if ( isEnd ) {
			// Jagged break
			const angle = Math.atan2( pos.getZ( i ), pos.getX( i ) );
			const deform = 0.6 + Math.sin( angle * 3 + seed * 10 ) * 0.3;
			pos.setX( i, pos.getX( i ) * deform );
			pos.setZ( i, pos.getZ( i ) * deform );
		}
		// Slight surface irregularity
		const surfaceNoise = 0.9 + Math.sin( y * 2 + seed * 5 + pos.getX( i ) * 3 ) * 0.1;
		pos.setX( i, pos.getX( i ) * surfaceNoise );
		pos.setZ( i, pos.getZ( i ) * surfaceNoise );
	}
	pos.needsUpdate = true;
	geo.computeVertexNormals();

	// Bark texture for the log
	const barkTexture = createBarkTextureNode( { knotFrequency: 2 } );
	const logMat = new MeshPhysicalNodeMaterial();
	logMat.name = `FallenLog_${seed}`;
	logMat.roughness = 0.9;
	logMat.metalness = 0.0;

	const barkColorFn = Fn( () => {
		return barkTexture( uv(), float( seed ) );
	} );
	logMat.colorNode = barkColorFn();

	const log = new Mesh( geo, logMat );
	log.position.copy( position );
	log.rotation.x = Math.random() * 0.3;
	log.rotation.z = Math.random() * 0.3;
	log.rotation.y = rotation;
	log.name = `FallenLog_${seed}`;
	log.castShadow = true;
	log.receiveShadow = true;
	return log;
}

/**
 * Creates a flower with petal geometry.
 * @param {Vector3} position — Base position.
 * @param {number} seed — Random seed.
 * @returns {Group}
 */
function createFlower( position, seed ) {
	const group = new Group();

	// Petal colors
	const colors = [
		[ 1.0, 0.4, 0.6 ],  // pink
		[ 1.0, 0.8, 0.2 ],  // yellow
		[ 0.4, 0.6, 1.0 ],  // blue
		[ 1.0, 0.5, 0.2 ],  // orange
		[ 0.8, 0.3, 0.8 ],  // purple
		[ 1.0, 1.0, 0.6 ],  // pale yellow
	];
	const colorIdx = Math.floor( seed * colors.length ) % colors.length;
	const petalColor = colors[ colorIdx ];

	// Stem
	const stemGeo = new CylinderGeometry( 0.02, 0.03, 0.4, 4 );
	const stemMat = new MeshPhysicalNodeMaterial();
	stemMat.color.setHex( 0x336633 );
	stemMat.roughness = 0.8;
	const stem = new Mesh( stemGeo, stemMat );
	stem.position.y = 0.2;
	group.add( stem );

	// Petals (4-6 petals arranged radially)
	const petalCount = 4 + Math.floor( seed * 3 );
	for ( let i = 0; i < petalCount; i++ ) {
		const angle = ( i / petalCount ) * Math.PI * 2 + seed * 0.5;
		// Each petal is a small curved quad
		const petalGeo = new CircleGeometry( 0.08, 6 );
		const petalMat = new MeshPhysicalNodeMaterial();
		petalMat.color.setRGB( petalColor[ 0 ], petalColor[ 1 ], petalColor[ 2 ] );
		petalMat.roughness = 0.4;
		petalMat.metalness = 0.0;

		const petal = new Mesh( petalGeo, petalMat );
		petal.position.set(
			Math.cos( angle ) * 0.06,
			0.4,
			Math.sin( angle ) * 0.06
		);
		petal.rotation.x = -0.3;
		petal.rotation.y = -angle;
		petal.scale.set( 1, 1.5, 1 );
		group.add( petal );
	}

	// Center
	const centerGeo = new SphereGeometry( 0.03, 6, 6 );
	const centerMat = new MeshPhysicalNodeMaterial();
	centerMat.color.setHex( 0xffdd44 );
	centerMat.emissive.setHex( 0xffaa00 );
	centerMat.emissiveIntensity = 0.3;
	const center = new Mesh( centerGeo, centerMat );
	center.position.y = 0.4;
	group.add( center );

	group.position.copy( position );
	group.name = `Flower_${seed}`;
	return group;
}

/**
 * Creates a ground vine (thin wavy tube along terrain).
 * @param {Vector3} start — Start position.
 * @param {Vector3} end — End position.
 * @param {number} seed — Random seed.
 * @returns {Mesh}
 */
function createGroundVine( start, end, seed ) {
	const mid = new Vector3(
		( start.x + end.x ) / 2 + Math.sin( seed * 20 ) * 1.5,
		( start.y + end.y ) / 2 - 0.1,
		( start.z + end.z ) / 2 + Math.cos( seed * 15 ) * 1.5
	);
	const points = [ start, mid, end ];
	const curve = new CatmullRomCurve3( points );

	const tubeGeo = new CylinderGeometry( 0.03, 0.05, 1, 4, 6 );
	// Deform along curve
	const pos = tubeGeo.attributes.position;
	for ( let i = 0; i < pos.count; i++ ) {
		const y = pos.getY( i ) + 0.5;
		const point = curve.getPoint( y );
		pos.setX( i, pos.getX( i ) + point.x - start.x );
		pos.setZ( i, pos.getZ( i ) + point.z - start.z );
	}
	pos.needsUpdate = true;
	tubeGeo.computeVertexNormals();

	const vineMat = new MeshPhysicalNodeMaterial();
	vineMat.color.setHex( 0x445533 );
	vineMat.roughness = 0.9;
	vineMat.metalness = 0.0;

	const vine = new Mesh( tubeGeo, vineMat );
	vine.position.copy( start );
	vine.name = `GroundVine_${seed}`;
	return vine;
}

/**
 * Creates a moss patch (flat irregular disc).
 * @param {Vector3} position — Center position.
 * @param {number} radius — Patch radius.
 * @param {number} seed — Random seed.
 * @returns {Mesh}
 */
function createMossPatch( position, radius, seed ) {
	const segments = 12;
	const geo = new CircleGeometry( radius, segments );
	// Deform for irregular shape
	const pos = geo.attributes.position;
	for ( let i = 0; i < pos.count; i++ ) {
		const x = pos.getX( i );
		const z = pos.getZ( i );
		const deform = 0.7 + Math.sin( x * 3 + seed * 10 ) * 0.3 + Math.sin( z * 4 + seed * 7 ) * 0.2;
		pos.setX( i, x * deform );
		pos.setZ( i, z * deform );
	}
	pos.needsUpdate = true;
	geo.computeVertexNormals();

	const mossMat = new MeshPhysicalNodeMaterial();
	mossMat.color.setHex( 0x336633 );
	mossMat.roughness = 1.0;
	mossMat.metalness = 0.0;

	const moss = new Mesh( geo, mossMat );
	moss.position.copy( position );
	moss.rotation.x = -Math.PI / 2;
	moss.name = `MossPatch_${seed}`;
	return moss;
}

/**
 * Adds nature details to the scene.
 * @param {import('three').Scene} scene
 * @param {Object} [options]
 * @param {Array} [options.mountainPositions] — Positions of mountains for root attachment.
 */
export function createNatureDetails( scene, options = {} ) {

	const group = new Group();
	group.name = 'NatureDetails';

	const { mountainPositions = [] } = options;

	// ── Hanging roots from mountains ───────────────────────────────
	// Attach roots to the bottom of each mountain
	for ( const mPos of mountainPositions ) {
		const rootCount = 3 + Math.floor( Math.random() * 4 );
		for ( let i = 0; i < rootCount; i++ ) {
			const angle = ( i / rootCount ) * Math.PI * 2 + Math.random() * 0.5;
			const radius = 2 + Math.random() * 3;
			const pos = new Vector3(
				mPos.x + Math.cos( angle ) * radius,
				mPos.y - 0.5,
				mPos.z + Math.sin( angle ) * radius
			);
			const length = 1.5 + Math.random() * 3;
			const thickness = 0.05 + Math.random() * 0.1;
			const root = createRoot( length, thickness, pos, Math.random() );
			group.add( root );
		}
	}

	// ── Fallen logs ────────────────────────────────────────────────
	const logPositions = [
		[ -18, -1.5, -22 ], [ 22, -1.5, -18 ], [ -20, -1.5, 20 ], [ 25, -1.5, 15 ],
		[ -12, -1.5, -28 ], [ 15, -1.5, -25 ], [ -25, -1.5, 12 ], [ 30, -1.5, -10 ],
		[ -8, -1.5, 25 ], [ 10, -1.5, 28 ],
	];
	for ( let i = 0; i < logPositions.length; i++ ) {
		const pos = logPositions[ i ];
		const length = 1.5 + Math.random() * 2.5;
		const radius = 0.15 + Math.random() * 0.2;
		const log = createFallenLog(
			length, radius,
			new Vector3( pos[ 0 ], pos[ 1 ], pos[ 2 ] ),
			Math.random() * Math.PI * 2,
			Math.random()
		);
		group.add( log );
	}

	// ── Flower patches ─────────────────────────────────────────────
	const flowerPositions = [];
	for ( let i = 0; i < 12; i++ ) {
		const angle = Math.random() * Math.PI * 2;
		const dist = 10 + Math.random() * 20;
		flowerPositions.push( [ Math.cos( angle ) * dist, -1.5, Math.sin( angle ) * dist ] );
	}
	for ( const pos of flowerPositions ) {
		// Each patch has 3-6 flowers
		const count = 3 + Math.floor( Math.random() * 4 );
		for ( let i = 0; i < count; i++ ) {
			const offset = 0.3 + Math.random() * 0.5;
			const flowerPos = new Vector3(
				pos[ 0 ] + Math.cos( i * 2.1 ) * offset,
				pos[ 1 ],
				pos[ 2 ] + Math.sin( i * 2.1 ) * offset
			);
			const flower = createFlower( flowerPos, Math.random() );
			group.add( flower );
		}
	}

	// ── Ground vines ───────────────────────────────────────────────
	const vinePairs = [
		[ [ -15, -1.65, -20 ], [ -10, -1.65, -25 ] ],
		[ [ 20, -1.65, -15 ], [ 25, -1.65, -20 ] ],
		[ [ -20, -1.65, 15 ], [ -15, -1.65, 20 ] ],
		[ [ 10, -1.65, 20 ], [ 15, -1.65, 25 ] ],
		[ [ -5, -1.65, -28 ], [ 0, -1.65, -30 ] ],
		[ [ 28, -1.65, -5 ], [ 30, -1.65, 0 ] ],
		[ [ -28, -1.65, 5 ], [ -30, -1.65, 10 ] ],
		[ [ 5, -1.65, 28 ], [ 10, -1.65, 30 ] ],
	];
	for ( let i = 0; i < vinePairs.length; i++ ) {
		const pair = vinePairs[ i ];
		const start = new Vector3( pair[ 0 ][ 0 ], pair[ 0 ][ 1 ], pair[ 0 ][ 2 ] );
		const end = new Vector3( pair[ 1 ][ 0 ], pair[ 1 ][ 1 ], pair[ 1 ][ 2 ] );
		const vine = createGroundVine( start, end, Math.random() );
		group.add( vine );
	}

	// ── Moss patches ───────────────────────────────────────────────
	for ( let i = 0; i < 20; i++ ) {
		const angle = Math.random() * Math.PI * 2;
		const dist = 8 + Math.random() * 25;
		const pos = new Vector3(
			Math.cos( angle ) * dist,
			-1.4,
			Math.sin( angle ) * dist
		);
		const radius = 0.5 + Math.random() * 1.5;
		const moss = createMossPatch( pos, radius, Math.random() );
		group.add( moss );
	}

	scene.add( group );
	console.log( '[NatureDetails] Added roots, logs, flowers, vines, and moss' );
}