/**
 * @file Environment — Ambient light, hemisphere light, and fog colour
 *
 * Sets up the scene's lighting environment:
 *   - HemisphereLight for sky/ground colour
 *   - AmbientLight for fill
 *   - Fog colour override
 *
 * @dependency three — HemisphereLight, AmbientLight, FogExp2
 */

import { HemisphereLight, AmbientLight, FogExp2, Color } from 'three';

/**
 * Rayman-style pastel environment colours.
 */
const SKY_COLOR = 0xffccaa;   // warm peach sky
const GROUND_COLOR = 0x88bbff; // cool blue ground bounce
const AMBIENT_INTENSITY = 0.4;

/**
 * Configures the scene's ambient lighting and fog.
 * @param {import('three').Scene} scene
 */
export function createEnvironment( scene ) {

	// ── Hemisphere light ───────────────────────────────────────────
	// Provides natural sky/ground colour separation
	const hemi = new HemisphereLight( SKY_COLOR, GROUND_COLOR, 0.8 );
	scene.add( hemi );

	// ── Ambient fill ───────────────────────────────────────────────
	// Soft fill light to prevent pure-black shadows
	const ambient = new AmbientLight( 0xffffff, AMBIENT_INTENSITY );
	scene.add( ambient );

	// ── Fog colour ─────────────────────────────────────────────────
	// Match fog to sky colour for seamless distance blending
	if ( scene.fog ) {
		scene.fog.color.set( SKY_COLOR );
	}
}