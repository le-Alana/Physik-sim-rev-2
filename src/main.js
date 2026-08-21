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
import { Timer, PCFSoftShadowMap, Mesh, BoxGeometry, MeshStandardMaterial, Color } from 'three';
import { getPhysicsEngine, physicsConfig, cubes, UPDATE_INTERVAL } from './engine/PhysicsEngine.js';

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

	// ── Physics engine ───────────────────────────────────────────
	const physicsEngine = getPhysicsEngine();

	// Create a second cube with different color
	const friendGeo = new BoxGeometry( physicsConfig.cubeSize, physicsConfig.cubeSize, physicsConfig.cubeSize );
	const friendMat = new MeshStandardMaterial( { color: new Color( 0xff6b9d ), roughness: 0.4, metalness: 0.3 } );
	const friendMesh = new Mesh( friendGeo, friendMat );
	friendMesh.position.set( 3, 0.02, 0 ); // same height as cubey
	friendMesh.name = 'CubeyFriend';
	friendMesh.castShadow = true;
	friendMesh.receiveShadow = true;
	sceneManager.scene.add( friendMesh );

	// Store for physics access
	window.cubeMeshes = { cubey: cubey.mesh, friend: friendMesh };
	physicsEngine.storeInitialPositions();

	// ── Dance floor boundary ─────────────────────────────────────
	const floorSize = boundarySize * 2;
	const floorGeo = new BoxGeometry( floorSize, 0.1, floorSize );
	const floorMat = new MeshStandardMaterial( { color: new Color( 0x2a2a3e ), roughness: 0.8, metalness: 0.2 } );
	const danceFloor = new Mesh( floorGeo, floorMat );
	danceFloor.position.y = -5;
	danceFloor.name = 'DanceFloor';
	danceFloor.receiveShadow = true;
	sceneManager.scene.add( danceFloor );

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

	// ── FPS tracking ─────────────────────────────────────────────
	let frameCount = 0;
	let lastFpsUpdate = performance.now();
	let currentFps = 0;

	// ── Render loop ────────────────────────────────────────────────
	function animate( timestamp ) {

		timer.update();
		const dt = timer.getDelta();
		const elapsed = timer.getElapsed();

		// Update physics is handled by its own loop (started by button)
		// physicsEngine.update( timestamp * 1000 ); // managed internally

		// Update player cube input (for user movement if you want)
		cubey.update( dt );

		// Update animated lights
		animatedLights.update( elapsed );

		// Update camera controls and render the scene
		sceneManager.controls.update();
		engine.renderer.render( sceneManager.scene, sceneManager.camera );

		// FPS calculation
		frameCount++;
		if ( timestamp - lastFpsUpdate >= 500 ) {
			currentFps = Math.min( Math.round( frameCount / ( ( timestamp - lastFpsUpdate ) / 1000 ) ), 60 );
			frameCount = 0;
			lastFpsUpdate = timestamp;
			updateFpsDisplay( currentFps );
		}

		requestAnimationFrame( animate );
	}

	animate();

	console.log( '[main] Render loop started' );

	// ── Expose physics config and cubes to UI ────────────────────
	window.physicsConfig = physicsConfig;
	window.cubes = cubes;
	window.boundarySize = boundarySize;
	window.physicsEngine = physicsEngine;
	window.UPDATE_INTERVAL = UPDATE_INTERVAL;

	window.startPhysics = () => {
		// Velocities are read from the speed/direction sliders in physicsEngine.reset()
		physicsEngine.start();
	};
	window.stopPhysics = () => physicsEngine.stop();
	window.setCubePosition = physicsEngine.setCubePosition.bind( physicsEngine );
	window.setCubeVelocity = physicsEngine.setCubeVelocity.bind( physicsEngine );
	window.getCubeVelocity = physicsEngine.getCubeVelocity.bind( physicsEngine );
	window.checkCollision = () => physicsEngine.checkCollision();

	// ── FPS display update ───────────────────────────────────────
	window.updateFpsDisplay = ( fps ) => {
		const fpsBar = document.getElementById( 'fps-bar-fill' );
		const fpsText = document.getElementById( 'fps-text' );
		if ( fpsBar && fpsText ) {
			const pct = ( fps / 60 ) * 100;
			fpsBar.style.width = pct + '%';
			fpsText.textContent = fps + ' FPS';
			// Color coding
			if ( fps >= 55 ) fpsBar.style.backgroundColor = '#4ade80';
			else if ( fps >= 30 ) fpsBar.style.backgroundColor = '#fbbf24';
			else fpsBar.style.backgroundColor = '#f87171';
		}
	};

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