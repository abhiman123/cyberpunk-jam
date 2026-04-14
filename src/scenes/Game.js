export default class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
        this.add.text(640, 360, 'Game loop running', {
            fontFamily: 'monospace',
            fontSize: '32px',
            color: '#00ffcc',
        }).setOrigin(0.5);

        this.belt = new ConveyorBelt(this);
        this.robot = new RobotFSM(this);
        this.gears = 0;
        this.mistakes = 0;

        this.belt.onMachineArrived = (machine) => {
            this.ui.showRecipe(machine.recipe);   // show what parts are needed
        };

        this.belt.onMachineCompleted = (machine) => {
            this.gears += machine.recipe.gearReward;
            this.ui.updateGears(this.gears);
            const unlocked = MachineRecipes.tryUnlock(this.gears);
            if (unlocked) this.ui.showUnlockNotice(unlocked.label);
        };

        this.belt.onMachineLeft = () => {
            this.mistakes++;
            this.robot.advance(this.mistakes);
        };
    }

    update(time, delta) {}
}