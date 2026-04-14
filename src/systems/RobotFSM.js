const STAGES = [
    {
        stage: 0,
        label: 'Dormant',
        x: 1180,
        alpha: 0.2,
        tint: 0x444444,
        eyeGlow: false,
        message: null,
    },
    {
        stage: 1,
        label: 'Stirring',
        x: 1060,
        alpha: 0.4,
        tint: 0x884400,
        eyeGlow: false,
        message: 'Something stirs in the dark.',
    },
    {
        stage: 2,
        label: 'Active',
        x: 920,
        alpha: 0.6,
        tint: 0xaa5500,
        eyeGlow: true,
        eyeColor: 0xff4400,
        message: 'Its eyes open.',
    },
    {
        stage: 3,
        label: 'Watching',
        x: 780,
        alpha: 0.75,
        tint: 0xcc3300,
        eyeGlow: true,
        eyeColor: 0xff2200,
        message: 'It has noticed you.',
    },
    {
        stage: 4,
        label: 'Rising',
        x: 640,
        alpha: 0.85,
        tint: 0xdd2200,
        eyeGlow: true,
        eyeColor: 0xff0000,
        message: 'It is standing.',
    },
    {
        stage: 5,
        label: 'Advancing',
        x: 500,
        alpha: 0.95,
        tint: 0xff1100,
        eyeGlow: true,
        eyeColor: 0xff0000,
        message: 'It is coming for you.',
    },
    {
        stage: 6,
        label: 'Imminent',
        x: 360,
        alpha: 1.0,
        tint: 0xff0000,
        eyeGlow: true,
        eyeColor: 0xffffff,
        message: 'One more mistake.',
    },
    {
        stage: 7,
        label: 'Kill',
        x: 100,
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

        const s = STAGES[0];

        this.sprite = scene.add.image(s.x, 260, 'robot')
            .setAlpha(s.alpha)
            .setTint(s.tint)
            .setDepth(10);

        this.messageText = scene.add.text(640, 560, '', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#ff4400',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(11).setAlpha(0);
    }

    advance(mistakeCount) {
        this.currentStage = Math.min(mistakeCount, STAGES.length - 1);
        this._applyStage(STAGES[this.currentStage]);
    }

    _applyStage(stageData) {
        // slide the robot in
        this.scene.tweens.add({
            targets: this.sprite,
            x: stageData.x,
            alpha: stageData.alpha,
            duration: 800,
            ease: 'Power2',
        });

        this.sprite.setTint(stageData.tint);

        if (stageData.message) {
            this.messageText.setText(stageData.message).setAlpha(0);
            this.scene.tweens.add({
                targets: this.messageText,
                alpha: { from: 0, to: 1 },
                duration: 400,
                yoyo: true,
                hold: 1500,
                onComplete: () => this.messageText.setAlpha(0),
            });
        }
    }

    reset() {
        this.currentStage = 0;
        const s = STAGES[0];
        this.sprite.setAlpha(s.alpha).setTint(s.tint);
        this.scene.tweens.add({
            targets: this.sprite,
            x: s.x,
            duration: 400,
            ease: 'Power2',
        });
        this.messageText.setAlpha(0);
    }
}
