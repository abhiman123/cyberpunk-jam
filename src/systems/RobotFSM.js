const STAGES = [
    {
        stage: 0,
        label: 'Dormant',
        x: 1150,          // off to the right edge, barely visible
        alpha: 0.2,
        tint: 0x444444,
        eyeGlow: false,
        message: null,
    },
    {
        stage: 1,
        label: 'Stirring',
        x: 1050,
        alpha: 0.4,
        tint: 0x884400,
        eyeGlow: false,
        message: 'Something stirs in the dark.',
    },
    {
        stage: 2,
        label: 'Active',
        x: 900,
        alpha: 0.6,
        tint: 0xaa5500,
        eyeGlow: true,
        eyeColor: 0xff4400,
        message: 'Its eyes open.',
    },
    {
        stage: 3,
        label: 'Watching',
        x: 720,
        alpha: 0.75,
        tint: 0xcc3300,
        eyeGlow: true,
        eyeColor: 0xff2200,
        message: 'It has noticed you.',
    },
    {
        stage: 4,
        label: 'Rising',
        x: 560,
        alpha: 0.85,
        tint: 0xdd2200,
        eyeGlow: true,
        eyeColor: 0xff0000,
        message: 'It is standing.',
    },
    {
        stage: 5,
        label: 'Advancing',
        x: 400,
        alpha: 0.95,
        tint: 0xff1100,
        eyeGlow: true,
        eyeColor: 0xff0000,
        message: 'It is coming for you.',
    },
    {
        stage: 6,
        label: 'Imminent',
        x: 240,
        alpha: 1.0,
        tint: 0xff0000,
        eyeGlow: true,
        eyeColor: 0xffffff,
        message: 'One more mistake.',
    },
    {
        stage: 7,
        label: 'Kill',
        x: 0,
        alpha: 1.0,
        tint: 0xffffff,
        eyeGlow: true,
        eyeColor: 0xff0000,
        message: 'SYSTEM FAILURE.',
    },
];

export default class RobotFSM {
    constructor(scene) {
        this.scene = scene;
        this.currentStage = 0;

        this.sprite = scene.add.image(STAGES[0].x, 300, 'robot');
        this.sprite.setAlpha(STAGES[0].alpha);
        this.sprite.setDepth(10);

        this.messageText = scene.add.text(640, 560, '', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#ff4400',
        }).setOrigin(0.5).setDepth(11);
    }

    advance(mistakeCount) {
        // clamp to max stage
        this.currentStage = Math.min(mistakeCount, STAGES.length - 1);
        this._applyStage(STAGES[this.currentStage]);

        if (this.currentStage === 7) {
            this._triggerKill();
        }
    }

    _applyStage(stageData) {
        // tween the robot sliding in
        this.scene.tweens.add({
            targets: this.sprite,
            x: stageData.x,
            alpha: stageData.alpha,
            duration: 800,
            ease: 'Power2',
        });

        this.sprite.setTint(stageData.tint);

        if (stageData.message) {
            this.messageText.setText(stageData.message);
            // fade message in then out
            this.scene.tweens.add({
                targets: this.messageText,
                alpha: { from: 0, to: 1 },
                duration: 400,
                yoyo: true,
                hold: 1500,
            });
        }
    }

    _triggerKill() {
        // screen flash, then transition
        this.scene.cameras.main.flash(300, 255, 0, 0);
        this.scene.cameras.main.shake(500, 0.04);
        this.scene.time.delayedCall(800, () => {
            this.scene.scene.start('GameOver');
        });
    }

    reset() {
        this.currentStage = 0;
        this._applyStage(STAGES[0]);
    }
}