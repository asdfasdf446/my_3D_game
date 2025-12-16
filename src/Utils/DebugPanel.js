import GUI from 'lil-gui';
import Stats from 'stats.js';
export class DebugPanel {
    constructor(fox, inputManager, environment) {
        this.fox = fox; this.input = inputManager; this.env = environment; this.netManager = null;
        this.statsContainer = document.createElement('div');
        this.statsContainer.style.cssText = 'position:absolute; top:10px; left:10px; display:flex; gap:5px; z-index:20;';
        document.body.appendChild(this.statsContainer);
        this.statsFPS = this._createStat(0); this.statsMS = this._createStat(1); this.statsMB = this._createStat(2); 

        this.gui = new GUI({ title: 'Engine Debugger' });
        const perfFolder = this.gui.addFolder('Performance');
        this.perfParams = { showFPS: true, showMS: true, showMB: true };
        perfFolder.add(this.perfParams, 'showFPS').onChange(v => this._toggleStat(this.statsFPS, v));
        perfFolder.add(this.perfParams, 'showMS').onChange(v => this._toggleStat(this.statsMS, v));
        perfFolder.add(this.perfParams, 'showMB').onChange(v => this._toggleStat(this.statsMB, v));

        const modelFolder = this.gui.addFolder('Model & Physics');
        this.debugParams = { useProxy: false, showPhysics: false };
        modelFolder.add(this.debugParams, 'useProxy').onChange(v => this.updateGlobalDebug());
        modelFolder.add(this.debugParams, 'showPhysics').onChange(v => this.updateGlobalDebug());
        modelFolder.add(this.env.scene.fog, 'far', 10, 100).name('Fog Distance');
            
        const netFolder = this.gui.addFolder('Network');
        this.netParams = { latency: 0 };
        netFolder.add(this.netParams, 'latency', 0, 1000, 50).onChange(v => this.input.setLatency(v));
        perfFolder.open();
        
        // --- 修复 Bug 1: 初始化时强制同步一次状态 ---
        this.updateGlobalDebug();
    }
    setNetworkManager(nm) { this.netManager = nm; }
    updateGlobalDebug() {
        const p = this.debugParams.useProxy; const c = this.debugParams.showPhysics;
        this.env.setDebugMode(c);
        if (this.netManager) this.netManager.setAllDebugMode(p, c);
        else this.fox.setDebugMode(p, c);
    }
    _createStat(type) {
        const s = new Stats(); s.showPanel(type); s.dom.style.position = 'relative'; 
        this.statsContainer.appendChild(s.dom); return s;
    }
    _toggleStat(s, v) { s.dom.style.display = v ? 'block' : 'none'; }
    begin() { if(this.perfParams.showFPS) this.statsFPS.begin(); if(this.perfParams.showMS) this.statsMS.begin(); if(this.perfParams.showMB) this.statsMB.begin(); }
    end() { if(this.perfParams.showFPS) this.statsFPS.end(); if(this.perfParams.showMS) this.statsMS.end(); if(this.perfParams.showMB) this.statsMB.end(); }
}
