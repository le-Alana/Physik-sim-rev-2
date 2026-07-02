/**
 * @file WearNode — Procedural scratch & wear pattern (TSL node)
 *
 * Generates a procedural wear/scratch pattern using hash-based noise.
 * This is the most important realism cue — it breaks the "perfect"
 * look of PBR materials and makes surfaces feel real.
 *
 * Usage in a material:
 *   const wear = createWearNode();
 *   material.colorNode = mix( baseColor, wornColor, wear );
 *
 * @dependency three/tsl — float, vec2, Fn, fract, sin, abs, step, mix, etc.
 */

import { float, vec2, Fn, fract, sin, abs, step, mix, floor, max, min, length } from 'three/tsl';

/**
 * Simple 2D hash for deterministic randomness.
 * @param {Node<vec2>} p — Input coordinate
 * @returns {Node<float>} Hash value in [0,1]
 */
const hash2D = Fn( ( [ p ] ) => {

	const h = fract( sin( p.x.mul( 127.1 ).add( p.y.mul( 311.7 ) ) ).mul( 43758.5453123 ) );
	return h;

} );

/**
 * Creates a TSL node that outputs a wear factor in [0,1].
 * 0 = pristine, 1 = heavily worn.
 *
 * The pattern combines:
 *   - Long scratch streaks (directionally biased)
 *   - Micro-scratches (small random dots)
 *   - Edge wear (higher near UV seams / edges)
 *
 * @param {Object} [config]
 * @param {number} [config.scratchCount=8] — Number of visible scratch streaks.
 * @param {number} [config.strength=0.4] — Overall wear intensity.
 * @returns {() => Node<float>} TSL function node
 */
export function createWearNode( config = {} ) {

	const {
		scratchCount = 8,
		strength = 0.4,
	} = config;

	// ── Wear pattern function ───────────────────────────────────────
	// Takes UV coordinates as input, returns wear intensity.
	const wearFn = Fn( ( [ uvNode ] ) => {

		// Scale UV for more detail
		const uv = vec2( uvNode ).toVar();
		const scale = float( 6.0 );

		// ── Scratch streaks ─────────────────────────────────────────
		// Randomly placed horizontal/vertical streaks
		let scratches = float( 0 ).toVar();

		// Loop-like unroll for scratch streaks (TSL doesn't support dynamic loops easily)
		// Using a parametric approach instead: sample several pseudo-random positions
		const scratchIntensity = float( 0.3 ).mul( strength );

		// Generate scratch at several positions
		for ( let i = 0; i < scratchCount; i++ ) {

			const seed = i * 0.618033988749895; // golden ratio
			const sx = fract( seed );
			const sy = fract( seed * 1.324717957 );

			// Scratch is a thin elongated ellipse
			const dx = uv.x.sub( sx );
			const dy = uv.y.sub( sy );
			// Stretch in X direction → horizontal scratches
			const distX = dx.mul( 50 ).abs();
			const distY = dy.abs();
			const scratch = step( 0.02, max( distX, distY.mul( 4 ) ) ).sub( 1 ).abs();

			scratches = max( scratches, scratch.mul( scratchIntensity ) );
		}

		// ── Micro-scratches (grain) ─────────────────────────────────
		const grainUV = uv.mul( scale.mul( 3 ) );
		const grain = hash2D( grainUV ).mul( 0.15 ).mul( strength );

		// ── Edge wear (concentric) ──────────────────────────────────
		const centerDist = length( uv.sub( 0.5 ) );
		const edgeWear = step( 0.35, centerDist ).mul( 0.5 ).mul( strength );

		// ── Combine ─────────────────────────────────────────────────
		const result = min( scratches.add( grain ).add( edgeWear ), 1.0 );
		return result;

	} );

	return wearFn;
}