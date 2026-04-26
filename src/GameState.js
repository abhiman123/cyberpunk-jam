export const GameState = {
    day: 1,
    calendarAnchorIso: null,
    deskPhotoLayout: null,
    totalMistakes: 0,
    paycheckTotal: 0,
    casesProcessedThisShift: 0,
    hasSeenOpeningPhoneCall: false,
    hasSeenRulebookTutorial: false,
    activeRules: [1],
    bonusRuleIds: [],
    rulebookSeenRules: new Set(),
    trackedMachineOutcomes: [],
    pendingWorldFeedNotifications: [],
    shiftSummaryAdjustments: [],
    specialItems: [],
    jesterDeal: null,
    umbrellaQuest: null,
    debriefReport: null,
    puzzleTimingBuckets: {
        grid: [],
        flow: [],
        gear: [],
        code: [],
    },
    activePuzzleTimingStarts: {},
    completedPuzzleTimingKeys: {},

    get period() {
        return this.getDirectiveDay();
    },

    get totalDays() {
        return 4;
    },

    isLastDay() {
        return this.day >= this.totalDays;
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
        return Math.max(1, this.day) - 1;
    },

    getDirectiveDay() {
        return Math.max(1, Math.min(3, this.day));
    },

    getLegacyContentCursor() {
        if (this.day <= 1) {
            return { period: 1, day: 1 };
        }

        if (this.day === 2) {
            return { period: 2, day: 1 };
        }

        if (this.day === 3) {
            return { period: 3, day: 1 };
        }

        return { period: 3, day: 2 };
    },

    getBaseRuleIdsForCurrentDay() {
        if (this.day <= 1) return [1];
        if (this.day === 2) return [1, 2];
        return [1, 2, 3];
    },

    recomputeActiveRules() {
        this.activeRules = [...new Set([
            ...this.getBaseRuleIdsForCurrentDay(),
            ...this.bonusRuleIds,
        ])].sort((left, right) => left - right);

        return this.activeRules;
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

    queueWorldFeedNotification(notification) {
        if (!notification) return null;

        const entry = {
            title: String(notification.title || 'WORLD FEED'),
            message: String(notification.message || ''),
            status: String(notification.status || 'WORLD FEED'),
            delayCases: Math.max(0, Number(notification.delayCases || 0)),
        };
        this.pendingWorldFeedNotifications.push(entry);
        return entry;
    },

    drainReadyWorldFeedNotifications() {
        const ready = [];
        const pending = [];

        this.pendingWorldFeedNotifications.forEach((entry) => {
            const nextDelay = Math.max(0, Number(entry.delayCases || 0));
            if (nextDelay <= 0) {
                ready.push({ ...entry, delayCases: 0 });
                return;
            }

            const decremented = nextDelay - 1;
            if (decremented <= 0) {
                ready.push({ ...entry, delayCases: 0 });
            } else {
                pending.push({ ...entry, delayCases: decremented });
            }
        });

        this.pendingWorldFeedNotifications = pending;
        return ready;
    },

    queueShiftSummaryAdjustment(adjustment) {
        if (!adjustment) return null;

        const entry = {
            label: String(adjustment.label || 'ADJUSTMENT'),
            amount: Number(adjustment.amount || 0),
        };
        this.shiftSummaryAdjustments.push(entry);
        return entry;
    },

    consumeShiftSummaryAdjustments() {
        const adjustments = this.shiftSummaryAdjustments.map((entry) => ({ ...entry }));
        this.shiftSummaryAdjustments = [];
        return adjustments;
    },

    addSpecialItem(item) {
        if (!item) return null;

        const entry = typeof item === 'string'
            ? { id: item, label: item }
            : {
                ...item,
                id: String(item.id || item.label || `item_${this.specialItems.length + 1}`),
                label: String(item.label || item.id || 'Unknown Item'),
            };

        const existingIndex = this.specialItems.findIndex((existing) => existing.id === entry.id);
        if (existingIndex >= 0) {
            this.specialItems.splice(existingIndex, 1, {
                ...this.specialItems[existingIndex],
                ...entry,
            });
            return this.specialItems[existingIndex];
        }

        this.specialItems.push(entry);
        return entry;
    },

    getSpecialItem(itemId) {
        return this.specialItems.find((item) => item.id === itemId) || null;
    },

    hasSpecialItem(itemId) {
        return Boolean(this.getSpecialItem(itemId));
    },

    getDayFourEndingVariant() {
        const quest = this.umbrellaQuest;
        if (!quest || quest.failed) {
            return 'replacement';
        }

        if (quest.stage === 'pending-day4' && quest.specialCircuitDelivered) {
            if (quest.deliveredPurpleCircuit && quest.deliveredClownCircuit) {
                return 'umbrella_mixed';
            }

            if (quest.deliveredPurpleCircuit) {
                return 'umbrella_purple';
            }

            if (quest.deliveredClownCircuit) {
                return 'umbrella_red';
            }
        }

        return 'replacement';
    },

    startPuzzleTimer(type, contextKey) {
        if (!type || !contextKey) return;
        if (!this.puzzleTimingBuckets[type]) return;
        if (this.completedPuzzleTimingKeys[contextKey]) return;
        if (this.activePuzzleTimingStarts[contextKey]) return;
        this.activePuzzleTimingStarts[contextKey] = Date.now();
    },

    finishPuzzleTimer(type, contextKey, { completed = false } = {}) {
        if (!type || !contextKey) return;
        if (!this.puzzleTimingBuckets[type]) return;
        const startedAt = this.activePuzzleTimingStarts[contextKey];
        delete this.activePuzzleTimingStarts[contextKey];
        if (!completed || !startedAt || this.completedPuzzleTimingKeys[contextKey]) return;

        const elapsedMs = Math.max(0, Date.now() - startedAt);
        this.puzzleTimingBuckets[type].push(elapsedMs);
        this.completedPuzzleTimingKeys[contextKey] = true;
    },

    getPuzzleTimingStats(type) {
        const bucket = this.puzzleTimingBuckets?.[type];
        if (!Array.isArray(bucket) || bucket.length <= 0) {
            return { count: 0, averageMs: 0 };
        }
        const totalMs = bucket.reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
        return {
            count: bucket.length,
            averageMs: totalMs / bucket.length,
        };
    },

    removeSpecialItem(itemId) {
        const existingIndex = this.specialItems.findIndex((item) => item.id === itemId);
        if (existingIndex < 0) return null;

        const [removed] = this.specialItems.splice(existingIndex, 1);
        return removed || null;
    },

    advanceDay() {
        this.day += 1;

        this.recomputeActiveRules();

        this.casesProcessedThisShift = 0;
    },

    reset() {
        this.day = 1;
        this.calendarAnchorIso = null;
        this.deskPhotoLayout = null;
        this.totalMistakes = 0;
        this.paycheckTotal = 0;
        this.casesProcessedThisShift = 0;
        this.hasSeenOpeningPhoneCall = false;
        this.hasSeenRulebookTutorial = false;
        this.activeRules = [1];
        this.bonusRuleIds = [];
        this.rulebookSeenRules = new Set();
        this.trackedMachineOutcomes = [];
        this.pendingWorldFeedNotifications = [];
        this.shiftSummaryAdjustments = [];
        this.specialItems = [];
        this.jesterDeal = null;
        this.umbrellaQuest = null;
        this.debriefReport = null;
        this.puzzleTimingBuckets = {
            grid: [],
            flow: [],
            gear: [],
            code: [],
        };
        this.activePuzzleTimingStarts = {};
        this.completedPuzzleTimingKeys = {};
    }
};
