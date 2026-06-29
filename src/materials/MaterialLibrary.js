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
 * @dependency three/tsl — vec3
 */

import { createPBRMaterial } from './PBRMaterialBuilder.js';
import { createWearNode } from '../shaders/WearNode.js';
import { createOvergrowthNode } from '../shaders/OvergrowthNode.js';
import { vec3 } from 'three/tsl';

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
}

// Export singleton
export default new MaterialLibrary();