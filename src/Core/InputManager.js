export class InputManager {
    // 构造函数接收 canvas 参数
    constructor(canvas) {
        this.canvas = canvas; 
        this.realKeys = { w: false, a: false, s: false, d: false, shift: false };
        this.keys = { w: false, a: false, s: false, d: false, shift: false };
        this.mouseDelta = { x: 0, y: 0 };
        this.isLocked = false;
        this.latencyMs = 0; 
        this.inputQueue = [];
        this._initListeners();
    }

    _initListeners() {
        // 键盘事件捕获（防止 UI 抢焦点导致无法移动）
        window.addEventListener('keydown', (e) => this._onKeyChange(e, true), { capture: true });
        window.addEventListener('keyup', (e) => this._onKeyChange(e, false), { capture: true });
        
        // --- 核心修复 1: 明确锁定目标为 Canvas ---
        // 只有点击 Canvas 及其下方元素时，才请求锁定
        // 这样点击 lil-gui 或其他 UI 不会意外触发逻辑
        this.canvas.addEventListener('click', () => {
            if (!this.isLocked) {
                this.canvas.requestPointerLock();
            }
        });
        
        // --- 核心修复 2: 监听 Canvas 的锁定状态 ---
        document.addEventListener('pointerlockchange', () => {
            // 只有当锁定对象是我们的 canvas 时，才视为游戏锁定
            this.isLocked = (document.pointerLockElement === this.canvas);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isLocked) { 
                // 使用累加防止丢帧
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
        
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
    }
}
