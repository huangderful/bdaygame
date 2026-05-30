class MiniGameDodge extends Phaser.Scene {
    constructor() { super('MiniGameDodge'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.frames = 0;
        this.surviveFrames = 1200; // 20 seconds at 60fps
        this.drops = [];
        this.gfx = this.add.graphics().setDepth(5);

        this.add.text(195, 30, 'DODGE', { fontSize: '20px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.timerText = this.add.text(195, 55, '', { fontSize: '14px', color: '#888' }).setOrigin(0.5);

        // Player
        this.px = 195;
        this.player = this.add.circle(this.px, 750, 10, 0x4ecca3).setDepth(10);

        // Touch drag
        this.input.on('pointermove', (p) => { if (p.isDown && !this.done) this.px = Phaser.Math.Clamp(p.x, 20, 370); });
        this.input.on('pointerdown', (p) => { if (!this.done) this.px = Phaser.Math.Clamp(p.x, 20, 370); });
    }

    update() {
        if (this.done) return;
        this.frames++;
        this.player.x = this.px;

        const remaining = Math.max(0, (this.surviveFrames - this.frames) / 60);
        this.timerText.setText(`${remaining.toFixed(1)}s`);

        if (this.frames >= this.surviveFrames) { this.win(); return; }

        // Spawn drops (increasing density)
        const spawnRate = Math.max(2, 10 - Math.floor(this.frames / 120));
        if (this.frames % spawnRate === 0) {
            this.drops.push({ x: Phaser.Math.Between(20, 370), y: 0, speed: Phaser.Math.Between(3, 5 + Math.floor(this.frames / 200)) });
        }

        // Move + draw drops
        this.gfx.clear();
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            d.y += d.speed;
            if (d.y > 844) { this.drops.splice(i, 1); continue; }
            this.gfx.fillStyle(0xe94560, 0.8);
            this.gfx.fillRect(d.x - 4, d.y - 8, 8, 16);

            // Collision
            if (Math.abs(d.x - this.px) < 14 && Math.abs(d.y - 750) < 18) { this.die(); return; }
        }
    }

    die() {
        this.done = true;
        if (window.Native) window.Native.vibrate(200);
        this.player.setFillStyle(0xff0000);
        const cx = 195;
        this.add.rectangle(cx, 400, 280, 160, 0x0f0f23, 0.95).setDepth(30).setStrokeStyle(2, 0xe94560);
        this.add.text(cx, 370, `💀 Hit! (${Math.floor(this.frames/60)}s)`, { fontSize: '20px', color: '#e94560' }).setOrigin(0.5).setDepth(31);
        this.add.text(cx, 410, '[ Retry ]', { fontSize: '18px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 16, y: 8 } })
            .setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(cx, 455, '[ Back ]', { fontSize: '16px', color: '#888' }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }

    win() {
        this.done = true;
        const levels = this.registry.get('levels');
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.add.text(195, 400, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5);
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
