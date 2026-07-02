/**
 * @file Cubey — Player-controlled cube with arrow keys
 *
 * A cube that the player can move with arrow keys.
 * Features:
 *   - Arrow key movement (WASD-style)
 *   - PBR material with wear scratches
 *   - Smooth movement with delta time
 *   - Bounding within the dance floor area
 *
 * @dependency three — BoxGeometry, Mesh, MeshPhysicalNodeMaterial
 * @dependency ../materials/MaterialLibrary — default
 */

import { BoxGeometry, Mesh, Group } from 'three';
import materialLib from '../materials/MaterialLibrary.js';

/** Movement speed in units per second */
const SPEED = 6;

/** Boundary half-size (dance floor is 60 units) */
const BOUNDARY = 25;

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

		// ── Create mesh ─────────────────────────────────────────────
		const geo = new BoxGeometry( 1.2, 1.2, 1.2 );
		const mat = materialLib.getCubeyMaterial();
		this.mesh = new Mesh( geo, mat );
		this.mesh.position.set( 0, 0.5, 0 );
		this.mesh.name = 'Cubey';
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;

		scene.add( this.mesh );

		// ── Bind keyboard events ────────────────────────────────────
		this._onKeyDown = this._onKeyDown.bind( this );
		this._onKeyUp = this._onKeyUp.bind( this );
		window.addEventListener( 'keydown', this._onKeyDown );
		window.addEventListener( 'keyup', this._onKeyUp );
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

		if ( this._keys.ArrowUp || this._keys.ArrowUp ) dz -= 1;
		if ( this._keys.ArrowDown || this._keys.ArrowDown ) dz += 1;
		if ( this._keys.ArrowLeft || this._keys.ArrowLeft ) dx -= 1;
		if ( this._keys.ArrowRight || this._keys.ArrowRight ) dx += 1;

		// Normalise diagonal movement
		if ( dx !== 0 && dz !== 0 ) {
			const inv = 1 / Math.SQRT2;
			dx *= inv;
			dz *= inv;
		}

		// Apply movement
		this.mesh.position.x += dx * SPEED * dt;
		this.mesh.position.z += dz * SPEED * dt;

		// Clamp to boundary
		this.mesh.position.x = Math.max( -BOUNDARY, Math.min( BOUNDARY, this.mesh.position.x ) );
		this.mesh.position.z = Math.max( -BOUNDARY, Math.min( BOUNDARY, this.mesh.position.z ) );

		// Gentle rotation while moving
		if ( dx !== 0 || dz !== 0 ) {
			this.mesh.rotation.y += dt * 2 * ( dx || dz );
			// Slight tilt
			this.mesh.rotation.x += dt * dz * 0.5;
			this.mesh.rotation.z -= dt * dx * 0.5;
		}

		// Damping for rotation
		this.mesh.rotation.x *= 0.95;
		this.mesh.rotation.z *= 0.95;
	}

	/**
	 * Cleans up event listeners.
	 */
	dispose() {
		window.removeEventListener( 'keydown', this._onKeyDown );
		window.removeEventListener( 'keyup', this._onKeyUp );
	}
}