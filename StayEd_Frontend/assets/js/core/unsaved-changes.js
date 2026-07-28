
const UnsavedChanges = {

    _dirtyForms: new Set(),

    _installed: false,

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

    clear(container) {

        this._dirtyForms.delete(container);

    },

    hasUnsavedChanges() {

        return this._dirtyForms.size > 0;

    },

    _installGlobalGuards() {

        if (this._installed) return;

        this._installed = true;

        window.addEventListener("beforeunload", event => {

            if (!this.hasUnsavedChanges()) return;

            event.preventDefault();

            event.returnValue = "";

        });

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
