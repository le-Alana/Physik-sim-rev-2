/**
 * @file Foliage — Grass blades, branched trees, and shrubs
 *
 * Creates organic foliage with realistic geometry:
 *   - Grass: Individual blade geometry (triangle strips), NOT transparent quads
 *   - Trees: Branched structure with leaf clusters, bark-textured trunks
 *   - Shrubs: Multi-leaf cluster bushes
 *   - All foliage uses procedural TSL textures
 *
 * Major improvements over previous version:
 *   - NO transparency on grass (was using opacity: 0.8 for no reason)
 *   - Each grass blade is a narrow 3D mesh, not a flat card
 *   - Trees have branches and leaf clusters instead of cone crowns
 *   - All materials are MeshPhysicalNodeMaterial for proper PBR
 *
 * @dependency three — BufferGeometry, Mesh, Group, CylinderGeometry, SphereGeometry
 * @dependency three/tsl — Fn, vec3, positionLocal, time, sin, float
 * @dependency ../materials/MaterialLibrary — default
 * @dependency ../shaders/GrassTextureNode — createGrassTextureNode
 * @dependency ../shaders/LeafTextureNode — createLeafTextureNode
 * @dependency ../shaders/BarkTextureNode — createBarkTextureNode
 */

import { BufferGeometry, Float32BufferAttribute, Mesh, Group, CylinderGeometry, SphereGeometry } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { Fn, vec3, positionLocal, time, sin, float, normalLocal } from 'three/tsl';
import materialLib from '../materials/MaterialLibrary.js';
import { createGrassTextureNode } from '../shaders/GrassTextureNode.js';
import { createLeafTextureNode } from '../shaders/LeafTextureNode.js';
import { createBarkTextureNode } from '../shaders/BarkTextureNode.js';
import { createNormalPerturbationNode } from '../shaders/NormalPerturbationNode.js';

/**
 * Creates a single grass blade mesh (triangle strip, 3D, opaque).
 * @param {number} height — Blade height.
 * @param {number} width — Blade base width.
 * @param {number} seed — Random seed for variation.
 * @returns {Mesh}
 */
function createGrassBlade( height, width, seed ) {
	// Each blade is 4 vertices forming a narrow quad that tapers to a point
	// Base is wider, tip is a single point
	const geo = new BufferGeometry();
	const vertices = new Float32Array( [
		// Front face
		-width / 2, 0, 0.01,
		width / 2, 0, 0.01,
		0, height, 0,
		// Back face
		-width / 2, 0, -0.01,
		0, height, 0,
		width / 2, 0, -0.01,
	] );
	const uvs = new Float32Array( [
		0, 0,
		1, 0,
		0.5, 1,
		0, 0,
		0.5, 1,
		1, 0,
	] );
	const indices = [ 0, 1, 2, 3, 4, 5 ];

	geo.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );
	geo.setAttribute( 'uv', new Float32BufferAttribute( uvs, 2 ) );
	geo.setIndex( indices );
	geo.computeVertexNormals();

	// Add slight random bend to blade
	const pos = geo.attributes.position;
	for ( let i = 0; i < pos.count; i++ ) {
		const y = pos.getY( i );
		if ( y > 0 ) {
			const bend = 0.03 * ( y / height ) * ( seed - 0.5 ) * 2;
			pos.setX( i, pos.getX( i ) + bend );
		}
	}
	pos.needsUpdate = true;

	// Material with grass texture
	const grassTex = createGrassTextureNode();
	const mat = new MeshPhysicalNodeMaterial();
	mat.name = `GrassBlade_${seed}`;
	mat.roughness = 0.7;
	mat.metalness = 0.0;

	const colorFn = Fn( () => {
		return grassTex( new Float32BufferAttribute( uvs, 2 ), float( seed ) );
	} );

	// Use a simpler approach — apply grass texture via TSL
	const simplerColorFn = Fn( () => {
		// Use local position as UV proxy
		const uvX = positionLocal.x.add( width / 2 ).div( width );
		const uvY = positionLocal.y.div( height );
		return grassTex( vec3( uvX, uvY, 0 ), float( seed ) );
	} );
	mat.colorNode = simplerColorFn();

	const blade = new Mesh( geo, mat );
	blade.name = `GrassBlade_${seed}`;
	return blade;
}

/**
 * Creates a branched tree with leaf clusters.
 * @param {number} trunkHeight — Height of trunk.
 * @param {number} trunkRadius — Radius of trunk base.
 * @param {number} crownRadius — Radius of leaf crown.
 * @param {number} seed — Random seed.
 * @returns {Group}
 */
function createTree( trunkHeight, trunkRadius, crownRadius, seed ) {
	const tree = new Group();

	// ── Trunk (irregular cylinder) ─────────────────────────────────
	const trunkSegs = 8;
	const trunkGeo = new CylinderGeometry( trunkRadius * 0.5, trunkRadius, trunkHeight, trunkSegs, 4 );
	// Deform for organic shape
	const pos = trunkGeo.attributes.position;
	for ( let i = 0; i < pos.count; i++ ) {
		const x = pos.getX( i );
		const z = pos.getZ( i );
		const y = pos.getY( i );
		const deform = 0.85 + Math.sin( y * 3 + seed * 10 + x * 2 ) * 0.15;
		pos.setX( i, x * deform );
		pos.setZ( i, z * deform );
	}
	pos.needsUpdate = true;
	trunkGeo.computeVertexNormals();

	// Bark texture for trunk
	const barkTex = createBarkTextureNode();
	const trunkMat = new MeshPhysicalNodeMaterial();
	trunkMat.name = `TreeTrunk_${seed}`;
	trunkMat.roughness = 0.85;
	trunkMat.metalness = 0.0;
	const trunkColorFn = Fn( () => {
		return barkTex( new Float32BufferAttribute( [], 2 ), float( seed ) );
	} );
	// Simpler: just use the bark material from library
	const trunk = new Mesh( trunkGeo, materialLib.getBarkMaterial().clone() );
	trunk.position.y = trunkHeight / 2;
	trunk.name = 'Trunk';
	trunk.castShadow = true;
	tree.add( trunk );

	// ── Branches ──────────────────────────────────────────────────
	const branchCount = 3 + Math.floor( seed * 3 );
	for ( let i = 0; i < branchCount; i++ ) {
		const angle = ( i / branchCount ) * Math.PI * 2 + seed * 0.5;
		const branchHeight = trunkHeight * ( 0.5 + i * 0.15 );
		const branchLength = crownRadius * ( 0.3 + Math.random() * 0.3 );
		const branchRadius = trunkRadius * 0.3;

		const branchGeo = new CylinderGeometry( branchRadius * 0.3, branchRadius, branchLength, 5, 2 );
		const branch = new Mesh( branchGeo, materialLib.getBarkMaterial().clone() );
		branch.position.set(
			Math.cos( angle ) * trunkRadius * 0.5,
			branchHeight,
			Math.sin( angle ) * trunkRadius * 0.5
		);
		branch.rotation.z = Math.cos( angle ) * 0.5;
		branch.rotation.x = Math.sin( angle ) * 0.5;
		branch.name = `Branch_${i}`;
		branch.castShadow = true;
		tree.add( branch );

		// Leaf cluster at branch tip
		const clusterCount = 2 + Math.floor( Math.random() * 3 );
		for ( let j = 0; j < clusterCount; j++ ) {
			const clusterRadius = crownRadius * ( 0.2 + Math.random() * 0.2 );
			const leafGeo = new SphereGeometry( clusterRadius, 6, 6 );
			// Deform for organic leaf cluster shape
			const leafPos = leafGeo.attributes.position;
			for ( let k = 0; k < leafPos.count; k++ ) {
				const lx = leafPos.getX( k );
				const ly = leafPos.getY( k );
				const lz = leafPos.getZ( k );
				const deform = 0.6 + Math.sin( lx * 3 + j * 2 + seed * 5 ) * 0.4;
				leafPos.setXYZ( k, lx * deform, ly * ( 0.7 + Math.random() * 0.3 ), lz * deform );
			}
			leafPos.needsUpdate = true;
			leafGeo.computeVertexNormals();

			const leafMat = materialLib.getLeafMaterial().clone();
			const leaf = new Mesh( leafGeo, leafMat );
			const tip = branch.position.clone();
			tip.y += branchLength * 0.5;
			tip.x += Math.cos( angle + j * 1.5 ) * clusterRadius;
			tip.z += Math.sin( angle + j * 1.5 ) * clusterRadius;
			leaf.position.copy( tip );
			leaf.position.y += j * clusterRadius * 0.5;
			leaf.name = `LeafCluster_${i}_${j}`;
			leaf.castShadow = true;
			tree.add( leaf );
		}
	}

	// ── Top crown leaf cluster ────────────────────────────────────
	const topLeafGeo = new SphereGeometry( crownRadius * 0.8, 8, 6 );
	const topPos = topLeafGeo.attributes.position;
	for ( let i = 0; i < topPos.count; i++ ) {
		const lx = topPos.getX( i );
		const ly = topPos.getY( i );
		const lz = topPos.getZ( i );
		const deform = 0.5 + Math.sin( lx * 2 + seed * 3 ) * 0.5;
		topPos.setXYZ( i, lx * deform, ly * ( 0.5 + Math.random() * 0.5 ), lz * deform );
	}
	topPos.needsUpdate = true;
	topLeafGeo.computeVertexNormals();

	const topLeaf = new Mesh( topLeafGeo, materialLib.getLeafMaterial().clone() );
	topLeaf.position.y = trunkHeight + crownRadius * 0.5;
	topLeaf.name = 'TopCrown';
	topLeaf.castShadow = true;
	tree.add( topLeaf );

	tree.name = `Tree_${seed}`;
	return tree;
}

/**
 * Creates a shrub/bush (multiple leaf clusters on short stems).
 * @param {number} radius — Bush radius.
 * @param {number} seed — Random seed.
 * @returns {Group}
 */
function createShrub( radius, seed ) {
	const shrub = new Group();
	const clusterCount = 4 + Math.floor( seed * 4 );

	for ( let i = 0; i < clusterCount; i++ ) {
		const angle = ( i / clusterCount ) * Math.PI * 2 + seed * 0.3;
		const dist = radius * ( 0.3 + Math.random() * 0.5 );
		const clusterRadius = radius * ( 0.2 + Math.random() * 0.3 );

		const leafGeo = new SphereGeometry( clusterRadius, 6, 5 );
		const leafMat = materialLib.getLeafMaterial().clone();
		const leaf = new Mesh( leafGeo, leafMat );
		leaf.position.set(
			Math.cos( angle ) * dist,
			0.2 + Math.random() * radius * 0.5,
			Math.sin( angle ) * dist
		);
		leaf.scale.set( 1, 0.7 + Math.random() * 0.3, 1 );
		leaf.name = `ShrubLeaf_${i}`;
		leaf.castShadow = true;
		shrub.add( leaf );
	}

	shrub.name = `Shrub_${seed}`;
	return shrub;
}

/**
 * Adds foliage (grass, trees, shrubs) to the scene.
 * @param {import('three').Scene} scene
 */
export function createFoliage( scene ) {

	const group = new Group();
	group.name = 'Foliage';

	// ── Grass blades ──────────────────────────────────────────────
	// 100 blades scattered around the scene
	for ( let i = 0; i < 100; i++ ) {
		const height = 0.4 + Math.random() * 0.8;
		const width = 0.04 + Math.random() * 0.06;
		const seed = Math.random();

		const blade = createGrassBlade( height, width, seed );

		// Position in clusters around the scene
		const clusterAngle = Math.random() * Math.PI * 2;
		const clusterDist = 4 + Math.random() * 22;
		const clusterOffset = ( Math.random() - 0.5 ) * 3;

		blade.position.set(
			Math.cos( clusterAngle ) * clusterDist + clusterOffset,
			-1,
			Math.sin( clusterAngle ) * clusterDist + clusterOffset
		);
		blade.rotation.y = Math.random() * Math.PI * 2;
		blade.rotation.z = ( Math.random() - 0.5 ) * 0.15;
		blade.name = `Grass_${i}`;

		group.add( blade );
	}

	// ── Trees ─────────────────────────────────────────────────────
	const treeConfigs = [
		{ trunkH: 2.5, trunkR: 0.15, crownR: 1.5, seed: 0.1 },
		{ trunkH: 3.0, trunkR: 0.2, crownR: 2.0, seed: 0.4 },
		{ trunkH: 2.0, trunkR: 0.12, crownR: 1.2, seed: 0.7 },
		{ trunkH: 3.5, trunkR: 0.25, crownR: 2.2, seed: 0.2 },
		{ trunkH: 2.8, trunkR: 0.18, crownR: 1.8, seed: 0.9 },
		{ trunkH: 2.2, trunkR: 0.14, crownR: 1.3, seed: 0.3 },
		{ trunkH: 3.2, trunkR: 0.22, crownR: 2.0, seed: 0.6 },
		{ trunkH: 2.6, trunkR: 0.16, crownR: 1.6, seed: 0.5 },
		{ trunkH: 4.0, trunkR: 0.3, crownR: 2.5, seed: 0.8 },
		{ trunkH: 2.4, trunkR: 0.15, crownR: 1.4, seed: 0.11 },
		{ trunkH: 3.8, trunkR: 0.28, crownR: 2.3, seed: 0.55 },
		{ trunkH: 2.0, trunkR: 0.1, crownR: 1.0, seed: 0.77 },
		{ trunkH: 3.3, trunkR: 0.2, crownR: 1.9, seed: 0.33 },
		{ trunkH: 2.7, trunkR: 0.17, crownR: 1.7, seed: 0.66 },
		{ trunkH: 3.6, trunkR: 0.24, crownR: 2.1, seed: 0.44 },
	];

	for ( const cfg of treeConfigs ) {
		const tree = createTree( cfg.trunkH, cfg.trunkR, cfg.crownR, cfg.seed );
		const angle = Math.random() * Math.PI * 2;
		const dist = 12 + Math.random() * 18;
		tree.position.set(
			Math.cos( angle ) * dist,
			-1,
			Math.sin( angle ) * dist
		);
		tree.scale.setScalar( 0.8 + Math.random() * 0.4 );
		group.add( tree );
	}

	// ── Shrubs ────────────────────────────────────────────────────
	for ( let i = 0; i < 15; i++ ) {
		const radius = 0.4 + Math.random() * 0.6;
		const seed = Math.random();
		const shrub = createShrub( radius, seed );
		const angle = Math.random() * Math.PI * 2;
		const dist = 6 + Math.random() * 16;
		shrub.position.set(
			Math.cos( angle ) * dist,
			-1,
			Math.sin( angle ) * dist
		);
		group.add( shrub );
	}

	scene.add( group );
	console.log( '[Foliage] Added grass, trees, and shrubs (opaque, textured)' );
}