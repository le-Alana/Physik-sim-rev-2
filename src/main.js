/**
 * @file main.js — Application bootstrap and render loop
 *
 * This is the entry point of the Physik Sim WebGPU renderer.
 * It initialises the engine, builds the test scene, and runs
 * the animation loop.
 *
 * Flow:
 *   Engine.init() → SceneManager → buildTestScene() → PostProcessing → loop
 *
 * @dependency ./engine/Engine — Engine
 * @dependency ./engine/SceneManager — SceneManager
 * @dependency ./engine/PostProcessing — createPostProcessing
 * @dependency ./scene/TestScene — buildTestScene
 * @dependency three — Clock
 */

import Engine from './engine/Engine.js';
import SceneManager from './engine/SceneManager.js';
import { buildTestScene } from './scene/TestScene.js';
import { createPostProcessing } from './engine/PostProcessing.js';
import { Timer, PCFSoftShadowMap } from 'three';

(async () => {

	'use strict';

	// ── Get the canvas ─────────────────────────────────────────────
	const canvas = document.getElementById( 'renderCanvas' );

	// ── Initialise engine ──────────────────────────────────────────
	const engine = new Engine( canvas );
	await engine.init();

	console.log( `[main] Engine initialised (mobile: ${engine.isMobile}, shadowMapSize: ${engine.shadowMapSize})` );

	// Enable PCFSoft shadows
	engine.renderer.shadowMap.enabled = true;
	engine.renderer.shadowMap.type = PCFSoftShadowMap;

	// ── Scene manager ──────────────────────────────────────────────
	const sceneManager = new SceneManager( 60, 0.1, 150 );
	sceneManager.updateAspect( window.innerWidth, window.innerHeight );

	// ── Build the test scene ───────────────────────────────────────
	const { cubey, animatedLights } = buildTestScene(
		sceneManager.scene,
		engine
	);

	// ── Post-processing ────────────────────────────────────────────
	// Create post-processing pipeline (SSR + GTAO + Bloom).
	// Quality is scaled for mobile.
	let postProcessing = null;
	try {
		postProcessing = createPostProcessing(
			engine.renderer,
			sceneManager.scene,
			sceneManager.camera,
			{
				enableSSR: !engine.isMobile,  // SSR is expensive on mobile
				enableAO: true,
				enableBloom: true,
				qualityScale: engine.qualityScale,
			}
		);
		console.log( '[main] Post-processing enabled' );
	} catch ( err ) {
		console.warn( '[main] Post-processing setup failed, rendering without:', err.message );
	}

	// ── Clock for delta time ───────────────────────────────────────
	const timer = new Timer();

	// ── Render loop ────────────────────────────────────────────────
	function animate() {

		timer.update();
		const dt = timer.getDelta();
		const elapsed = timer.getElapsed();

		// Update player cube
		cubey.update( dt );

		// Update animated lights
		animatedLights.update( elapsed );

		// Update camera controls and render the scene
		sceneManager.controls.update();
		engine.renderer.render( sceneManager.scene, sceneManager.camera );

		requestAnimationFrame( animate );
	}

	animate();

	console.log( '[main] Render loop started' );

	// ── Handle resize ──────────────────────────────────────────────
	window.addEventListener( 'resize', () => {
		const w = window.innerWidth;
		const h = window.innerHeight;
		sceneManager.updateAspect( w, h );
		if ( postProcessing ) {
			postProcessing.setSize( w, h );
		}
	} );

})();