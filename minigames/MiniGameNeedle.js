class MiniGameNeedle extends Phaser.Scene {
    constructor() { super('MiniGameNeedle'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.add.text(195, 30, 'NEEDLE', { fontSize: '20px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);

        // Generate winding path
        this.pathWidth = 40;
        this.pathPoints = [];
        let x = 195;
        for (let y = 100; y < 750; y += 10) {
            x += Phaser.Math.Between(-8, 8);
            x = Phaser.Math.Clamp(x, 50, 340);
            this.pathPoints.push({ x, y });
        }

        // Draw path
        this.pathGfx = this.add.graphics();
        this.pathGfx.fillStyle(0x16213e);
        for (const p of this.pathPoints) {
            this.pathGfx.fillRect(p.x - this.pathWidth / 2, p.y - 5, this.pathWidth, 12);
        }

        // Start/end markers
        const start = this.pathPoints[0], end = this.pathPoints[this.pathPoints.length - 1];
        this.add.circle(start.x, start.y, 8, 0x4ecca3).setDepth(10);
        this.add.circle(end.x, end.y, 8, 0xffaa00).setDepth(10);

        // Player dot
        this.player = this.add.circle(start.x, start.y, 6, 0xffffff).setDepth(15);
        this.started = false;

        this.input.on('pointermove', (p) => {
            if (this.done) return;
            if (!p.isDown) return;
            this.started = true;
            this.player.x = p.x;
            this.player.y = p.y;
            this.checkBounds();
        });
    }

    checkBounds() {
        if (!this.started) return;
        const py = this.player.y;
        // Find nearest path point
        let nearest = this.pathPoints[0], minDist = Infinity;
        for (const p of this.pathPoints) {
            const d = Math.abs(p.y - py);
            if (d < minDist) { minDist = d; nearest = p; }
        }
        const dx = Math.abs(this.player.x - nearest.x);
        if (dx > this.pathWidth / 2) {
            // Hit wall - flash red, reset to start
            this.player.setFillStyle(0xff0000);
            this.time.delayedCall(300, () => {
                this.player.setFillStyle(0xffffff);
                this.player.x = this.pathPoints[0].x;
                this.player.y = this.pathPoints[0].y;
            });
            if (window.Native) window.Native.vibrate(50);
        }

        // Check win
        const end = this.pathPoints[this.pathPoints.length - 1];
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, end.x, end.y) < 15) {
            this.win();
        }
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
