// SPATIAL — flappy-bird-esque pipe navigation, deliberately broken/unfair.
// NO gravity. Patience-style drag steering. Sporadic violent lurches that only
// reset on a FRESH re-touch. 22 close pipes. Win by clearing 22 pipes OR by
// losing 22 attempts (the run auto-restarts on each death).
class MiniGameSpatial extends Phaser.Scene {
    constructor() { super('MiniGameSpatial'); }

    init(data) { this.levelIndex = data.levelIndex ?? 9; }

    preload() {
        FeedbackFX.preload(this);
    }

    create() {
        this.W = 390; this.H = 844;
        const cx = this.W / 2;
        this.done = false;
        this.attemptActive = false;

        // Tunables
        this.rectW = 24; this.rectH = 16;
        this.rectXBase = 70;
        this.rectXMin = 55; this.rectXMax = 130;
        this.pipeW = 44;
        this.gapH = 150;
        this.pipeSpacing = 130;
        this.NUM_PIPES = DevConfig.stages(22);   // 2 in dev: a lucky run wins fast
        this.scrollSpeed = 2.6;   // px/frame, pipes scroll right-to-left
        this.vSpeed = 4.5;        // vertical steer speed at full deflection
        this.hSpeed = 1.6;        // slight horizontal nudge
        this.maxAttempts = DevConfig.stages(22); // pity-win after this many deaths (2 in dev)

        // Background
        this.add.rectangle(cx, this.H / 2, this.W, this.H, 0x0a0a1a);

        // HUD — show the pity-win ceiling up front
        this.attemptText = this.add.text(cx, 16, `Attempt 1 / ${this.maxAttempts}`, {
            fontSize: '18px', color: '#e63030', fontStyle: 'bold'
        }).setOrigin(0.5, 0).setDepth(30);
        this.pipeText = this.add.text(cx, 40, `Pipe 0 / ${this.NUM_PIPES}`, {
            fontSize: '14px', color: '#4ecca3'
        }).setOrigin(0.5, 0).setDepth(30);
        this.add.text(cx, 62, `(yeah I know it's hard — you get a free win after ${this.maxAttempts} attempts)`, {
            fontSize: '11px', color: '#888', align: 'center', wordWrap: { width: 360 }
        }).setOrigin(0.5, 0).setDepth(30);
        addExitButton(this);

        // Rectangle "bird"
        this.rectX = this.rectXBase;
        this.rectY = this.H / 2;
        this.rect = this.add.rectangle(this.rectX, this.rectY, this.rectW, this.rectH, 0xffd166)
            .setStrokeStyle(2, 0xffffff).setDepth(10);

        // Pipes (built per attempt)
        this.pipes = [];

        // Control state (Patience-style drag)
        this.moveX = 0;
        this.moveY = 0;
        this.touchStart = null;

        // Lurch state
        this.lurching = false;
        this.lurchVX = 0;
        this.lurchVY = 0;
        this.lurchTimer = 0;

        // Track dot at touch point (like Patience)
        this.trackDot = this.add.circle(cx, this.H / 2, 10, 0x4ecca3, 0.5).setDepth(20).setVisible(false);
        this.add.text(cx, this.H - 24, 'drag anywhere to steer', {
            fontSize: '12px', color: '#444'
        }).setOrigin(0.5).setDepth(20);

        this.setupInput();

        // Start first attempt
        this.attempt = 1;
        this.startAttempt();
    }

    setupInput() {
        // Fresh pointerdown = regain control (clears any active lurch).
        // A held finger from before a lurch will NOT fire this, so it cannot cancel a lurch.
        // The lurch timer is deliberately NOT reset here: tapping must not postpone
        // the next lurch (the unfairness is the point — do not soften it).
        this.input.on('pointerdown', (p) => {
            if (this.done || !this.attemptActive) return;
            this.lurching = false;              // fresh re-touch snaps control back
            this.touchStart = { x: p.x, y: p.y };
            this.moveX = 0; this.moveY = 0;
            this.trackDot.setPosition(p.x, p.y).setVisible(true);
        });

        this.input.on('pointermove', (p) => {
            if (this.done || !this.attemptActive || !p.isDown || !this.touchStart) return;
            const dx = p.x - this.touchStart.x;
            const dy = p.y - this.touchStart.y;
            const maxDist = 30;
            this.moveX = Phaser.Math.Clamp(dx / maxDist, -1, 1);
            this.moveY = Phaser.Math.Clamp(dy / maxDist, -1, 1);
            this.trackDot.setPosition(p.x, p.y).setVisible(true);
            // ease the anchor toward the finger (feels like a trackpad)
            this.touchStart.x += dx * 0.08;
            this.touchStart.y += dy * 0.08;
        });

        this.input.on('pointerup', () => {
            this.moveX = 0; this.moveY = 0;
            this.touchStart = null;
            this.trackDot.setVisible(false);
        });
    }

    startAttempt() {
        // Reset control + lurch
        this.moveX = 0; this.moveY = 0;
        this.touchStart = null;
        this.trackDot.setVisible(false);
        this.lurching = false;
        this.lurchTimer = Phaser.Math.Between(42, 90);

        // Reset rectangle
        this.rectX = this.rectXBase;
        this.rectY = this.H / 2;
        this.rect.setPosition(this.rectX, this.rectY).setFillStyle(0xffd166).setVisible(true);

        // Rebuild pipes
        for (const p of this.pipes) { p.top.destroy(); p.bot.destroy(); }
        this.pipes = [];
        let px = this.W + 120; // lead-in before the first pipe reaches the rectangle
        for (let i = 0; i < this.NUM_PIPES; i++) {
            const gapY = Phaser.Math.Between(115, this.H - 115); // keep gap fully on screen
            const gapTop = gapY - this.gapH / 2;
            const gapBottom = gapY + this.gapH / 2;
            const top = this.add.rectangle(px, gapTop / 2, this.pipeW, gapTop, 0x4ecca3)
                .setStrokeStyle(2, 0x2a7a5a).setDepth(5);
            const botH = this.H - gapBottom;
            const bot = this.add.rectangle(px, gapBottom + botH / 2, this.pipeW, botH, 0x4ecca3)
                .setStrokeStyle(2, 0x2a7a5a).setDepth(5);
            this.pipes.push({ x: px, gapTop, gapBottom, passed: false, top, bot });
            px += this.pipeSpacing;
        }
        this.pipesPassed = 0;

        this.attemptText.setText(`Attempt ${this.attempt} / ${this.maxAttempts}`);
        this.pipeText.setText(`Pipe 0 / ${this.NUM_PIPES}`);
        this.attemptActive = true;
    }

    startLurch() {
        // Unfair: violent velocity, mostly vertical, keeps drifting
        // until the user lifts and re-touches.
        // (Intensity scaled to 0.75x of the original 8–13 / ±2 values.)
        this.lurching = true;
        const dir = Math.random() < 0.5 ? -1 : 1;
        const speed = Phaser.Math.FloatBetween(6, 9.75);
        this.lurchVY = dir * speed;
        this.lurchVX = Phaser.Math.FloatBetween(-1.5, 1.5);
    }

    // A pipe pair is "near" when its x-span overlaps, or sits within ~120px
    // ahead of, the rectangle's x. Lurches only fire near pipes.
    isPipeNear() {
        const NEAR_DIST = 120;
        for (const p of this.pipes) {
            const pipeLeft = p.x - this.pipeW / 2;
            const pipeRight = p.x + this.pipeW / 2;
            if (pipeRight >= this.rectX && pipeLeft <= this.rectX + NEAR_DIST) return true;
        }
        return false;
    }

    update() {
        if (this.done || !this.attemptActive) return;

        // Lurch scheduling — fire often (~0.7–1.5s), re-fire even mid-lurch for chaos.
        // Only fires when a pipe is near; otherwise the expired timer is HELD
        // (not re-rolled), so the lurch lands soon after a pipe approaches.
        this.lurchTimer--;
        if (this.lurchTimer <= 0) {
            if (this.isPipeNear()) {
                this.startLurch();
                this.lurchTimer = Phaser.Math.Between(42, 90);
            } else {
                this.lurchTimer = 0; // hold/requeue: fires as soon as a pipe is near
            }
        }

        // Move the rectangle
        if (this.lurching) {
            this.rectX += this.lurchVX;
            this.rectY += this.lurchVY;
        } else {
            this.rectX += (this.moveX || 0) * this.hSpeed;
            this.rectY += (this.moveY || 0) * this.vSpeed;
        }
        this.rectX = Phaser.Math.Clamp(this.rectX, this.rectXMin, this.rectXMax);
        this.rect.setPosition(this.rectX, this.rectY);

        // Screen top/bottom death
        const rectTop = this.rectY - this.rectH / 2;
        const rectBot = this.rectY + this.rectH / 2;
        if (rectTop <= 0 || rectBot >= this.H) { this.die(); return; }

        // Scroll pipes + collision + passing
        const rectLeft = this.rectX - this.rectW / 2;
        const rectRight = this.rectX + this.rectW / 2;
        for (const p of this.pipes) {
            p.x -= this.scrollSpeed;
            p.top.x = p.x;
            p.bot.x = p.x;

            const pipeLeft = p.x - this.pipeW / 2;
            const pipeRight = p.x + this.pipeW / 2;

            // AABB overlap in x, then check gap
            if (rectRight > pipeLeft && rectLeft < pipeRight) {
                if (rectTop < p.gapTop || rectBot > p.gapBottom) { this.die(); return; }
            }

            // Passed the rectangle?
            if (!p.passed && pipeRight < rectLeft) {
                p.passed = true;
                this.pipesPassed++;
                this.pipeText.setText(`Pipe ${this.pipesPassed} / ${this.NUM_PIPES}`);
                if (this.pipesPassed >= this.NUM_PIPES) { this.win(); return; }
            }
        }
    }

    die() {
        if (!this.attemptActive) return;
        this.attemptActive = false;

        const dx = this.rectX, dy = this.rectY;
        this.rect.setFillStyle(0xe63030);
        if (window.Native) window.Native.vibrate(120);

        // Loss feedback from the death spot
        FeedbackFX.playNegative(this);
        FeedbackFX.fountain(this, dx, dy, false);

        // After the 1s feedback moment: win if 22 attempts consumed, else next attempt.
        this.time.delayedCall(1000, () => {
            if (this.done) return;
            if (this.attempt >= this.maxAttempts) {
                this.win();
            } else {
                this.attempt++;
                this.startAttempt();
            }
        });
    }

    win() {
        if (this.done) return;
        this.done = true;
        this.attemptActive = false;

        const dx = this.rectX, dy = this.rectY;
        if (window.Native) window.Native.vibrate(200);

        FeedbackFX.playPositive(this);
        FeedbackFX.fountain(this, dx, dy, true);

        const levels = this.registry.get('levels') || [];
        if (levels[this.levelIndex]) levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));

        const cx = this.W / 2;
        this.add.text(cx, 380, '✓ Spatial complete!', { fontSize: '20px', color: '#4ecca3' })
            .setOrigin(0.5).setDepth(40);
        this.add.text(cx, 420, '✓ Page Unlocked!', { fontSize: '18px', color: '#4ecca3' })
            .setOrigin(0.5).setDepth(40);

        this.time.delayedCall(1200, () => this.scene.start('PartReveal', { levelIndex: this.levelIndex }));
    }
}
