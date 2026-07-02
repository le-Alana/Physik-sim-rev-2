/**
 * @file Sky — Gradient sky dome with glowing sun disc
 *
 * Creates a stylised Rayman-style sky:
 *   - Large inverted sphere with vertex colour gradient
 *   - Glowing sun disc (billboarded sprite with emissive material)
 *
 * @dependency three — SphereGeometry, Mesh, MeshBasicNodeMaterial, Sprite, SpriteMaterial
 * @dependency three/tsl — Fn, vec3, positionWorld, mix, sin, time
 */

import { SphereGeometry, BackSide, Mesh, Sprite, SpriteMaterial, AdditiveBlending, CanvasTexture } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, vec3, positionWorld, mix, sin, time } from 'three/tsl';

/**
 * Adds a procedural gradient sky and glowing sun to the scene.
 * @param {import('three').Scene} scene
 */
export function createSky( scene ) {

	// ── Gradient sky dome ──────────────────────────────────────────
	// Large inverted sphere with a node-based gradient colour
	const skyGeo = new SphereGeometry( 500, 32, 24 );
	const skyMat = new MeshBasicNodeMaterial( { side: BackSide } );

	// TSL gradient: warm peach at horizon → light blue at zenith
	const skyGradient = Fn( () => {

		const h = positionWorld.y.add( 500 ).div( 1000 ); // normalise height for radius 500
		const horizonColor = vec3( 1.0, 0.8, 0.6 );      // warm peach
		const zenithColor = vec3( 0.6, 0.85, 1.0 );      // light blue

		// Animate a subtle colour shift
		const shift = sin( time.mul( 0.05 ) ).mul( 0.05 );
		const color = mix( horizonColor, zenithColor, h.add( shift ) );

		return color;

	} );

	skyMat.colorNode = skyGradient();
	const sky = new Mesh( skyGeo, skyMat );
	sky.name = 'SkyDome';
	sky.renderOrder = -1; // render behind everything
	sky.material.depthWrite = false; // don't write to depth buffer
	scene.add( sky );

	// ── Sun disc ───────────────────────────────────────────────────
	// A bright emissive sprite that always faces the camera
	const sunCanvas = document.createElement( 'canvas' );
	sunCanvas.width = 128;
	sunCanvas.height = 128;
	const ctx = sunCanvas.getContext( '2d' );

	// Draw a soft glowing circle
	const gradient = ctx.createRadialGradient( 64, 64, 0, 64, 64, 64 );
	gradient.addColorStop( 0, 'rgba(255, 240, 200, 1)' );
	gradient.addColorStop( 0.3, 'rgba(255, 200, 100, 0.8)' );
	gradient.addColorStop( 0.6, 'rgba(255, 150, 50, 0.3)' );
	gradient.addColorStop( 1, 'rgba(255, 150, 50, 0)' );
	ctx.fillStyle = gradient;
	ctx.fillRect( 0, 0, 128, 128 );

	const sunTexture = new CanvasTexture( sunCanvas );

	const sunMat = new SpriteMaterial( {
		map: sunTexture,
		blending: AdditiveBlending,
		depthWrite: false,
		transparent: true,
	} );

	const sun = new Sprite( sunMat );
	sun.scale.set( 25, 25, 1 );
	sun.position.set( 30, 60, -80 );
	sun.name = 'Sun';
	scene.add( sun );
}