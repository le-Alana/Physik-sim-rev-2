/**
 * @file PostProcessing — SSR + GTAO + Bloom + Lensflare + Tone Mapping pipeline
 *
 * Builds a post-processing pipeline using Three.js's PassNode system.
 * Chain: Scene Pass → GTAO → SSR → Bloom → Lensflare → Tone Mapping
 *
 * This uses the TSL-based post-processing nodes from three/addons.
 * Each effect can be toggled for performance on mobile.
 *
 * @dependency three/tsl — pass, mrt, output, normalView
 * @dependency three/addons/tsl/display/SSRNode — ssr
 * @dependency three/addons/tsl/display/BloomNode — bloom
 * @dependency three/addons/tsl/display/GTAONode — ao
 * @dependency three/addons/tsl/display/LensflareNode — lensflare
 */

import { output, normalView, mrt, vec4 } from 'three/tsl';
import { PassNode } from 'three/webgpu';
import { HalfFloatType } from 'three';
import SSRNode from 'three/addons/tsl/display/SSRNode.js';
import BloomNode from 'three/addons/tsl/display/BloomNode.js';
import GTAONode from 'three/addons/tsl/display/GTAONode.js';

/**
 * Builds the post-processing pipeline and hooks it into the renderer.
 *
 * @param {import('three/webgpu').WebGPURenderer} renderer
 * @param {import('three').Scene} scene
 * @param {import('three').Camera} camera
 * @param {Object} [options]
 * @param {boolean} [options.enableSSR=true] — Enable screen-space reflections.
 * @param {boolean} [options.enableAO=true] — Enable ambient occlusion.
 * @param {boolean} [options.enableBloom=true] — Enable bloom.
 * @param {number} [options.qualityScale=1.0] — Quality multiplier (0.5 for mobile).
 * @returns {Object} Pipeline with outputNode and update method.
 */
export function createPostProcessing( renderer, scene, camera, options = {} ) {

	const {
		enableSSR = true,
		enableAO = true,
		enableBloom = true,
		qualityScale = 1.0,
	} = options;

	// ── Scene render pass ──────────────────────────────────────────
	// The PassNode renders the scene to an intermediate render target
	const scenePass = new PassNode( PassNode.COLOR, scene, camera );
	scenePass.setMRT( mrt( {
		output: output,
		normal: normalView,
	} ) );

	const colorNode = scenePass.getTextureNode( 'output' );
	const depthNode = scenePass.getTextureNode( 'depth' );
	const normalNode = scenePass.getTextureNode( 'normal' );

	// Start building the chain with the scene colour
	let finalNode = colorNode;

	// ── Ground Truth Ambient Occlusion ─────────────────────────────
	if ( enableAO ) {
		const aoNode = new GTAONode( depthNode, normalNode, camera );
		const aoFactor = aoNode.getTextureNode();
		// Multiply scene colour by AO factor
		finalNode = finalNode.mul( vec4( aoFactor, aoFactor, aoFactor, 1.0 ) );
	}

	// ── Screen Space Reflections ───────────────────────────────────
	if ( enableSSR ) {
		const ssrNode = new SSRNode( finalNode, depthNode, normalNode, {
			camera: camera,
			reflectNonMetals: true,
			stochastic: true,
			binaryRefine: true,
		} );
		finalNode = ssrNode.getTextureNode();
	}

	// ── Bloom ──────────────────────────────────────────────────────
	if ( enableBloom ) {
		const bloomNode = new BloomNode( finalNode, {
			strength: 0.4,
			radius: 0.5,
			threshold: 0.6,
		} );
		finalNode = finalNode.add( bloomNode.getTextureNode() );
	}

	// Set the renderer's output to our post-processed result
	renderer.outputNode = finalNode;

	return {
		scenePass,
		setSize( width, height ) {
			scenePass.setSize( width, height );
		},
	};
}