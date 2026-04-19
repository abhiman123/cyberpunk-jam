export const GameState = {
    period: 1,
    day: 1,
    calendarAnchorIso: null,
    deskPhotoLayout: null,
    totalMistakes: 0,
    paycheckTotal: 0,
    casesProcessedThisShift: 0,
    hasSeenOpeningPhoneCall: false,
    activeRules: [1],
    rulebookSeenRules: new Set(),
    trackedMachineOutcomes: [],

    isLastDay() {
        return this.period === 3 && this.day === 2;
    },

    _getTodayIso() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    ensureCalendarAnchor() {
        if (!this.calendarAnchorIso) {
            this.calendarAnchorIso = this._getTodayIso();
        }

        return this.calendarAnchorIso;
    },

    getShiftSequenceIndex() {
        return (Math.max(1, this.period) - 1) * 2 + (Math.max(1, this.day) - 1);
    },

    getDirectiveDay() {
        return Math.max(1, Math.min(3, this.period));
    },

    getCurrentShiftDate() {
        const [year, month, day] = this.ensureCalendarAnchor().split('-').map(Number);
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() + this.getShiftSequenceIndex());
        return date;
    },

    recordTrackedMachineOutcome(outcome) {
        if (!outcome) return null;

        this.trackedMachineOutcomes.push({
            ...outcome,
            completedPuzzleParts: Array.isArray(outcome.completedPuzzleParts)
                ? [...outcome.completedPuzzleParts]
                : [],
            resolvedPuzzleParts: Array.isArray(outcome.resolvedPuzzleParts)
                ? [...outcome.resolvedPuzzleParts]
                : [],
        });

        return outcome;
    },

    formatCurrentShiftDate() {
        const date = this.getCurrentShiftDate();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${month}.${day}.${year}`;
    },

    advanceDay() {
        if (this.day < 2) {
            this.day++;
        } else {
            this.period++;
            this.day = 1;
        }

        if (this.period <= 1) this.activeRules = [1];
        else if (this.period === 2) this.activeRules = [1, 2];
        else this.activeRules = [1, 2, 3];

        this.casesProcessedThisShift = 0;
    },

    reset() {
        this.period = 1;
        this.day = 1;
        this.calendarAnchorIso = null;
        this.deskPhotoLayout = null;
        this.totalMistakes = 0;
        this.paycheckTotal = 0;
        this.casesProcessedThisShift = 0;
        this.hasSeenOpeningPhoneCall = false;
        this.activeRules = [1];
        this.rulebookSeenRules = new Set();
        this.trackedMachineOutcomes = [];
    }
};
