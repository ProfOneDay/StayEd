/**
 * ============================================
 * StayEd
 * Unsaved Changes Guard
 * ============================================
 *
 * Watches a form (or any container) for user
 * edits and warns before the browser tab closes
 * or reloads, and before in-app links navigate
 * away, so nobody silently loses form input.
 *
 * Usage:
 *   UnsavedChanges.track(formElement);
 *   // ...on successful save:
 *   UnsavedChanges.clear(formElement);
 * ============================================
 */

const UnsavedChanges = {

    _dirtyForms: new Set(),

    _installed: false,

    /**
     * Start tracking a form/container for changes.
     * Any input/change event inside it marks it dirty;
     * calling clear() (e.g. after a successful save)
     * marks it clean again.
     */
    track(container) {

        if (!container || container.dataset.unsavedTracked) {

            return;

        }

        container.dataset.unsavedTracked = "true";

        const markDirty = () => this._dirtyForms.add(container);

        container.addEventListener("input", markDirty);

        container.addEventListener("change", markDirty);

        this._installGlobalGuards();

    },

    /**
     * Mark a tracked form/container as saved (clean).
     * Call this right after a successful submit/save.
     */
    clear(container) {

        this._dirtyForms.delete(container);

    },

    /**
     * Whether anything currently tracked has unsaved
     * edits.
     */
    hasUnsavedChanges() {

        return this._dirtyForms.size > 0;

    },

    /* -----------------------------------------
       Global guards (installed once): browser
       close/reload, and in-app link clicks.
    ----------------------------------------- */

    _installGlobalGuards() {

        if (this._installed) return;

        this._installed = true;

        window.addEventListener("beforeunload", event => {

            if (!this.hasUnsavedChanges()) return;

            event.preventDefault();

            // Chrome requires returnValue to be set to
            // show its native confirmation dialog.
            event.returnValue = "";

        });

        /*
         * Intercept clicks on in-app links (not the
         * current page, not new-tab/modifier clicks) so
         * the person gets our own confirm dialog rather
         * than the generic browser prompt, matching the
         * rest of the app's modal styling.
         */
        document.addEventListener("click", event => {

            if (!this.hasUnsavedChanges()) return;

            const link = event.target.closest("a[href]");

            if (!link) return;

            const href = link.getAttribute("href");

            if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
                return;
            }

            if (event.metaKey || event.ctrlKey || event.shiftKey || link.target === "_blank") {
                return;
            }

            event.preventDefault();

            if (window.Modal) {

                Modal.show({

                    title: "Unsaved Changes",

                    message: "You have unsaved changes on this page. Are you sure you want to leave without saving?",

                    onConfirm: () => {

                        this._dirtyForms.clear();

                        window.location.href = href;

                    }

                });

            } else if (window.confirm("You have unsaved changes. Leave without saving?")) {

                this._dirtyForms.clear();

                window.location.href = href;

            }

        }, true);

    }

};

window.UnsavedChanges = UnsavedChanges;
