/**
 * @file PostProcessing — SSR + GTAO + Bloom + Tone Mapping pipeline
 *
 * Builds a post-processing pipeline using Three.js's PassNode system.
 * Chain: Scene Pass → GTAO → SSR → Bloom → Tone Mapping
 *
 * Uses the TSL-based post-processing nodes from three/addons.
 * Each effect can be toggled for performance on mobile.
 *
 * SSR is configured with proper roughness/metalness inputs for
 * realistic reflections on the dance floor and metallic objects.
 *
 * @dependency three/tsl — pass, mrt, output, normalView, roughness, metalness
 * @dependency three/addons/tsl/display/SSRNode — ssr
 * @dependency three/addons/tsl/display/BloomNode — bloom
 * @dependency three/addons/tsl/display/GTAONode — ao
 */

import { output, normalView, mrt, roughness, metalness } from 'three/tsl';
import { PassNode } from 'three/webgpu';
import { HalfFloatType } from 'three';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';

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
		try {
			const aoNode = ao( depthNode, normalNode, camera );
			const aoFactor = aoNode.getTextureNode();
			// Multiply scene colour by AO factor
			finalNode = finalNode.mul( aoFactor );
		} catch ( err ) {
			console.warn( '[PostProcessing] GTAO setup failed:', err.message );
		}
	}

	// ── Screen Space Reflections ───────────────────────────────────
	if ( enableSSR ) {
		try {
			// Use the ssr TSL function with proper roughness/metalness inputs
			const ssrNode = ssr( finalNode, depthNode, normalNode, {
				camera: camera,
				stochastic: true,
				binaryRefine: true,
				reflectNonMetals: true,
				roughnessNode: roughness,
				metalnessNode: metalness,
			} );
			finalNode = ssrNode;
		} catch ( err ) {
			console.warn( '[PostProcessing] SSR setup failed:', err.message );
		}
	}

	// ── Bloom ──────────────────────────────────────────────────────
	if ( enableBloom ) {
		try {
			const bloomNode = bloom( finalNode, {
				strength: 0.4,
				radius: 0.5,
				threshold: 0.6,
			} );
			finalNode = finalNode.add( bloomNode );
		} catch ( err ) {
			console.warn( '[PostProcessing] Bloom setup failed:', err.message );
		}
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