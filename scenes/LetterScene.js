// LETTER — unlocked after beating the game. Scrollable text with images.
// Content is placeholder lorem ipsum for now.
class LetterScene extends Phaser.Scene {
    constructor() { super('Letter'); }

    preload() {
        // reuse the positive feedback photos as the letter's images for now
        this.load.image('letter_img1', 'img/positive/pos1.png');
        this.load.image('letter_img2', 'img/positive/pos3.png');
        this.load.image('letter_img3', 'img/positive/pos5.png');
    }

    create() {
        const cx = 195;
        this.add.rectangle(cx, 30, 390, 60, 0x1a1a2e).setDepth(10);
        this.add.text(cx, 30, 'A LETTER FOR YOU', {
            fontSize: '20px', color: '#4ecca3', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11);

        // scrollable container
        this.content = this.add.container(0, 0);
        let y = 90;

        const para = (t) => {
            const txt = this.add.text(cx, y, t, {
                fontSize: '16px', color: '#ffffff', align: 'left',
                wordWrap: { width: 330 }, lineSpacing: 6
            }).setOrigin(0.5, 0);
            this.content.add(txt);
            y += txt.height + 24;
        };
        const image = (key) => {
            const img = this.add.image(cx, y, key).setOrigin(0.5, 0);
            const s = Math.min(280 / img.width, 280 / img.height);
            img.setScale(s);
            this.content.add(img);
            y += img.height * s + 24;
        };

        para('Dear Webs,');
        para('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor ' +
             'incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud ' +
             'exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.');
        image('letter_img1');
        para('Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu ' +
             'fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in ' +
             'culpa qui officia deserunt mollit anim id est laborum.');
        para('Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium ' +
             'doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore ' +
             'veritatis et quasi architecto beatae vitae dicta sunt explicabo.');
        image('letter_img2');
        para('Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed ' +
             'quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.');
        para('Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, ' +
             'adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et ' +
             'dolore magnam aliquam quaerat voluptatem.');
        image('letter_img3');
        para('And that’s a fact.');
        para('— Richard');
        y += 40;

        this.contentHeight = y;
        this.scrollY = 0;
        this.maxScroll = Math.max(0, this.contentHeight - 844 + 80);

        // drag to scroll (with a little momentum)
        this.velocity = 0;
        this.lastY = null;
        this.input.on('pointerdown', (p) => { this.lastY = p.y; this.velocity = 0; });
        this.input.on('pointermove', (p) => {
            if (!p.isDown || this.lastY === null) return;
            const dy = p.y - this.lastY;
            this.lastY = p.y;
            this.velocity = -dy;
            this.scroll(this.scrollY - dy);
        });
        this.input.on('pointerup', () => { this.lastY = null; });

        const back = this.add.text(cx, 815, '[ Back ]', {
            fontSize: '18px', color: '#888', backgroundColor: '#1a1a2e', padding: { x: 10, y: 4 }
        }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true });
        back.on('pointerdown', (p, lx, ly, event) => {
            event.stopPropagation();
            this.scene.start('Title');
        });
    }

    scroll(v) {
        this.scrollY = Phaser.Math.Clamp(v, 0, this.maxScroll);
        this.content.y = -this.scrollY;
    }

    update() {
        if (this.lastY === null && Math.abs(this.velocity) > 0.5) {
            this.scroll(this.scrollY + this.velocity);
            this.velocity *= 0.95;
        }
    }
}
