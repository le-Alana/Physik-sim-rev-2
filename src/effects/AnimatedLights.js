/**
 * @file AnimatedLights — Orbiting coloured point lights
 *
 * Creates several point lights that orbit the scene with
 * smoothly cycling colours. These add a magical, dream-like
 * quality fitting the Rayman style.
 *
 * Uses Three.js's time node for smooth animation.
 *
 * @dependency three — PointLight, Color
 * @dependency three/tsl — time, sin
 */

import { PointLight, Color } from 'three';

/**
 * Creates and manages animated lights.
 */
export default class AnimatedLights {

	/**
	 * @param {import('three').Scene} scene
	 * @param {number} [count=4] — Number of orbiting lights.
	 */
	constructor( scene, count = 4 ) {

		/** @type {Array<{light: PointLight, angle: number, speed: number, radius: number, height: number, hue: number}>} */
		this._lights = [];

		for ( let i = 0; i < count; i++ ) {

			const light = new PointLight( 0xffffff, 0.8, 30 );
			light.name = `AnimatedLight_${i}`;

			scene.add( light );

			this._lights.push( {
				light,
				angle: ( i / count ) * Math.PI * 2,
				speed: 0.3 + Math.random() * 0.3,
				radius: 10 + Math.random() * 8,
				height: 3 + Math.random() * 5,
				hue: i / count,
			} );
		}
	}

	/**
	 * Updates animated light positions and colours.
	 * Call every frame with the current time.
	 * @param {number} t — Elapsed time in seconds.
	 */
	update( t ) {

		for ( const l of this._lights ) {

			// Orbit
			const a = l.angle + t * l.speed;
			l.light.position.x = Math.cos( a ) * l.radius;
			l.light.position.z = Math.sin( a ) * l.radius;
			l.light.position.y = l.height + Math.sin( t * 0.5 + l.angle ) * 2;

			// Colour cycling through HSV
			const hue = ( l.hue + t * 0.05 ) % 1;
			const color = new Color().setHSL( hue, 0.8, 0.5 );
			l.light.color.copy( color );

			// Intensity pulsation
			l.light.intensity = 0.6 + Math.sin( t * 1.5 + l.angle ) * 0.3;
		}
	}
}