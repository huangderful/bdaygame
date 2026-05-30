class MiniGameFuse extends Phaser.Scene {
    constructor() { super('MiniGameFuse'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.fuseNum = 0;
        this.totalFuses = 5;
        this.misses = 0;
        this.maxMisses = 2;

        this.add.text(195, 40, 'FUSE', { fontSize: '24px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.statusText = this.add.text(195, 80, '', { fontSize: '14px', color: '#888' }).setOrigin(0.5);
        this.resultText = this.add.text(195, 600, '', { fontSize: '18px' }).setOrigin(0.5);

        this.gfx = this.add.graphics();
        this.nextFuse();

        this.input.on('pointerdown', () => { if (!this.done && this.burning) this.cut(); });
    }

    nextFuse() {
        this.fuseNum++;
        if (this.fuseNum > this.totalFuses) { this.win(); return; }
        this.statusText.setText(`Fuse ${this.fuseNum}/${this.totalFuses} | Misses: ${this.misses}/${this.maxMisses}`);
        this.fuseX = 50;
        this.fuseSpeed = 1.5 + this.fuseNum * 0.8;
        this.fuseEnd = 340;
        this.burning = true;
        this.resultText.setText('TAP to cut!');
    }

    cut() {
        this.burning = false;
        const dist = Math.abs(this.fuseX - this.fuseEnd);
        if (dist < 15) {
            this.resultText.setText('✓ Perfect cut!').setColor('#4ecca3');
        } else {
            this.misses++;
            this.resultText.setText(`✗ Off by ${Math.round(dist)}px`).setColor('#e94560');
            if (this.misses >= this.maxMisses) { this.fail(); return; }
        }
        this.time.delayedCall(1000, () => this.nextFuse());
    }

    update() {
        if (this.done || !this.burning) return;
        this.fuseX += this.fuseSpeed;

        // Draw fuse
        this.gfx.clear();
        // Fuse line
        this.gfx.lineStyle(6, 0x888888);
        this.gfx.lineBetween(50, 400, 340, 400);
        // Target zone
        this.gfx.fillStyle(0x4ecca3, 0.3);
        this.gfx.fillRect(this.fuseEnd - 15, 380, 30, 40);
        // Burning point
        this.gfx.fillStyle(0xff6600);
        this.gfx.fillCircle(this.fuseX, 400, 8);
        // Burnt part
        this.gfx.lineStyle(6, 0x333333);
        this.gfx.lineBetween(50, 400, this.fuseX, 400);

        if (this.fuseX > 360) {
            this.burning = false;
            this.misses++;
            this.resultText.setText('✗ Too late! Boom!').setColor('#e94560');
            if (this.misses >= this.maxMisses) { this.fail(); return; }
            this.time.delayedCall(1000, () => this.nextFuse());
        }
    }

    fail() {
        this.done = true;
        if (window.Native) window.Native.vibrate(200);
        this.add.text(195, 500, '💥 Too many misses!', { fontSize: '20px', color: '#e94560' }).setOrigin(0.5);
        this.add.text(195, 550, '[ Retry ]', { fontSize: '18px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 16, y: 8 } })
            .setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
    }

    win() {
        this.done = true;
        const levels = this.registry.get('levels');
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.resultText.setText('✓ Page Unlocked!').setColor('#4ecca3');
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
