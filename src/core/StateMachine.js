export default class StateMachine {
    constructor(initial = null) {
        this.state = initial;
        this._handlers = new Map();
        this._exitHandlers = new Map();
    }

    on(state, enter, exit = null) {
        this._handlers.set(state, enter);
        if (exit) this._exitHandlers.set(state, exit);
        return this;
    }

    transition(next, context = null) {
        const prev = this.state;
        const exit = this._exitHandlers.get(prev);
        if (exit) exit(context, next);
        this.state = next;
        const enter = this._handlers.get(next);
        if (enter) enter(context, prev);
    }

    is(state) {
        return this.state === state;
    }
}
