/**
 * @file PhysicsEngine — Minimal physics loop template
 *
 * Provides a 10ms update loop where you can put your own physics code.
 *
 * Loop:
 *   - Every 10ms: updatePhysics(dt) is called with dt in seconds
 *   - Use cubes[name].velocity to get/set velocity
 *   - Use window.cubeMeshes[name].position to get/set position
 *   - Use setCubePosition(name, x, y, z) to move cubes directly
 *   - Use window.boundarySize for arena half-size
 *
 * @dependency three — Vector3
 */

import { Vector3 } from 'three';

/**
 * Physics variables exposed to UI and your custom code.
 */
export const physicsConfig = {
	friction: 0.0,
	cubeSize: 1.2,
	restitution: 1.0, // 1 = elastic, 0 = inelastic
};

/**
 * Cubes with weight and velocity.
 */
export const cubes = {
	cubey: {
		weight: 1.0,
		velocity: new Vector3( 0, 0, 0 ),
	},
	friend: {
		weight: 1.0,
		velocity: new Vector3( 0, 0, 0 ),
	},
};

/**
 * Arena half-size.
 */
export const boundarySize = 24;

/**
 * Fixed timestep in ms. Change if needed.
 */
export const UPDATE_INTERVAL = 10;

/**
 * Engine manages the loop. Use engine.start() / engine.stop().
 */
export default class PhysicsEngine {
	constructor() {
		this.lastUpdate = 0;
		this.running = false;
		this.collisionState = { colliding: false };
		// Store initial positions for reset
		this.initialPositions = {};
	}

	storeInitialPositions() {
		for ( const [ name, mesh ] of Object.entries( window.cubeMeshes || {} ) ) {
			this.initialPositions[ name ] = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
		}
	}

	reset() {
		// Reset cube positions and velocities
		for ( const [ name, pos ] of Object.entries( this.initialPositions ) ) {
			const mesh = window.cubeMeshes?.[ name ];
			if ( mesh ) mesh.position.set( pos.x, pos.y, pos.z );
			cubes[ name ].velocity.set( 0, 0, 0 );
		}
		this.collisionState.colliding = false;

		// Apply current slider velocities
		const applySliderVelocities = () => {
			const cubeySpeed = parseFloat( document.getElementById( 'cubeySpeed' )?.value || 0 );
			const cubeyDir = parseFloat( document.getElementById( 'cubeyDir' )?.value || 0 );
			const cubeyRad = cubeyDir * Math.PI / 180;
			cubes.cubey.velocity.set( Math.cos( cubeyRad ) * cubeySpeed, 0, Math.sin( cubeyRad ) * cubeySpeed );

			const friendSpeed = parseFloat( document.getElementById( 'friendSpeed' )?.value || 0 );
			const friendDir = parseFloat( document.getElementById( 'friendDir' )?.value || 0 );
			const friendRad = friendDir * Math.PI / 180;
			cubes.friend.velocity.set( Math.cos( friendRad ) * friendSpeed, 0, Math.sin( friendRad ) * friendSpeed );
		};
		applySliderVelocities();
	}

	start() {
		if ( !this.running ) {
			this.running = true;
			this.lastUpdate = performance.now();
			this._loop();
		}
	}

	stop() {
		this.running = false;
	}

	_loop() {
		if ( !this.running ) return;
		const now = performance.now();
		const dt = UPDATE_INTERVAL / 1000;
		while ( now - this.lastUpdate >= UPDATE_INTERVAL ) {
			this.updatePhysics( dt );
			this.lastUpdate += UPDATE_INTERVAL;
		}
		requestAnimationFrame( () => this._loop() );
	}

	/**
	 * Your physics function. Runs every 10ms.
	 * Replace this with your own calculations.
	 *
	 * @param {number} dt — seconds since last step
	 */
		updatePhysics( dt ) {
			// Apply friction as velocity multiplier (0 = no friction, 1 = full stop)
			for ( const [ name, cube ] of Object.entries( cubes ) ) {
				const frictionMultiplier = Math.max( 0, 1.0 - physicsConfig.friction );
				cube.velocity.multiplyScalar( frictionMultiplier );
			}

			// Check and handle collision before integrating position
			const collision = this.checkCollision();
			if ( collision.hitting ) {
				const a = cubes.cubey;
				const b = cubes.friend;
				const m1 = a.weight;
				const m2 = b.weight;
				const nx = collision.normal.x;
				const nz = collision.normal.z;

				// Current velocities
				const v1x = a.velocity.x;
				const v1z = a.velocity.z;
				const v2x = b.velocity.x;
				const v2z = b.velocity.z;

				// Relative velocity along normal
				const v1n = v1x * nx + v1z * nz;
				const v2n = v2x * nx + v2z * nz;

				// Only collide if cubes approach each other
				if ( v1n - v2n > 0 ) {
					// Separate velocities into normal and tangential components
					const v1nx = v1n * nx;
					const v1nz = v1n * nz;
					const v1tx = v1x - v1nx;
					const v1tz = v1z - v1nz;

					const v2nx = v2n * nx;
					const v2nz = v2n * nz;
					const v2tx = v2x - v2nx;
					const v2tz = v2z - v2nz;

					// Elastic collision (e = 1): kinetic energy conserved
					// Formula: v1n_new = (m1 - m2)*v1n + 2*m2*v2n) / (m1 + m2)
					//          v2n_new = (m2 - m1)*v2n + 2*m1*v1n) / (m1 + m2)
					const massSum = m1 + m2;
					const elasticV1n = ( ( m1 - m2 ) * v1n + 2 * m2 * v2n ) / massSum;
					const elasticV2n = ( ( m2 - m1 ) * v2n + 2 * m1 * v1n ) / massSum;

					// Inelastic collision (e = 0): objects stick together
					// Formula: v_new = (m1*v1 + m2*v2) / (m1 + m2)
					const inelasticV1n = ( m1 * v1n + m2 * v2n ) / massSum;
					const inelasticV2n = ( m1 * v1n + m2 * v2n ) / massSum;

					// Mix between elastic and inelastic based on restitution
					const e = physicsConfig.restitution;
					const finalV1n = elasticV1n * e + inelasticV1n * ( 1 - e );
					const finalV2n = elasticV2n * e + inelasticV2n * ( 1 - e );

					// Reconstruct final velocities
					a.velocity.x = finalV1n * nx + v1tx;
					a.velocity.z = finalV1n * nz + v1tz;
					b.velocity.x = finalV2n * nx + v2tx;
					b.velocity.z = finalV2n * nz + v2tz;
				}
			}

			// Integrate velocity to position: nextPosition = currentPosition + velocity * dt
			for ( const [ name, cube ] of Object.entries( cubes ) ) {
				const mesh = window.cubeMeshes?.[ name ];
				if ( !mesh ) continue;

				mesh.position.x += cube.velocity.x * dt;
				mesh.position.z += cube.velocity.z * dt;

				// Boundary bouncing
				const half = window.boundarySize;
				if ( mesh.position.x < -half ) { mesh.position.x = -half; cube.velocity.x *= -1; }
				if ( mesh.position.x > half ) { mesh.position.x = half; cube.velocity.x *= -1; }
				if ( mesh.position.z < -half ) { mesh.position.z = -half; cube.velocity.z *= -1; }
				if ( mesh.position.z > half ) { mesh.position.z = half; cube.velocity.z *= -1; }
			}
		}

	start() {
		if ( !this.running ) {
			this.reset();
			this.running = true;
			this.lastUpdate = performance.now();
			this._loop();
		}
	}

	/**
	 * Teleport a cube.
	 */
	setCubePosition( name, x, y, z ) {
		const mesh = window.cubeMeshes?.[ name ];
		if ( mesh ) mesh.position.set( x, y, z );
	}

	/**
	 * Set velocity directly.
	 */
	setCubeVelocity( name, vx, vy, vz ) {
		if ( cubes[ name ] ) cubes[ name ].velocity.set( vx, vy, vz );
	}

	/**
	 * Get current velocity.
	 */
	getCubeVelocity( name ) {
		return cubes[ name ]?.velocity || new Vector3();
	}

	/**
	 * Check if the two cubes are colliding.
	 * @returns {{ hitting: boolean, overlap: number, normal: import('three').Vector3 }}
	 */
	checkCollision() {
		const a = window.cubeMeshes?.cubey;
		const b = window.cubeMeshes?.friend;
		if ( !a || !b ) return { hitting: false, overlap: 0, normal: new Vector3() };

		const dx = b.position.x - a.position.x;
		const dz = b.position.z - a.position.z;
		const dist = Math.sqrt( dx * dx + dz * dz );
		const minDist = physicsConfig.cubeSize;

		if ( dist < minDist && dist > 0.0001 ) {
			const overlap = minDist - dist;
			const nx = dx / dist;
			const nz = dz / dist;
			return {
				hitting: true,
				overlap,
				normal: new Vector3( nx, 0, nz )
			};
		}
		return { hitting: false, overlap: 0, normal: new Vector3() };
	}
}

/** Singleton */
let instance = null;
export function getPhysicsEngine() {
	if ( !instance ) instance = new PhysicsEngine();
	return instance;
}
