class MiniGameEcho extends Phaser.Scene {
    constructor() { super('MiniGameEcho'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        this.done = false;
        this.gridSize = 3;
        this.sequence = [];
        this.playerIndex = 0;
        this.showing = false;
        this.round = 0;
        this.roundsToWin = 8;

        this.add.text(195, 40, 'ECHO', { fontSize: '24px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.roundText = this.add.text(195, 75, '', { fontSize: '14px', color: '#888' }).setOrigin(0.5);
        this.statusText = this.add.text(195, 750, '', { fontSize: '16px', color: '#4ecca3' }).setOrigin(0.5);

        this.buildGrid();
        this.nextRound();
    }

    buildGrid() {
        this.tiles = [];
        const size = 90, gap = 10, startX = 195 - (this.gridSize * (size + gap) - gap) / 2 + size / 2, startY = 200;
        for (let i = 0; i < this.gridSize * this.gridSize; i++) {
            const row = Math.floor(i / this.gridSize), col = i % this.gridSize;
            const x = startX + col * (size + gap), y = startY + row * (size + gap);
            const tile = this.add.rectangle(x, y, size, size, 0x16213e).setStrokeStyle(2, 0x333333).setInteractive({ useHandCursor: true });
            tile.idx = i;
            tile.on('pointerdown', () => this.tapTile(i));
            this.tiles.push(tile);
        }
    }

    nextRound() {
        this.round++;
        if (this.round > this.roundsToWin) { this.win(); return; }
        this.roundText.setText(`Round ${this.round} / ${this.roundsToWin}`);
        this.sequence.push(Phaser.Math.Between(0, this.gridSize * this.gridSize - 1));
        this.playerIndex = 0;
        this.showSequence();
    }

    showSequence() {
        this.showing = true;
        this.statusText.setText('Watch...');
        let i = 0;
        const show = () => {
            if (i >= this.sequence.length) {
                this.showing = false;
                this.statusText.setText('Your turn!');
                return;
            }
            const tile = this.tiles[this.sequence[i]];
            tile.setFillStyle(0x4ecca3);
            this.time.delayedCall(400, () => {
                tile.setFillStyle(0x16213e);
                i++;
                this.time.delayedCall(200, show);
            });
        };
        this.time.delayedCall(500, show);
    }

    tapTile(idx) {
        if (this.done || this.showing) return;
        if (idx === this.sequence[this.playerIndex]) {
            this.tiles[idx].setFillStyle(0x4ecca3);
            this.time.delayedCall(200, () => this.tiles[idx].setFillStyle(0x16213e));
            this.playerIndex++;
            if (this.playerIndex >= this.sequence.length) {
                this.statusText.setText('✓ Correct!');
                this.time.delayedCall(800, () => this.nextRound());
            }
        } else {
            this.tiles[idx].setFillStyle(0xe94560);
            this.fail();
        }
    }

    fail() {
        this.done = true;
        this.statusText.setText(`✗ Wrong! Got to round ${this.round}`).setColor('#e94560');
        this.time.delayedCall(1500, () => {
            this.add.text(195, 650, '[ Retry ]', { fontSize: '20px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 16, y: 8 } })
                .setOrigin(0.5).setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
            this.add.text(195, 710, '[ Back ]', { fontSize: '16px', color: '#888' }).setOrigin(0.5).setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.scene.start('LevelSelect'));
        });
    }

    win() {
        this.done = true;
        const levels = this.registry.get('levels');
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.statusText.setText('✓ Perfect memory!').setColor('#4ecca3');
        this.add.text(195, 650, '✓ Page Unlocked!', { fontSize: '20px', color: '#4ecca3' }).setOrigin(0.5);
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }
}
