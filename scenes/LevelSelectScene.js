class LevelSelectScene extends Phaser.Scene {
    constructor() { super('LevelSelect'); }

    create() {
        this.page = 0;
        this.perPage = 2;
        this.levels = this.registry.get('levels') || [];
        this.totalPages = Math.ceil(this.levels.length / this.perPage);

        // Swipe detection
        this.swipeStartX = 0;
        this.input.on('pointerdown', (p) => { this.swipeStartX = p.x; });
        this.input.on('pointerup', (p) => {
            const dx = p.x - this.swipeStartX;
            if (dx < -50 && this.page < this.totalPages - 1) { this.page++; this.drawPage(); }
            else if (dx > 50 && this.page > 0) { this.page--; this.drawPage(); }
        });

        this.drawPage();
    }

    drawPage() {
        this.children.removeAll(true);
        const cx = this.scale.width / 2;

        this.add.text(cx, 60, 'Select Level', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);

        const start = this.page * this.perPage;
        const end = Math.min(start + this.perPage, this.levels.length);

        for (let i = start; i < end; i++) {
            const idx = i - start;
            const y = 200 + idx * 260;
            const level = this.levels[i];
            const completed = level?.completed;

            const rect = this.add.rectangle(cx, y, 300, 200, completed ? 0x0f3460 : 0x16213e)
                .setStrokeStyle(3, completed ? 0x4ecca3 : 0xe94560)
                .setInteractive({ useHandCursor: true });

            this.add.text(cx, y - 30, level?.name || `Level ${i + 1}`, { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
            this.add.text(cx, y + 20, completed ? '✓ Complete' : 'Tap to play', {
                fontSize: '16px', color: completed ? '#4ecca3' : '#888'
            }).setOrigin(0.5);

            rect.on('pointerdown', () => {
                const sceneMap = { 0: 'MiniGameDig', 1: 'MiniGameDraw', 2: 'MiniGameMath', 3: 'MiniGamePatience' };
                const target = sceneMap[i] || 'MiniGame';
                this.scene.start(target, { levelIndex: i });
            });
        }

        // Pagination
        this.add.text(cx, 730, `${this.page + 1} / ${this.totalPages}`, {
            fontSize: '16px', color: '#888'
        }).setOrigin(0.5);

        if (this.page > 0) {
            this.add.text(80, 730, '◀ Prev', { fontSize: '18px', color: '#e94560' })
                .setOrigin(0.5).setInteractive({ useHandCursor: true })
                .on('pointerdown', () => { this.page--; this.drawPage(); });
        }
        if (this.page < this.totalPages - 1) {
            this.add.text(this.scale.width - 80, 730, 'Next ▶', { fontSize: '18px', color: '#e94560' })
                .setOrigin(0.5).setInteractive({ useHandCursor: true })
                .on('pointerdown', () => { this.page++; this.drawPage(); });
        }

        this.add.text(cx, 790, '[ Back ]', { fontSize: '20px', color: '#888' })
            .setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('Title'));
    }
}
