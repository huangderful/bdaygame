// TICKLE — 4x6 grid, 11 filled squares per board; tap all 11 within the time
// limit. Tapping an unfilled square (including one you already cleared) = lose.
// 2 boards total. Awards the stomach (level 10).
class MiniGameTickle extends Phaser.Scene {
    constructor() { super('MiniGameTickle'); }

    init(data) { this.levelIndex = data.levelIndex ?? 10; }

    preload() { FeedbackFX.preload(this); }

    create() {
        this.done = false;
        this.cols = 4;
        this.rows = 6;
        this.fillCount = 11;
        this.totalBoards = DevConfig.stages(2);
        this.boardNum = 0;
        this.timeLimit = DevConfig.on ? 122 : 2; // 2s per board (dev: 2m2s)
        // Dev: 2 wrong-square taps are forgiven
        this.forgiveness = DevConfig.on ? 2 : 0;

        const cx = 195;
        this.add.text(cx, 30, 'TICKLE', { fontSize: '22px', color: '#e63030', fontStyle: 'bold' }).setOrigin(0.5);
        this.timerText = this.add.text(cx, 60, '', { fontSize: '14px', color: '#888' }).setOrigin(0.5);
        this.boardText = this.add.text(cx, 84, '', { fontSize: '13px', color: '#4ecca3' }).setOrigin(0.5);
        if (DevConfig.on) {
            this.forgiveText = this.add.text(cx, 12, `DEV: ${this.forgiveness} wrong taps forgiven`, { fontSize: '11px', color: '#e63030' }).setOrigin(0.5);
        }

        // grid geometry: fill the width, tall cells
        this.gx = 15; this.gy = 110;
        this.cellW = (390 - 30) / this.cols;
        this.cellH = (844 - this.gy - 30) / this.rows;

        this.cells = [];
        this.startTime = null; // stamped on first update tick
        this.nextBoard();

        this.input.on('pointerdown', (p) => this.onTap(p));
    }

    nextBoard() {
        this.boardNum++;
        this.boardText.setText(`Board ${this.boardNum} / ${this.totalBoards}`);
        // Per-board clock: null → stamped on the next update tick. Never use
        // this.time.now here — board 1 is created inside create(), where the
        // clock is stale and instantly expires the timer (the insta-loss bug).
        this.startTime = null;

        // pick 11 random filled squares
        const all = Phaser.Utils.Array.Shuffle([...Array(this.cols * this.rows).keys()]);
        const filled = new Set(all.slice(0, this.fillCount));
        this.remaining = this.fillCount;

        for (const c of this.cells) c.rect.destroy();
        this.cells = [];
        for (let i = 0; i < this.cols * this.rows; i++) {
            const col = i % this.cols, row = Math.floor(i / this.cols);
            const x = this.gx + col * this.cellW + this.cellW / 2;
            const y = this.gy + row * this.cellH + this.cellH / 2;
            const isFilled = filled.has(i);
            const rect = this.add.rectangle(x, y, this.cellW - 4, this.cellH - 4,
                isFilled ? 0x4ecca3 : 0x16213e).setStrokeStyle(1, 0x333355);
            this.cells.push({ rect, filled: isFilled, x, y });
        }
    }

    onTap(p) {
        if (this.done) return;
        const col = Math.floor((p.x - this.gx) / this.cellW);
        const row = Math.floor((p.y - this.gy) / this.cellH);
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
        const cell = this.cells[row * this.cols + col];
        if (!cell) return;

        if (cell.filled) {
            // correct: convert to non-filled (tapping it again would now lose)
            cell.filled = false;
            cell.rect.setFillStyle(0x16213e);
            this.remaining--;
            FeedbackFX.playPositive(this);
            if (window.Native) window.Native.vibrate(20);
            if (this.remaining <= 0) {
                if (this.boardNum >= this.totalBoards) { this.win(); return; }
                FeedbackFX.playPositive(this);
                this.nextBoard();
            }
        } else if (this.forgiveness > 0) {
            // dev: forgiven — flash the square red, then restore it
            this.forgiveness--;
            if (this.forgiveText) this.forgiveText.setText(`DEV: ${this.forgiveness} wrong taps forgiven`);
            FeedbackFX.playNegative(this);
            cell.rect.setFillStyle(0xe63030);
            this.time.delayedCall(350, () => { if (!this.done) cell.rect.setFillStyle(0x16213e); });
        } else {
            cell.rect.setFillStyle(0xe63030); // shade the offending square red
            this.lose();
        }
    }

    update() {
        if (this.done) return;
        if (this.startTime === null) this.startTime = this.time.now;
        const remaining = Math.max(0, this.timeLimit - (this.time.now - this.startTime) / 1000);
        this.timerText.setText(`${remaining.toFixed(1)}s`);
        if (remaining <= 0) this.lose();
    }

    lose() {
        this.done = true;
        FeedbackFX.playNegative(this);
        if (window.Native) window.Native.vibrate(200);
        const cx = 195;
        this.add.rectangle(cx, 422, 300, 200, 0x0f0f23, 0.95).setDepth(30).setStrokeStyle(2, 0xe63030);
        this.add.text(cx, 375, '💀 Tickled wrong!', { fontSize: '20px', color: '#e63030' }).setOrigin(0.5).setDepth(31);
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
        FeedbackFX.playPositive(this);
        const levels = this.registry.get('levels') || [];
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.add.text(195, 422, '✓ Page Unlocked!', {
            fontSize: '22px', color: '#4ecca3', backgroundColor: '#0f0f23', padding: { x: 12, y: 6 }
        }).setOrigin(0.5).setDepth(20);
        this.time.delayedCall(1200, () => this.scene.start('PartReveal', { levelIndex: this.levelIndex }));
    }
}
