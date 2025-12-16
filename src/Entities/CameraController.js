import * as THREE from 'three';
export class CameraController {
    constructor(camera, targetObject, inputManager) {
        this.camera = camera; this.target = targetObject; this.input = inputManager;
        this.state = { distance: 3.5, theta: Math.PI, phi: Math.PI / 3 };
        this._initScroll();
    }
    _initScroll() {
        document.addEventListener('wheel', (e) => {
            if (this.input.isLocked) {
                this.state.distance += e.deltaY * 0.005;
                this.state.distance = Math.max(1.5, Math.min(10, this.state.distance));
            }
        });
    }
    update(dt) {
        if (!this.target.container) return;
        if (this.input.isLocked) {
            this.state.theta -= this.input.mouseDelta.x * 0.005;
            this.state.phi -= this.input.mouseDelta.y * 0.005;
            this.state.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.state.phi));
        }
        const center = this.target.getPosition().clone().add(new THREE.Vector3(0, 1.5, 0));
        const x = center.x + this.state.distance * Math.sin(this.state.phi) * Math.sin(this.state.theta);
        const y = center.y + this.state.distance * Math.cos(this.state.phi);
        const z = center.z + this.state.distance * Math.sin(this.state.phi) * Math.cos(this.state.theta);
        this.camera.position.set(x, y, z);
        this.camera.lookAt(center);
    }
}
