class MiniGameSpinner extends Phaser.Scene {
    constructor() { super('MiniGameSpinner'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.frames = 0;
        this.surviveFrames = 1500; // 25 seconds

        this.add.text(195, 30, 'SPINNER', { fontSize: '20px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.timerText = this.add.text(195, 60, '', { fontSize: '14px', color: '#888' }).setOrigin(0.5);

        // 4 meters
        this.meters = [];
        const colors = [0xe94560, 0x4ecca3, 0x4444ff, 0xffaa00];
        const labels = ['❤️', '💚', '💙', '💛'];
        for (let i = 0; i < 4; i++) {
            const x = 60 + i * 95;
            const meter = { value: 100, drainRate: 0.3 + i * 0.1, color: colors[i] };
            this.add.text(x, 130, labels[i], { fontSize: '20px' }).setOrigin(0.5);
            meter.bg = this.add.rectangle(x, 420, 50, 400, 0x16213e).setStrokeStyle(1, 0x333333);
            meter.fill = this.add.rectangle(x, 620, 46, 0, colors[i]).setOrigin(0.5, 1);
            meter.btn = this.add.rectangle(x, 720, 70, 60, colors[i], 0.3).setStrokeStyle(2, colors[i]).setInteractive({ useHandCursor: true });
            meter.btn.on('pointerdown', () => { if (!this.done) meter.value = Math.min(100, meter.value + 25); });
            this.meters.push(meter);
        }
    }

    update() {
        if (this.done) return;
        this.frames++;

        const remaining = (this.surviveFrames - this.frames) / 60;
        this.timerText.setText(`${remaining.toFixed(1)}s`);
        if (this.frames >= this.surviveFrames) { this.win(); return; }

        // Drain rate increases over time
        const speedMult = 1 + this.frames / 1000;

        for (const m of this.meters) {
            m.value -= m.drainRate * speedMult * (1/60) * 10;
            m.value = Math.max(0, m.value);
            m.fill.height = (m.value / 100) * 396;

            if (m.value <= 0) { this.fail(); return; }
        }
    }

    fail() {
        this.done = true;
        if (window.Native) window.Native.vibrate(200);
        this.add.rectangle(195, 420, 280, 160, 0x0f0f23, 0.95).setDepth(30).setStrokeStyle(2, 0xe94560);
        this.add.text(195, 390, '💀 Meter empty!', { fontSize: '18px', color: '#e94560' }).setOrigin(0.5).setDepth(31);
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
