class ArchiveScene extends Phaser.Scene {
    constructor() { super('Archive'); }

    create() {
        const cx = this.scale.width / 2;
        this.currentPage = 0;

        const levels = this.registry.get('levels') || [];
        this.completedLevels = levels.filter(l => l.completed);

        this.add.text(cx, 60, 'Archive', {
            fontSize: '24px', color: '#ffffff'
        }).setOrigin(0.5);

        this.pageText = this.add.text(cx, 400, '', {
            fontSize: '18px', color: '#cccccc', wordWrap: { width: 300 }, align: 'center'
        }).setOrigin(0.5);

        this.pageNum = this.add.text(cx, 700, '', {
            fontSize: '16px', color: '#888'
        }).setOrigin(0.5);

        // Nav arrows
        this.add.text(60, 400, '◀', { fontSize: '32px', color: '#e63030' })
            .setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.flip(-1));

        this.add.text(this.scale.width - 60, 400, '▶', { fontSize: '32px', color: '#e63030' })
            .setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.flip(1));

        this.add.text(cx, 780, '[ Back ]', {
            fontSize: '20px', color: '#888'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('Title'));

        this.showPage();
    }

    flip(dir) {
        if (this.completedLevels.length === 0) return;
        this.currentPage = (this.currentPage + dir + this.completedLevels.length) % this.completedLevels.length;
        this.showPage();
    }

    showPage() {
        if (this.completedLevels.length === 0) {
            this.pageText.setText('No pages unlocked yet.\nComplete minigames to fill the archive.');
            this.pageNum.setText('');
        } else {
            const level = this.completedLevels[this.currentPage];
            this.pageText.setText(level.pageText || 'DEFAULT COMPLETED TEXT');
            this.pageNum.setText(`Page ${this.currentPage + 1} / ${this.completedLevels.length}`);
        }
    }
}
