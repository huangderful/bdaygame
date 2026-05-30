class MiniGameArena extends Phaser.Scene {
    constructor() { super('MiniGameArena'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.frames = 0;
        this.surviveFrames = 1200;
        this.cx = 195; this.cy = 420;
        this.radius = 180;
        this.px = this.cx; this.py = this.cy;
        this.enemies = [];
        this.gfx = this.add.graphics();

        this.add.text(195, 30, 'ARENA', { fontSize: '20px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.timerText = this.add.text(195, 60, '', { fontSize: '14px', color: '#888' }).setOrigin(0.5);
        this.player = this.add.circle(this.px, this.py, 8, 0x4ecca3).setDepth(10);

        // Spawn initial enemies
        for (let i = 0; i < 3; i++) this.spawnEnemy();

        this.input.on('pointermove', (p) => { if (p.isDown && !this.done) { this.px = p.x; this.py = p.y; } });
        this.input.on('pointerdown', (p) => { if (!this.done) { this.px = p.x; this.py = p.y; } });
    }

    spawnEnemy() {
        const angle = Math.random() * Math.PI * 2;
        const r = this.radius * 0.5;
        this.enemies.push({
            x: this.cx + Math.cos(angle) * r,
            y: this.cy + Math.sin(angle) * r,
            vx: Phaser.Math.FloatBetween(-2, 2),
            vy: Phaser.Math.FloatBetween(-2, 2)
        });
    }

    update() {
        if (this.done) return;
        this.frames++;

        const remaining = (this.surviveFrames - this.frames) / 60;
        this.timerText.setText(`${remaining.toFixed(1)}s`);
        if (this.frames >= this.surviveFrames) { this.win(); return; }

        // Shrink arena
        this.radius = 180 - (this.frames / this.surviveFrames) * 120;

        // Spawn more enemies over time
        if (this.frames % 180 === 0) this.spawnEnemy();

        // Move player
        this.player.x = this.px; this.player.y = this.py;

        // Check player in arena
        const pDist = Phaser.Math.Distance.Between(this.px, this.py, this.cx, this.cy);
        if (pDist > this.radius - 10) { this.die(); return; }

        // Move enemies
        this.gfx.clear();
        this.gfx.lineStyle(2, 0xe94560);
        this.gfx.strokeCircle(this.cx, this.cy, this.radius);

        for (const e of this.enemies) {
            e.x += e.vx; e.y += e.vy;
            const eDist = Phaser.Math.Distance.Between(e.x, e.y, this.cx, this.cy);
            if (eDist > this.radius - 8) {
                const angle = Math.atan2(e.y - this.cy, e.x - this.cx);
                e.vx = -Math.cos(angle) * 2;
                e.vy = -Math.sin(angle) * 2;
            }
            this.gfx.fillStyle(0xe94560, 0.8);
            this.gfx.fillCircle(e.x, e.y, 6);

            if (Phaser.Math.Distance.Between(this.px, this.py, e.x, e.y) < 14) { this.die(); return; }
        }
    }

    die() {
        this.done = true;
        if (window.Native) window.Native.vibrate(200);
        this.player.setFillStyle(0xff0000);
        this.add.rectangle(195, 420, 280, 160, 0x0f0f23, 0.95).setDepth(30).setStrokeStyle(2, 0xe94560);
        this.add.text(195, 390, `💀 (${Math.floor(this.frames/60)}s)`, { fontSize: '20px', color: '#e94560' }).setOrigin(0.5).setDepth(31);
        this.add.text(195, 430, '[ Retry ]', { fontSize: '18px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 16, y: 8 } })
            .setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(195, 475, '[ Back ]', { fontSize: '16px', color: '#888' }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
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
