// Stands in for both `@/ui` and lib/data when a hook in src/features runs under node --test: a toast
// API that records what is on screen, and a deleteApplications that records its calls.
export const shown = {
    toasts: [],
    deletes: [],
    /** What the next delete does: return a value, or throw it if it is an Error. */
    nextDelete: null,
};

export function resetFakes() {
    shown.toasts = [];
    shown.deletes = [];
    shown.nextDelete = null;
}

let nextToast = 1;
const toastApi = {
    show(t) {
        const id = nextToast++;
        shown.toasts.push({ ...t, id });
        return id;
    },
    dismiss(id) {
        shown.toasts = shown.toasts.filter((t) => t.id !== id);
    },
};

export const useToast = () => toastApi;

export async function deleteApplications(ids, opts) {
    shown.deletes.push({ ids, opts });
    const next = shown.nextDelete;
    if (next instanceof Error) throw next;
    return next ?? { deleted: ids.length, filesLeft: 0, filesUnchecked: 0 };
}

export const refetchAll = async () => {};
