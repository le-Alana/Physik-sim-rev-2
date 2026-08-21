/**
 * @file BarkTextureNode — Procedural tree bark texture (TSL)
 *
 * Generates a realistic bark texture procedurally:
 *   - Vertical grain lines (stretched noise)
 *   - Brown/grey color variation
 *   - Knot patterns (circular ring features)
 *   - Roughness variation
 *
 * Designed for tree trunks, vine pillars, and fallen logs.
 *
 * @dependency three/tsl — Fn, vec2, vec3, mix, sin, abs, step, length, triNoise3D, float
 */

import { Fn, vec2, vec3, mix, sin, abs, step, length, triNoise3D, float } from 'three/tsl';

/**
 * Creates a TSL function that returns a bark color.
 *
 * @param {Object} [config]
 * @param {vec3} [config.barkColor] — Base bark brown.
 * @param {vec3} [config.darkColor] — Dark crevice color.
 * @param {vec3} [config.lightColor] — Light highlight color.
 * @param {number} [config.knotFrequency=3] — How many knots appear.
 * @returns {Function} TSL node function (uv: vec2, seed: float) => vec3
 */
export function createBarkTextureNode( config = {} ) {

	const {
		barkColor = vec3( 0.35, 0.25, 0.18 ),     // warm bark brown
		darkColor = vec3( 0.15, 0.1, 0.08 ),       // deep crevice brown
		lightColor = vec3( 0.5, 0.4, 0.3 ),        // highlight brown
		knotFrequency = 3,
	} = config;

	const barkFn = Fn( ( [ uvNode, seedNode ] ) => {

		const uv = vec2( uvNode ).toVar();
		const seed = float( seedNode || 0.5 ).toVar();

		// ── Vertical grain lines ────────────────────────────────────
		// Stretched horizontal noise creates vertical bark grain
		const grainUV = vec3(
			uv.x.mul( 30 ).add( seed.mul( 10 ) ),
			uv.y.mul( 5 ),
			seed.mul( 2 )
		);
		const grainNoise = triNoise3D( grainUV, float( 1 ), float( 0 ) );

		// Vertical stretching via multiple frequencies
		const grainFine = triNoise3D(
			vec3( uv.x.mul( 80 ), uv.y.mul( 3 ), seed.mul( 3 ) ),
			float( 1 ), float( 0 )
		);

		// Combine grain frequencies
		let color = mix( barkColor, darkColor, grainNoise.mul( 0.6 ) );
		color = mix( color, lightColor, grainFine.mul( 0.3 ) );

		// ── Deep vertical crevices ─────────────────────────────────
		// Dark lines separating bark plates
		const creviceX = sin( uv.x.mul( 15 ).add( seed.mul( 5 ) ) ).mul( 0.5 ).add( 0.5 );
		const creviceMask = step( 0.85, creviceX );
		color = mix( color, darkColor, creviceMask.mul( 0.7 ) );

		// ── Horizontal crack lines ──────────────────────────────────
		const crackY = sin( uv.y.mul( 8 ).add( seed.mul( 3 ) ) ).mul( 0.5 ).add( 0.5 );
		const crackMask = step( 0.9, crackY );
		color = mix( color, darkColor, crackMask.mul( 0.4 ) );

		// ── Knot patterns ──────────────────────────────────────────
		// Knots are circular features at random positions
		for ( let i = 0; i < knotFrequency; i++ ) {
			const kx = sin( seed.mul( 12.9898 + i * 73.1 ) ).mul( 0.5 ).add( 0.5 );
			const ky = sin( seed.mul( 46.7 + i * 31.2 ) ).mul( 0.5 ).add( 0.5 );
			const knotCenter = vec2( kx, ky );
			const dist = length( uv.sub( knotCenter ) );

			// Knot ring
			const knotRing = step( 0.05, dist ).sub( step( 0.12, dist ) );
			color = mix( color, darkColor, knotRing.mul( 0.6 ) );

			// Knot center (darker)
			const knotCenterMask = step( dist, 0.05 );
			color = mix( color, vec3( 0.1, 0.08, 0.06 ), knotCenterMask.mul( 0.8 ) );
		}

		// ── Moss patches on bark ───────────────────────────────────
		const mossNoise = triNoise3D(
			vec3( uv.x.mul( 10 ), uv.y.mul( 10 ), seed.mul( 5 ) ),
			float( 1 ), float( 0 )
		);
		const mossMask = step( 0.6, mossNoise );
		const mossColor = vec3( 0.12, 0.35, 0.1 );
		color = mix( color, mossColor, mossMask.mul( 0.2 ) );

		return color.max( 0 ).min( 1 );

	} );

	return barkFn;
}