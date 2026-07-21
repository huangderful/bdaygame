// FUSE — merge of the original Fuse (burning fuse, cut at the target zone) and
// Quickdraw (WAIT.../DRAW! reflex tap). 11 fuses, each faster than the last, with
// a 75% chance per fuse of a mid-burn quickdraw interruption (222ms threshold).
// Any miss / false-start / slow reaction / burnout = lose. Clear all 11 = win.
class MiniGameFuseQuickdraw extends Phaser.Scene {
    constructor() { super('MiniGameFuseQuickdraw'); }
    init(data) { this.levelIndex = data.levelIndex; }

    preload() { FeedbackFX.preload(this); }

    create() {
        const cx = 195;
        this.done = false;
        this.THRESHOLD = DevConfig.on ? 500 : 262;   // ms reaction threshold for quickdraw
        this.totalFuses = DevConfig.stages(7);
        this.fuseNum = 0;

        // Dev-mode extra chances: a would-be loss consumes a miss while any remain.
        this.maxMisses = DevConfig.on ? 2 : 0;
        this.misses = 0;

        // Fuse geometry. The cut zone moves per fuse (see nextFuse) but always
        // sits past the halfway point of the wire.
        this.fuseStartX = 50;
        this.wireEndX = 340;       // where the wire ends
        this.fuseEnd = 340;        // center of the cut zone (re-rolled per fuse)
        this.fuseY = 400;
        this.boomX = 360;          // burnt past here = burnout loss

        // 'idle' | 'burning' | 'result' | 'qd_wait' | 'qd_draw' | 'done'
        this.state = 'idle';

        this.add.text(cx, 40, 'FUSE', { fontSize: '24px', color: '#e63030', fontStyle: 'bold' }).setOrigin(0.5);
        this.statusText = this.add.text(cx, 80, '', { fontSize: '14px', color: '#888' }).setOrigin(0.5);
        this.resultText = this.add.text(cx, 600, '', { fontSize: '18px' }).setOrigin(0.5);

        this.gfx = this.add.graphics();

        // Quickdraw overlay (created hidden, shown when a quickdraw triggers)
        this.qdBg = this.add.rectangle(cx, 422, 390, 844, 0x0f0f23, 1).setDepth(50).setVisible(false);
        this.qdTitle = this.add.text(cx, 120, 'QUICKDRAW', { fontSize: '24px', color: '#e63030', fontStyle: 'bold' })
            .setOrigin(0.5).setDepth(51).setVisible(false);
        this.qdThreshold = this.add.text(cx, 200, '', { fontSize: '16px', color: '#e9c046' })
            .setOrigin(0.5).setDepth(51).setVisible(false);
        this.qdMain = this.add.text(cx, 400, '', { fontSize: '48px', color: '#888' })
            .setOrigin(0.5).setDepth(51).setVisible(false);
        this.qdSub = this.add.text(cx, 500, '', { fontSize: '16px', color: '#666' })
            .setOrigin(0.5).setDepth(51).setVisible(false);

        this.input.on('pointerdown', () => this.onPointerDown());

        // Spacebar interacts too (cut the fuse / react on the quickdraw).
        this.onSpace = (e) => {
            if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); this.onPointerDown(); }
        };
        this.input.keyboard.on('keydown', this.onSpace);
        this.events.once('shutdown', () => this.input.keyboard.off('keydown', this.onSpace));
        this.events.once('destroy', () => this.input.keyboard.off('keydown', this.onSpace));

        this.nextFuse();
    }

    nextFuse() {
        this.fuseNum++;
        if (this.fuseNum > this.totalFuses) { this.win(); return; }

        this.statusText.setText(`Fuse ${this.fuseNum} / ${this.totalFuses}`);
        this.fuseX = this.fuseStartX;
        this.fuseSpeed = 1.5 + this.fuseNum * 0.8;   // Fuse's ramp, extended to 11
        this.resultText.setText('Cut the wire in the square!').setColor('#ffffff');
        this.state = 'burning';

        // Cut zone lands somewhere new each fuse — always past 50% of the wire
        // (halfway + margin so the 30px square sits fully beyond the midpoint).
        const mid = (this.fuseStartX + this.wireEndX) / 2;
        this.fuseEnd = Phaser.Math.Between(mid + 20, this.wireEndX - 15);

        // Roll the quickdraw once per fuse (75%), scheduling its trigger position now.
        this.quickdrawPending = Math.random() < 0.75;
        this.quickdrawTriggerX = this.quickdrawPending
            ? Phaser.Math.Between(this.fuseStartX + 40, this.fuseEnd - 40)
            : null;

        this.drawFuse();
    }

    update() {
        if (this.done || this.state !== 'burning') return;

        this.fuseX += this.fuseSpeed;

        // Mid-burn quickdraw interruption: freeze the fuse and switch over.
        if (this.quickdrawPending && this.fuseX >= this.quickdrawTriggerX) {
            this.quickdrawPending = false;
            this.drawFuse();   // render the exact frozen position we'll resume from
            this.startQuickdraw();
            return;
        }

        this.drawFuse();

        if (this.fuseX > this.boomX) {
            this.state = 'done';
            this.resultText.setText('✗ Too late! Boom!').setColor('#e63030');
            this.failAttempt('💥 Fuse burned out!');
        }
    }

    // A would-be loss. In dev (maxMisses > 0) it consumes a miss and re-runs the
    // current fuse; in prod maxMisses is 0 so this goes straight to lose().
    failAttempt(msg) {
        if (this.misses < this.maxMisses) {
            this.misses++;
            this.state = 'result';
            if (this.qdWaitTimer) this.qdWaitTimer.remove();
            if (this.qdDrawTimer) this.qdDrawTimer.remove();
            this.hideQuickdraw();
            FeedbackFX.playNegative(this);
            this.resultText.setText(`✗ Miss ${this.misses} / ${this.maxMisses} — retrying fuse`).setColor('#e63030');
            this.time.delayedCall(900, () => { this.fuseNum--; this.nextFuse(); });
            return;
        }
        this.lose(msg);
    }

    drawFuse() {
        const g = this.gfx;
        g.clear();
        // Fuse line (full wire; the cut zone sits somewhere along it)
        g.lineStyle(6, 0x888888);
        g.lineBetween(this.fuseStartX, this.fuseY, this.wireEndX, this.fuseY);
        // Target zone
        g.fillStyle(0x4ecca3, 0.3);
        g.fillRect(this.fuseEnd - 15, this.fuseY - 20, 30, 40);
        // Burnt part
        g.lineStyle(6, 0x333333);
        g.lineBetween(this.fuseStartX, this.fuseY, this.fuseX, this.fuseY);
        // Burning point
        g.fillStyle(0xff6600);
        g.fillCircle(this.fuseX, this.fuseY, 8);
    }

    onPointerDown() {
        if (this.done) return;
        if (this.state === 'burning') {
            this.cut();
        } else if (this.state === 'qd_wait') {
            // Tapped before DRAW! = false start = lose.
            this.state = 'done';
            this.qdMain.setText('✗').setColor('#e63030');
            this.qdSub.setText('False start!');
            this.failAttempt('✗ False start!');
        } else if (this.state === 'qd_draw') {
            const reaction = Date.now() - this.drawTime;
            if (reaction < this.THRESHOLD) {
                this.qdSuccess(reaction);
            } else {
                this.state = 'done';
                this.failAttempt(`✗ ${reaction}ms — needed under ${this.THRESHOLD}ms`);
            }
        }
    }

    cut() {
        this.state = 'result';
        const dist = Math.abs(this.fuseX - this.fuseEnd);
        if (dist < 15) {
            this.resultText.setText('✓ Perfect cut!').setColor('#4ecca3');
            this.time.delayedCall(700, () => this.nextFuse());
        } else {
            // With 11 fuses, any bad cut fails the level.
            this.state = 'done';
            this.resultText.setText(`✗ Off by ${Math.round(dist)}px`).setColor('#e63030');
            this.failAttempt('💥 Bad cut!');
        }
    }

    startQuickdraw() {
        // Fuse position (this.fuseX) is now frozen; update() won't advance it while
        // state !== 'burning', so it resumes from exactly here on success.
        this.state = 'qd_wait';
        this.qdBg.setVisible(true);
        this.qdTitle.setVisible(true);
        this.qdThreshold.setVisible(true).setText(`React under ${this.THRESHOLD}ms!`);
        this.qdMain.setVisible(true).setText('WAIT...').setColor('#888888');
        this.qdSub.setVisible(true).setText("Don't tap yet!").setColor('#666666');

        const delay = Phaser.Math.Between(1000, 2500);   // WAIT... for 1–2.5s
        this.qdWaitTimer = this.time.delayedCall(delay, () => {
            if (this.done || this.state !== 'qd_wait') return;
            this.state = 'qd_draw';
            this.drawTime = Date.now();
            this.qdMain.setText('DRAW!').setColor('#ff0000');
            this.qdSub.setText('TAP NOW!').setColor('#ffffff');
            // Grace window past the threshold so a LATE tap still registers and
            // can report its actual ms (the tap handler fails it with the number).
            // Only if they never tap at all does this timer fail without one.
            this.qdDrawTimer = this.time.delayedCall(this.THRESHOLD + 1500, () => {
                if (this.done || this.state !== 'qd_draw') return;
                this.state = 'done';
                this.failAttempt(`✗ No reaction — needed under ${this.THRESHOLD}ms`);
            });
        });
    }

    qdSuccess(reaction) {
        if (this.qdDrawTimer) this.qdDrawTimer.remove();
        this.hideQuickdraw();
        // Resume the fuse at the exact frozen position.
        this.resultText.setText(`⚡ ${reaction}ms! Cut the wire in the square!`).setColor('#4ecca3');
        this.state = 'burning';
        this.drawFuse();
    }

    hideQuickdraw() {
        this.qdBg.setVisible(false);
        this.qdTitle.setVisible(false);
        this.qdThreshold.setVisible(false);
        this.qdMain.setVisible(false);
        this.qdSub.setVisible(false);
    }

    lose(msg) {
        this.done = true;
        if (window.Native) window.Native.vibrate(200);
        FeedbackFX.playNegative(this);
        this.time.delayedCall(600, () => {
            this.hideQuickdraw();
            this.showFailModal(msg);
        });
    }

    showFailModal(msg) {
        const cx = 195;
        this.add.rectangle(cx, 422, 320, 210, 0x0f0f23, 0.97).setDepth(100).setStrokeStyle(2, 0xe63030);
        this.add.text(cx, 375, msg, { fontSize: '18px', color: '#e63030', align: 'center', wordWrap: { width: 290 } })
            .setOrigin(0.5).setDepth(101);
        this.add.text(cx, 430, '[ Retry ]', {
            fontSize: '20px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(cx, 485, '[ Back ]', { fontSize: '18px', color: '#888' })
            .setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }

    win() {
        this.done = true;
        this.state = 'done';
        FeedbackFX.playPositive(this);
        const levels = this.registry.get('levels') || [];
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.hideQuickdraw();
        this.resultText.setText('✓ Page Unlocked!').setColor('#4ecca3');
        this.time.delayedCall(1200, () => this.scene.start('PartReveal', { levelIndex: this.levelIndex }));
    }
}
