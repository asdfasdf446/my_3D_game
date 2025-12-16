import { io } from 'socket.io-client';
import { Fox } from '../Entities/Fox.js';
import { CesiumMan } from '../Entities/CesiumMan.js'; 

export class NetworkManager {
    constructor(scene, uiManager) {
        this.scene = scene; this.ui = uiManager; this.socket = null; this.localPlayer = null; 
        this.remotePlayers = {}; this.isConnected = false; this.currentPing = 0;
        this.joinInfo = { name: "", modelType: "fox" };
    }
    joinGame(name, modelType, localPlayer) {
        this.joinInfo = { name, modelType };
        this.localPlayer = localPlayer;
        this.localPlayer.setNetworkManager(this);
        this.socket = io(`${window.location.protocol}//${window.location.hostname}:3000`);
        this.socket.on('connect', () => { this.isConnected = true; this.socket.emit('join', this.joinInfo); });
        this.socket.on('init', (data) => {
            this.ui.updateStatus(`Joined as ${this.joinInfo.modelType}`);
            Object.values(data.players).forEach(p => { if(p.id !== this.socket.id) this.addRemotePlayer(p); });
            this.ui.updateTable(data.players, this.socket.id);
        });
        this.socket.on('newPlayer', (data) => this.addRemotePlayer(data));
        this.socket.on('bePushed', (vec) => { if(this.localPlayer) this.localPlayer.applyPush(vec.x, vec.z); });
        this.socket.on('playerListUpdate', (players) => {
            this.ui.updateTable(players, this.socket.id);
            Object.keys(players).forEach(id => {
                if (id === this.socket.id) return;
                if (!this.remotePlayers[id]) this.addRemotePlayer(players[id]);
                else this.remotePlayers[id].updateRemote(players[id]);
            });
            Object.keys(this.remotePlayers).forEach(rid => {
                if (!players[rid]) { this.remotePlayers[rid].dispose(); delete this.remotePlayers[rid]; }
            });
        });
        this.socket.on('playerDisconnected', (id) => {
            if (this.remotePlayers[id]) { this.remotePlayers[id].dispose(); delete this.remotePlayers[id]; }
        });
        setInterval(() => { if(this.socket) this.socket.emit('updatePing', this.currentPing); }, 1000);
    }
    addRemotePlayer(data) {
        if (this.remotePlayers[data.id]) return;
        const entity = (data.modelType === 'cesium') 
            ? new CesiumMan(this.scene, null, true, {x: data.x, z: data.z})
            : new Fox(this.scene, null, true, {x: data.x, z: data.z});
        entity.netId = data.id; entity.isNPC = data.isNPC;
        entity.setName(data.name); 
        this.remotePlayers[data.id] = entity;
    }
    sendPush(targetId, vx, vz) { if(this.socket) this.socket.emit('pushAction', { targetId, vectorX: vx, vectorZ: vz }); }
    setAllDebugMode(p, c) {
        if(this.localPlayer) this.localPlayer.setDebugMode(p, c);
        Object.values(this.remotePlayers).forEach(obj => obj.setDebugMode(p, c));
    }
    update(dt) {
        Object.values(this.remotePlayers).forEach(p => p.update(dt));
        if (this.localPlayer && this.isConnected) {
            const pos = this.localPlayer.getPosition();
            this.socket.emit('playerInput', {
                x: pos.x, z: pos.z, rotation: this.localPlayer.getRotation(), action: this.localPlayer.getActionState(),
                ping: 30 + Math.floor(Math.random() * 20) 
            });
        }
    }
    getObstacles() { return Object.values(this.remotePlayers); }
}
