class TitleScene extends Phaser.Scene {
    constructor() { super('Title'); }

    create() {
        const cx = this.scale.width / 2;

        // Schedule birthday notification for July 21 12:00 AM PST
        try {
            if (window.Native && window.Native.scheduleNotification) {
                const target = new Date('2026-07-21T00:00:00-07:00').getTime();
                const delay = Math.max(1000, target - Date.now());
                if (delay > 1000) {
                    window.Native.scheduleNotification('🎂 Happy Birthday!', 'Open your present...', delay);
                }
            }
        } catch(e) { console.error(e); }

        this.add.text(cx, 200, 'The Webs Archive', {
            fontSize: '32px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.createButton(cx, 420, 'Play', () => this.scene.start('LevelSelect'));
        this.createButton(cx, 500, 'Archive', () => this.scene.start('Archive'));
        this.createButton(cx, 580, 'Settings', () => this.scene.start('Settings'));
    }

    createButton(x, y, label, callback) {
        const btn = this.add.text(x, y, `[ ${label} ]`, {
            fontSize: '24px', color: '#e94560', backgroundColor: '#16213e',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setColor('#ffffff'));
        btn.on('pointerout', () => btn.setColor('#e94560'));
        btn.on('pointerdown', callback);
    }
}
