class MiniGame extends Phaser.Scene {
    constructor() { super('MiniGame'); }

    init(data) {
        this.levelIndex = data.levelIndex ?? 0;
    }

    create() {
        const cx = this.scale.width / 2;

        const levels = this.registry.get('levels') || [];
        const levelName = levels[this.levelIndex]?.name || `Level ${this.levelIndex + 1}`;

        this.add.text(cx, 100, levelName, {
            fontSize: '24px', color: '#ffffff'
        }).setOrigin(0.5);

        this.add.text(cx, 200, 'Click the button to win!', {
            fontSize: '16px', color: '#888'
        }).setOrigin(0.5);

        const btn = this.add.text(cx, 420, '[ CLICK ME ]', {
            fontSize: '28px', color: '#1a1a2e', backgroundColor: '#e94560',
            padding: { x: 30, y: 15 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerdown', () => this.win());
    }

    win() {
        // Mark level complete
        const levels = this.registry.get('levels') || [];
        if (!levels[this.levelIndex]) {
            levels[this.levelIndex] = { completed: false, pageText: 'DEFAULT COMPLETED TEXT' };
        }
        levels[this.levelIndex].completed = true;
        this.registry.set('levels', levels);

        // Save to localStorage
        localStorage.setItem('bdaygame_levels', JSON.stringify(levels));

        // Show completion
        const cx = this.scale.width / 2;
        this.add.text(cx, 600, '✓ Page Unlocked!', {
            fontSize: '22px', color: '#4ecca3'
        }).setOrigin(0.5);

        this.time.delayedCall(1500, () => this.scene.start('LevelSelect'));
    }
}
