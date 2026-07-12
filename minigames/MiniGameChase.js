// CHASE — monkeytype-style typing minigame (level index 10).
// Full target text is rendered faded; correctly typed chars turn solid white.
// ANY mistype instantly restarts the attempt (negative feedback + fountain) and
// resets the 22s timer. Typing the whole string correctly within 22s = win.
// Supports a physical keyboard (Phaser keydown) AND a hidden DOM <input> so the
// mobile soft keyboard opens (refocused on tap, cleaned up on shutdown).
class MiniGameChase extends Phaser.Scene {
    constructor() { super('MiniGameChase'); }

    init(data) { this.levelIndex = data.levelIndex ?? 12; }

    preload() { FeedbackFX.preload(this); }

    create() {
        const W = this.scale.width, cx = W / 2;
        this.done = false;
        this.timeLimit = DevConfig.time(44); // seconds per attempt

        // Exact target — preserve punctuation AND the double space after "feel."
        const fullTarget = "I love myself so so so much! I'm kind. I'm absolutely gorgeous and stunning. I think about how others feel.  I'm so smart. I'm so cool. I love that I love what I love. And that's a fact.";
        // Dev-only short target: just the first sentence.
        const devTarget = "I love myself so so so much!";
        this.target = DevConfig.on ? devTarget : fullTarget;

        // Colors (dark-theme equivalent of monkeytype: faded -> solid white)
        this.FADED = '#555555';
        this.SOLID = '#ffffff';
        this.CURSOR = '#4ecca3';

        // Header
        this.add.text(cx, 34, 'CHASE', { fontSize: '30px', color: '#e63030', fontStyle: 'bold' }).setOrigin(0.5);
        this.timerText = this.add.text(cx, 74, '', { fontSize: '18px', color: '#888' }).setOrigin(0.5);
        addExitButton(this);
        this.add.text(cx, 104, 'Type it perfectly — one slip and you restart.', {
            fontSize: '11px', color: '#666'
        }).setOrigin(0.5);

        // Dev-only: forgiven mistypes per attempt (0 in prod = unchanged behavior).
        this.maxForgiveness = DevConfig.on ? 2 : 0;
        this.forgiveness = this.maxForgiveness;
        if (DevConfig.on) {
            this.forgiveText = this.add.text(cx, 124, '', { fontSize: '11px', color: '#4ecca3' }).setOrigin(0.5);
            this.updateForgiveText();
        }

        // Build per-character text objects, then lay them out with word wrapping.
        this.buildText();
        this.layoutText();

        // Cursor / underline under the current character.
        this.cursorLine = this.add.rectangle(0, 0, 12, 2, 0x4ecca3).setOrigin(0.5, 0.5).setDepth(5);

        this.cursor = 0;
        // Stamped on the first update() tick — this.time.now can be stale in
        // create() when assets are cached, which insta-expired the timer.
        this.attemptStart = null;
        this.updateCursor();

        // Physical keyboard input.
        this.input.keyboard.on('keydown', this.onKeyDown, this);

        // Hidden DOM input for the mobile soft keyboard.
        this.createHiddenInput();

        // Re-focus / re-summon the soft keyboard on any tap, and pull it up
        // automatically on scene start (needs the native assist on Android).
        this.input.on('pointerdown', () => this.summonKeyboard());
        this.summonKeyboard();
        this.time.delayedCall(400, () => this.summonKeyboard());
        this.time.delayedCall(1200, () => this.summonKeyboard());

        // Clean up DOM + listeners when the scene ends.
        this.events.once('shutdown', this.cleanup, this);
        this.events.once('destroy', this.cleanup, this);
    }

    buildText() {
        this.charObjs = [];
        this.charX = [];
        this.charY = [];
        for (let i = 0; i < this.target.length; i++) {
            const obj = this.add.text(0, 0, this.target[i], {
                fontFamily: 'monospace', fontSize: '18px', color: this.FADED
            }).setOrigin(0, 0);
            this.charObjs.push(obj);
        }
    }

    layoutText() {
        const marginX = 22;
        const maxRight = this.scale.width - marginX;
        const startY = 150;
        const lineH = 30;
        let x = marginX, y = startY;

        for (let i = 0; i < this.charObjs.length; i++) {
            const c = this.target[i];
            // At the start of a word, wrap if the whole word won't fit on this line.
            if (c !== ' ' && (i === 0 || this.target[i - 1] === ' ')) {
                let wordW = 0;
                for (let j = i; j < this.target.length && this.target[j] !== ' '; j++) {
                    wordW += this.charObjs[j].width;
                }
                if (x + wordW > maxRight && x > marginX) { x = marginX; y += lineH; }
            }
            const obj = this.charObjs[i];
            obj.setPosition(x, y);
            this.charX[i] = x;
            this.charY[i] = y;
            x += obj.width;
        }
    }

    // Screen-space center of a character (used for feedback fountains).
    charCenter(i) {
        const idx = Phaser.Math.Clamp(i, 0, this.target.length - 1);
        const obj = this.charObjs[idx];
        return { x: this.charX[idx] + obj.width / 2, y: this.charY[idx] + obj.height / 2 };
    }

    updateCursor() {
        if (this.cursor >= this.target.length) { this.cursorLine.setVisible(false); return; }
        const obj = this.charObjs[this.cursor];
        // Highlight the character awaiting input.
        obj.setColor(this.CURSOR);
        this.cursorLine.setVisible(true);
        this.cursorLine.setSize(Math.max(obj.width, 8), 2);
        this.cursorLine.setPosition(this.charX[this.cursor] + obj.width / 2, this.charY[this.cursor] + obj.height + 2);
    }

    createHiddenInput() {
        // Remove any stale input from a previous attempt/restart.
        const existing = document.getElementById('chase-hidden-input');
        if (existing) existing.remove();

        const input = document.createElement('input');
        input.id = 'chase-hidden-input';
        input.type = 'text';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'none');
        input.setAttribute('spellcheck', 'false');
        input.setAttribute('inputmode', 'text');
        Object.assign(input.style, {
            position: 'fixed', top: '0', left: '0',
            width: '1px', height: '1px',
            opacity: '0', border: '0', padding: '0', margin: '0',
            fontSize: '16px', // >=16px avoids mobile auto-zoom
            background: 'transparent', color: 'transparent', caretColor: 'transparent',
            pointerEvents: 'none', zIndex: '-1'
        });
        document.body.appendChild(input);
        this.hiddenInput = input;

        this.onInput = () => {
            if (this.done) return;
            const val = this.hiddenInput.value;
            this.hiddenInput.value = '';
            // Stop on a mistype so leftover batched chars (swipe/autocomplete commits)
            // don't cascade extra failures against the freshly reset cursor.
            for (const ch of val) { if (!this.handleChar(ch) || this.done) break; }
        };
        input.addEventListener('input', this.onInput);

        // Attempt an initial focus so the keyboard opens (may require a tap on mobile).
        try { input.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }

    onKeyDown(e) {
        if (this.done) return;
        // If the hidden input has focus, the 'input' event handles it — avoid double counting.
        if (this.hiddenInput && document.activeElement === this.hiddenInput) return;
        // Ignore chorded shortcuts (Cmd+R, Ctrl+C, Option+letter...). Shift is fine —
        // it's how capitals and punctuation are typed.
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        // Single-character keys only; modifier/arrow/Enter/Backspace keys have multi-char names.
        if (e.key && e.key.length === 1) {
            // Keep space from scrolling the page and ' from opening Firefox quick-find.
            if (e.preventDefault) e.preventDefault();
            this.handleChar(e.key);
        }
    }

    // Returns true if the char was correct, false on a mistype (attempt restarted).
    handleChar(ch) {
        if (this.done) return false;
        // Normalize smart quotes / NBSP some mobile keyboards insert.
        if (ch === '’' || ch === '‘') ch = "'";
        if (ch === '“' || ch === '”') ch = '"';
        if (ch === ' ') ch = ' ';

        const expected = this.target[this.cursor];
        if (ch === expected) {
            const obj = this.charObjs[this.cursor];
            obj.setColor(this.SOLID);
            this.cursor++;
            if (this.cursor >= this.target.length) { this.win(); return true; }
            this.updateCursor();
            return true;
        }
        // Dev-only forgiveness: absorb the mistype without resetting progress.
        if (this.forgiveness > 0) {
            this.forgiveness--;
            this.updateForgiveText();
            this.forgiveMistype();
            return false;
        }
        this.failAttempt();
        return false;
    }

    // Dev-only: penalty feedback for a forgiven mistype — flash the current char
    // red briefly; the expected char stays the same and progress is kept.
    forgiveMistype() {
        FeedbackFX.playNegative(this);
        const idx = this.cursor;
        const obj = this.charObjs[idx];
        obj.setColor('#e63030');
        this.time.delayedCall(250, () => {
            if (this.done) return;
            // Restore whatever color the char should have now.
            if (idx < this.cursor) obj.setColor(this.SOLID);
            else if (idx === this.cursor) obj.setColor(this.CURSOR);
            else obj.setColor(this.FADED);
        });
    }

    updateForgiveText() {
        if (this.forgiveText) this.forgiveText.setText(`DEV: ${this.forgiveness} forgiven mistypes left`);
    }

    // ANY mistype: negative feedback from the mistyped char, then restart the attempt.
    failAttempt() {
        const c = this.charCenter(this.cursor);
        FeedbackFX.playNegative(this);
        FeedbackFX.fountain(this, c.x, c.y, false);
        if (window.Native) window.Native.vibrate(80);
        bumpAttempts(this.levelIndex); // each mistype-restart counts as an attempt

        // Reset all characters to faded, cursor to 0, and restart the timer.
        for (const obj of this.charObjs) obj.setColor(this.FADED);
        this.cursor = 0;
        this.attemptStart = this.time.now;
        // Dev-only: forgiveness refills on attempt restart (no-op in prod: 0 -> 0).
        this.forgiveness = this.maxForgiveness;
        this.updateForgiveText();
        this.updateCursor();
    }

    summonKeyboard() {
        if (this.done || !this.hiddenInput) return;
        try { this.hiddenInput.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        if (window.Native && window.Native.showKeyboard) window.Native.showKeyboard();
    }

    update() {
        if (this.done) return;
        if (this.attemptStart === null) this.attemptStart = this.time.now;
        const remaining = Math.max(0, this.timeLimit - (this.time.now - this.attemptStart) / 1000);
        this.timerText.setText(`⏱ ${remaining.toFixed(1)}s`);
        if (remaining <= 0) this.timeoutFail();
    }

    timeoutFail() {
        this.done = true;
        // Close the soft keyboard so the modal isn't hidden behind it.
        if (this.hiddenInput) { try { this.hiddenInput.blur(); } catch (e) { /* ignore */ } }
        const c = this.charCenter(this.cursor);
        FeedbackFX.playNegative(this);
        FeedbackFX.fountain(this, c.x, c.y, false);
        this.showFailModal("⏰ Time's up!");
    }

    showFailModal(msg) {
        const cx = this.scale.width / 2;
        this.cursorLine.setVisible(false);
        this.add.rectangle(cx, 422, 300, 200, 0x0f0f23, 0.95).setDepth(20).setStrokeStyle(2, 0xe63030);
        this.add.text(cx, 380, msg, { fontSize: '18px', color: '#e63030' }).setOrigin(0.5).setDepth(21);
        this.add.text(cx, 430, '[ Retry ]', {
            fontSize: '20px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(cx, 480, '[ Back ]', { fontSize: '18px', color: '#888' })
            .setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }

    win() {
        this.done = true;
        this.cursorLine.setVisible(false);
        // Close the soft keyboard so the unlock message is visible.
        if (this.hiddenInput) { try { this.hiddenInput.blur(); } catch (e) { /* ignore */ } }

        // Positive feedback fountain from the final (current cursor) character.
        const c = this.charCenter(this.target.length - 1);
        FeedbackFX.playPositive(this);
        FeedbackFX.fountain(this, c.x, c.y, true);

        const levels = this.registry.get('levels') || [];
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));

        const cx = this.scale.width / 2;
        this.add.text(cx, 650, '✓ Page Unlocked!', { fontSize: '22px', color: '#4ecca3' }).setOrigin(0.5).setDepth(21);
        this.time.delayedCall(1200, () => this.scene.start('PartReveal', { levelIndex: this.levelIndex }));
    }

    cleanup() {
        if (this.input && this.input.keyboard) this.input.keyboard.off('keydown', this.onKeyDown, this);
        if (window.Native && window.Native.hideKeyboard) window.Native.hideKeyboard();
        if (this.hiddenInput) {
            if (this.onInput) this.hiddenInput.removeEventListener('input', this.onInput);
            try { this.hiddenInput.blur(); } catch (e) { /* ignore */ }
            this.hiddenInput.remove();
            this.hiddenInput = null;
        }
    }
}
