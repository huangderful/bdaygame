class MiniGameSteady extends Phaser.Scene {
    constructor() { super('MiniGameSteady'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.add.text(195, 30, 'STEADY', { fontSize: '20px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.add.text(195, 55, 'Trace the line without touching edges', { fontSize: '11px', color: '#666' }).setOrigin(0.5);

        // Generate curving path with decreasing width
        this.pathPoints = [];
        this.pathWidths = [];
        let x = 195;
        for (let y = 120; y < 750; y += 8) {
            x += Math.sin(y * 0.02) * 4 + Phaser.Math.FloatBetween(-2, 2);
            x = Phaser.Math.Clamp(x, 60, 330);
            this.pathPoints.push({ x, y });
            const progress = (y - 120) / 630;
            this.pathWidths.push(30 - progress * 18); // 30px -> 12px
        }

        // Draw path
        this.pathGfx = this.add.graphics();
        this.pathGfx.fillStyle(0x16213e);
        for (let i = 0; i < this.pathPoints.length; i++) {
            const p = this.pathPoints[i], w = this.pathWidths[i];
            this.pathGfx.fillRect(p.x - w / 2, p.y - 4, w, 10);
        }

        // Start/end
        this.add.circle(this.pathPoints[0].x, this.pathPoints[0].y, 8, 0x4ecca3);
        this.add.circle(this.pathPoints[this.pathPoints.length - 1].x, this.pathPoints[this.pathPoints.length - 1].y, 8, 0xffaa00);

        this.player = this.add.circle(this.pathPoints[0].x, this.pathPoints[0].y, 5, 0xffffff).setDepth(10);
        this.trailGfx = this.add.graphics().setDepth(8);
        this.trail = [];

        this.input.on('pointermove', (p) => {
            if (!p.isDown || this.done) return;
            this.player.x = p.x; this.player.y = p.y;
            this.trail.push({ x: p.x, y: p.y });
            this.drawTrail();
            this.checkBounds();
        });
    }

    drawTrail() {
        this.trailGfx.clear();
        this.trailGfx.lineStyle(2, 0x4ecca3, 0.5);
        if (this.trail.length < 2) return;
        this.trailGfx.beginPath();
        this.trailGfx.moveTo(this.trail[0].x, this.trail[0].y);
        for (let i = 1; i < this.trail.length; i++) this.trailGfx.lineTo(this.trail[i].x, this.trail[i].y);
        this.trailGfx.strokePath();
    }

    checkBounds() {
        const py = this.player.y;
        let nearest = this.pathPoints[0], nearestW = this.pathWidths[0];
        let minD = Infinity;
        for (let i = 0; i < this.pathPoints.length; i++) {
            const d = Math.abs(this.pathPoints[i].y - py);
            if (d < minD) { minD = d; nearest = this.pathPoints[i]; nearestW = this.pathWidths[i]; }
        }
        if (Math.abs(this.player.x - nearest.x) > nearestW / 2) {
            // Hit edge - vibrate and flash
            this.player.setFillStyle(0xff0000);
            if (window.Native) window.Native.vibrate(30);
            this.time.delayedCall(200, () => this.player.setFillStyle(0xffffff));
            // Push back slightly
            this.player.x = nearest.x;
        }

        // Check win
        const end = this.pathPoints[this.pathPoints.length - 1];
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, end.x, end.y) < 15) this.win();
    }

    win() {
        this.done = true;
        const levels = this.registry.get('levels');
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.add.text(195, 400, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5).setDepth(20);
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
