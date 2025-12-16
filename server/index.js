import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// --- 配置路径 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 指向上一级目录的 dist 文件夹 (构建产物)
const distPath = path.join(__dirname, '../dist');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  // 生产环境通常不需要 CORS 配置，因为前端和后端同源
  // 但为了保险，还是允许所有
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- 关键修改：托管前端静态文件 ---
app.use(express.static(distPath));

const entities = {};
const MAP_LIMIT = 28;

class NPC {
    constructor(type, index) {
        this.id = `npc_${type}_${index}`;
        this.name = ""; 
        this.modelType = type; 
        this.isNPC = true; 
        this.ping = 0;
        this.x = (Math.random() - 0.5) * 40;
        this.z = (Math.random() - 0.5) * 40;
        this.rotation = Math.random() * Math.PI * 2;
        this.action = type === 'cesium' ? 'Run' : 'Survey';
        this.timer = 0;
        this.targetRotation = this.rotation;
        this.moveSpeed = 0;
        this.pickNewBehavior();
    }

    pickNewBehavior() {
        this.timer = 2000 + Math.random() * 3000;
        if (this.modelType === 'fox') {
            const rand = Math.random();
            if (rand < 0.4) { this.action = 'Survey'; this.moveSpeed = 0; }
            else if (rand < 0.8) { this.action = 'Walk'; this.moveSpeed = 0.05; }
            else { this.action = 'Run'; this.moveSpeed = 0.15; }
        } else {
            this.action = 'Run'; this.moveSpeed = 0.04;
        }
        if (Math.random() > 0.3) {
            this.targetRotation = this.rotation + (Math.random() - 0.5) * Math.PI;
        }
    }

    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) this.pickNewBehavior();

        const rotDiff = this.targetRotation - this.rotation;
        this.rotation += rotDiff * 0.05;

        if (this.moveSpeed > 0) {
            const dx = Math.sin(this.rotation) * this.moveSpeed;
            const dz = Math.cos(this.rotation) * this.moveSpeed;
            this.x += dx; this.z += dz;

            if (this.x < -MAP_LIMIT || this.x > MAP_LIMIT || this.z < -MAP_LIMIT || this.z > MAP_LIMIT) {
                this.targetRotation = Math.atan2(-this.x, -this.z) + (Math.random()-0.5); 
                this.x = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, this.x));
                this.z = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, this.z));
            }
        }
    }
}

const npcs = [];
for(let i=0; i<3; i++) npcs.push(new NPC('fox', i));
for(let i=0; i<3; i++) npcs.push(new NPC('cesium', i));
npcs.forEach(npc => { entities[npc.id] = npc; });

io.on('connection', (socket) => {
  let ip = socket.handshake.address;
  if (ip.startsWith('::ffff:')) ip = ip.substr(7);
  
  socket.on('join', (data) => {
      const name = typeof data === 'object' ? data.name : data;
      const type = typeof data === 'object' ? data.modelType : 'fox';
      entities[socket.id] = {
        id: socket.id, name: name || `Player_${socket.id.substr(0,4)}`, modelType: type,
        isNPC: false, ip: ip, ping: 0,
        x: (Math.random() - 0.5) * 10, z: (Math.random() - 0.5) * 10, rotation: 0, action: 'Survey'
      };
      socket.emit('init', { id: socket.id, players: entities });
      socket.broadcast.emit('newPlayer', entities[socket.id]);
  });

  socket.on('playerInput', (data) => {
    if (entities[socket.id]) {
      Object.assign(entities[socket.id], data); 
      if(data.ping) entities[socket.id].ping = data.ping;
    }
  });

  socket.on('pushAction', (data) => {
      const target = entities[data.targetId];
      if (target) {
          if (target.isNPC) {
              target.x += data.vectorX; target.z += data.vectorZ;
              target.x = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, target.x));
              target.z = Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, target.z));
          } else {
              io.to(data.targetId).emit('bePushed', { x: data.vectorX, z: data.vectorZ });
          }
      }
  });

  socket.on('updatePing', (ms) => { if(entities[socket.id]) entities[socket.id].ping = ms; });
  socket.on('disconnect', () => { delete entities[socket.id]; io.emit('playerDisconnected', socket.id); });
});

setInterval(() => {
    npcs.forEach(npc => npc.update(50));
    io.emit('playerListUpdate', entities);
}, 50);

// --- 端口配置 ---
// 云服务器常用 80 (HTTP) 或 8080/3000
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => console.log(`Game Server running on port ${PORT}`));
