class MiniGameMirror extends Phaser.Scene {
    constructor() { super('MiniGameMirror'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.add.text(195, 30, 'MIRROR', { fontSize: '20px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.add.text(195, 55, 'Controls are REVERSED!', { fontSize: '12px', color: '#e94560' }).setOrigin(0.5);
        this.timerText = this.add.text(195, 80, '20s', { fontSize: '14px', color: '#888' }).setOrigin(0.5);
        this.startTime = this.time.now;

        // Simple maze using rectangles
        this.walls = [];
        const maze = [
            [50, 120, 300, 10], [50, 120, 10, 200], [340, 120, 10, 200],
            [100, 200, 10, 150], [150, 250, 150, 10], [200, 350, 10, 100],
            [100, 400, 120, 10], [280, 300, 10, 150], [50, 500, 200, 10],
            [300, 450, 10, 100], [150, 550, 200, 10], [50, 600, 10, 100],
            [50, 700, 300, 10], [340, 550, 10, 160],
        ];
        const gfx = this.add.graphics();
        gfx.fillStyle(0x333333);
        for (const [x, y, w, h] of maze) {
            gfx.fillRect(x, y, w, h);
            this.walls.push({ x, y, w, h });
        }

        // Start and end
        this.player = this.add.circle(80, 150, 8, 0x4ecca3).setDepth(10);
        this.px = 80; this.py = 150;
        this.add.circle(320, 670, 12, 0xffaa00, 0.5); // goal
        this.goalX = 320; this.goalY = 670;

        this.input.on('pointermove', (p) => {
            if (!p.isDown || this.done) return;
            // REVERSED controls
            const dx = -(p.x - p.prevPosition.x);
            const dy = -(p.y - p.prevPosition.y);
            const nx = this.px + dx, ny = this.py + dy;
            if (!this.hitsWall(nx, ny)) { this.px = Phaser.Math.Clamp(nx, 20, 370); this.py = Phaser.Math.Clamp(ny, 100, 740); }
        });
    }

    hitsWall(x, y) {
        for (const w of this.walls) {
            if (x > w.x - 8 && x < w.x + w.w + 8 && y > w.y - 8 && y < w.y + w.h + 8) return true;
        }
        return false;
    }

    update() {
        if (this.done) return;
        this.player.x = this.px; this.player.y = this.py;

        const elapsed = (this.time.now - this.startTime) / 1000;
        this.timerText.setText(`${Math.max(0, 20 - elapsed).toFixed(1)}s`);
        if (elapsed >= 20) { this.fail(); return; }

        if (Phaser.Math.Distance.Between(this.px, this.py, this.goalX, this.goalY) < 20) this.win();
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
        this.add.text(195, 420, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5).setDepth(20);
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
