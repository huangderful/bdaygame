class SettingsScene extends Phaser.Scene {
    constructor() { super('Settings'); }

    create() {
        const cx = this.scale.width / 2;
        this.add.text(cx, 200, 'Settings', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
        this.add.text(cx, 400, '(nothing here yet)', { fontSize: '16px', color: '#888' }).setOrigin(0.5);

        this.add.text(cx, 700, '[ Back ]', {
            fontSize: '20px', color: '#888'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('Title'));
    }
}
