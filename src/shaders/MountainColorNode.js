/**
 * @file MountainColorNode — Rayman-style gradient colour palette (TSL)
 *
 * Generates a smooth gradient colour for the floating mountains.
 * Rayman's art style uses vibrant, saturated pastels with smooth
 * transitions — typically magenta → cyan → peach → lavender.
 *
 * The gradient is driven by the vertex Y position and a noise
 * offset for variety between mountains.
 *
 * @dependency three/tsl — Fn, vec3, mix, sin, abs, time
 */

import { Fn, vec3, mix, sin, abs, time } from 'three/tsl';

/**
 * Rayman colour palette (pastel fantasy).
 */
const COLORS = {
	top:    vec3( 1.0, 0.6, 0.8 ),   // pastel pink
	mid:    vec3( 0.5, 0.8, 1.0 ),   // sky blue
	bottom: vec3( 1.0, 0.7, 0.4 ),   // peach
	accent: vec3( 0.8, 0.4, 1.0 ),   // lavender
};

/**
 * Creates a TSL function that returns a Rayman-style gradient colour.
 *
 * @param {Object} [config]
 * @param {vec3} [config.topColor] — Colour at the top of the mountain.
 * @param {vec3} [config.bottomColor] — Colour at the bottom.
 * @param {number} [config.speed=0.1] — Subtle colour animation speed.
 * @returns {Function} TSL node function (height: float, seed: float) => vec3
 */
export function createMountainColorNode( config = {} ) {

	const {
		topColor = COLORS.top,
		bottomColor = COLORS.bottom,
		speed = 0.1,
	} = config;

	const colorFn = Fn( ( [ height, seed ] ) => {

		// Normalise height to [0, 1] range
		const h = height.add( 1 ).mul( 0.5 );

		// Base gradient: bottom → top
		let color = mix( bottomColor, topColor, h );

		// Add subtle animated shimmer (Rayman's magical feel)
		const shimmer = sin( height.mul( 3 ).add( time.mul( speed ).add( seed ) ) ).mul( 0.08 );
		color = color.add( vec3( shimmer, shimmer.mul( 0.5 ), shimmer.mul( -0.3 ) ) );

		// Add accent band at mid-height
		const midBand = abs( h.sub( 0.5 ) ).mul( 4 ).sub( 1 ).max( 0 );
		color = mix( color, COLORS.accent, midBand.mul( 0.3 ) );

		return color.max( 0 ).min( 1 );

	} );

	return colorFn;
}