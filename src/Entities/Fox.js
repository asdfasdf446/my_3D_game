import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const sharedLoader = new GLTFLoader();
let sharedModelTemplate = null;

export class Fox {
    constructor(scene, inputManager, isRemote = false, initialPos = {x:0, z:0}) {
        this.scene = scene;
        this.input = inputManager;
        this.isRemote = isRemote; 
        this.container = new THREE.Group();
        this.container.position.set(initialPos.x, 0, initialPos.z);
        this.scene.add(this.container);
        this.mixer = null; this.actions = {}; this.activeAction = null; this.model = null;
        this.radius = 0.4; this.others = []; this.networkManager = null; this.isNPC = false;
        
        // --- 修复 Bug 1: 显式初始化 ---
        this.useProxyModel = false; 

        this.currentState = 'Survey';
        this.params = { walkSpeed: 0.05, runSpeed: 0.15, rotateSpeed: 0.05 };
        this.initDebugMesh();
        this.loadModel();
    }
    setNetworkManager(nm) { this.networkManager = nm; }
    setObstacles(foxes) { this.others = foxes; }
    initDebugMesh() {
        const geometry = new THREE.BoxGeometry(0.5, 1, 1.5); 
        this.proxyMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xff0000 }));
        this.proxyMesh.position.y = 0.5; this.proxyMesh.visible = false;
        this.container.add(this.proxyMesh);
        this.colliderMesh = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xffff00 }));
        this.colliderMesh.position.y = 0.5; this.colliderMesh.visible = false;
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
        sprite.position.y = 1.8; sprite.scale.set(2, 0.5, 1); sprite.name = 'nameTag';
        this.container.add(sprite);
    }
    loadModel() {
        if (sharedModelTemplate) this.setupFromTemplate(sharedModelTemplate);
        else sharedLoader.load('/Fox.glb', (gltf) => { sharedModelTemplate = gltf; this.setupFromTemplate(gltf); });
    }
    setupFromTemplate(gltf) {
        this.model = SkeletonUtils.clone(gltf.scene);
        this.model.scale.set(0.02, 0.02, 0.02);
        this.model.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
        this.container.add(this.model);
        this.mixer = new THREE.AnimationMixer(this.model);
        const getClip = (name) => THREE.AnimationClip.findByName(gltf.animations, name);
        this.actions['Survey'] = this.mixer.clipAction(getClip('Survey'));
        this.actions['Walk'] = this.mixer.clipAction(getClip('Walk'));
        this.actions['Run'] = this.mixer.clipAction(getClip('Run'));
        this.activeAction = this.actions['Survey'];
        this.activeAction.play();
        this.updateVisibility();
    }
    updateRemote(data) {
        this.container.position.x = data.x; this.container.position.z = data.z; this.container.rotation.y = data.rotation;
        if (data.action && data.action !== this.currentState) this.fadeToAction(data.action, 1);
    }
    applyPush(vx, vz) {
        const newX = this.container.position.x + vx; const newZ = this.container.position.z + vz;
        if(newX > -30 && newX < 30) this.container.position.x = newX;
        if(newZ > -30 && newZ < 30) this.container.position.z = newZ;
    }
    checkBoundary(pos) { return (pos.x > -30 && pos.x < 30 && pos.z > -30 && pos.z < 30); }
    detectCollision(proposedPos, myForward) {
        for (const other of this.others) {
            if (!other.container) continue;
            const dist = proposedPos.distanceTo(other.getPosition());
            if (dist < this.radius + (other.radius||0.4)) {
                const otherForward = new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0), other.getRotation());
                const isOtherMoving = other.getActionState() !== 'Survey';
                const isHeadOn = isOtherMoving && (myForward.dot(otherForward) < -0.5);
                return { collided: true, target: other, isHeadOn };
            }
        }
        return { collided: false };
    }
    update(dt) {
        if (!this.model) return;
        if (!this.isRemote) {
            if (this.input.keys.a) this.container.rotation.y += this.params.rotateSpeed;
            if (this.input.keys.d) this.container.rotation.y -= this.params.rotateSpeed;
            let nextAction = 'Survey'; let moveSpeed = 0; let timeScale = 1;
            if (this.input.keys.w) {
                if (this.input.keys.shift) { nextAction = 'Run'; moveSpeed = this.params.runSpeed; } 
                else { nextAction = 'Walk'; moveSpeed = this.params.walkSpeed; }
            } else if (this.input.keys.s) {
                nextAction = 'Walk'; moveSpeed = -this.params.walkSpeed * 0.6; timeScale = -1;
            }
            if (moveSpeed !== 0) {
                const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.container.rotation.y);
                const velocity = forward.clone().multiplyScalar(moveSpeed); 
                const proposedPos = this.container.position.clone().add(velocity);
                if (this.checkBoundary(proposedPos)) {
                    const collision = this.detectCollision(proposedPos, forward);
                    if (!collision.collided) {
                        this.container.position.copy(proposedPos);
                    } else {
                        if (!collision.isHeadOn && this.networkManager && collision.target.netId) {
                            this.networkManager.sendPush(collision.target.netId, velocity.x * 0.8, velocity.z * 0.8);
                        }
                    }
                }
            }
            this.fadeToAction(nextAction, timeScale);
        }
        if (this.mixer) this.mixer.update(dt);
    }
    setDebugMode(p, c) { this.useProxyModel = p; if(this.colliderMesh) this.colliderMesh.visible = c; this.updateVisibility(); }
    updateVisibility() {
        if (!this.model) return;
        this.model.visible = !this.useProxyModel;
        this.proxyMesh.visible = this.useProxyModel;
    }
    fadeToAction(name, timeScale) {
        const next = this.actions[name]; if(!next) return;
        next.timeScale = timeScale;
        if (this.currentState !== name) {
            if(this.activeAction) this.activeAction.fadeOut(0.2);
            next.reset().fadeIn(0.2).play();
            this.activeAction = next; this.currentState = name;
        }
    }
    getPosition() { return this.container.position; }
    getRotation() { return this.container.rotation.y; }
    getActionState() { return this.currentState; }
    dispose() { this.scene.remove(this.container); }
}
