/**
 * @file SceneManager — Scene, Camera, and Fog setup
 *
 * Creates the Three.js scene with a perspective camera and exponential fog.
 * The fog colour is chosen to match the Rayman-style sky (warm pastel).
 *
 * @dependency three — Scene, PerspectiveCamera, FogExp2
 */

import { Scene, PerspectiveCamera, FogExp2, Color } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Rayman-style pastel fog colour (warm peach).
 */
const FOG_COLOR = 0xffccaa;

/**
 * Manages the scene graph, camera, and fog.
 */
export default class SceneManager {

	/**
	 * @param {number} [fov=60] — Vertical field of view in degrees.
	 * @param {number} [near=0.1] — Near clipping plane.
	 * @param {number} [far=200] — Far clipping plane.
	 */
	constructor( fov = 60, near = 0.1, far = 200 ) {

		// ── Scene ───────────────────────────────────────────────────
		/** @type {Scene} */
		this.scene = new Scene();
		this.scene.background = new Color( 0x87ceeb ); // temporary sky blue

		// ── Camera ──────────────────────────────────────────────────
		const aspect = window.innerWidth / window.innerHeight;
		/** @type {PerspectiveCamera} */
		this.camera = new PerspectiveCamera( fov, aspect, near, far );
		this.camera.position.set( 12, 8, 18 );
		this.camera.lookAt( 0, 0, 0 );

		const canvas = document.getElementById( 'renderCanvas' );
		this.controls = new OrbitControls( this.camera, canvas );
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.enablePan = true;
		this.controls.enableZoom = true;
		this.controls.enableRotate = true;
		this.controls.target.set( 0, 2, 0 );
		this.controls.minDistance = 6;
		this.controls.maxDistance = 80;
		this.controls.maxPolarAngle = Math.PI * 0.95;
		this.controls.enableKeys = false;
		this.controls.touches = {
			ONE: 1,
			TWO: 2,
			THREE: 2,
		};
		this.controls.update();
		if ( canvas ) {
			canvas.style.touchAction = 'none';
			canvas.setAttribute( 'data-touch-enabled', 'true' );
		}

		this._touchState = null;
		this._onTouchStart = this._onTouchStart.bind( this );
		this._onTouchMove = this._onTouchMove.bind( this );
		this._onTouchEnd = this._onTouchEnd.bind( this );
		if ( canvas ) {
			canvas.addEventListener( 'touchstart', this._onTouchStart, { passive: false } );
			canvas.addEventListener( 'touchmove', this._onTouchMove, { passive: false } );
			canvas.addEventListener( 'touchend', this._onTouchEnd );
			canvas.addEventListener( 'touchcancel', this._onTouchEnd );
		}

		// ── Fog ─────────────────────────────────────────────────────
		// Exponential fog blends distant objects into the sky colour.
		// The density is tuned so mountains at ~40 units start fading.
		this.scene.fog = new FogExp2( FOG_COLOR, 0.008 );

		// Store for resize
		this._fov = fov;
		this._near = near;
		this._far = far;
	}

	/**
	 * Call on window resize to keep the camera aspect ratio correct.
	 * @param {number} width
	 * @param {number} height
	 */
	updateAspect( width, height ) {
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
	}

	_onTouchStart( event ) {
		if ( event.touches.length === 1 ) {
			this._touchState = {
				active: true,
				startX: event.touches[ 0 ].clientX,
				startY: event.touches[ 0 ].clientY,
				lastX: event.touches[ 0 ].clientX,
				lastY: event.touches[ 0 ].clientY,
			};
		}
	}

	_onTouchMove( event ) {
		if ( !this._touchState || event.touches.length !== 1 ) return;
		const touch = event.touches[ 0 ];
		const deltaX = touch.clientX - this._touchState.lastX;
		const deltaY = touch.clientY - this._touchState.lastY;
		this._touchState.lastX = touch.clientX;
		this._touchState.lastY = touch.clientY;
		if ( Math.abs( deltaX ) < 0.5 && Math.abs( deltaY ) < 0.5 ) return;
		this.controls.rotateLeft( -deltaX * 0.005 );
		this.controls.rotateUp( -deltaY * 0.005 );
		event.preventDefault();
	}

	_onTouchEnd() {
		this._touchState = null;
	}
}