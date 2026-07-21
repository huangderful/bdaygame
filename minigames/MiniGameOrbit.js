class MiniGameOrbit extends Phaser.Scene {
    constructor() { super('MiniGameOrbit'); }
    init(data) { this.levelIndex = data.levelIndex; }

    preload() { FeedbackFX.preload(this); }

    create() {
        this.done = false;
        this.transitioning = false;
        this.falling = false;

        this.cx = 195;
        this.cy = 400;
        this.gapSize = 0.55;      // radians, arc opening (~0.5)
        this.fallSpeed = 2;       // px per frame while held
        this.totalRounds = DevConfig.stages(5);
        this.round = 1;

        // Ring colors (innermost -> outermost)
        this.ringColors = [0x4ecca3, 0xffaa00, 0x64b5ff];

        // Time limit: 2 minutes 2 seconds = 122s
        this.timeLimitMs = DevConfig.time(122) * 1000;
        this.timeLeft = this.timeLimitMs;

        // --- HUD ---
        this.add.text(195, 40, 'ORBIT', { fontSize: '24px', color: '#e63030', fontStyle: 'bold' }).setOrigin(0.5);
        this.roundText = this.add.text(195, 75, `Round ${this.round} / ${this.totalRounds}`, { fontSize: '16px', color: '#888' }).setOrigin(0.5);
        this.timerText = this.add.text(195, 105, '', { fontSize: '16px', color: '#888' }).setOrigin(0.5);
        this.add.text(195, 790, 'HOLD to descend — the ball only moves DOWN', { fontSize: '13px', color: '#666' }).setOrigin(0.5);

        this.gfx = this.add.graphics();

        // Center hub + ball (ball only moves DOWN, x stays at center)
        this.add.circle(this.cx, this.cy, 5, 0x333355).setDepth(5);
        this.ball = this.add.circle(this.cx, this.cy, 7, 0xffe66d).setDepth(10);

        // Opaque arrow under the ball showing its only direction of travel: DOWN.
        // Solid triangle in the ball's color, ~14px wide, tip pointing down.
        this.arrow = this.add.triangle(this.cx, this.cy + 16, 0, 0, 14, 0, 7, 10, 0xffe66d).setDepth(10);

        this.initRings();
        this.updateTimer();

        // Hold-to-fall: press to descend, release to stop.
        // Track the raw held state only; update() derives `falling` from it each
        // frame, so a finger kept down through a wall hit or a round transition
        // resumes the descent instead of leaving the ball frozen until re-press.
        this.pointerHeld = false;
        this.input.on('pointerdown', () => { this.pointerHeld = true; });
        this.input.on('pointerup', () => { this.pointerHeld = false; });
        this.input.on('pointerupoutside', () => { this.pointerHeld = false; });
        this.input.on('gameout', () => { this.pointerHeld = false; });
    }

    initRings() {
        const radii = [60, 105, 150];
        const speeds = [0.020, -0.016, 0.013];
        // Rings rotate 1.4x faster each round (this.round is 1-based: round 1 = 1x).
        const roundScale = Math.pow(1.4, this.round - 1);
        this.rings = radii.map((radius, i) => ({
            radius,
            angle: Math.random() * Math.PI * 2,   // current gap-start angle (rotates)
            speed: speeds[i] * roundScale,
            color: this.ringColors[i],
        }));
    }

    resetBall() {
        this.ball.setPosition(this.cx, this.cy);
        this.arrow.setPosition(this.cx, this.cy + 16);
    }

    updateTimer() {
        const total = Math.max(0, Math.ceil(this.timeLeft / 1000));
        const m = Math.floor(total / 60);
        const s = (total % 60).toString().padStart(2, '0');
        this.timerText.setText(`${m}:${s}`);
    }

    update(time, delta) {
        if (this.done) return;

        // Countdown
        this.timeLeft -= delta;
        if (this.timeLeft <= 0) {
            this.timeLeft = 0;
            this.updateTimer();
            this.timeUp();
            return;
        }
        this.updateTimer();

        // Rotate ring gaps
        for (const r of this.rings) r.angle += r.speed;

        // Descend while held. Derived every frame from the raw pointer state so
        // holding through a wall hit / round transition keeps working.
        this.falling = this.pointerHeld && !this.transitioning;
        if (this.falling) {
            this.ball.y += this.fallSpeed;
            this.resolveCollisions();
        }

        // Keep the down-arrow glued below the ball; hide it mid-transition.
        this.arrow.setPosition(this.ball.x, this.ball.y + 16);
        this.arrow.setVisible(!this.transitioning);

        this.drawRings();
    }

    drawRings() {
        this.gfx.clear();
        for (const r of this.rings) {
            this.gfx.lineStyle(4, r.color, 0.9);
            this.gfx.beginPath();
            // The wall spans from the gap's end all the way around to the gap's start.
            const gapEnd = r.angle + this.gapSize;
            const wallEnd = r.angle + Math.PI * 2;
            this.gfx.moveTo(this.cx + Math.cos(gapEnd) * r.radius, this.cy + Math.sin(gapEnd) * r.radius);
            for (let a = gapEnd + 0.05; a < wallEnd; a += 0.05) {
                this.gfx.lineTo(this.cx + Math.cos(a) * r.radius, this.cy + Math.sin(a) * r.radius);
            }
            // Close exactly at the gap's start so the drawn gap matches the collision gap.
            this.gfx.lineTo(this.cx + Math.cos(wallEnd) * r.radius, this.cy + Math.sin(wallEnd) * r.radius);
            this.gfx.strokePath();
        }
    }

    // True if `angle` falls within the gap interval [gapStart, gapEnd] (mod 2PI).
    angleInGap(angle, gapStart, gapEnd) {
        const twoPi = Math.PI * 2;
        const a = ((angle % twoPi) + twoPi) % twoPi;
        const gs = ((gapStart % twoPi) + twoPi) % twoPi;
        const ge = ((gapEnd % twoPi) + twoPi) % twoPi;
        if (gs <= ge) return a >= gs && a <= ge;
        return a >= gs || a <= ge;   // gap wraps past 2PI
    }

    resolveCollisions() {
        let guard = 0;
        while (!this.done && !this.transitioning && this.rings.length > 0 && guard < 8) {
            guard++;
            // Innermost still-active ring
            let ring = null;
            for (const r of this.rings) if (!ring || r.radius < ring.radius) ring = r;

            const ballDist = this.ball.y - this.cy;   // ball is straight below center
            if (ballDist < ring.radius) break;

            // Ball has reached this ring's radius. Bottom of the ring is angle +PI/2.
            if (this.angleInGap(Math.PI / 2, ring.angle, ring.angle + this.gapSize)) {
                this.shatterRing(ring);
                this.rings = this.rings.filter(r => r !== ring);
                if (this.rings.length === 0) { this.roundCleared(); return; }
                // continue: the ball keeps falling toward the next ring
            } else {
                this.wallHit();
                return;   // round reset; ball back at center
            }
        }
    }

    // Break a ring into a burst of tiny particles along its circumference.
    shatterRing(ring) {
        FeedbackFX.playPositive(this);
        const count = Phaser.Math.Between(20, 30);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const px = this.cx + Math.cos(a) * ring.radius;
            const py = this.cy + Math.sin(a) * ring.radius;
            const size = Phaser.Math.Between(2, 3);
            const p = this.add.rectangle(px, py, size, size, ring.color).setDepth(15);
            const dist = Phaser.Math.FloatBetween(30, 90);
            this.tweens.add({
                targets: p,
                x: px + Math.cos(a) * dist,
                y: py + Math.sin(a) * dist,
                alpha: 0,
                duration: 500,
                onComplete: () => p.destroy(),
            });
        }
    }

    wallHit() {
        // Loss feedback from the ball's current position, then reset the round.
        FeedbackFX.playNegative(this);
        FeedbackFX.fountain(this, this.ball.x, this.ball.y, false);
        if (window.Native) window.Native.vibrate(120);

        this.falling = false;
        this.resetBall();
        this.initRings();   // restore all 3 rings
    }

    roundCleared() {
        // Win feedback from the ball's current position (fires for every round, incl. the 5th).
        FeedbackFX.playPositive(this);
        FeedbackFX.fountain(this, this.ball.x, this.ball.y, true);

        this.rings = [];
        this.falling = false;

        if (this.round >= this.totalRounds) { this.win(); return; }

        this.round++;
        this.roundText.setText(`Round ${this.round} / ${this.totalRounds}`);
        this.transitioning = true;
        this.time.delayedCall(900, () => {
            if (this.done) return;
            this.resetBall();
            this.initRings();
            this.transitioning = false;
        });
    }

    timeUp() {
        // Final time-out counts as a loss for feedback, then fail modal.
        FeedbackFX.playNegative(this);
        FeedbackFX.fountain(this, this.ball.x, this.ball.y, false);
        this.fail();
    }

    fail() {
        this.done = true;
        if (window.Native) window.Native.vibrate(200);
        this.add.rectangle(195, 420, 300, 180, 0x0f0f23, 0.95).setDepth(30).setStrokeStyle(2, 0xe63030);
        this.add.text(195, 375, "⏱ Time's Up!", { fontSize: '22px', color: '#e63030' }).setOrigin(0.5).setDepth(31);
        this.add.text(195, 410, `Reached round ${this.round} / ${this.totalRounds}`, { fontSize: '14px', color: '#888' }).setOrigin(0.5).setDepth(31);
        this.add.text(195, 445, '[ Retry ]', { fontSize: '18px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 16, y: 8 } })
            .setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(195, 490, '[ Back ]', { fontSize: '16px', color: '#888' }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }

    win() {
        this.done = true;
        const levels = this.registry.get('levels');
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.add.text(195, 420, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5).setDepth(40);
        this.time.delayedCall(1200, () => this.scene.start('PartReveal', { levelIndex: this.levelIndex }));
    }
}
