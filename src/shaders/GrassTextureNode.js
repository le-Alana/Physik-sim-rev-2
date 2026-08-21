/**
 * @file GrassTextureNode — Procedural grass blade texture (TSL)
 *
 * Generates a realistic grass blade texture procedurally:
 *   - Vertical vein stripes (alternating light/dark green)
 *   - Tip yellowing/browning
 *   - Random blade-to-blade variation via seed
 *   - Subtle horizontal bands (node lines)
 *
 * This is NOT a leaf texture — it's specifically for grass blades.
 * Designed to be used as colorNode on MeshPhysicalNodeMaterial.
 *
 * @dependency three/tsl — Fn, vec2, vec3, mix, sin, fract, abs, step, time
 */

import { Fn, vec2, vec3, mix, sin, fract, abs, step, time, float } from 'three/tsl';

/**
 * Creates a TSL function that returns a grass blade color.
 *
 * @param {Object} [config]
 * @param {vec3} [config.baseColor] — Base green color.
 * @param {vec3} [config.tipColor] — Yellow/brown tip color.
 * @param {number} [config.veinStrength=0.15] — How prominent the veins are.
 * @param {number} [config.variation=0.1] — Random color variation between blades.
 * @returns {Function} TSL node function (uv: vec2, seed: float) => vec3
 */
export function createGrassTextureNode( config = {} ) {

	const {
		baseColor = vec3( 0.25, 0.55, 0.18 ),    // rich grass green
		tipColor = vec3( 0.55, 0.5, 0.15 ),       // yellow-brown tip
		veinStrength = 0.15,
		variation = 0.1,
	} = config;

	const grassFn = Fn( ( [ uvNode, seedNode ] ) => {

		const uv = vec2( uvNode ).toVar();
		const seed = float( seedNode || 0.5 ).toVar();

		// ── Base gradient: green at bottom → yellow/brown at tip ────
		// uv.y goes from 0 (base) to 1 (tip)
		const heightGradient = uv.y;
		let color = mix( baseColor, tipColor, heightGradient.mul( 0.6 ) );

		// ── Vertical vein stripes ───────────────────────────────────
		// Multiple vein frequencies for natural look
		const veinUV = uv.x.mul( 20 ).add( seed.mul( 2 ) );
		const vein1 = sin( veinUV.mul( 1.0 ) ).mul( 0.5 ).add( 0.5 );
		const vein2 = sin( veinUV.mul( 2.3 ).add( 1.2 ) ).mul( 0.3 ).add( 0.5 );
		const vein3 = sin( veinUV.mul( 0.7 ).add( 3.7 ) ).mul( 0.2 ).add( 0.5 );

		// Combine veins — thinner = darker, thicker = lighter
		const veinPattern = vein1.mul( vein2 ).add( vein3.mul( 0.3 ) );
		const lightVein = vec3( 0.35, 0.65, 0.25 );
		const darkVein = vec3( 0.15, 0.4, 0.12 );
		const vs = float( veinStrength );
		color = mix( color, lightVein, veinPattern.mul( vs ).mul( uv.y.add( 0.2 ) ) );
		color = mix( color, darkVein, float( 1 ).sub( veinPattern ).mul( vs.mul( 0.5 ) ) );

		// ── Horizontal node bands ───────────────────────────────────
		// Subtle horizontal lines like real grass nodes
		const bands = sin( uv.y.mul( 8 ).add( seed.mul( 5 ) ) ).abs().mul( 0.5 );
		const bandMask = step( 0.85, bands );
		color = mix( color, vec3( 0.3, 0.5, 0.2 ), bandMask.mul( 0.15 ) );

		// ── Tip browning ────────────────────────────────────────────
		// More brown at the very tip
		const tipMask = step( 0.7, uv.y );
		const brownTip = vec3( 0.5, 0.4, 0.1 );
		color = mix( color, brownTip, tipMask.mul( uv.y.sub( 0.7 ).div( 0.3 ).mul( 0.5 ) ) );

		// ── Random blade variation ──────────────────────────────────
		// Each blade gets a slightly different shade
		const bladeVar = sin( seed.mul( 12.9898 ).add( 78.233 ) ).mul( float( variation ) );
		color = color.add( vec3( bladeVar, bladeVar.mul( 0.5 ), bladeVar.mul( -0.3 ) ) );

		// ── Subtle wind darkening on edges ──────────────────────────
		const edgeDist = uv.x.sub( 0.5 ).abs().mul( 2 );
		color = color.mul( float( 1 ).sub( edgeDist.mul( 0.1 ) ) );

		return color.max( 0 ).min( 1 );

	} );

	return grassFn;
}