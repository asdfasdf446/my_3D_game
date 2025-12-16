import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const sharedLoader = new GLTFLoader();
let sharedModelTemplate = null;

export class CesiumMan {
    constructor(scene, inputManager, isRemote = false, initialPos = {x:0, z:0}) {
        this.scene = scene;
        this.input = inputManager;
        this.isRemote = isRemote; 
        
        this.container = new THREE.Group();
        this.container.position.set(initialPos.x, 0, initialPos.z);
        this.scene.add(this.container);

        this.mixer = null;
        this.model = null;
        this.activeAction = null;

        this.radius = 0.4; 
        this.others = []; 
        this.networkManager = null;
        this.netId = null;
        this.isNPC = false;

        // --- 修复：显式初始化 ---
        this.useProxyModel = false;

        this.moveSpeed = 0.04; 
        this.currentDir = 1;   
        this.rotateSpeed = 0.05;

        this.initDebugMesh();
        this.loadModel();
    }
    
    setNetworkManager(nm) { this.networkManager = nm; }
    setObstacles(objects) { this.others = objects; }

    initDebugMesh() {
        const geometry = new THREE.BoxGeometry(0.5, 1.8, 0.5); 
        this.proxyMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x0000ff }));
        this.proxyMesh.position.y = 0.9;
        this.proxyMesh.visible = false;
        this.container.add(this.proxyMesh);

        const wireframeGeo = new THREE.WireframeGeometry(geometry);
        this.colliderMesh = new THREE.LineSegments(wireframeGeo, new THREE.LineBasicMaterial({ color: 0xffff00 }));
        this.colliderMesh.position.y = 0.9;
        this.colliderMesh.visible = false;
        this.container.add(this.colliderMesh);
    }

    setName(name) {
        if(!this.isRemote || this.isNPC) return; 
        const old = this.container.getObjectByName('nameTag');
        if(old) this.container.remove(old);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256; canvas.height = 64;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0, 256, 64);
        ctx.fillStyle = 'white'; ctx.font = 'bold 32px Arial'; ctx.textAlign = 'center'; ctx.fillText(name, 128, 42);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
        sprite.position.y = 2.0; sprite.scale.set(2, 0.5, 1); sprite.name = 'nameTag';
        this.container.add(sprite);
    }

    loadModel() {
        if (sharedModelTemplate) {
            this.setupFromTemplate(sharedModelTemplate);
        } else {
            sharedLoader.load('/CesiumMan.glb', (gltf) => {
                sharedModelTemplate = gltf;
                this.setupFromTemplate(gltf);
            });
        }
    }

    setupFromTemplate(gltf) {
        this.model = SkeletonUtils.clone(gltf.scene);
        this.model.rotation.y = Math.PI; 
        this.model.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
        this.container.add(this.model);

        this.mixer = new THREE.AnimationMixer(this.model);
        if(gltf.animations[0]) {
            this.activeAction = this.mixer.clipAction(gltf.animations[0]);
            this.activeAction.play();
        }
        
        this.updateVisibility();
    }

    updateRemote(data) {
        this.container.position.x = data.x;
        this.container.position.z = data.z;
        this.container.rotation.y = data.rotation;
    }

    applyPush(vectorX, vectorZ) {
        const newX = this.container.position.x + vectorX;
        const newZ = this.container.position.z + vectorZ;
        if(newX > -30 && newX < 30) this.container.position.x = newX;
        if(newZ > -30 && newZ < 30) this.container.position.z = newZ;
    }

    checkBoundary(pos) {
        const LIMIT = 30;
        return (pos.x > -LIMIT && pos.x < LIMIT && pos.z > -LIMIT && pos.z < LIMIT);
    }

    detectCollision(proposedPos) {
        for (const other of this.others) {
            if (!other.container) continue;
            const dist = proposedPos.distanceTo(other.getPosition());
            if (dist < this.radius + (other.radius || 0.4)) {
                return { collided: true, target: other };
            }
        }
        return { collided: false };
    }

    update(dt) {
        if (!this.model) return;

        if (!this.isRemote) {
            if (this.input.keys.a) this.container.rotation.y += this.rotateSpeed;
            if (this.input.keys.d) this.container.rotation.y -= this.rotateSpeed;
            if (this.input.keys.w) this.currentDir = -1;
            if (this.input.keys.s) this.currentDir = 1;
            if (this.activeAction) this.activeAction.timeScale = -this.currentDir;

            const speed = this.moveSpeed * this.currentDir;
            const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.container.rotation.y);
            const velocity = forward.clone().multiplyScalar(speed);
            const proposedPos = this.container.position.clone().add(velocity);

            if (this.checkBoundary(proposedPos)) {
                const collision = this.detectCollision(proposedPos);
                if (!collision.collided) {
                    this.container.position.copy(proposedPos);
                } else {
                    if(this.networkManager && collision.target.netId) {
                        this.networkManager.sendPush(collision.target.netId, velocity.x * 0.8, velocity.z * 0.8);
                    }
                }
            }
        }

        if (this.mixer) this.mixer.update(dt);
    }

    // --- 修复：状态更新时确保同步 ---
    setDebugMode(useProxy, showPhysics) {
        this.useProxyModel = useProxy;
        if(this.colliderMesh) this.colliderMesh.visible = showPhysics;
        this.updateVisibility();
    }

    updateVisibility() {
        if (!this.model) return;
        this.model.visible = !this.useProxyModel;
        this.proxyMesh.visible = this.useProxyModel;
    }
    getPosition() { return this.container.position; }
    getRotation() { return this.container.rotation.y; }
    getActionState() { return 'Run'; } 
    dispose() { this.scene.remove(this.container); }
}
