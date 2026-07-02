/**
 * @file OvergrowthNode — Moss/vine procedural pattern (TSL)
 *
 * Generates an organic overgrowth pattern using noise.
 * Moss clusters near the bottom of objects and creeps upward.
 * Vines form thin,蜿蜒 (winding) vertical streaks.
 *
 * Uses built-in `triNoise3D` and `hash` for procedural variation.
 *
 * @dependency three/tsl — Fn, float, vec2, vec3, triNoise3D, hash, time
 */

import { Fn, float, vec3, triNoise3D, hash, time, sin, step, mix, max, min, abs, smoothstep } from 'three/tsl';

/**
 * Creates a TSL function that returns an overgrowth mask in [0,1].
 * 0 = clean surface, 1 = fully overgrown.
 *
 * @param {Object} [config]
 * @param {number} [config.mossAmount=0.6] — How much moss coverage.
 * @param {number} [config.vineAmount=0.3] — How many vine streaks.
 * @param {number} [config.mossHeight=0.5] — Height limit for moss (Y coordinate).
 * @returns {Function} TSL node function (position: vec3, uv: vec2) => float
 */
export function createOvergrowthNode( config = {} ) {

	const {
		mossAmount = 0.6,
		vineAmount = 0.3,
		mossHeight = 0.5,
	} = config;

	const overgrowthFn = Fn( ( [ position, uv ] ) => {

		// ── Moss layer ─────────────────────────────────────────────
		// Moss grows near the bottom and in crevices
		const mossNoise = triNoise3D( position.mul( 2.5 ), float( 1.0 ), time.mul( 0.02 ) );
		const heightFactor = position.y.add( 1 ).mul( 0.5 ).sub( mossHeight ).max( 0 ).mul( -3 ).add( 1 ).max( 0 );
		const moss = smoothstep( 0.3, 0.8, mossNoise ).mul( heightFactor ).mul( mossAmount );

		// ── Vine streaks ───────────────────────────────────────────
		// Thin vertical streaks using stretched noise
		const vineUV = vec3( uv.x.mul( 8 ), uv.y.mul( 20 ), float( 0.5 ) );
		const vineNoise = triNoise3D( vineUV, float( 0.5 ), time.mul( 0.01 ) );
		const vine = step( 0.85, vineNoise ).mul( vineAmount );

		// ── Combine ────────────────────────────────────────────────
		const result = max( moss, vine ).min( 1.0 );
		return result;

	} );

	return overgrowthFn;
}