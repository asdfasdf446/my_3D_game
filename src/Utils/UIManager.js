export class UIManager {
    constructor() {
        this.loginLayer = document.getElementById('login-layer');
        this.connStatus = document.getElementById('conn-status');
        this.tableBody = document.querySelector('#player-table tbody');
        this.controlsHint = document.getElementById('controls-hint');
        this.selectedType = 'fox'; 
        const cards = document.querySelectorAll('.char-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                cards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedType = card.dataset.type;
            });
        });
        this.onStart = null;
        document.getElementById('start-btn').addEventListener('click', () => {
            const name = document.getElementById('username').value || "Unknown";
            if(this.onStart) this.onStart(name, this.selectedType);
            this.loginLayer.classList.add('hidden');
            document.body.requestPointerLock();
            this.updateControls(this.selectedType);
        });
    }
    updateControls(type) {
        if (type === 'fox') {
            this.controlsHint.innerHTML = `<p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</p><p><kbd>Shift</kbd> Run</p><p>Mouse Look</p>`;
        } else {
            this.controlsHint.innerHTML = `<p><strong>AUTO-WALK</strong></p><p><kbd>A</kbd>/<kbd>D</kbd> Rotate</p><p><kbd>W</kbd> Fwd <kbd>S</kbd> Back</p><p>Mouse Look</p>`;
        }
    }
    updateStatus(msg) { this.connStatus.innerText = msg; }
    updateTable(players, myId) {
        this.tableBody.innerHTML = '';
        Object.keys(players).sort((a,b) => (a===myId?-1:b===myId?1:a.localeCompare(b))).forEach(id => {
            const p = players[id];
            if (p.isNPC) return; 
            const tr = document.createElement('tr');
            if(id === myId) tr.style.color = '#ffff00';
            const color = p.ping > 200 ? 'red' : p.ping > 100 ? 'orange' : '#0f0';
            tr.innerHTML = `<td>${p.name} ${id===myId?'(You)':''}</td><td>${p.modelType==='cesium'?'Man':'Fox'}</td><td style="color:${color}">${p.ping||0} ms</td>`;
            this.tableBody.appendChild(tr);
        });
    }
}
