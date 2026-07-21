// LETTER — unlocked after beating the game. Scrollable text + a closing photo.
class LetterScene extends Phaser.Scene {
    constructor() { super('Letter'); }

    preload() {
        this.load.image('letter_end', 'img/letter_end.jpg');
    }

    create() {
        const cx = 195;

        // scrollable container
        this.content = this.add.container(0, 0);
        let y = 90;

        const para = (t, opts) => {
            const o = opts || {};
            const txt = this.add.text(cx, y, t, {
                fontSize: o.size || '16px', color: o.color || '#ffffff',
                align: o.align || 'left', fontStyle: o.style || 'normal',
                wordWrap: { width: 330 }, lineSpacing: 6
            }).setOrigin(0.5, 0);
            this.content.add(txt);
            y += txt.height + (o.gap != null ? o.gap : 22);
        };

        const LETTER = [
            "Dear Vanessa,",
            "Since it’s your birthday Imma make this about me. (This feels weird typing out the letter to you instead of handwriting it or writing “claude write a heartfelt funny letter to my girlfriend, make no mistakes, fuck you if you do”).",
            "When I was 22, I wanted to get my master’s, to sell our bikes, to actually hide the birthday gift in the Santa Barbara beach that I said I hid a year ago when you got mad at me for not calling you at 12AM on the dot and then claim it was there all along, to get a job, to launch my company, etc etc. Some of these things happened. Some of them didn’t. I’ll let you figure out which. But obviously I thought about you. Our relationship. The peace, the turbulence, the happiness, the sorrows, the colors of it all, the trust.",
            "I knew I would always love you. You have the wit, a keen sense of sympathy, and you’re cute and hot which y’know is a trifecta more powerful than the Chase Trifecta (of credit cards, I guess that’s not a good comparison cuz the Chase Trifecta is sucking balz now so the Hyrulean Trifecta!). And I knew that about you. I knew quickly because those are your black and whites.",
            "There’s a ton of gray with humans. And even knowing the direction for those grays is difficult. But knowing those hazy concepts for a person will give you a lot of color about them. You know my blacks and whites, my habit of chewing nails, my game preferences, my favorite basketball team. But I think you’re the only person in the world who knows the multidimensional direction of my grays. The temperature I like for showering, my stance on affirmative action, what I feel about my gender, my preferred hairstyle. I don’t need to tell you who I am.",
            "Now I’m 23, my goals are different, my worries are different, and so too is the way I love you. No longer is it the black white love of just telling you basic things like I love you, I’ll never cheat, and I think you’re beautiful. It has much more nuance and color.",
            "The reds of knowing when I give you options what you really want even if you’re not saying it.",
            "The greens of knowing when to hug you and how tight you like it.",
            "The blues of knowing when you’re uncomfortable with me.",
            "The purples of expectations that you may have of me.",
            "The blacks of back massages.",
            "The yellows of wording and blame.",
            "The oranges of when you get truly frustrated or annoyed and when to stop or start.",
            "My color palette is slowly growing with different shades for different things. And as I know you more and our love grows more colorful than it ever has been before. As you turn 22, many things will change: where I work in the world (PLEASE), your friends, and your experiences. But if one thing should be constant it is that our love for each other will always get painted. There may be days where oil spills on canvas, but when we take a look back and see how the oil, the colors, the whiteouts, and pen strokes look the painting gets more and more gorgeous everyday. That painting is almost as pretty as you.",
            "Happy Belated Birthday my wonderful webs,",
            "~Richard",
            "PS It goes without saying, I love you",
            "PSS Lol 22 asl, hello grandma",
        ];

        para('A Letter For You', { size: '22px', color: '#4ecca3', style: 'bold', align: 'center', gap: 34 });
        LETTER.forEach(p => para(p));

        // Closing photo
        y += 12;
        const img = this.add.image(cx, y, 'letter_end').setOrigin(0.5, 0);
        img.setScale(Math.min(320 / img.width, 320 / img.height));
        this.content.add(img);
        y += img.displayHeight + 40;

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
