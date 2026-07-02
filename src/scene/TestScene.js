/**
 * @file TestScene — Scene orchestrator
 *
 * Calls all scene-building functions in the correct order.
 * This is the single entry point for constructing the entire scene.
 *
 * Order matters:
 *   1. Environment (ambient + hemisphere lights, fog)
 *   2. Sky (gradient dome + sun)
 *   3. Clouds (drifting layers)
 *   4. Mountains (Rayman-style floating)
 *   5. Ground (reflective dance floor)
 *   6. Overgrowth (vine pillars, rocks, flora)
 *   7. Foliage (grass tufts, trees)
 *   8. Cubey (player cube)
 *   9. Shadows (directional lights)
 *   10. AnimatedLights (orbiting point lights)
 *
 * @dependency ./Environment — createEnvironment
 * @dependency ./Sky — createSky
 * @dependency ./Clouds — createClouds
 * @dependency ./Mountains — createMountains
 * @dependency ./Ground — createGround
 * @dependency ./Overgrowth — createOvergrowth
 * @dependency ./Foliage — createFoliage
 * @dependency ./Cubey — Cubey (class)
 * @dependency ../effects/ShadowManager — createShadows
 * @dependency ../effects/AnimatedLights — AnimatedLights (class)
 */

import { createEnvironment } from './Environment.js';
import { createSky } from './Sky.js';
import { createClouds } from './Clouds.js';
import { createMountains } from './Mountains.js';
import { createGround } from './Ground.js';
import { createOvergrowth } from './Overgrowth.js';
import { createFoliage } from './Foliage.js';
import Cubey from './Cubey.js';
import { createShadows } from '../effects/ShadowManager.js';
import AnimatedLights from '../effects/AnimatedLights.js';

/**
 * Builds the complete Rayman-style test scene.
 *
 * @param {import('three').Scene} scene
 * @param {Object} engine — Engine instance (for quality settings)
 * @returns {{ cubey: Cubey, animatedLights: AnimatedLights }}
 */
export function buildTestScene( scene, engine ) {

	console.log( '[TestScene] Building scene…' );

	// 1. Environment lighting + fog
	createEnvironment( scene );

	// 2. Sky dome + sun
	createSky( scene );

	// 3. Drifting clouds
	createClouds( scene );

	// 4. Floating Rayman mountains
	createMountains( scene );

	// 5. Reflective dance floor
	createGround( scene );

	// 6. Overgrown details (pillars, rocks, glowing flora)
	createOvergrowth( scene );

	// 7. Foliage (grass, trees)
	createFoliage( scene );

	// 8. Player cube
	const cubey = new Cubey( scene );

	// 9. Shadow-casting lights
	createShadows( scene, { shadowMapSize: engine.shadowMapSize } );

	// 10. Animated orbiting lights
	const animatedLights = new AnimatedLights( scene );

	console.log( '[TestScene] Scene build complete.' );

	return { cubey, animatedLights };
}