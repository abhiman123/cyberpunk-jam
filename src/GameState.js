export const GameState = {
    period: 1,
    day: 1,
    totalMistakes: 0,
    paycheckTotal: 0,
    activeRules: [1, 2, 3],
    casesCompleted: [],
    rulebookSeenRules: new Set(),

    isLastDay() {
        return this.period === 3 && this.day === 2;
    },

    advanceDay() {
        if (this.day < 2) {
            this.day++;
        } else {
            this.period++;
            this.day = 1;
            if (this.period === 2) this.activeRules = [1, 2, 3, 4, 5];
            if (this.period === 3) this.activeRules = [1, 2, 3, 4, 5, 6, 7];
        }
    },

    reset() {
        this.period = 1;
        this.day = 1;
        this.totalMistakes = 0;
        this.paycheckTotal = 0;
        this.activeRules = [1, 2, 3];
        this.casesCompleted = [];
        this.rulebookSeenRules = new Set();
    }
};
