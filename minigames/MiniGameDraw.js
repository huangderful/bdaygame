class MiniGameDraw extends Phaser.Scene {
    constructor() { super('MiniGameDraw'); }

    init(data) { this.levelIndex = data.levelIndex ?? 1; }

    create() {
        const cx = this.scale.width / 2;
        this.shapes = ['square', 'circle', 'triangle'];
        this.shapeIndex = 0;
        this.points = [];
        this.drawing = false;
        this.timeLimit = 30;
        this.startTime = null;
        this.done = false;

        this.add.text(cx, 40, 'DRAW', { fontSize: '36px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.promptText = this.add.text(cx, 90, '', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
        this.timerText = this.add.text(cx, 130, '⏱ draw to start', { fontSize: '16px', color: '#888' }).setOrigin(0.5);
        this.scoreText = this.add.text(cx, 750, '', { fontSize: '18px', color: '#4ecca3' }).setOrigin(0.5);

        this.add.rectangle(cx, 420, 340, 500, 0x16213e).setStrokeStyle(2, 0x333333);
        this.graphics = this.add.graphics().setDepth(10);

        this.input.on('pointerdown', (p) => this.onDown(p));
        this.input.on('pointermove', (p) => this.onMove(p));
        this.input.on('pointerup', () => this.onUp());

        this.showShape();
    }

    showShape() {
        this.currentShape = this.shapes[this.shapeIndex];
        this.promptText.setText(`Draw a ${this.currentShape} (${this.shapeIndex + 1}/3)`);
        this.scoreText.setText('');
        this.points = [];
        this.graphics.clear();
        this.startTime = null;
        this.drawing = false;
    }

    onDown(p) {
        if (this.done) return;
        this.drawing = true;
        this.points = [{ x: p.x, y: p.y }];
        this.graphics.clear();
        if (!this.startTime) this.startTime = this.time.now;
    }

    onMove(p) {
        if (!this.drawing || this.done || !p.isDown) return;
        this.points.push({ x: p.x, y: p.y });
        this.redraw();
    }

    onUp() {
        if (!this.drawing || this.done) return;
        this.drawing = false;
        this.evaluate();
    }

    redraw() {
        this.graphics.clear();
        if (this.points.length < 2) return;
        this.graphics.lineStyle(4, 0xe94560);
        this.graphics.beginPath();
        this.graphics.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            this.graphics.lineTo(this.points[i].x, this.points[i].y);
        }
        this.graphics.strokePath();
    }

    evaluate() {
        const score = this.evaluateShape(this.currentShape, this.points);
        if (score >= 0.8) {
            this.scoreText.setText(`✓ ${this.currentShape}: ${Math.round(score * 100)}%`).setColor('#4ecca3');
            this.shapeIndex++;
            if (this.shapeIndex >= this.shapes.length) {
                this.win();
            } else {
                // Brief pause then next shape
                this.done = true;
                this.time.delayedCall(800, () => {
                    this.done = false;
                    this.startTime = null;
                    this.showShape();
                });
            }
        } else {
            this.scoreText.setText(`✗ ${Math.round(score * 100)}% — need 80%. Draw again!`).setColor('#e94560');
            // Don't clear — let them see their attempt, next pointerdown clears it
        }
    }

    update() {
        if (this.done || !this.startTime) return;
        const elapsed = (this.time.now - this.startTime) / 1000;
        const remaining = Math.max(0, this.timeLimit - elapsed);
        this.timerText.setText(`⏱ ${remaining.toFixed(1)}s`);
        if (remaining <= 0) {
            this.done = true;
            this.drawing = false;
            this.showFailModal('⏰ Time\'s up!');
        }
    }

    showFailModal(msg) {
        const cx = this.scale.width / 2;
        this.add.rectangle(cx, 422, 300, 200, 0x0f0f23, 0.95).setDepth(20).setStrokeStyle(2, 0xe94560);
        this.add.text(cx, 380, msg, { fontSize: '22px', color: '#e94560' }).setOrigin(0.5).setDepth(21);
        this.add.text(cx, 430, '[ Retry ]', {
            fontSize: '20px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(cx, 480, '[ Back ]', {
            fontSize: '18px', color: '#888'
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }

    evaluateShape(shape, pts) {
        if (pts.length < 10) return 0;
        const bounds = this.getBounds(pts);
        const { cx, cy, w, h } = bounds;
        if (w < 30 || h < 30) return 0;
        if (shape === 'circle') return this.scoreCircle(pts, cx, cy, w, h);
        if (shape === 'square') return this.scoreSquare(pts, cx, cy, w, h);
        if (shape === 'triangle') return this.scoreTriangle(pts, cx, cy, w, h);
        return 0;
    }

    scoreCircle(pts, cx, cy, w, h) {
        const aspectScore = 1 - Math.abs(1 - w / h) * 2;
        const radius = (w + h) / 4;
        let distSum = 0;
        for (const p of pts) {
            const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
            distSum += Math.abs(d - radius) / radius;
        }
        const radiusScore = 1 - distSum / pts.length;
        const closure = this.closureScore(pts, radius);
        return Math.max(0, aspectScore * 0.3 + radiusScore * 0.5 + closure * 0.2);
    }

    scoreSquare(pts, cx, cy, w, h) {
        const aspectScore = 1 - Math.abs(1 - w / h) * 2;
        const halfW = w / 2, halfH = h / 2;
        let edgeSum = 0;
        for (const p of pts) {
            const dx = Math.abs(p.x - cx), dy = Math.abs(p.y - cy);
            const distToEdge = Math.min(Math.abs(dx - halfW), Math.abs(dy - halfH));
            edgeSum += distToEdge / ((w + h) / 4);
        }
        const edgeScore = 1 - edgeSum / pts.length;
        const closure = this.closureScore(pts, (w + h) / 4);
        return Math.max(0, aspectScore * 0.3 + edgeScore * 0.5 + closure * 0.2);
    }

    scoreTriangle(pts, cx, cy, w, h) {
        const top = { x: cx, y: cy - h / 2 };
        const bl = { x: cx - w / 2, y: cy + h / 2 };
        const br = { x: cx + w / 2, y: cy + h / 2 };
        let edgeSum = 0;
        for (const p of pts) {
            const d = Math.min(
                this.distToSegment(p, top, bl),
                this.distToSegment(p, bl, br),
                this.distToSegment(p, br, top)
            );
            edgeSum += d / ((w + h) / 4);
        }
        const edgeScore = 1 - edgeSum / pts.length;
        const closure = this.closureScore(pts, (w + h) / 4);
        return Math.max(0, edgeScore * 0.7 + closure * 0.3);
    }

    closureScore(pts, size) {
        const first = pts[0], last = pts[pts.length - 1];
        const d = Math.sqrt((first.x - last.x) ** 2 + (first.y - last.y) ** 2);
        return Math.max(0, 1 - d / (size * 0.5));
    }

    distToSegment(p, a, b) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const proj = { x: a.x + t * dx, y: a.y + t * dy };
        return Math.sqrt((p.x - proj.x) ** 2 + (p.y - proj.y) ** 2);
    }

    getBounds(pts) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of pts) {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
        return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
    }

    win() {
        this.done = true;
        const levels = this.registry.get('levels') || [];
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));

        const cx = this.scale.width / 2;
        this.promptText.setText('All shapes drawn!');
        this.add.text(cx, 650, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5);
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
