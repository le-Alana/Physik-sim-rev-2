/**
 * @file CloudNoiseNode — FBM cloud noise layer (TSL)
 *
 * Creates drifting cloud-like patterns using fractal Brownian motion
 * via the built-in `triNoise3D`. Designed to be used as a mask for
 * semi-transparent cloud layers.
 *
 * @dependency three/tsl — Fn, float, vec3, triNoise3D, Timer
 */

import { Fn, float, vec3, triNoise3D, time } from 'three/tsl';

/**
 * Creates a TSL function that returns cloud density in [0,1].
 *
 * @param {Object} [config]
 * @param {number} [config.detail=4] — Noise octaves (fewer = softer clouds).
 * @param {number} [config.scale=0.8] — Spatial scale of the cloud pattern.
 * @param {number} [config.density=0.5] — How much cloud fills the space.
 * @returns {Function} TSL node function (pos: vec3) => float
 */
export function createCloudNoiseNode( config = {} ) {

	const {
		detail = 4,
		scale = 0.8,
		density = 0.5,
	} = config;

	const cloudFn = Fn( ( [ pos ] ) => {

		// Add wind drift animation using Timer
		const windOffset = vec3( time.mul( 0.03 ), 0.0, time.mul( 0.02 ) );
		const p = pos.mul( scale ).add( windOffset );

		// Use triNoise3D for cloud-like FBM noise
		const noiseVal = triNoise3D( p, float( 1.0 ), time.mul( 0.05 ) );

		// Threshold to create cloud shapes (soft step)
		const cloud = noiseVal.sub( density ).max( 0 ).mul( 2 );

		return cloud.min( 1.0 );

	} );

	return cloudFn;
}