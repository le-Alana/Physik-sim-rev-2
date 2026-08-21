/**
 * @file GroundTextureNode — Procedural dirt/soil texture (TSL)
 *
 * Generates a realistic ground texture procedurally:
 *   - Brown base with darker speckles (soil particles)
 *   - Green moss patches
 *   - Small pebble dots
 *   - Subtle noise variation for organic feel
 *
 * Designed for the terrain mesh below the dance floor.
 *
 * @dependency three/tsl — Fn, vec2, vec3, mix, sin, step, length, triNoise3D, time
 */

import { Fn, vec2, vec3, mix, sin, step, length, triNoise3D, time, float } from 'three/tsl';

/**
 * Creates a TSL function that returns a ground/dirt color.
 *
 * @param {Object} [config]
 * @param {vec3} [config.dirtColor] — Base dirt brown.
 * @param {vec3} [config.mossColor] — Green moss color.
 * @param {vec3} [config.pebbleColor] — Light pebble gray.
 * @param {number} [config.mossAmount=0.3] — How much moss coverage.
 * @returns {Function} TSL node function (uv: vec2, worldPos: vec3) => vec3
 */
export function createGroundTextureNode( config = {} ) {

	const {
		dirtColor = vec3( 0.35, 0.25, 0.15 ),     // rich soil brown
		mossColor = vec3( 0.15, 0.4, 0.12 ),       // forest moss green
		pebbleColor = vec3( 0.5, 0.45, 0.4 ),      // small stone gray
		mossAmount = 0.3,
	} = config;

	const groundFn = Fn( ( [ uvNode, worldPosNode ] ) => {

		const uv = vec2( uvNode ).toVar();
		const worldPos = vec3( worldPosNode || vec3( 0 ) ).toVar();

		// ── Large-scale dirt variation ──────────────────────────────
		// Use world-space noise for consistent ground across the terrain
		const noise1 = triNoise3D( worldPos.mul( 0.3 ), float( 1 ), time.mul( 0.01 ) );
		const noise2 = triNoise3D( worldPos.mul( 0.8 ), float( 1 ), time.mul( 0.005 ) );

		// Base dirt with noise variation
		let color = mix( dirtColor, dirtColor.mul( 0.7 ), noise1.mul( 0.4 ) );
		color = mix( color, dirtColor.mul( 1.3 ), noise2.mul( 0.2 ) );

		// ── Dark soil speckles ─────────────────────────────────────
		// Small darker dots representing organic matter in soil
		const speckleUV = uv.mul( 50 );
		const speckleNoise = triNoise3D( vec3( speckleUV.x, speckleUV.y, float( 0 ) ), float( 1 ), float( 0 ) );
		const speckleMask = step( 0.7, speckleNoise );
		const darkSpot = vec3( 0.2, 0.15, 0.1 );
		color = mix( color, darkSpot, speckleMask.mul( 0.3 ) );

		// ── Pebbles (small light dots) ─────────────────────────────
		const pebbleUV = uv.mul( 30 );
		const pebbleNoise = triNoise3D( vec3( pebbleUV.x, pebbleUV.y, float( 1 ) ), float( 1 ), float( 0 ) );
		const pebbleMask = step( 0.85, pebbleNoise );
		color = mix( color, pebbleColor, pebbleMask.mul( 0.5 ) );

		// ── Moss patches ───────────────────────────────────────────
		// Moss grows in low-lying damp areas
		const mossNoise = triNoise3D( worldPos.mul( 0.5 ), float( 2 ), time.mul( 0.008 ) );
		const mossMask = step( 0.4, mossNoise ).mul( step( mossNoise, 0.7 ) ).mul( 2 );
		color = mix( color, mossColor, mossMask.mul( mossAmount ) );

		// ── Subtle root/organic streaks ─────────────────────────────
		const streakUV = uv.x.mul( 20 ).add( uv.y.mul( 5 ) );
		const streaks = sin( streakUV ).mul( 0.5 ).add( 0.5 );
		const organicStreak = vec3( 0.3, 0.2, 0.1 );
		color = mix( color, organicStreak, step( 0.9, streaks ).mul( 0.15 ) );

		// ── Height-based drying ────────────────────────────────────
		// Higher areas are slightly more yellow/brown (drier)
		const heightDry = worldPos.y.add( 2 ).div( 6 );
		const dryColor = vec3( 0.45, 0.35, 0.2 );
		color = mix( color, dryColor, heightDry.mul( 0.2 ) );

		return color.max( 0 ).min( 1 );

	} );

	return groundFn;
}