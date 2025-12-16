import * as THREE from 'three';
export class Loop {
    constructor(camera, scene, renderer, debugPanel) {
        this.camera = camera;
        this.scene = scene;
        this.renderer = renderer;
        this.debug = debugPanel;
        this.updatables = []; 
        this.clock = new THREE.Clock();
    }
    add(object) { this.updatables.push(object); }
    start() {
        this.renderer.setAnimationLoop(() => {
            if(this.debug) this.debug.begin();
            this.tick();
            this.renderer.render(this.scene, this.camera);
            if(this.debug) this.debug.end();
        });
    }
    tick() {
        const dt = this.clock.getDelta();
        for (const object of this.updatables) object.update(dt);
    }
}
