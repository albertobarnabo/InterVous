// Just enough of React for store.ts's useResource to run outside a render.
const subscribed = [];
const cleanups = [];
let state;

export const useRef = (current) => ({ current });
export const useCallback = (callback) => callback;
export function useEffect(effect) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
}
export function useState(initial) {
    state = { value: typeof initial === 'function' ? initial() : initial };
    const box = state;
    return [box.value, (next) => (box.value = typeof next === 'function' ? next(box.value) : next)];
}

/** The value of the most recent useState, which no re-render would otherwise show. */
export const currentState = () => state.value;

/** Runs every effect cleanup so far. */
export function unmount() {
    for (const cleanup of cleanups.splice(0)) cleanup();
}

export function useSyncExternalStore(subscribe, getSnapshot) {
    subscribed.push(subscribe(() => {}));
    return getSnapshot();
}

/** Takes every useResource call so far off screen. */
export function leaveScreen() {
    for (const unsubscribe of subscribed.splice(0)) unsubscribe();
}
