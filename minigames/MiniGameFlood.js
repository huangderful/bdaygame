class MiniGameFlood extends Phaser.Scene {
    constructor() { super('MiniGameFlood'); }
    init(data) { this.levelIndex = data.levelIndex; }

    preload() { FeedbackFX.preload(this); }

    create() {
        this.done = false;
        this.gridSize = 6;
        this.maxMoves = DevConfig.on ? 33 : 22;  // single shared budget across both boards (extra chances in dev)
        this.moves = 0;
        this.boardNum = 1;           // 1 or 2
        this.timeLimit = DevConfig.time(22);     // seconds for the whole run
        this.timeLeft = this.timeLimit;
        this.colors = [0xe63030, 0x4ecca3, 0x4444ff, 0xffaa00];

        this.add.text(195, 30, 'FLOOD', { fontSize: '24px', color: '#e63030', fontStyle: 'bold' }).setOrigin(0.5);
        this.boardText = this.add.text(195, 62, `Board ${this.boardNum}/2`, { fontSize: '15px', color: '#4ecca3', fontStyle: 'bold' }).setOrigin(0.5);
        this.moveText = this.add.text(110, 90, `Moves: 0 / ${this.maxMoves}`, { fontSize: '14px', color: '#888' }).setOrigin(0.5);
        this.timerText = this.add.text(280, 90, `Time: ${this.timeLeft}s`, { fontSize: '14px', color: '#888' }).setOrigin(0.5);

        // Generate the first board
        this.newBoard();

        this.drawGrid();
        this.drawButtons();

        // Countdown timer for the whole run
        this.timerEvent = this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                if (this.done) return;
                this.timeLeft--;
                this.timerText.setText(`Time: ${this.timeLeft}s`);
                if (this.timeLeft <= 0) { this.fail('Out of time!'); }
            }
        });
    }

    newBoard() {
        this.grid = [];
        for (let i = 0; i < this.gridSize * this.gridSize; i++) {
            this.grid.push(Phaser.Math.Between(0, this.colors.length - 1));
        }
    }

    drawGrid() {
        if (this.gridGfx) this.gridGfx.destroy();
        this.gridGfx = this.add.graphics();
        const size = 50, gap = 2, startX = 195 - (this.gridSize * (size + gap)) / 2, startY = 120;
        for (let i = 0; i < this.gridSize * this.gridSize; i++) {
            const row = Math.floor(i / this.gridSize), col = i % this.gridSize;
            const x = startX + col * (size + gap), y = startY + row * (size + gap);
            this.gridGfx.fillStyle(this.colors[this.grid[i]]);
            this.gridGfx.fillRect(x, y, size, size);
        }
    }

    drawButtons() {
        const y = 680;
        for (let i = 0; i < this.colors.length; i++) {
            const x = 80 + i * 80;
            const btn = this.add.rectangle(x, y, 55, 55, this.colors[i]).setStrokeStyle(2, 0xffffff).setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => this.flood(i));
        }
    }

    flood(colorIdx) {
        if (this.done) return;
        const currentColor = this.grid[0];
        if (colorIdx === currentColor) return;

        this.moves++;
        this.moveText.setText(`Moves: ${this.moves} / ${this.maxMoves}`);

        // BFS flood from top-left
        const visited = new Set();
        const queue = [0];
        visited.add(0);
        while (queue.length > 0) {
            const idx = queue.shift();
            if (this.grid[idx] !== currentColor) continue;
            this.grid[idx] = colorIdx;
            const row = Math.floor(idx / this.gridSize), col = idx % this.gridSize;
            const neighbors = [];
            if (row > 0) neighbors.push(idx - this.gridSize);
            if (row < this.gridSize - 1) neighbors.push(idx + this.gridSize);
            if (col > 0) neighbors.push(idx - 1);
            if (col < this.gridSize - 1) neighbors.push(idx + 1);
            for (const n of neighbors) {
                if (!visited.has(n)) { visited.add(n); queue.push(n); }
            }
        }

        this.drawGrid();

        // Board flooded?
        if (this.grid.every(c => c === this.grid[0])) {
            FeedbackFX.playPositive(this);
            if (this.boardNum === 1) {
                // Advance to a fresh board 2 with the remaining move budget
                this.boardNum = 2;
                this.boardText.setText(`Board ${this.boardNum}/2`);
                this.newBoard();
                this.drawGrid();
                // No moves left to flood board 2 -> fail
                if (this.moves >= this.maxMoves) { this.fail('Out of moves!'); }
                return;
            }
            // Board 2 flooded within budget -> win
            this.win();
            return;
        }

        if (this.moves >= this.maxMoves) { this.fail('Out of moves!'); }
    }

    fail(reason) {
        if (this.done) return;
        this.done = true;
        if (this.timerEvent) this.timerEvent.remove();
        FeedbackFX.playNegative(this);
        this.add.text(195, 750, `✗ ${reason}`, { fontSize: '18px', color: '#e63030' }).setOrigin(0.5);
        this.add.text(140, 790, '[ Retry ]', { fontSize: '16px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 14, y: 8 } })
            .setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(252, 790, '[ Back ]', { fontSize: '16px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 14, y: 8 } })
            .setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }

    win() {
        if (this.done) return;
        this.done = true;
        if (this.timerEvent) this.timerEvent.remove();
        const levels = this.registry.get('levels');
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.add.text(195, 750, '✓ Page Unlocked!', { fontSize: '20px', color: '#4ecca3' }).setOrigin(0.5);
        this.time.delayedCall(1200, () => this.scene.start('PartReveal', { levelIndex: this.levelIndex }));
    }
}
