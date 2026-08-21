/**
 * @file PBRMaterialBuilder — Factory for MeshPhysicalNodeMaterial
 *
 * Creates PBR materials with optional procedural wear and overgrowth.
 * All materials use Three.js's Node Material system for WebGPU compatibility.
 *
 * Supported features:
 *   - Roughness / Metalness
 *   - Normal mapping (via normalScale)
 *   - Clearcoat
 *   - Procedural wear (scratches)
 *   - Procedural overgrowth (moss/vines)
 *
 * @dependency three/webgpu — MeshPhysicalNodeMaterial
 * @dependency three/tsl — float, vec3, mix, uv, positionWorld
 * @dependency three — Color
 */

import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { float, vec3, mix, uv, positionWorld, normalLocal } from 'three/tsl';
import { Color } from 'three';
import { createNormalPerturbationNode } from '../shaders/NormalPerturbationNode.js';

/**
 * Builds a MeshPhysicalNodeMaterial with optional procedural layers.
 *
 * @param {Object} config
 * @param {string} config.name — Material name for debugging.
 * @param {number|Array} [config.color=0xffffff] — Base colour (hex or [r,g,b]).
 * @param {number} [config.roughness=0.5] — Roughness (0=mirror, 1=matte).
 * @param {number} [config.metalness=0.0] — Metalness (0=dielectric, 1=metal).
 * @param {number} [config.normalScale=1.0] — Normal map strength.
 * @param {number} [config.clearcoat=0] — Clearcoat layer intensity.
 * @param {number} [config.clearcoatRoughness=0.3] — Clearcoat roughness.
 * @param {boolean} [config.emissive=false] — Enable emissive glow?
 * @param {Array} [config.emissiveColor=[0,0,0]] — Emissive colour.
 * @param {number} [config.emissiveIntensity=1] — Emissive strength.
 * @param {Function|null} [config.wearNode=null] — TSL function returning wear factor [0,1].
 * @param {Function|null} [config.overgrowthNode=null] — TSL function returning overgrowth mask [0,1].
 * @param {Array} [config.wornColor=[0.6,0.55,0.5]] — Colour when worn (darker, desaturated).
 * @param {Array} [config.mossColor=[0.2,0.5,0.2]] — Moss colour.
 * @returns {MeshPhysicalNodeMaterial}
 */
export function createPBRMaterial( config ) {

	const {
		name = 'PBRMaterial',
		color = 0xffffff,
		roughness = 0.5,
		metalness = 0.0,
		normalScale = 1.0,
		clearcoat = 0,
		clearcoatRoughness = 0.3,
		emissive = false,
		emissiveColor = [ 0, 0, 0 ],
		emissiveIntensity = 1,
		wearNode = null,
		overgrowthNode = null,
		wornColor = [ 0.6, 0.55, 0.5 ],
		mossColor = [ 0.2, 0.5, 0.2 ],
	} = config;

	// ── Create material ─────────────────────────────────────────────
	const material = new MeshPhysicalNodeMaterial();
	material.name = name;
	material.roughness = roughness;
	material.metalness = metalness;
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.normalScale = normalScale;

	if ( emissive ) {
		const ec = new Color( ...emissiveColor );
		material.emissive = ec;
		material.emissiveIntensity = emissiveIntensity;
	}

	// ── Build colour node chain ─────────────────────────────────────
	// Convert hex colour to vec3 node
	const c = new Color( color );
	let colorNode = vec3( c.r, c.g, c.b );

	// Apply wear: mix pristine colour with worn colour
	if ( wearNode ) {
		const wearFactor = wearNode( uv() );
		const worn = vec3( wornColor[ 0 ], wornColor[ 1 ], wornColor[ 2 ] );
		colorNode = mix( colorNode, worn, wearFactor );
	}

	// Apply overgrowth: overlay moss colour
	if ( overgrowthNode ) {
		const growthFactor = overgrowthNode( positionWorld, uv() );
		const moss = vec3( mossColor[ 0 ], mossColor[ 1 ], mossColor[ 2 ] );
		colorNode = mix( colorNode, moss, growthFactor );
	}

	material.colorNode = colorNode;

	// ── Roughness variation from wear ───────────────────────────────
	if ( wearNode ) {
		const wearFactor = wearNode( uv() );
		material.roughnessNode = float( roughness ).add( wearFactor.mul( 0.3 ) );
	}

	// ── Normal perturbation for micro-detail ────────────────────────
	// Adds subtle high-frequency noise to normals for realistic surface detail.
	// Strength is lower for smooth surfaces (metals, clearcoat) and higher for rough ones.
	const normalPerturb = createNormalPerturbationNode( {
		strength: roughness > 0.5 ? 0.04 : 0.02,
		frequency: 10,
	} );
	material.normalNode = normalPerturb( normalLocal, positionWorld );

	return material;
}