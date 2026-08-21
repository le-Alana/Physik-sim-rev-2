/**
 * @file LeafTextureNode — Procedural leaf texture with veins (TSL)
 *
 * Generates a realistic leaf texture procedurally:
 *   - Central vein running vertically
 *   - Branching side veins at angles
 *   - Green base with darker vein lines
 *   - Slight yellow/brown edge browning
 *   - Subtle translucent edge effect
 *
 * Designed for tree crown meshes.
 *
 * @dependency three/tsl — Fn, vec2, vec3, mix, sin, abs, step, length, time
 */

import { Fn, vec2, vec3, mix, sin, abs, step, length, time, float } from 'three/tsl';

/**
 * Creates a TSL function that returns a leaf color.
 *
 * @param {Object} [config]
 * @param {vec3} [config.baseColor] — Base green color.
 * @param {vec3} [config.veinColor] — Darker vein color.
 * @param {vec3} [config.edgeColor] — Brown/yellow edge color.
 * @param {number} [config.veinStrength=0.3] — How prominent the veins are.
 * @returns {Function} TSL node function (uv: vec2, seed: float) => vec3
 */
export function createLeafTextureNode( config = {} ) {

	const {
		baseColor = vec3( 0.2, 0.5, 0.15 ),      // deep leaf green
		veinColor = vec3( 0.1, 0.3, 0.08 ),       // dark green vein
		edgeColor = vec3( 0.5, 0.4, 0.1 ),        // brown edge
		veinStrength = 0.3,
	} = config;

	const leafFn = Fn( ( [ uvNode, seedNode ] ) => {

		const uv = vec2( uvNode ).toVar();
		const seed = float( seedNode || 0.5 ).toVar();

		// Center UV so (0,0) is center of leaf
		const centered = uv.sub( 0.5 );
		const distFromCenter = length( centered );

		// ── Base color with slight gradient ─────────────────────────
		// Lighter toward center, darker at edges
		let color = mix( baseColor, baseColor.mul( 0.7 ), distFromCenter.mul( 0.5 ) );

		// ── Central vein (vertical) ─────────────────────────────────
		const centralVeinWidth = float( 0.04 );
		const centralVein = step( abs( centered.x ), centralVeinWidth );
		const vs = float( veinStrength );
		color = mix( color, veinColor, centralVein.mul( 0.8 ).mul( vs ) );

		// ── Branching side veins ────────────────────────────────────
		// Veins branch outward from the center at angles
		for ( let i = 0; i < 6; i++ ) {
			const t = float( i ).div( 6 );
			// Vein Y position along the leaf
			const veinY = t.sub( 0.5 );
			// Vein angle (spreading outward)
			const angle = t.mul( 0.8 ).add( 0.2 );
			// Distance from vein line
			const dx = centered.x.sub( veinY.mul( angle ).mul( 0.8 ) );
			const dy = centered.y.sub( veinY );
			const veinDist = length( vec2( dx.mul( 3 ), dy ) );
			const vein = step( veinDist, 0.04 );
			// Veins are thicker near center, thinner at edges
			const thickness = float( 1 ).sub( abs( veinY ).mul( 0.5 ) );
			color = mix( color, veinColor, vein.mul( thickness ).mul( vs.mul( 0.5 ) ) );
		}

		// ── Edge browning ───────────────────────────────────────────
		// Brown/yellow at the very edge of the leaf
		const edgeWidth = float( 0.08 );
		const edgeMask = step( 0.5, distFromCenter.add( edgeWidth ) ).sub( step( 0.5, distFromCenter ) );
		color = mix( color, edgeColor, edgeMask.mul( 0.4 ) );

		// ── Subtle translucent edge (lighter at edges) ──────────────
		const translucency = distFromCenter.mul( 0.3 );
		color = color.add( vec3( translucency, translucency.mul( 0.5 ), 0 ) );

		// ── Random variation per leaf ───────────────────────────────
		const leafVar = sin( seed.mul( 53.7 ).add( 12.3 ) ).mul( 0.05 );
		color = color.add( vec3( leafVar, leafVar.mul( 0.3 ), leafVar.mul( -0.2 ) ) );

		// ── Subtle animated shimmer ─────────────────────────────────
		const shimmer = sin( time.mul( 0.3 ).add( seed.mul( 10 ) ) ).mul( 0.02 );
		color = color.add( vec3( shimmer, shimmer.mul( 0.5 ), 0 ) );

		return color.max( 0 ).min( 1 );

	} );

	return leafFn;
}