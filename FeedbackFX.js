// Shared feedback effects: positive/negative sounds and image fountains.
// Usage:
//   preload() { FeedbackFX.preload(this); }
//   FeedbackFX.playPositive(this);           // random positive mp3
//   FeedbackFX.playNegative(this);           // random negative mp3
//   FeedbackFX.fountain(this, x, y, true);   // 3-7 positive images fountain from (x, y)
//   FeedbackFX.fountain(this, x, y, false);  // 3-7 negative images
const FeedbackFX = {
    NUM_IMAGES: 7,
    NUM_SOUNDS: 3,

    preload(scene) {
        for (let i = 1; i <= this.NUM_IMAGES; i++) {
            scene.load.image(`fx_pos${i}`, `img/positive/pos${i}.png`);
            scene.load.image(`fx_neg${i}`, `img/negative/neg${i}.png`);
        }
        for (let i = 1; i <= this.NUM_SOUNDS; i++) {
            scene.load.audio(`fx_snd_pos${i}`, `sounds/positive/pos${i}.mp3`);
            scene.load.audio(`fx_snd_neg${i}`, `sounds/negative/neg${i}.mp3`);
        }
    },

    playPositive(scene) {
        scene.sound.play(`fx_snd_pos${Phaser.Math.Between(1, this.NUM_SOUNDS)}`);
    },

    playNegative(scene) {
        scene.sound.play(`fx_snd_neg${Phaser.Math.Between(1, this.NUM_SOUNDS)}`);
    },

    // 3-7 images (each picked independently, repeats allowed) burst upward from
    // (x, y) with high downward acceleration, fading to invisible over 1 second.
    fountain(scene, x, y, positive) {
        const count = Phaser.Math.Between(3, 7);
        const prefix = positive ? 'fx_pos' : 'fx_neg';
        for (let i = 0; i < count; i++) {
            const key = `${prefix}${Phaser.Math.Between(1, this.NUM_IMAGES)}`;
            const img = scene.add.image(x, y, key).setDepth(200);
            // normalize to ~66px on the longest side regardless of source size
            img.setScale(66 / Math.max(img.width, img.height));
            const vx = Phaser.Math.FloatBetween(-140, 140);
            const vy = Phaser.Math.FloatBetween(-620, -420); // launch upward
            const accel = 1500;                              // strong pull back down
            scene.tweens.addCounter({
                from: 0, to: 1, duration: 1000,
                onUpdate: (tw) => {
                    const t = tw.getValue();
                    img.x = x + vx * t;
                    img.y = y + vy * t + 0.5 * accel * t * t;
                    img.setAlpha(1 - t);
                },
                onComplete: () => img.destroy()
            });
        }
    }
};
