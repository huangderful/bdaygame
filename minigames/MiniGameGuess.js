// GUESS THE CHAR — type the image's name while it grows from 1px to full width.
// Wrong guess restarts from the first image. Awards the right eye (level 2).
const GUESS_ANSWERS = ['coco', 'hisoka', 'jokic', 'me', 'mei', 'miku', 'moana',
    'owen', 'strange', 'theodore', 'webs'];

class MiniGameGuess extends Phaser.Scene {
    constructor() { super('MiniGameGuess'); }

    init(data) { this.levelIndex = data.levelIndex ?? 2; }

    preload() {
        FeedbackFX.preload(this);
        for (const name of GUESS_ANSWERS) {
            this.load.image(`guess_${name}`, `img/guess/${name}.jpg`);
        }
    }

    create() {
        const cx = 195;
        this.done = false;
        this.total = DevConfig.stages(GUESS_ANSWERS.length);
        this.timeLimit = DevConfig.time(22);
        this.startTime = null; // stamped on first update tick (create-time clock can be stale)
        this.growMs = 10000; // 1px -> full width in 10 seconds
        // Dev: 2 wrong guesses are forgiven (clear input, no run restart)
        this.maxForgiveness = DevConfig.on ? 2 : 0;
        this.forgiveness = this.maxForgiveness;

        this.add.text(cx, 30, 'GUESS THE CHAR', { fontSize: '20px', color: '#e63030', fontStyle: 'bold' }).setOrigin(0.5);
        this.timerText = this.add.text(cx, 58, '', { fontSize: '13px', color: '#888' }).setOrigin(0.5);
        addExitButton(this);
        this.progressText = this.add.text(cx, 80, '', { fontSize: '13px', color: '#4ecca3' }).setOrigin(0.5);
        this.blanksText = this.add.text(cx, 120, '', { fontSize: '26px', color: '#ffffff', fontFamily: 'monospace' }).setOrigin(0.5);
        this.typedText = this.add.text(cx, 155, '', { fontSize: '16px', color: '#4ecca3', fontFamily: 'monospace' }).setOrigin(0.5);

        this.imgY = 430;
        this.img = null;

        if (DevConfig.on) {
            this.forgiveText = this.add.text(cx, 815, '', { fontSize: '12px', color: '#e63030' }).setOrigin(0.5);
            this.updateForgiveText();
        }

        this.createInput();
        this.beginRun();
    }

    beginRun() {
        // shuffled order each run; wrong guess restarts here
        this.order = Phaser.Utils.Array.Shuffle(GUESS_ANSWERS.slice()).slice(0, this.total);
        this.idx = 0;
        this.showImage();
    }

    showImage() {
        this.answer = this.order[this.idx];
        this.typed = '';
        this.progressText.setText(`${this.idx + 1} / ${this.total}`);
        this.updateBlanks();

        if (this.img) this.img.destroy();
        this.img = this.add.image(195, this.imgY, `guess_${this.answer}`).setDepth(-1);
        this.imgStarted = this.time.now;
        const startScale = 1 / this.img.width; // ~1px wide
        this.img.setScale(startScale);
        this.tweens.add({
            targets: this.img,
            scale: 390 / this.img.width, // fill screen width
            duration: this.growMs,
            ease: 'Linear'
        });
    }

    updateBlanks() {
        const shown = this.answer.split('').map((ch, i) => this.typed[i] || '_').join(' ');
        this.blanksText.setText(shown);
        this.typedText.setText(`${this.typed.length} / ${this.answer.length}`);
    }

    createInput() {
        // hidden DOM input opens the Android soft keyboard; physical keys also work
        const old = document.getElementById('guess-hidden-input');
        if (old) old.remove();
        const inp = document.createElement('input');
        inp.id = 'guess-hidden-input';
        inp.type = 'text';
        inp.autocomplete = 'off';
        inp.autocapitalize = 'none';
        inp.setAttribute('autocorrect', 'off');
        inp.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0;font-size:16px;pointer-events:none;';
        document.body.appendChild(inp);
        this.hiddenInput = inp;

        this.onDomInput = () => {
            const chars = inp.value;
            inp.value = '';
            for (const ch of chars) {
                if (!this.handleChar(ch)) break;
            }
        };
        inp.addEventListener('input', this.onDomInput);

        this.onKeyDown = (e) => {
            if (this.done) return;
            if (document.activeElement === this.hiddenInput && e.key.length === 1) return; // dedupe
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === 'Backspace') { this.typed = this.typed.slice(0, -1); this.updateBlanks(); return; }
            if (e.key.length === 1) { e.preventDefault(); this.handleChar(e.key); }
        };
        this.input.keyboard.on('keydown', this.onKeyDown);

        // backspace from the soft keyboard
        this.onDomKeyDown = (e) => {
            if (e.key === 'Backspace') { this.typed = this.typed.slice(0, -1); this.updateBlanks(); }
        };
        inp.addEventListener('keydown', this.onDomKeyDown);

        this.input.on('pointerdown', () => this.summonKeyboard());
        this.summonKeyboard();
        // The soft keyboard often ignores programmatic focus with no user
        // gesture, so keep re-summoning briefly after scene start.
        this.time.delayedCall(400, () => this.summonKeyboard());
        this.time.delayedCall(1200, () => this.summonKeyboard());

        const cleanup = () => this.cleanupInput();
        this.events.once('shutdown', cleanup);
        this.events.once('destroy', cleanup);
    }

    summonKeyboard() {
        if (this.done || !this.hiddenInput) return;
        try { this.hiddenInput.focus({ preventScroll: true }); } catch (e) {}
        if (window.Native && window.Native.showKeyboard) window.Native.showKeyboard();
    }

    cleanupInput() {
        if (this.onKeyDown) this.input.keyboard.off('keydown', this.onKeyDown);
        if (this.hiddenInput) {
            this.hiddenInput.removeEventListener('input', this.onDomInput);
            this.hiddenInput.removeEventListener('keydown', this.onDomKeyDown);
            this.hiddenInput.blur();
            this.hiddenInput.remove();
            this.hiddenInput = null;
        }
        if (window.Native && window.Native.hideKeyboard) window.Native.hideKeyboard();
    }

    handleChar(ch) {
        if (this.done) return false;
        if (!/^[a-zA-Z0-9]$/.test(ch)) return true;
        this.typed += ch.toLowerCase();
        this.updateBlanks();

        if (this.typed.length >= this.answer.length) {
            if (this.typed === this.answer) this.correct();
            else this.wrong();
            return false;
        }
        return true;
    }

    correct() {
        FeedbackFX.playPositive(this);
        FeedbackFX.fountain(this, this.img.x, this.img.y, true);
        this.idx++;
        if (this.idx >= this.total) { this.win(); return; }
        this.showImage();
    }

    updateForgiveText() {
        if (this.forgiveText) this.forgiveText.setText(`DEV: ${this.forgiveness} wrong guesses forgiven`);
    }

    wrong() {
        FeedbackFX.playNegative(this);
        FeedbackFX.fountain(this, this.img.x, this.img.y, false);
        this.cameras.main.shake(200, 0.01);
        if (this.forgiveness > 0) {
            // dev: forgiven — clear the typed word, keep the same image and run
            this.forgiveness--;
            this.updateForgiveText();
            this.typed = '';
            this.updateBlanks();
            return;
        }
        // loss: restart to the beginning — Chase-style: the timer resets and
        // the attempt counter goes up.
        bumpAttempts(this.levelIndex);
        this.startTime = null; // re-stamped on the next update tick
        this.beginRun();
    }

    update() {
        if (this.done) return;
        if (this.startTime === null) this.startTime = this.time.now;
        const remaining = Math.max(0, this.timeLimit - (this.time.now - this.startTime) / 1000);
        this.timerText.setText(`${remaining.toFixed(1)}s`);
        if (remaining <= 0) this.fail();
    }

    fail() {
        this.done = true;
        this.cleanupInput();
        FeedbackFX.playNegative(this);
        if (this.img) FeedbackFX.fountain(this, this.img.x, this.img.y, false);
        const cx = 195;
        this.add.rectangle(cx, 422, 300, 200, 0x0f0f23, 0.95).setDepth(30).setStrokeStyle(2, 0xe63030);
        this.add.text(cx, 375, "⏰ Time's up!", { fontSize: '20px', color: '#e63030' }).setOrigin(0.5).setDepth(31);
        this.add.text(cx, 430, '[ Retry ]', {
            fontSize: '18px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(cx, 480, '[ Back ]', { fontSize: '16px', color: '#888' })
            .setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }

    win() {
        this.done = true;
        this.cleanupInput();
        const levels = this.registry.get('levels') || [];
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.add.text(195, 700, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5).setDepth(20);
        this.time.delayedCall(1200, () => this.scene.start('PartReveal', { levelIndex: this.levelIndex }));
    }
}
