/**
 * @file TestScene — Scene orchestrator
 *
 * Calls all scene-building functions in the correct order.
 * This is the single entry point for constructing the entire scene.
 *
 * Order matters:
 *   1. Environment (ambient + hemisphere lights, fog)
 *   2. Terrain (height-mapped ground below dance floor)
 *   3. Sky (gradient dome + sun)
 *   4. Clouds (volumetric clusters)
 *   5. Mountains (Rayman-style floating, organic shapes)
 *   6. Ground (reflective dance floor with running lights)
 *   7. Overgrowth (organic pillars, faceted rocks, detailed mushrooms)
 *   8. NatureDetails (hanging roots, fallen logs, flowers, vines, moss)
 *   9. Foliage (blade grass, branched trees, shrubs)
 *   10. Cubey (beveled player cube)
 *   11. Shadows (directional lights)
 *   12. AnimatedLights (orbiting point lights)
 *
 * @dependency ./Environment — createEnvironment
 * @dependency ./Terrain — createTerrain
 * @dependency ./Sky — createSky
 * @dependency ./Clouds — createClouds
 * @dependency ./Mountains — createMountains
 * @dependency ./Ground — createGround
 * @dependency ./Overgrowth — createOvergrowth
 * @dependency ./NatureDetails — createNatureDetails
 * @dependency ./Foliage — createFoliage
 * @dependency ./Cubey — Cubey (class)
 * @dependency ../effects/ShadowManager — createShadows
 * @dependency ../effects/AnimatedLights — AnimatedLights (class)
 */

import { createEnvironment } from './Environment.js';
import { createTerrain } from './Terrain.js';
import { createSky } from './Sky.js';
import { createClouds } from './Clouds.js';
import { createMountains } from './Mountains.js';
import { createGround } from './Ground.js';
import { createOvergrowth } from './Overgrowth.js';
import { createNatureDetails } from './NatureDetails.js';
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

	// 2. Terrain (height-mapped ground below dance floor)
	createTerrain( scene );

	// 3. Sky dome + sun
	createSky( scene );

	// 4. Volumetric cloud clusters
	createClouds( scene );

	// 5. Organic floating mountains (returns positions for root attachment)
	const mountainPositions = createMountains( scene );

	// 6. Reflective dance floor with running lights (sits on terrain)
	createGround( scene );

	// 7. Overgrown details (organic pillars, faceted rocks, detailed mushrooms)
	createOvergrowth( scene );

	// 8. Nature details (roots, fallen logs, flowers, vines, moss)
	createNatureDetails( scene, { mountainPositions } );

	// 9. Foliage (blade grass, branched trees, shrubs) — opaque, textured
	createFoliage( scene );

	// 10. Player cube (beveled/rounded)
	const cubey = new Cubey( scene );

	// 11. Shadow-casting lights
	createShadows( scene, { shadowMapSize: engine.shadowMapSize } );

	// 12. Animated orbiting lights
	const animatedLights = new AnimatedLights( scene );

	console.log( '[TestScene] Scene build complete.' );

	return { cubey, animatedLights };
}