export class InputManager {
    constructor() {
        this.realKeys = { w: false, a: false, s: false, d: false, shift: false };
        this.keys = { w: false, a: false, s: false, d: false, shift: false };
        this.mouseDelta = { x: 0, y: 0 };
        this.uiLayer = document.getElementById('hud-layer');
        this.isLocked = false;
        this.latencyMs = 0; 
        this.inputQueue = [];
        this._initListeners();
    }
    _initListeners() {
        window.addEventListener('keydown', (e) => this._onKeyChange(e, true), { capture: true });
        window.addEventListener('keyup', (e) => this._onKeyChange(e, false), { capture: true });
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = (document.pointerLockElement === document.body);
        });
        document.addEventListener('mousemove', (e) => {
            if (this.isLocked) { 
                // --- 修复 Bug 2: 使用累加 (+=) 而不是赋值 (=) ---
                // 防止高回报率鼠标在同一帧内的多次移动被最后一次覆盖
                this.mouseDelta.x += e.movementX; 
                this.mouseDelta.y += e.movementY; 
            }
        });
    }
    _onKeyChange(e, isPressed) {
        const key = e.key.toLowerCase();
        if (this.realKeys.hasOwnProperty(key)) this.realKeys[key] = isPressed;
        if (e.key === 'Shift') this.realKeys.shift = isPressed;
    }
    setLatency(ms) { this.latencyMs = ms; }
    update(dt) {
        const now = performance.now();
        this.inputQueue.push({ time: now, keys: { ...this.realKeys } });
        const threshold = now - this.latencyMs;
        let activeSnapshot = null;
        while(this.inputQueue.length > 0 && this.inputQueue[0].time <= threshold) {
            activeSnapshot = this.inputQueue.shift();
        }
        if (activeSnapshot) this.keys = activeSnapshot.keys;
        else if (this.latencyMs === 0) this.keys = { ...this.realKeys };
        
        // 重置鼠标增量
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
    }
}
