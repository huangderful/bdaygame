class MiniGameGravity extends Phaser.Scene {
    constructor() { super('MiniGameGravity'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.scrollX = 0;
        this.scrollSpeed = 2;
        this.gravityDir = 1; // 1 = down, -1 = up
        this.playerY = 422;
        this.playerVy = 0;
        this.gravity = 0.4;

        this.add.text(195, 30, 'GRAVITY', { fontSize: '20px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.add.text(195, 55, 'Tap to flip gravity!', { fontSize: '12px', color: '#666' }).setOrigin(0.5);

        // Corridor bounds
        this.corridorTop = 150;
        this.corridorBot = 694;
        this.corridorH = this.corridorBot - this.corridorTop;

        // Generate obstacles
        this.obstacles = [];
        for (let x = 400; x < 5000; x += Phaser.Math.Between(150, 250)) {
            const fromTop = Math.random() > 0.5;
            const h = Phaser.Math.Between(80, 200);
            this.obstacles.push({ x, fromTop, h });
        }
        this.winX = 5000;

        this.gfx = this.add.graphics();
        this.player = this.add.rectangle(80, this.playerY, 16, 16, 0x4ecca3).setDepth(10);

        this.input.on('pointerdown', () => { if (!this.done) this.gravityDir *= -1; });
    }

    update() {
        if (this.done) return;
        this.scrollX += this.scrollSpeed;

        // Physics
        this.playerVy += this.gravity * this.gravityDir;
        this.playerVy = Phaser.Math.Clamp(this.playerVy, -8, 8);
        this.playerY += this.playerVy;
        this.player.y = this.playerY;

        // Corridor bounds
        if (this.playerY < this.corridorTop + 10 || this.playerY > this.corridorBot - 10) { this.die(); return; }

        // Draw
        this.gfx.clear();
        this.gfx.fillStyle(0x16213e);
        this.gfx.fillRect(0, this.corridorTop, 390, this.corridorH);
        this.gfx.lineStyle(2, 0x4ecca3);
        this.gfx.lineBetween(0, this.corridorTop, 390, this.corridorTop);
        this.gfx.lineBetween(0, this.corridorBot, 390, this.corridorBot);

        // Obstacles
        for (const obs of this.obstacles) {
            const screenX = obs.x - this.scrollX;
            if (screenX < -30 || screenX > 420) continue;
            const oy = obs.fromTop ? this.corridorTop : this.corridorBot - obs.h;
            this.gfx.fillStyle(0xe94560, 0.8);
            this.gfx.fillRect(screenX, oy, 25, obs.h);

            // Collision
            if (screenX > 60 && screenX < 100) {
                if (obs.fromTop && this.playerY < this.corridorTop + obs.h + 10) { this.die(); return; }
                if (!obs.fromTop && this.playerY > this.corridorBot - obs.h - 10) { this.die(); return; }
            }
        }

        // Win
        if (this.scrollX >= this.winX) this.win();
    }

    die() {
        this.done = true;
        if (window.Native) window.Native.vibrate(200);
        this.player.setFillStyle(0xff0000);
        this.add.rectangle(195, 422, 280, 160, 0x0f0f23, 0.95).setDepth(30).setStrokeStyle(2, 0xe94560);
        this.add.text(195, 392, '💀 Crashed!', { fontSize: '20px', color: '#e94560' }).setOrigin(0.5).setDepth(31);
        this.add.text(195, 432, '[ Retry ]', { fontSize: '18px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 16, y: 8 } })
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
        this.add.text(195, 422, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5).setDepth(20);
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
