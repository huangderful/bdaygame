class MiniGameOrbit extends Phaser.Scene {
    constructor() { super('MiniGameOrbit'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.cx = 195; this.cy = 400;
        this.hits = 0;
        this.hitsNeeded = 5;
        this.rings = [
            { radius: 60, angle: 0, speed: 0.02, gapAngle: 0 },
            { radius: 100, angle: Math.PI / 3, speed: -0.015, gapAngle: Math.PI / 3 },
            { radius: 140, angle: Math.PI, speed: 0.025, gapAngle: Math.PI },
        ];
        this.gapSize = 0.6; // radians

        this.add.text(195, 50, 'ORBIT', { fontSize: '24px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.scoreText = this.add.text(195, 90, `0 / ${this.hitsNeeded}`, { fontSize: '16px', color: '#888' }).setOrigin(0.5);
        this.statusText = this.add.text(195, 700, 'Tap when gaps align!', { fontSize: '14px', color: '#666' }).setOrigin(0.5);

        this.gfx = this.add.graphics();

        // Center dot
        this.add.circle(this.cx, this.cy, 8, 0x4ecca3);

        this.input.on('pointerdown', () => { if (!this.done) this.checkAlignment(); });
    }

    update() {
        if (this.done) return;
        for (const r of this.rings) r.angle += r.speed;
        this.drawRings();
    }

    drawRings() {
        this.gfx.clear();
        for (const r of this.rings) {
            this.gfx.lineStyle(4, 0x4ecca3, 0.7);
            this.gfx.beginPath();
            const gapStart = r.angle + r.gapAngle;
            const gapEnd = gapStart + this.gapSize;
            for (let a = gapEnd; a < gapStart + Math.PI * 2; a += 0.05) {
                const x = this.cx + Math.cos(a) * r.radius;
                const y = this.cy + Math.sin(a) * r.radius;
                if (a === gapEnd) this.gfx.moveTo(x, y);
                else this.gfx.lineTo(x, y);
            }
            this.gfx.strokePath();
        }
    }

    checkAlignment() {
        // Check if all gaps are roughly at the same angle (top, angle ~= -PI/2)
        const targetAngle = -Math.PI / 2;
        let aligned = true;
        for (const r of this.rings) {
            const gapCenter = (r.angle + r.gapAngle + this.gapSize / 2) % (Math.PI * 2);
            const diff = Math.abs(((gapCenter - targetAngle) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
            if (diff > 0.5) { aligned = false; break; }
        }

        if (aligned) {
            this.hits++;
            this.scoreText.setText(`${this.hits} / ${this.hitsNeeded}`);
            this.statusText.setText('✓ Aligned!').setColor('#4ecca3');
            // Speed up
            for (const r of this.rings) r.speed *= 1.2;
            if (this.hits >= this.hitsNeeded) this.win();
            else this.time.delayedCall(500, () => this.statusText.setText('Tap when gaps align!').setColor('#666'));
        } else {
            this.statusText.setText('✗ Not aligned!').setColor('#e94560');
            this.time.delayedCall(500, () => this.statusText.setText('Tap when gaps align!').setColor('#666'));
        }
    }

    win() {
        this.done = true;
        const levels = this.registry.get('levels');
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.statusText.setText('✓ Page Unlocked!').setColor('#4ecca3');
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
