class MiniGameQuickdraw extends Phaser.Scene {
    constructor() { super('MiniGameQuickdraw'); }
    init(data) { this.levelIndex = data.levelIndex; }

    create() {
        const cx = 195;
        this.done = false;
        this.canTap = false;
        this.tapped = false;

        this.add.text(cx, 100, 'QUICKDRAW', { fontSize: '24px', color: '#e94560', fontStyle: 'bold' }).setOrigin(0.5);
        this.mainText = this.add.text(cx, 400, 'WAIT...', { fontSize: '48px', color: '#888' }).setOrigin(0.5);
        this.subText = this.add.text(cx, 500, "Don't tap yet!", { fontSize: '16px', color: '#666' }).setOrigin(0.5);

        // Random delay 1.5-4 seconds
        const delay = 1500 + Math.random() * 2500;
        this.time.delayedCall(delay, () => {
            if (this.tapped) return; // false start already handled
            this.canTap = true;
            this.drawTime = Date.now();
            this.mainText.setText('DRAW!').setColor('#ff0000');
            this.subText.setText('TAP NOW!');
            // Auto-fail after 1 second
            this.time.delayedCall(1000, () => { if (!this.done && this.canTap) this.fail('Too slow!'); });
        });

        this.input.on('pointerdown', () => {
            if (this.done) return;
            if (!this.canTap) {
                this.tapped = true;
                this.fail('False start!');
            } else {
                this.done = true;
                const reaction = Date.now() - this.drawTime;
                if (reaction < 300) this.win(reaction);
                else this.fail(`${reaction}ms — need under 300ms`);
            }
        });
    }

    win(ms) {
        this.mainText.setText(`${ms}ms`).setColor('#4ecca3');
        this.subText.setText('⚡ Lightning fast!');
        const levels = this.registry.get('levels');
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));
        this.add.text(195, 600, '✓ Page Unlocked!', { fontSize: '20px', color: '#4ecca3' }).setOrigin(0.5);
        this.time.delayedCall(2000, () => this.scene.start('LevelSelect'));
    }

    fail(msg) {
        this.done = true;
        this.mainText.setText('✗').setColor('#e94560');
        this.subText.setText(msg);
        this.time.delayedCall(1500, () => {
            this.showRetry();
        });
    }

    showRetry() {
        const cx = 195;
        this.add.text(cx, 650, '[ Retry ]', { fontSize: '20px', color: '#4ecca3', backgroundColor: '#16213e', padding: { x: 16, y: 8 } })
            .setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.restart({ levelIndex: this.levelIndex }));
        this.add.text(cx, 710, '[ Back ]', { fontSize: '16px', color: '#888' })
            .setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('LevelSelect'));
    }
}
