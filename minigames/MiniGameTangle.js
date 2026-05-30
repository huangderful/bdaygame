class MiniGameTangle extends Phaser.Scene {
    constructor() { super('MiniGameTangle'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.add.text(195, 40, 'TANGLE', { fontSize: '24px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.statusText = this.add.text(195, 80, 'Drag nodes to untangle!', { fontSize: '13px', color: '#888' }).setOrigin(0.5);
        this.timerText = this.add.text(195, 800, '30s', { fontSize: '16px', color: '#888' }).setOrigin(0.5);

        this.startTime = this.time.now;
        this.timeLimit = 30000;

        // Generate nodes in a circle, then randomize positions
        this.nodes = [];
        this.edges = [];
        const numNodes = 6;
        const cx = 195, cy = 420, radius = 120;

        // Create nodes
        for (let i = 0; i < numNodes; i++) {
            const angle = (i / numNodes) * Math.PI * 2;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            // Randomize starting position
            const rx = Phaser.Math.Between(60, 330);
            const ry = Phaser.Math.Between(200, 650);
            const node = this.add.circle(rx, ry, 16, 0x4ecca3).setDepth(10).setInteractive({ draggable: true });
            node.solveX = x; node.solveY = y;
            this.nodes.push(node);
        }

        // Create edges (connect adjacent + some cross connections)
        for (let i = 0; i < numNodes; i++) {
            this.edges.push([i, (i + 1) % numNodes]);
            if (i < numNodes - 2) this.edges.push([i, i + 2]);
        }

        this.gfx = this.add.graphics().setDepth(5);
        this.input.on('drag', (pointer, obj, dragX, dragY) => {
            obj.x = dragX; obj.y = dragY;
        });
    }

    update() {
        if (this.done) return;

        const elapsed = this.time.now - this.startTime;
        const remaining = Math.max(0, (this.timeLimit - elapsed) / 1000);
        this.timerText.setText(`${remaining.toFixed(1)}s`);

        if (remaining <= 0) { this.fail(); return; }

        // Draw edges
        this.gfx.clear();
        let crossings = 0;
        for (let i = 0; i < this.edges.length; i++) {
            for (let j = i + 1; j < this.edges.length; j++) {
                if (this.edgesCross(this.edges[i], this.edges[j])) crossings++;
            }
        }

        for (const [a, b] of this.edges) {
            const color = crossings === 0 ? 0x4ecca3 : 0xe94560;
            this.gfx.lineStyle(2, color, 0.8);
            this.gfx.lineBetween(this.nodes[a].x, this.nodes[a].y, this.nodes[b].x, this.nodes[b].y);
        }

        this.statusText.setText(crossings === 0 ? '✓ Untangled!' : `${crossings} crossing${crossings > 1 ? 's' : ''}`);
        if (crossings === 0) this.win();
    }

    edgesCross([a1, a2], [b1, b2]) {
        if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) return false;
        const p1 = this.nodes[a1], p2 = this.nodes[a2], p3 = this.nodes[b1], p4 = this.nodes[b2];
        return this.linesIntersect(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y);
    }

    linesIntersect(x1,y1,x2,y2,x3,y3,x4,y4) {
        const d = (x2-x1)*(y4-y3)-(y2-y1)*(x4-x3);
        if (d === 0) return false;
        const t = ((x3-x1)*(y4-y3)-(y3-y1)*(x4-x3))/d;
        const u = ((x3-x1)*(y2-y1)-(y3-y1)*(x2-x1))/d;
        return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
    }

    fail() {
        this.done = true;
        this.add.text(195, 420, '⏰ Time up!', { fontSize: '22px', color: '#e94560' }).setOrigin(0.5).setDepth(30);
        this.add.text(195, 470, '[ Retry ]', { fontSize: '18px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 16, y: 8 } })
            .setOrigin(0.5).setDepth(30).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
    }

    win() {
        this.done = true;
        const levels = this.registry.get('levels');
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.add.text(195, 750, '✓ Page Unlocked!', { fontSize: '20px', color: '#4ecca3' }).setOrigin(0.5);
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
