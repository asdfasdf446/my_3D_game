import * as THREE from 'three';
export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.floorMesh = null;
        this.debugGroup = new THREE.Group(); 
        this.scene.add(this.debugGroup);
        this.dirLight = null;
        this.target = null; this.camera = null;
        this.initLights();
        this.initFloor();
        this.initWalls();
    }
    setReferences(fox, camera) { this.target = fox; this.camera = camera; }
    initLights() {
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
        hemiLight.position.set(0, 20, 0);
        this.scene.add(hemiLight);
        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.dirLight.position.set(5, 10, 7);
        this.dirLight.castShadow = true;
        const d = 20; 
        this.dirLight.shadow.camera.left = -d; this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d; this.dirLight.shadow.camera.bottom = -d;
        this.dirLight.shadow.mapSize.width = 2048; this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.bias = -0.0005;
        this.scene.add(this.dirLight);
    }
    initFloor() {
        const size = 60;
        const geometry = new THREE.PlaneGeometry(size, size);
        this.floorMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ 
            color: 0x556677, roughness: 0.8, transparent: true, opacity: 1.0 
        }));
        this.floorMesh.rotation.x = -Math.PI / 2;
        this.floorMesh.receiveShadow = true;
        this.scene.add(this.floorMesh);
        const grid = new THREE.GridHelper(size, 60, 0x000000, 0x000000);
        grid.material.opacity = 0.1; grid.material.transparent = true;
        this.scene.add(grid);
        const wireframeGeo = new THREE.WireframeGeometry(geometry);
        const floorCollider = new THREE.LineSegments(wireframeGeo, new THREE.LineBasicMaterial({ color: 0xff0000 }));
        floorCollider.rotation.x = -Math.PI / 2; floorCollider.position.y = 0.01;
        this.debugGroup.add(floorCollider);
    }
    initWalls() {
        const size = 60;
        const geometry = new THREE.BoxGeometry(size, 5, size);
        const wallCollider = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xff0000 }));
        wallCollider.position.y = 2.5; 
        this.debugGroup.add(wallCollider);
        this.debugGroup.visible = false;
    }
    setDebugMode(showPhysics) { this.debugGroup.visible = showPhysics; }
    update(dt) {
        if (!this.target || !this.target.container) return;
        const foxPos = this.target.getPosition();
        this.dirLight.position.x = foxPos.x + 5;
        this.dirLight.position.z = foxPos.z + 7;
        this.dirLight.target.position.copy(foxPos);
        this.dirLight.target.updateMatrixWorld();
        if (this.camera && this.floorMesh) {
            const targetOpacity = this.camera.position.y < 0.2 ? 0.3 : 1.0;
            this.floorMesh.material.opacity += (targetOpacity - this.floorMesh.material.opacity) * 5 * dt;
        }
    }
}
