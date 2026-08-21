/**
 * @file NormalPerturbationNode — Micro-detail normal perturbation (TSL)
 *
 * Adds high-frequency noise-based perturbation to surface normals,
 * creating the illusion of micro-surface detail (small bumps, pores,
 * grain) without needing a normal map texture.
 *
 * This is critical for realistic shading — it breaks the "perfectly
 * smooth" look of PBR materials.
 *
 * @dependency three/tsl — Fn, vec3, triNoise3D, normalLocal, positionWorld, mix
 */

import { Fn, vec3, triNoise3D, normalLocal, positionWorld, mix, float } from 'three/tsl';

/**
 * Creates a TSL function that returns a perturbed normal.
 *
 * @param {Object} [config]
 * @param {number} [config.strength=0.05] — Perturbation strength (0=none, 0.1=strong).
 * @param {number} [config.frequency=8] — Noise frequency (higher = finer detail).
 * @param {number} [config.scale=1.0] — Overall scale multiplier.
 * @returns {Function} TSL node function (normal: vec3, position: vec3) => vec3
 */
export function createNormalPerturbationNode( config = {} ) {

	const {
		strength = 0.05,
		frequency = 8,
		scale = 1.0,
	} = config;

	// Wrap config values as TSL float nodes BEFORE the Fn closure
	// This ensures they are TSL nodes when used with .mul() inside the Fn.
	const freqNode = float( frequency );
	const strNode = float( strength );
	const scaleNode = float( scale );

	const perturbFn = Fn( ( [ normalNode, positionNode ] ) => {

		const normal = vec3( normalNode || normalLocal ).toVar();
		const position = vec3( positionNode || positionWorld ).toVar();

		// ── Sample noise at the surface position ────────────────────
		// Use multiple octaves for rich detail
		const noise1 = triNoise3D( position.mul( freqNode ), float( 1 ), float( 0 ) );
		const noise2 = triNoise3D( position.mul( freqNode.mul( 2.3 ) ), float( 1 ), float( 0 ) );
		const noise3 = triNoise3D( position.mul( freqNode.mul( 5.1 ) ), float( 1 ), float( 0 ) );

		// ── Compute gradient offsets ───────────────────────────────
		// Approximate normal perturbation via noise gradient
		// Sample noise at slightly offset positions to get gradient
		const eps = float( 0.01 );
		const offsetX = vec3( eps, 0, 0 );
		const offsetY = vec3( 0, eps, 0 );

		const nx = triNoise3D( position.mul( freqNode ).add( offsetX ), float( 1 ), float( 0 ) )
			.sub( triNoise3D( position.mul( freqNode ).sub( offsetX ), float( 1 ), float( 0 ) ) );
		const ny = triNoise3D( position.mul( freqNode ).add( offsetY ), float( 1 ), float( 0 ) )
			.sub( triNoise3D( position.mul( freqNode ).sub( offsetY ), float( 1 ), float( 0 ) ) );

		// ── Combine noise into perturbation vector ─────────────────
		const perturbation = vec3(
			nx.mul( strNode ).mul( scaleNode ),
			ny.mul( strNode ).mul( scaleNode ),
			float( 0 )
		);

		// ── Apply perturbation to normal ────────────────────────────
		// Add perturbation in tangent space and renormalize
		const perturbedNormal = normal.add( perturbation );
		return perturbedNormal.normalize();

	} );

	return perturbFn;
}