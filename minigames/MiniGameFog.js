class MiniGameFog extends Phaser.Scene {
    constructor() { super('MiniGameFog'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.add.text(195, 30, 'FOG', { fontSize: '20px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.timerText = this.add.text(195, 55, '30s', { fontSize: '14px', color: '#888' }).setOrigin(0.5);
        this.startTime = this.time.now;

        // Maze walls
        this.walls = [];
        const gfx = this.add.graphics().setDepth(1);
        gfx.fillStyle(0x222244);
        const maze = [
            [30, 100, 330, 10], [30, 100, 10, 650], [350, 100, 10, 650], [30, 740, 330, 10],
            [80, 180, 10, 200], [150, 150, 10, 150], [220, 200, 10, 180],
            [80, 380, 150, 10], [180, 350, 10, 100], [280, 250, 10, 200],
            [100, 450, 10, 150], [150, 500, 120, 10], [250, 450, 10, 150],
            [80, 600, 200, 10], [200, 600, 10, 100], [300, 550, 10, 100],
        ];
        for (const [x, y, w, h] of maze) {
            gfx.fillRect(x, y, w, h);
            this.walls.push({ x, y, w, h });
        }

        // Goal
        this.add.circle(320, 700, 10, 0xffaa00).setDepth(2);
        this.goalX = 320; this.goalY = 700;

        // Player
        this.px = 60; this.py = 140;
        this.player = this.add.circle(this.px, this.py, 7, 0x4ecca3).setDepth(5);

        // Fog overlay (black with circular cutout)
        this.fog = this.add.graphics().setDepth(10);
        this.fogRadius = 50;

        this.input.on('pointermove', (p) => {
            if (!p.isDown || this.done) return;
            const dx = (p.x - p.prevPosition.x) * 0.8;
            const dy = (p.y - p.prevPosition.y) * 0.8;
            const nx = this.px + dx, ny = this.py + dy;
            if (!this.hitsWall(nx, ny)) { this.px = nx; this.py = ny; }
        });
    }

    hitsWall(x, y) {
        for (const w of this.walls) {
            if (x > w.x - 6 && x < w.x + w.w + 6 && y > w.y - 6 && y < w.y + w.h + 6) return true;
        }
        return false;
    }

    update() {
        if (this.done) return;
        this.player.x = this.px; this.player.y = this.py;

        const elapsed = (this.time.now - this.startTime) / 1000;
        this.timerText.setText(`${Math.max(0, 30 - elapsed).toFixed(1)}s`);
        if (elapsed >= 30) { this.fail(); return; }

        // Draw fog
        this.fog.clear();
        this.fog.fillStyle(0x000000, 0.92);
        this.fog.fillRect(0, 0, 390, 844);
        // Cut out circle around player
        this.fog.fillStyle(0x000000, 0);
        this.fog.beginPath();
        this.fog.arc(this.px, this.py, this.fogRadius, 0, Math.PI * 2);
        this.fog.closePath();
        this.fog.fillPath();
        // Actually need to use a mask approach - simpler: just clear a circle
        // Phaser graphics can't do subtractive. Use a different approach:
        this.fog.clear();
        // Draw fog as a donut shape (fill everything except circle)
        this.fog.fillStyle(0x000000, 0.93);
        // Top
        this.fog.fillRect(0, 0, 390, Math.max(0, this.py - this.fogRadius));
        // Bottom
        this.fog.fillRect(0, this.py + this.fogRadius, 390, 844 - this.py - this.fogRadius);
        // Left of circle row
        this.fog.fillRect(0, this.py - this.fogRadius, Math.max(0, this.px - this.fogRadius), this.fogRadius * 2);
        // Right of circle row
        this.fog.fillRect(this.px + this.fogRadius, this.py - this.fogRadius, 390 - this.px - this.fogRadius, this.fogRadius * 2);

        if (Phaser.Math.Distance.Between(this.px, this.py, this.goalX, this.goalY) < 18) this.win();
    }

    fail() {
        this.done = true;
        this.fog.clear();
        this.add.text(195, 420, '⏰ Time up!', { fontSize: '22px', color: '#e94560' }).setOrigin(0.5).setDepth(30);
        this.add.text(195, 470, '[ Retry ]', { fontSize: '18px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 16, y: 8 } })
            .setOrigin(0.5).setDepth(30).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
    }

    win() {
        this.done = true;
        this.fog.clear();
        const levels = this.registry.get('levels');
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.add.text(195, 420, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5).setDepth(20);
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
