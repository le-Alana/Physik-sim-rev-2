/**
 * @file MaterialLibrary — Central registry for all scene materials
 *
 * Pre-builds and caches all materials used by scene objects.
 * Other modules call methods like `getDanceFloorMaterial()` to get
 * a shared material instance.
 *
 * @dependency ./PBRMaterialBuilder — createPBRMaterial
 * @dependency ../shaders/WearNode — createWearNode
 * @dependency ../shaders/OvergrowthNode — createOvergrowthNode
 * @dependency ../shaders/GrassTextureNode — createGrassTextureNode
 * @dependency ../shaders/LeafTextureNode — createLeafTextureNode
 * @dependency ../shaders/GroundTextureNode — createGroundTextureNode
 * @dependency ../shaders/BarkTextureNode — createBarkTextureNode
 * @dependency ../shaders/NormalPerturbationNode — createNormalPerturbationNode
 * @dependency three/tsl — vec3, Fn, uv, float
 */

import { createPBRMaterial } from './PBRMaterialBuilder.js';
import { createWearNode } from '../shaders/WearNode.js';
import { createOvergrowthNode } from '../shaders/OvergrowthNode.js';
import { createGrassTextureNode } from '../shaders/GrassTextureNode.js';
import { createLeafTextureNode } from '../shaders/LeafTextureNode.js';
import { createGroundTextureNode } from '../shaders/GroundTextureNode.js';
import { createBarkTextureNode } from '../shaders/BarkTextureNode.js';
import { createNormalPerturbationNode } from '../shaders/NormalPerturbationNode.js';
import { vec3, Fn, uv, float } from 'three/tsl';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';

/**
 * Singleton material library — caches materials by name.
 */
class MaterialLibrary {

	constructor() {
		/** @type {Map<string, MeshPhysicalNodeMaterial>} */
		this._cache = new Map();
	}

	/**
	 * Returns a cached material or builds it.
	 * @param {string} name
	 * @param {Function} builderFn — Called once to create the material if not cached.
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	_getOrCreate( name, builderFn ) {
		if ( !this._cache.has( name ) ) {
			this._cache.set( name, builderFn() );
		}
		return this._cache.get( name );
	}

	/**
	 * Reflective dance floor material — metallic, with wear scratches.
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	getDanceFloorMaterial() {
		return this._getOrCreate( 'danceFloor', () => {
			return createPBRMaterial( {
				name: 'Dance Floor',
				color: 0x88bbff,
				roughness: 0.15,
				metalness: 0.9,
				clearcoat: 0.3,
				wearNode: createWearNode( { scratchCount: 12, strength: 0.3 } ),
				wornColor: [ 0.5, 0.6, 0.8 ],
			} );
		} );
	}

	/**
	 * Rayman-style mountain material — pastel gradient, non-metallic, no wear.
	 * Color is set per-vertex via our MountainColorNode in the scene object instead.
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	getMountainMaterial() {
		return this._getOrCreate( 'mountain', () => {
			return createPBRMaterial( {
				name: 'Mountain',
				color: 0xffccee,
				roughness: 0.7,
				metalness: 0.0,
				clearcoat: 0.1,
			} );
		} );
	}

	/**
	 * Rock material with moss overgrowth.
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	getRockMaterial() {
		return this._getOrCreate( 'rock', () => {
			return createPBRMaterial( {
				name: 'Rock',
				color: 0x887766,
				roughness: 0.9,
				metalness: 0.0,
				overgrowthNode: createOvergrowthNode( {
					mossAmount: 0.7,
					mossHeight: 0.8,
				} ),
				mossColor: [ 0.15, 0.45, 0.15 ],
			} );
		} );
	}

	/**
	 * Vine pillar material — dark with heavy overgrowth.
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	getVineMaterial() {
		return this._getOrCreate( 'vine', () => {
			return createPBRMaterial( {
				name: 'Vine Pillar',
				color: 0x554433,
				roughness: 0.8,
				metalness: 0.0,
				overgrowthNode: createOvergrowthNode( {
					mossAmount: 0.8,
					vineAmount: 0.5,
					mossHeight: 1.0,
				} ),
				mossColor: [ 0.1, 0.4, 0.1 ],
			} );
		} );
	}

	/**
	 * Player cube material — bright, slightly metallic, with wear.
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	getCubeyMaterial() {
		return this._getOrCreate( 'cubey', () => {
			return createPBRMaterial( {
				name: 'Cubey',
				color: 0xff6644,
				roughness: 0.3,
				metalness: 0.4,
				clearcoat: 0.2,
				wearNode: createWearNode( { scratchCount: 6, strength: 0.5 } ),
				wornColor: [ 0.7, 0.4, 0.3 ],
			} );
		} );
	}

	/**
	 * Glowing flora material — emissive, translucent.
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	getGlowFloraMaterial() {
		return this._getOrCreate( 'glowFlora', () => {
			return createPBRMaterial( {
				name: 'Glow Flora',
				color: 0x88ffaa,
				roughness: 0.6,
				metalness: 0.0,
				emissive: true,
				emissiveColor: [ 0.3, 0.8, 0.4 ],
				emissiveIntensity: 1.5,
			} );
		} );
	}

	/**
	 * Clean metallic material for accents.
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	getMetalAccentMaterial() {
		return this._getOrCreate( 'metalAccent', () => {
			return createPBRMaterial( {
				name: 'Metal Accent',
				color: 0xccddff,
				roughness: 0.1,
				metalness: 1.0,
				clearcoat: 0.5,
			} );
		} );
	}

	/**
	 * Grass blade material — uses GrassTextureNode for realistic blade pattern.
	 * Opaque, non-metallic, high roughness.
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	getGrassMaterial() {
		return this._getOrCreate( 'grass', () => {
			const grassTex = createGrassTextureNode();
			const mat = new MeshPhysicalNodeMaterial();
			mat.name = 'Grass';
			mat.roughness = 0.7;
			mat.metalness = 0.0;

			const colorFn = Fn( () => {
				return grassTex( uv(), float( 0.5 ) );
			} );
			mat.colorNode = colorFn();

			// Add normal perturbation for micro-detail
			const normalPerturb = createNormalPerturbationNode( { strength: 0.03, frequency: 12 } );
			const perturbedNormal = normalPerturb( null, null );
			mat.normalNode = perturbedNormal;

			return mat;
		} );
	}

	/**
	 * Leaf material — uses LeafTextureNode for vein pattern.
	 * Slightly rough, non-metallic, with subtle translucency.
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	getLeafMaterial() {
		return this._getOrCreate( 'leaf', () => {
			const leafTex = createLeafTextureNode();
			const mat = new MeshPhysicalNodeMaterial();
			mat.name = 'Leaf';
			mat.roughness = 0.6;
			mat.metalness = 0.0;
			mat.clearcoat = 0.1;

			const colorFn = Fn( () => {
				return leafTex( uv(), float( 0.5 ) );
			} );
			mat.colorNode = colorFn();

			return mat;
		} );
	}

	/**
	 * Ground/dirt material — uses GroundTextureNode for soil pattern.
	 * Very rough, non-metallic.
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	getGroundMaterial() {
		return this._getOrCreate( 'ground', () => {
			const groundTex = createGroundTextureNode();
			const mat = new MeshPhysicalNodeMaterial();
			mat.name = 'Ground';
			mat.roughness = 1.0;
			mat.metalness = 0.0;

			const colorFn = Fn( () => {
				return groundTex( uv(), vec3( 0 ) );
			} );
			mat.colorNode = colorFn();

			return mat;
		} );
	}

	/**
	 * Bark material — uses BarkTextureNode for tree trunk pattern.
	 * Rough, non-metallic.
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	getBarkMaterial() {
		return this._getOrCreate( 'bark', () => {
			const barkTex = createBarkTextureNode();
			const mat = new MeshPhysicalNodeMaterial();
			mat.name = 'Bark';
			mat.roughness = 0.85;
			mat.metalness = 0.0;

			const colorFn = Fn( () => {
				return barkTex( uv(), float( 0.5 ) );
			} );
			mat.colorNode = colorFn();

			return mat;
		} );
	}

	/**
	 * Root material — dark brown, very rough, no wear.
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	getRootMaterial() {
		return this._getOrCreate( 'root', () => {
			const mat = new MeshPhysicalNodeMaterial();
			mat.name = 'Root';
			mat.color.setHex( 0x443322 );
			mat.roughness = 1.0;
			mat.metalness = 0.0;
			return mat;
		} );
	}

	/**
	 * Flower petal material — colored, slightly rough, non-metallic.
	 * @param {number} r — Red component (0-1).
	 * @param {number} g — Green component (0-1).
	 * @param {number} b — Blue component (0-1).
	 * @returns {MeshPhysicalNodeMaterial}
	 */
	getFlowerPetalMaterial( r, g, b ) {
		// Not cached — colors vary per flower
		const mat = new MeshPhysicalNodeMaterial();
		mat.name = `FlowerPetal_${r}_${g}_${b}`;
		mat.color.setRGB( r, g, b );
		mat.roughness = 0.4;
		mat.metalness = 0.0;
		return mat;
	}
}

// Export singleton
export default new MaterialLibrary();
