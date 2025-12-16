import * as THREE from 'three';
import { InputManager } from './Core/InputManager.js';
import { Loop } from './Core/Loop.js';
import { Environment } from './World/Environment.js';
import { Fox } from './Entities/Fox.js';
import { CesiumMan } from './Entities/CesiumMan.js';
import { CameraController } from './Entities/CameraController.js';
import { DebugPanel } from './Utils/DebugPanel.js';
import { NetworkManager } from './Network/NetworkManager.js';
import { UIManager } from './Utils/UIManager.js';

class App {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 20, 60);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
        document.body.appendChild(this.renderer.domElement);
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        this.inputManager = new InputManager();
        this.environment = new Environment(this.scene);
        this.uiManager = new UIManager();
        this.networkManager = new NetworkManager(this.scene, this.uiManager);
        this.localPlayer = null; this.cameraControl = null; this.debugPanel = null;

        // Loop 顺序：环境 -> 网络(更新远程) -> 玩家/相机(读Input) -> Input(清空)
        this.loop = new Loop(this.camera, this.scene, this.renderer, null);
        this.loop.add(this.environment);
        this.loop.add(this.networkManager);

        this.uiManager.onStart = (name, type) => this.initGame(name, type);
        
        const originalTick = this.loop.tick.bind(this.loop);
        this.loop.tick = () => {
            if(this.localPlayer) this.localPlayer.setObstacles(this.networkManager.getObstacles());
            originalTick();
        };
        this.loop.start();
    }

    initGame(name, type) {
        this.localPlayer = (type === 'cesium') 
            ? new CesiumMan(this.scene, this.inputManager, false)
            : new Fox(this.scene, this.inputManager, false);

        this.cameraControl = new CameraController(this.camera, this.localPlayer, this.inputManager);
        this.environment.setReferences(this.localPlayer, this.camera);
        this.debugPanel = new DebugPanel(this.localPlayer, this.inputManager, this.environment);
        this.debugPanel.setNetworkManager(this.networkManager);
        this.loop.debug = this.debugPanel;

        // 添加到 Loop (注意顺序)
        this.loop.add(this.localPlayer);
        this.loop.add(this.cameraControl);
        // InputManager 必须在 Player/Camera 之后
        this.loop.add(this.inputManager);

        this.networkManager.joinGame(name, type, this.localPlayer);
    }
}
new App();
