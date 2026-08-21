/**
 * @file Cubey — Player-controlled cube with arrow keys
 *
 * A rounded/beveled cube that the player can move with arrow keys.
 * Features:
 *   - Beveled geometry (not sharp-edged box)
 *   - Arrow key movement
 *   - PBR material with wear scratches
 *   - Smooth movement with delta time
 *   - Bounding within the dance floor area
 *   - Subtle squash/stretch on direction change
 *
 * @dependency three — BoxGeometry, SphereGeometry, Mesh, MeshPhysicalNodeMaterial, Group
 * @dependency ../materials/MaterialLibrary — default
 */

import { BoxGeometry, SphereGeometry, Mesh, Group, BufferGeometry, Float32BufferAttribute } from 'three';
import materialLib from '../materials/MaterialLibrary.js';

/** Movement speed in units per second */
const SPEED = 6;

/** Boundary half-size (dance floor is ~25 units radius) */
const BOUNDARY = 24;

/**
 * Creates a beveled/rounded box geometry by rounding cube corners.
 * @param {number} width — Width (x).
 * @param {number} height — Height (y).
 * @param {number} depth — Depth (z).
 * @param {number} radius — Corner radius.
 * @param {number} segments — Corner subdivisions.
 * @returns {BufferGeometry}
 */
function createRoundedBox( width, height, depth, radius, segments ) {
	// Simple approach: use a sphere for corners, box for faces
	// This creates a beveled look using a box with sphere-capped corners
	const group = new Group();

	const innerW = width - radius * 2;
	const innerH = height - radius * 2;
	const innerD = depth - radius * 2;

	// Center box (the main body)
	const boxGeo = new BoxGeometry( innerW, innerH, innerD );
	const boxMat = materialLib.getCubeyMaterial().clone();
	const box = new Mesh( boxGeo, boxMat );
	group.add( box );

	// Edge cylinders (for beveled edges)
	const edgeGeo = new BoxGeometry( innerW, radius * 2, radius * 2 );
	const edgeMat = materialLib.getCubeyMaterial().clone();
	// Top edge
	const topEdge = new Mesh( edgeGeo, edgeMat );
	topEdge.position.y = innerH / 2 + radius;
	group.add( topEdge );
	// Bottom edge
	const bottomEdge = new Mesh( edgeGeo, edgeMat );
	bottomEdge.position.y = -innerH / 2 - radius;
	group.add( bottomEdge );

	// Merge all into one geometry
	const merged = new BufferGeometry();
	const positions = [];
	const uvs = [];

	// We'll use a simpler approach: sphere-based rounded box
	// Actually, let's just use a box with extra segments and manually round corners
	const boxSegments = 3;
	const roundedGeo = new BoxGeometry( width, height, depth, boxSegments, boxSegments, boxSegments );
	const pos = roundedGeo.attributes.position;

	for ( let i = 0; i < pos.count; i++ ) {
		let x = pos.getX( i );
		let y = pos.getY( i );
		let z = pos.getZ( i );

		// Push vertices near corners inward to round them
		const maxDist = Math.max( Math.abs( x ), Math.abs( y ), Math.abs( z ) );
		const cornerThreshold = width / 2 - radius;

		if ( maxDist > cornerThreshold ) {
			// This vertex is near a corner — round it
			const signX = Math.sign( x );
			const signY = Math.sign( y );
			const signZ = Math.sign( z );

			// Normalize to corner direction
			const cx = Math.abs( x ) - cornerThreshold;
			const cy = Math.abs( y ) - cornerThreshold;
			const cz = Math.abs( z ) - cornerThreshold;

			// Distance from corner
			const dist = Math.sqrt( cx * cx + cy * cy + cz * cz );
			if ( dist > 0 ) {
				const maxRadius = radius;
				const newDist = Math.min( dist, maxRadius );
				const scale = newDist / dist;

				x = signX * ( cornerThreshold + cx * scale );
				y = signY * ( cornerThreshold + cy * scale );
				z = signZ * ( cornerThreshold + cz * scale );
			}
		}

		pos.setXYZ( i, x, y, z );
	}
	pos.needsUpdate = true;
	roundedGeo.computeVertexNormals();

	return roundedGeo;
}

/**
 * Player cube controller.
 */
export default class Cubey {

	/**
	 * @param {import('three').Scene} scene
	 */
	constructor( scene ) {

		// ── Input state ─────────────────────────────────────────────
		/** @type {Object<string, boolean>} */
		this._keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

		// ── Create rounded cube mesh ────────────────────────────────
		const geo = createRoundedBox( 1.2, 1.2, 1.2, 0.2, 3 );
		const mat = materialLib.getCubeyMaterial();
		this.mesh = new Mesh( geo, mat );
		this.mesh.position.set( 0, 0.02, 0 );
		this.mesh.name = 'Cubey';
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;

		scene.add( this.mesh );

		// ── Bind keyboard events ────────────────────────────────────
		this._onKeyDown = this._onKeyDown.bind( this );
		this._onKeyUp = this._onKeyUp.bind( this );
		window.addEventListener( 'keydown', this._onKeyDown );
		window.addEventListener( 'keyup', this._onKeyUp );

		// ── Velocity for smooth movement ────────────────────────────
		this._velocity = { x: 0, z: 0 };
	}

	/**
	 * Handles key down events.
	 * @private
	 * @param {KeyboardEvent} e
	 */
	_onKeyDown( e ) {
		if ( e.key in this._keys ) {
			this._keys[ e.key ] = true;
			e.preventDefault();
		}
	}

	/**
	 * Handles key up events.
	 * @private
	 * @param {KeyboardEvent} e
	 */
	_onKeyUp( e ) {
		if ( e.key in this._keys ) {
			this._keys[ e.key ] = false;
			e.preventDefault();
		}
	}

	/**
	 * Updates cube position based on input.
	 * Call every frame with delta time.
	 * @param {number} dt — Delta time in seconds.
	 */
	update( dt ) {

		let dx = 0;
		let dz = 0;

		if ( this._keys.ArrowUp ) dz -= 1;
		if ( this._keys.ArrowDown ) dz += 1;
		if ( this._keys.ArrowLeft ) dx -= 1;
		if ( this._keys.ArrowRight ) dx += 1;

		// Normalise diagonal movement
		if ( dx !== 0 && dz !== 0 ) {
			const inv = 1 / Math.SQRT2;
			dx *= inv;
			dz *= inv;
		}

		// Smooth velocity
		this._velocity.x += ( dx - this._velocity.x ) * 0.2;
		this._velocity.z += ( dz - this._velocity.z ) * 0.2;

		// Apply movement
		this.mesh.position.x += this._velocity.x * SPEED * dt;
		this.mesh.position.z += this._velocity.z * SPEED * dt;

		// Clamp to boundary
		this.mesh.position.x = Math.max( -BOUNDARY, Math.min( BOUNDARY, this.mesh.position.x ) );
		this.mesh.position.z = Math.max( -BOUNDARY, Math.min( BOUNDARY, this.mesh.position.z ) );

		// Subtle squash/stretch on movement
		const speed = Math.sqrt(
			this._velocity.x * this._velocity.x +
			this._velocity.z * this._velocity.z
		);
		const squash = 1 - speed * 0.05;
		const stretch = 1 + speed * 0.05;
		this.mesh.scale.set( squash, stretch, squash );
	}

	/**
	 * Cleans up event listeners.
	 */
	dispose() {
		window.removeEventListener( 'keydown', this._onKeyDown );
		window.removeEventListener( 'keyup', this._onKeyUp );
	}
}