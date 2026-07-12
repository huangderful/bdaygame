// LOCKPICK — Choo-Choo-Charles-style lockpicking minigame (level index 7).
// A ball runs around a ring; tap when it's over one of 2 target circles.
// Each successful tap reverses the ball's direction and speeds it up for the rest of the round.
// Bad tap (not over a target) or failing to hit both targets within 2 laps of travel = lose the level.
// 11 rounds, ball speeds up each round, no time limit. See docs/minigames/LOCKPICK.md.
class MiniGameLockpick extends Phaser.Scene {
    constructor() { super('MiniGameLockpick'); }

    init(data) { this.levelIndex = data.levelIndex ?? 8; }

    preload() { FeedbackFX.preload(this); }

    create() {
        this.done = false;
        this.transitioning = false;

        // Geometry
        this.cx = 195;
        this.cy = 400;
        this.ringRadius = 140;
        this.ballRadius = 8;
        this.targetRadius = 18;
        this.startAngle = -Math.PI / 2; // ball starts at the top

        // Round / difficulty config
        this.totalRounds = DevConfig.stages(11);
        this.round = 0;              // 0-based index of the current round
        this.baseSpeed = 1.2;        // rad/s on round 1
        this.speedMult = 1.1;        // +10% per round
        this.maxLaps = 2;
        this.roundStartSpeed = this.baseSpeed;

        // Runtime state (reset each round)
        this.totalAngle = 0;         // |radians| travelled since the round started (distance, direction-agnostic)
        this.angleOffset = 0;        // signed offset from startAngle (ball position)
        this.direction = 1;          // +1 = clockwise, -1 = counter-clockwise; flips on each successful tap
        this.speed = this.baseSpeed;
        this.targets = [];
        this.hitsThisRound = 0;
        this.ballX = this.cx + Math.cos(this.startAngle) * this.ringRadius;
        this.ballY = this.cy + Math.sin(this.startAngle) * this.ringRadius;

        // Dev-mode extra chances: bad taps / lap-outs are forgiven this many times.
        this.forgiveness = DevConfig.on ? 2 : 0;

        // HUD
        this.add.text(195, 50, 'LOCKPICK', { fontSize: '28px', color: '#e63030', fontStyle: 'bold' }).setOrigin(0.5);
        this.roundText = this.add.text(195, 95, '', { fontSize: '18px', color: '#4ecca3' }).setOrigin(0.5);
        this.lapText = this.add.text(195, 125, '', { fontSize: '14px', color: '#888' }).setOrigin(0.5);
        this.forgiveText = DevConfig.on
            ? this.add.text(195, 150, '', { fontSize: '13px', color: '#e9c046' }).setOrigin(0.5)
            : null;
        this.updateForgiveText();
        this.add.text(195, 720, 'Tap when the ball is over a circle!', { fontSize: '14px', color: '#666' }).setOrigin(0.5);

        // Static ring outline
        const ring = this.add.graphics();
        ring.lineStyle(4, 0x4ecca3, 0.5);
        ring.strokeCircle(this.cx, this.cy, this.ringRadius);

        // The running ball (drawn on top of everything else)
        this.ball = this.add.circle(this.ballX, this.ballY, this.ballRadius, 0xe63030).setDepth(10);

        this.input.on('pointerdown', () => this.onTap());

        this.startRound(0);
    }

    startRound(index) {
        this.round = index;
        this.transitioning = false;
        this.totalAngle = 0;
        this.angleOffset = 0;
        this.direction = 1;          // always start a round going the default way
        this.hitsThisRound = 0;
        // Simple ramp: each round starts 1.1x faster than the previous round's start.
        this.speed = this.baseSpeed * Math.pow(this.speedMult, index);
        this.roundStartSpeed = this.speed;

        // Reset ball to the start position
        this.ballX = this.cx + Math.cos(this.startAngle) * this.ringRadius;
        this.ballY = this.cy + Math.sin(this.startAngle) * this.ringRadius;
        this.ball.setPosition(this.ballX, this.ballY);

        // Clear any leftover target graphics
        this.targets.forEach(t => { if (t.circle) t.circle.destroy(); });
        this.targets = [];

        // Place 2 targets at random angles: away from the start, at least 60° apart
        const angles = this.pickTargetAngles();
        for (const a of angles) {
            const x = this.cx + Math.cos(a) * this.ringRadius;
            const y = this.cy + Math.sin(a) * this.ringRadius;
            const circle = this.add.circle(x, y, this.targetRadius, 0xffd166, 0.9)
                .setStrokeStyle(2, 0xffffff).setDepth(5);
            this.targets.push({ angle: a, x, y, circle, hit: false });
        }

        this.roundText.setText(`Round ${index + 1} / ${this.totalRounds}`);
        this.updateLapText();
    }

    // Two angles: both kept clear of the ball's start, and at least 60° apart.
    pickTargetAngles() {
        const TWO_PI = Math.PI * 2;
        const norm = a => ((a % TWO_PI) + TWO_PI) % TWO_PI;
        const angDist = (a, b) => {
            const d = Math.abs(norm(a) - norm(b));
            return Math.min(d, TWO_PI - d);
        };
        const startBuffer = 0.7;      // ~40° clear of the start position
        const separation = Math.PI / 3; // 60° apart

        let a1;
        do { a1 = Phaser.Math.FloatBetween(0, TWO_PI); } while (angDist(a1, this.startAngle) < startBuffer);

        let a2;
        do {
            a2 = Phaser.Math.FloatBetween(0, TWO_PI);
        } while (angDist(a2, this.startAngle) < startBuffer || angDist(a2, a1) < separation);

        return [a1, a2];
    }

    update(time, delta) {
        if (this.done || this.transitioning) return;

        // Advance the ball at constant angular speed, in the current direction.
        // totalAngle accumulates |distance| travelled so reversals never un-count laps.
        const step = this.speed * (delta / 1000);
        this.totalAngle += step;
        this.angleOffset += this.direction * step;
        const angle = this.startAngle + this.angleOffset;
        this.ballX = this.cx + Math.cos(angle) * this.ringRadius;
        this.ballY = this.cy + Math.sin(angle) * this.ringRadius;
        this.ball.setPosition(this.ballX, this.ballY);
        this.updateLapText();

        // Lap-out: 2 full revolutions' worth of travel without hitting both targets → lose
        if (this.totalAngle >= this.maxLaps * Math.PI * 2) {
            this.failAttempt(true);
        }
    }

    updateLapText() {
        const lap = Math.min(this.maxLaps, Math.floor(this.totalAngle / (Math.PI * 2)) + 1);
        this.lapText.setText(`Lap ${lap} / ${this.maxLaps}`);
    }

    onTap() {
        if (this.done || this.transitioning) return;

        // Find an un-hit target the ball currently overlaps. Already-hit targets
        // are intentionally excluded: their circle is gone, so a tap over one is
        // "too early or too late" and loses the level, same as any other bad tap.
        const reach = this.ballRadius + this.targetRadius;
        let hitTarget = null;
        for (const t of this.targets) {
            if (t.hit) continue;
            const dist = Phaser.Math.Distance.Between(this.ballX, this.ballY, t.x, t.y);
            if (dist <= reach) { hitTarget = t; break; }
        }

        if (hitTarget) {
            this.hitTargetSuccess(hitTarget);
        } else {
            // Tapped while not over any target → lose the whole level
            this.failAttempt(false);
        }
    }

    hitTargetSuccess(target) {
        target.hit = true;
        this.hitsThisRound++;

        // Choo-Choo Charles feel: every successful tap reverses the ball and
        // speeds it up for the rest of the round (round-start speed unchanged).
        this.direction *= -1;
        this.speed *= 1.125; // halved buildup (was 1.25x per tap)

        // Positive feedback on every correctly tapped big circle
        FeedbackFX.playPositive(this);
        FeedbackFX.fountain(this, this.ballX, this.ballY, true);

        // Small flash: light up and fade the target out
        target.circle.setFillStyle(0x4ecca3, 1);
        this.tweens.add({
            targets: target.circle,
            scale: 1.6,
            alpha: 0,
            duration: 220,
            onComplete: () => { if (target.circle) { target.circle.destroy(); target.circle = null; } }
        });

        if (this.hitsThisRound >= this.targets.length) {
            // Round complete
            if (this.round + 1 >= this.totalRounds) {
                this.win();
            } else {
                this.transitioning = true;
                this.time.delayedCall(400, () => this.startRound(this.round + 1));
            }
        }
    }

    updateForgiveText() {
        if (this.forgiveText) this.forgiveText.setText(`Dev chances left: ${this.forgiveness}`);
    }

    // A would-be loss (bad tap or lap-out). In dev mode a few mistakes are
    // forgiven; in prod forgiveness is 0 so this goes straight to lose().
    failAttempt(isLapOut) {
        if (this.forgiveness > 0) {
            this.forgiveness--;
            this.updateForgiveText();
            FeedbackFX.playNegative(this);
            FeedbackFX.fountain(this, this.ballX, this.ballY, false);
            this.cameras.main.flash(150, 230, 48, 48);
            if (isLapOut) {
                this.totalAngle = 0;    // fresh laps for the ball
                this.angleOffset = 0;   // ball back at the start position, as before
            }
            return;
        }
        this.lose();
    }

    lose() {
        if (this.done) return;
        this.done = true;
        FeedbackFX.playNegative(this);
        FeedbackFX.fountain(this, this.ballX, this.ballY, false);
        this.showFailModal('🔒 Lock jammed!');
    }

    showFailModal(msg) {
        const cx = 195;
        this.add.rectangle(cx, 422, 300, 200, 0x0f0f23, 0.95).setDepth(20).setStrokeStyle(2, 0xe63030);
        this.add.text(cx, 380, msg, { fontSize: '18px', color: '#e63030' }).setOrigin(0.5).setDepth(21);
        this.add.text(cx, 430, '[ Retry ]', {
            fontSize: '20px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(cx, 480, '[ Back ]', {
            fontSize: '18px', color: '#888'
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }

    win() {
        this.done = true;
        const levels = this.registry.get('levels') || [];
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));

        FeedbackFX.playPositive(this);
        FeedbackFX.fountain(this, this.ballX, this.ballY, true);

        this.roundText.setText(`Round ${this.totalRounds} / ${this.totalRounds}`);
        this.add.text(195, 650, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5).setDepth(21);
        this.time.delayedCall(1200, () => this.scene.start('PartReveal', { levelIndex: this.levelIndex }));
    }
}
