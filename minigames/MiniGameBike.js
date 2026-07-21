// BIKE — pedal (draw circles) + steer (swipe) loop.
// 11 cycles: each cycle = draw 2 circles (>=75% accuracy) then perform N swipes.
// The 11 cycles' swipe counts total exactly 33. 22 second limit for the whole game.
// Circle scoring lifted from the (now-deleted) MiniGameDraw: scoreCircle / getBounds / closureScore.
class MiniGameBike extends Phaser.Scene {
    constructor() { super('MiniGameBike'); }

    init(data) { this.levelIndex = data.levelIndex ?? 13; }

    preload() { FeedbackFX.preload(this); }

    create() {
        const cx = this.scale.width / 2;
        this.cx = cx;

        // --- Game constants ---
        this.NUM_CYCLES = DevConfig.stages(11); // 2 in dev
        this.CIRCLES_PER_CYCLE = 2;
        this.CIRCLE_PASS = 0.75;
        this.TOTAL_CIRCLES = this.NUM_CYCLES * this.CIRCLES_PER_CYCLE; // 22 in prod, 4 in dev
        this.timeLimit = DevConfig.time(44);
        this.SWIPE_MIN_DIST = 60;
        this.ARROW_CX = cx;
        this.ARROW_CY = 440;

        // --- State ---
        this.done = false;
        this.startTime = null;
        this.cycleIndex = 0;
        this.circlesInCycle = 0;
        this.totalCircles = 0;
        this.phase = 'circle';        // 'circle' | 'swipe'
        this.points = [];
        this.drawing = false;
        this.swipeStart = null;
        this.swipeIndex = 0;
        this.swipeDirs = [];

        // Pre-generate swipe counts. Prod: 11 counts in [1..5] summing to exactly 33.
        // Dev: only 2 cycles, so the sum-to-33 constraint is impossible — just pick
        // each cycle's count uniformly in [1..5] with no sum constraint.
        this.swipeCounts = DevConfig.on
            ? Array.from({ length: this.NUM_CYCLES }, () => Phaser.Math.Between(1, 5))
            : this.genSwipeCounts(this.NUM_CYCLES, 33);

        // --- Static header ---
        this.add.text(cx, 34, 'BIKE', { fontSize: '36px', color: '#e63030', fontStyle: 'bold' }).setOrigin(0.5);
        this.counterText = this.add.text(cx, 72, '', { fontSize: '20px', color: '#4ecca3' }).setOrigin(0.5);
        this.timerText = this.add.text(cx, 104, '⏱ tap to start', { fontSize: '16px', color: '#888' }).setOrigin(0.5);

        // --- Circle-phase UI (same look as the old Draw game) ---
        this.promptText = this.add.text(cx, 150, '', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
        this.box = this.add.rectangle(cx, this.ARROW_CY, 340, 480, 0x16213e).setStrokeStyle(2, 0x333333);
        this.graphics = this.add.graphics().setDepth(10);
        this.scoreText = this.add.text(cx, 710, '', { fontSize: '18px', color: '#4ecca3' }).setOrigin(0.5);

        // --- Swipe-phase UI ---
        this.arrowGraphics = this.add.graphics().setDepth(6);
        this.swipeText = this.add.text(cx, 180, '', { fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.swipeHint = this.add.text(cx, 640, 'Swipe (or arrow-key) the way the arrow points!', { fontSize: '14px', color: '#888' }).setOrigin(0.5);

        // --- Input (dispatched by phase) ---
        this.input.on('pointerdown', (p) => this.onPointerDown(p));
        this.input.on('pointermove', (p) => this.onPointerMove(p));
        this.input.on('pointerup', (p) => this.onPointerUp(p));

        // Arrow keys also steer during the swipe phase.
        this.onArrowKey = (e) => {
            const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
            const dir = map[e.key];
            if (dir) { e.preventDefault(); this.applyDirection(dir); }
        };
        this.input.keyboard.on('keydown', this.onArrowKey);
        this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onArrowKey));
        this.events.once('destroy', () => this.input.keyboard.off('keydown', this.onArrowKey));

        this.updateCounter();
        this.startCycle();
    }

    // ---------- Swipe-count generation ----------
    // Distribute-then-fill: start every cycle at 1 (sum = n), then hand out the
    // remaining (target - n) swipes one at a time to random cycles, capping at 5.
    genSwipeCounts(n, target) {
        const arr = new Array(n).fill(1);
        let remaining = target - n;
        let guard = 100000;
        while (remaining > 0 && guard-- > 0) {
            const i = Phaser.Math.Between(0, n - 1);
            if (arr[i] < 5) { arr[i]++; remaining--; }
        }
        return arr;
    }

    // ---------- Cycle / phase flow ----------
    startCycle() {
        this.circlesInCycle = 0;
        this.swipeIndex = 0;
        const count = this.swipeCounts[this.cycleIndex];
        this.swipeDirs = [];
        for (let i = 0; i < count; i++) {
            this.swipeDirs.push(Phaser.Utils.Array.GetRandom(['up', 'down', 'left', 'right']));
        }
        this.enterCirclePhase();
    }

    enterCirclePhase() {
        this.phase = 'circle';
        this.setCircleUIVisible(true);
        this.setSwipeUIVisible(false);
        this.showCircle();
    }

    showCircle() {
        this.points = [];
        this.drawing = false;
        this.graphics.clear();
        this.scoreText.setText('');
        this.promptText.setText(
            `Cycle ${this.cycleIndex + 1}/${this.NUM_CYCLES} — draw a circle (${this.circlesInCycle + 1}/${this.CIRCLES_PER_CYCLE})`
        );
    }

    enterSwipePhase() {
        this.phase = 'swipe';
        this.swipeStart = null;
        this.setCircleUIVisible(false);
        this.setSwipeUIVisible(true);
        this.showSwipe();
    }

    showSwipe() {
        const dir = this.swipeDirs[this.swipeIndex];
        const count = this.swipeCounts[this.cycleIndex];
        this.swipeText.setText(`SWIPE ${dir.toUpperCase()}  (${this.swipeIndex + 1} of ${count})`);
        this.drawArrow(dir);
    }

    setCircleUIVisible(v) {
        this.box.setVisible(v);
        this.graphics.setVisible(v);
        this.promptText.setVisible(v);
        this.scoreText.setVisible(v);
    }

    setSwipeUIVisible(v) {
        this.arrowGraphics.setVisible(v);
        this.swipeText.setVisible(v);
        this.swipeHint.setVisible(v);
    }

    updateCounter() {
        this.counterText.setText(`Circles: ${this.totalCircles} / ${this.TOTAL_CIRCLES}`);
    }

    // ---------- Pointer handling ----------
    onPointerDown(p) {
        if (this.done) return;
        if (!this.startTime) this.startTime = this.time.now;
        if (this.phase === 'circle') {
            this.drawing = true;
            this.points = [{ x: p.x, y: p.y }];
            this.graphics.clear();
        } else {
            this.swipeStart = { x: p.x, y: p.y };
        }
    }

    onPointerMove(p) {
        if (this.done || this.phase !== 'circle') return;
        if (!this.drawing || !p.isDown) return;
        this.points.push({ x: p.x, y: p.y });
        this.redraw();
    }

    onPointerUp(p) {
        if (this.done) return;
        if (this.phase === 'circle') {
            if (!this.drawing) return;
            this.drawing = false;
            this.evaluateCircle();
        } else {
            if (!this.swipeStart) return;
            const dx = p.x - this.swipeStart.x;
            const dy = p.y - this.swipeStart.y;
            this.swipeStart = null;
            this.evaluateSwipe(dx, dy);
        }
    }

    // ---------- Circle phase ----------
    redraw() {
        this.graphics.clear();
        if (this.points.length < 2) return;
        this.graphics.lineStyle(4, 0xe63030);
        this.graphics.beginPath();
        this.graphics.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            this.graphics.lineTo(this.points[i].x, this.points[i].y);
        }
        this.graphics.strokePath();
    }

    evaluateCircle() {
        const score = this.circleScore(this.points);
        const pct = Math.round(score * 100);
        if (score >= this.CIRCLE_PASS) {
            this.totalCircles++;
            this.circlesInCycle++;
            this.updateCounter();
            if (this.circlesInCycle >= this.CIRCLES_PER_CYCLE) {
                // Switch immediately: delaying here would let an extra circle be
                // accepted during the wait and double-fire the phase transition.
                this.enterSwipePhase();
            } else {
                // showCircle() resets the canvas (and clears scoreText), so set
                // the success tick after it or the player never sees it.
                this.showCircle();
                this.scoreText.setText(`✓ ${pct}%`).setColor('#4ecca3');
            }
        } else {
            // No level fail — just let them redraw (next pointerdown clears the stroke).
            this.scoreText.setText(`✗ ${pct}% — again!`).setColor('#e63030');
        }
    }

    circleScore(pts) {
        if (pts.length < 10) return 0;
        const b = this.getBounds(pts);
        if (b.w < 30 || b.h < 30) return 0;
        return this.scoreCircle(pts, b.cx, b.cy, b.w, b.h);
    }

    // --- Lifted from MiniGameDraw ---
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

    closureScore(pts, size) {
        const first = pts[0], last = pts[pts.length - 1];
        const d = Math.sqrt((first.x - last.x) ** 2 + (first.y - last.y) ** 2);
        return Math.max(0, 1 - d / (size * 0.5));
    }

    getBounds(pts) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of pts) {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
        return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
    }

    // ---------- Swipe phase ----------
    evaluateSwipe(dx, dy) {
        this.applyDirection(this.resolveSwipe(dx, dy));
    }

    // Shared by swipes and arrow keys.
    applyDirection(dir) {
        if (this.done || this.phase !== 'swipe') return;
        if (!dir) return; // too short / no direction — wait for a real input
        if (dir === this.swipeDirs[this.swipeIndex]) {
            this.swipeIndex++;
            if (this.swipeIndex >= this.swipeCounts[this.cycleIndex]) {
                this.completeCycle();
            } else {
                this.showSwipe();
            }
        } else {
            this.shakeArrow();
        }
    }

    resolveSwipe(dx, dy) {
        const absX = Math.abs(dx), absY = Math.abs(dy);
        if (Math.max(absX, absY) < this.SWIPE_MIN_DIST) return null;
        if (absX > absY) return dx > 0 ? 'right' : 'left';
        return dy > 0 ? 'down' : 'up';
    }

    completeCycle() {
        FeedbackFX.playPositive(this);
        this.cycleIndex++;
        if (this.cycleIndex >= this.NUM_CYCLES) {
            this.win();
        } else {
            this.startCycle();
        }
    }

    // Big arrow (~150px) pointing `dir`, built from an up-arrow polygon rotated into place.
    drawArrow(dir) {
        this.tweens.killTweensOf(this.arrowGraphics); // stop any in-flight shake
        this.arrowGraphics.x = 0;
        this.arrowGraphics.clear();
        const angleByDir = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
        const theta = angleByDir[dir] || 0;
        // Up-arrow points, relative to center (spans ~150px tall, ~100px wide).
        const base = [
            { x: 0, y: -75 },   // tip
            { x: 50, y: -5 },   // right head corner
            { x: 20, y: -5 },   // right head inner
            { x: 20, y: 75 },   // right shaft bottom
            { x: -20, y: 75 },  // left shaft bottom
            { x: -20, y: -5 },  // left head inner
            { x: -50, y: -5 }   // left head corner
        ];
        const cos = Math.cos(theta), sin = Math.sin(theta);
        const pts = base.map(pt => new Phaser.Geom.Point(
            this.ARROW_CX + pt.x * cos - pt.y * sin,
            this.ARROW_CY + pt.x * sin + pt.y * cos
        ));
        this.arrowGraphics.fillStyle(0x4ecca3, 1);
        this.arrowGraphics.fillPoints(pts, true);
        this.arrowGraphics.lineStyle(4, 0xffffff, 1);
        this.arrowGraphics.strokePoints(pts, true, true);
    }

    shakeArrow() {
        this.tweens.killTweensOf(this.arrowGraphics); // don't stack shakes
        this.tweens.add({
            targets: this.arrowGraphics,
            x: { from: -12, to: 12 },
            duration: 55,
            yoyo: true,
            repeat: 3,
            onComplete: () => { this.arrowGraphics.x = 0; }
        });
    }

    // ---------- Timer ----------
    update() {
        if (this.done || !this.startTime) return;
        const elapsed = (this.time.now - this.startTime) / 1000;
        const remaining = Math.max(0, this.timeLimit - elapsed);
        this.timerText.setText(`⏱ ${remaining.toFixed(1)}s`);
        if (remaining <= 0) {
            this.done = true;
            this.drawing = false;
            this.lose();
        }
    }

    // ---------- Win / lose ----------
    win() {
        this.done = true;
        const levels = this.registry.get('levels') || [];
        if (levels[this.levelIndex]) levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));

        const cx = this.cx;
        this.setCircleUIVisible(false);
        this.setSwipeUIVisible(false);
        this.timerText.setText('⏱ done!');
        this.add.text(cx, 420, `All ${this.NUM_CYCLES} laps ridden!`, { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
        this.add.text(cx, 470, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5);
        this.time.delayedCall(1200, () => this.scene.start('PartReveal', { levelIndex: this.levelIndex }));
    }

    lose() {
        FeedbackFX.playNegative(this);
        this.showFailModal('⏰ Time\'s up!');
    }

    showFailModal(msg) {
        const cx = this.cx;
        this.add.rectangle(cx, 422, 300, 200, 0x0f0f23, 0.95).setDepth(20).setStrokeStyle(2, 0xe63030);
        this.add.text(cx, 380, msg, { fontSize: '22px', color: '#e63030' }).setOrigin(0.5).setDepth(21);
        this.add.text(cx, 430, '[ Retry ]', {
            fontSize: '20px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(cx, 480, '[ Back ]', {
            fontSize: '18px', color: '#888'
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }
}
