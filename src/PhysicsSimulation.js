import * as THREE from 'three';

/**
 * PhysicsSimulation - Handles physics calculations for objects
 * Includes gravity, collisions, and realistic motion
 */
export class PhysicsSimulation {
    constructor() {
        this.gravity = new THREE.Vector3(0, -9.81, 0);
        this.friction = 0.99;
        this.restitution = 0.7; // Bounce factor
        this.groundLevel = 0;
        this.damping = 0.98;
    }

    initialize() {
        console.log('📊 Physics engine initialized');
    }

    update(deltaTime, physicsObjects) {
        for (const obj of physicsObjects) {
            if (obj.type === 'dynamic') {
                this.updateDynamicObject(obj, deltaTime);
                this.checkCollisions(obj, physicsObjects);
            } else if (obj.isRotating) {
                // Rotate static objects
                obj.mesh.rotation.x += obj.rotationSpeed.x;
                obj.mesh.rotation.y += obj.rotationSpeed.y;
                obj.mesh.rotation.z += obj.rotationSpeed.z;
            }
        }
    }

    updateDynamicObject(obj, deltaTime) {
        // Apply acceleration (gravity and forces)
        obj.acceleration.copy(this.gravity);

        // Update velocity
        obj.velocity.addScaledVector(obj.acceleration, deltaTime);
        
        // Apply damping
        obj.velocity.multiplyScalar(this.damping);

        // Update position
        obj.mesh.position.addScaledVector(obj.velocity, deltaTime);

        // Ground collision
        if (obj.mesh.position.y < this.groundLevel + (obj.radius || obj.size?.y / 2 || 0)) {
            obj.mesh.position.y = this.groundLevel + (obj.radius || obj.size?.y / 2 || 0);
            obj.velocity.y *= -this.restitution;
            obj.velocity.x *= this.friction;
            obj.velocity.z *= this.friction;
        }

        // World boundaries
        const boundarySize = 50;
        if (Math.abs(obj.mesh.position.x) > boundarySize) {
            obj.mesh.position.x = Math.sign(obj.mesh.position.x) * boundarySize;
            obj.velocity.x *= -0.5;
        }
        if (Math.abs(obj.mesh.position.z) > boundarySize) {
            obj.mesh.position.z = Math.sign(obj.mesh.position.z) * boundarySize;
            obj.velocity.z *= -0.5;
        }
    }

    checkCollisions(obj, physicsObjects) {
        for (const other of physicsObjects) {
            if (obj === other) continue;

            const distance = obj.mesh.position.distanceTo(other.mesh.position);
            const minDistance = (obj.radius || 0.75) + (other.radius || 0.75);

            if (distance < minDistance && other.type === 'dynamic') {
                this.resolveCollision(obj, other, distance);
            }
        }
    }

    resolveCollision(obj1, obj2, distance) {
        // Get collision normal
        const normal = new THREE.Vector3().subVectors(obj2.mesh.position, obj1.mesh.position);
        normal.normalize();

        // Separate objects
        const overlap = (obj1.radius || 0.75) + (obj2.radius || 0.75) - distance;
        const separationVector = normal.multiplyScalar(overlap / 2 + 0.01);

        obj1.mesh.position.sub(separationVector);
        obj2.mesh.position.add(separationVector);

        // Calculate relative velocity
        const relativeVelocity = new THREE.Vector3().subVectors(obj2.velocity, obj1.velocity);
        const velocityAlongNormal = relativeVelocity.dot(normal);

        // Don't collide if objects moving apart
        if (velocityAlongNormal >= 0) return;

        // Calculate impulse
        const restitution = (this.restitution + this.restitution) / 2;
        const mass1 = obj1.mass || 1;
        const mass2 = obj2.mass || 1;
        const impulse = -(1 + restitution) * velocityAlongNormal / (1 / mass1 + 1 / mass2);

        // Apply impulse
        const impulseVector = normal.multiplyScalar(impulse);
        obj1.velocity.addScaledVector(impulseVector, -1 / mass1);
        obj2.velocity.addScaledVector(impulseVector, 1 / mass2);
    }

    reset() {
        console.log('🔄 Physics simulation reset');
    }

    getGravity() {
        return this.gravity.clone();
    }

    setGravity(value) {
        this.gravity.y = -Math.abs(value);
    }
}
