import * as THREE from 'three';

/**
 * SceneManager - Handles scene setup, lighting, and 3D object creation
 */
export class SceneManager {
    constructor(scene) {
        this.scene = scene;
        this.physicsObjects = [];
    }

    setupScene() {
        // Set scene background
        this.scene.background = new THREE.Color(0x0a0e27);
        this.scene.fog = new THREE.Fog(0x0a0e27, 50, 500);

        // Setup lighting
        this.setupLighting();

        // Create ground plane
        this.createGround();

        // Create physics objects
        this.createPhysicsObjects();

        // Create grid helper
        this.createGridHelper();
    }

    setupLighting() {
        // Ambient light - soft global illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Directional light - main light source
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(10, 15, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        this.scene.add(directionalLight);

        // Point light - accent lighting
        const pointLight1 = new THREE.PointLight(0xff6b6b, 0.8);
        pointLight1.position.set(-8, 5, 0);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x4ecdc4, 0.8);
        pointLight2.position.set(8, 5, 0);
        this.scene.add(pointLight2);

        // Hemisphere light - sky light
        const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x1a1a1a, 0.4);
        this.scene.add(hemisphereLight);
    }

    createGround() {
        // Ground plane material with metallic appearance
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            metalness: 0.3,
            roughness: 0.8,
            side: THREE.DoubleSide
        });

        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.castShadow = false;
        this.scene.add(ground);

        // Add physics object reference (static)
        this.physicsObjects.push({
            mesh: ground,
            type: 'static',
            mass: 0,
            velocity: new THREE.Vector3(0, 0, 0),
            acceleration: new THREE.Vector3(0, 0, 0)
        });
    }

    createPhysicsObjects() {
        // Sphere 1
        const sphereGeometry = new THREE.IcosahedronGeometry(1, 32);
        const sphereMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6b6b,
            metalness: 0.7,
            roughness: 0.2,
            emissive: 0x330000,
            emissiveIntensity: 0.2
        });
        const sphere1 = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere1.position.set(-3, 4, 0);
        sphere1.castShadow = true;
        sphere1.receiveShadow = true;
        this.scene.add(sphere1);

        this.physicsObjects.push({
            mesh: sphere1,
            type: 'dynamic',
            mass: 2,
            velocity: new THREE.Vector3(0, 0, 0),
            acceleration: new THREE.Vector3(0, -9.81, 0),
            radius: 1
        });

        // Cube
        const cubeGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const cubeMaterial = new THREE.MeshStandardMaterial({
            color: 0x4ecdc4,
            metalness: 0.6,
            roughness: 0.3,
            emissive: 0x003333,
            emissiveIntensity: 0.1
        });
        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        cube.position.set(0, 5, 0);
        cube.castShadow = true;
        cube.receiveShadow = true;
        this.scene.add(cube);

        this.physicsObjects.push({
            mesh: cube,
            type: 'dynamic',
            mass: 2.5,
            velocity: new THREE.Vector3(0.5, 0, 0),
            acceleration: new THREE.Vector3(0, -9.81, 0),
            size: new THREE.Vector3(1.5, 1.5, 1.5)
        });

        // Sphere 2
        const sphere2Geometry = new THREE.IcosahedronGeometry(0.8, 32);
        const sphere2Material = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.8,
            roughness: 0.15,
            emissive: 0x664400,
            emissiveIntensity: 0.3
        });
        const sphere2 = new THREE.Mesh(sphere2Geometry, sphere2Material);
        sphere2.position.set(3, 6, 0);
        sphere2.castShadow = true;
        sphere2.receiveShadow = true;
        this.scene.add(sphere2);

        this.physicsObjects.push({
            mesh: sphere2,
            type: 'dynamic',
            mass: 1.5,
            velocity: new THREE.Vector3(-0.3, 0, 0),
            acceleration: new THREE.Vector3(0, -9.81, 0),
            radius: 0.8
        });

        // Torus - decorative rotating object
        const torusGeometry = new THREE.TorusGeometry(2, 0.6, 16, 100);
        const torusMaterial = new THREE.MeshStandardMaterial({
            color: 0x9d4edd,
            metalness: 0.5,
            roughness: 0.4,
            emissive: 0x330066,
            emissiveIntensity: 0.2
        });
        const torus = new THREE.Mesh(torusGeometry, torusMaterial);
        torus.position.set(0, 0, 0);
        torus.rotation.x = Math.PI / 4;
        torus.castShadow = true;
        torus.receiveShadow = true;
        this.scene.add(torus);

        this.physicsObjects.push({
            mesh: torus,
            type: 'static',
            mass: 0,
            isRotating: true,
            rotationSpeed: new THREE.Vector3(0.005, 0.01, 0.002)
        });
    }

    createGridHelper() {
        const gridHelper = new THREE.GridHelper(100, 20, 0x444444, 0x222222);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
    }

    getPhysicsObjects() {
        return this.physicsObjects;
    }

    resetScene() {
        // Reset all dynamic objects to initial positions
        for (let i = 0; i < this.physicsObjects.length; i++) {
            const obj = this.physicsObjects[i];
            if (obj.type === 'dynamic') {
                obj.velocity.set(0, 0, 0);
                obj.acceleration.set(0, -9.81, 0);
                
                // Reset initial positions
                switch (i) {
                    case 1: // sphere1
                        obj.mesh.position.set(-3, 4, 0);
                        break;
                    case 2: // cube
                        obj.mesh.position.set(0, 5, 0);
                        obj.velocity.x = 0.5;
                        break;
                    case 3: // sphere2
                        obj.mesh.position.set(3, 6, 0);
                        obj.velocity.x = -0.3;
                        break;
                }
            }
        }
    }
}
