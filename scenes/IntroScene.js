// First-play intro slideshow: black background, white text fading in/out,
// ending on the outline ("the background") with AHHHHH, then Level Select.
// Seen-state persists in localStorage (cleared by the dev RESET ALL button).
const INTRO_SEEN_KEY = 'bdaygame_intro_seen';

class IntroScene extends Phaser.Scene {
    constructor() { super('Intro'); }

    preload() {
        this.load.image('parts_outline', 'img/parts/outline.png');
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000');
        // First play: the opening theme. (The Play tap that started this scene
        // is the user gesture, so autoplay policy allows it.)
        MusicFX.playOpening();
        // The canvas is FIT-scaled, so the letterbox edges show the page
        // background — force those black too for the intro, restore on exit.
        document.documentElement.style.backgroundColor = '#000000';
        document.body.style.backgroundColor = '#000000';
        this.events.once('shutdown', () => {
            document.documentElement.style.backgroundColor = '#1a1a2e';
            document.body.style.backgroundColor = '#1a1a2e';
        });
        const slides = [
            { text: 'Long long ago…', hold: 1500 },
            { text: 'There was a man', hold: 1500 },
            { text: "whose story I don't have\nthe budget to explain", hold: 2500 }, // 3s slide
            { text: 'REPAIR HIM!', hold: 1500 },
        ];
        this.showSlide(slides, 0);
    }

    // Each slide: fade in 500ms, hold, fade out 500ms, next.
    showSlide(slides, i) {
        if (i >= slides.length) { this.showFinale(); return; }
        const txt = this.add.text(195, 422, slides[i].text, {
            fontSize: i === slides.length - 1 ? '34px' : '24px',
            color: '#ffffff', fontStyle: i === slides.length - 1 ? 'bold' : 'normal',
            align: 'center', wordWrap: { width: 340 }
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({
            targets: txt, alpha: 1, duration: 500, hold: slides[i].hold, yoyo: true,
            onComplete: () => { txt.destroy(); this.showSlide(slides, i + 1); }
        });
    }

    showFinale() {
        // The background (the broken man's outline) with AHHHHH at the top.
        const outline = this.add.image(195, 460, 'parts_outline').setAlpha(0);
        const k = Math.min(340 / outline.width, 660 / outline.height);
        outline.setScale(k);
        const scream = this.add.text(195, 70, 'AHHHHH', {
            fontSize: '40px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({ targets: [outline, scream], alpha: 1, duration: 600 });
        this.time.delayedCall(2600, () => {
            this.tweens.add({
                targets: [outline, scream], alpha: 0, duration: 600,
                onComplete: () => {
                    localStorage.setItem(INTRO_SEEN_KEY, '1');
                    this.scene.start('LevelSelect');
                }
            });
        });
    }
}
