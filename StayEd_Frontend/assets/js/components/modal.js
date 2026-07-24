/**
 * ============================================
 * StayEd
 * Modal Manager
 * ============================================
 *
 * Standardized modal behaviour app-wide:
 *   - consistent width system (sm/md/lg/xl via
 *     the `size` option, defaulting to md)
 *   - consistent header with a close (X) button
 *   - consistent footer buttons (Cancel/Confirm,
 *     with confirmLabel/cancelLabel overrides)
 *   - Escape key closes the modal
 *   - clicking the backdrop closes the modal
 *   - smooth open/close animation
 *
 * Fully backward compatible with the original
 * Modal.show({title, message, onConfirm}) call
 * shape used throughout the app; new options are
 * additive.
 * ============================================
 */

class Modal {

    static _escapeBound = false;

    static show({

        title = "Confirmation",

        message = "",

        onConfirm = null,

        onCancel = null,

        onClose = null,

        confirmLabel = "Confirm",

        cancelLabel = "Cancel",

        size = "md",

        hideCancel = false,

        hideConfirm = false,

        closeOnBackdrop = true

    } = {}) {

        const modal = document.getElementById("st-modal");

        if (!modal) return;

        // Reset any previous size modifier, apply the new one.
        modal.className = modal.className
            .split(" ")
            .filter(c => !c.startsWith("st-modal--"))
            .join(" ");

        modal.classList.add(`st-modal--${size}`);

        modal.classList.remove("hidden");

        document.getElementById("st-modal-title").textContent = title;

        document.getElementById("st-modal-body").innerHTML = message;

        const confirmBtn = document.getElementById("st-modal-confirm");

        const cancelBtn = document.getElementById("st-modal-cancel");

        confirmBtn.textContent = confirmLabel;

        confirmBtn.style.display = hideConfirm ? "none" : "";

        confirmBtn.onclick = () => {

            if (onConfirm) onConfirm();

            this.hide();

        };

        cancelBtn.textContent = cancelLabel;

        cancelBtn.style.display = hideCancel ? "none" : "";

        cancelBtn.onclick = () => {

            if (onCancel) onCancel();

            this.hide();

        };

        const closeBtn = document.getElementById("st-modal-close");

        if (closeBtn) {

            closeBtn.onclick = () => {

                if (onClose) onClose();

                this.hide();

            };

        }

        const backdrop = modal.querySelector(".st-modal-backdrop");

        if (backdrop) {

            backdrop.onclick = closeOnBackdrop
                ? () => {
                    if (onClose) onClose();
                    this.hide();
                }
                : null;

        }

        this._bindEscape();

    }

    /**
     * Show a modal with fully custom body HTML and no
     * default Confirm/Cancel wiring (e.g. embedding a
     * larger workflow like Module Management). Still
     * gets the standardized header/close/Escape/
     * backdrop/animation behaviour.
     */
    static showCustom({

        title = "",

        bodyHtml = "",
        bodyElement = null,

        size = "lg",

        onClose = null,

        closeOnBackdrop = true,

        hideFooter = true

    } = {}) {

        const modal = document.getElementById("st-modal");

        if (!modal) return;

        modal.className = modal.className
            .split(" ")
            .filter(c => !c.startsWith("st-modal--"))
            .join(" ");

        modal.classList.add(`st-modal--${size}`);

        modal.classList.remove("hidden");

        document.getElementById("st-modal-title").textContent = title;

        const body = document.getElementById("st-modal-body");

        if (bodyElement) {

            body.innerHTML = "";

            body.appendChild(bodyElement);

        } else {

            body.innerHTML = bodyHtml;

        }

        const footer = modal.querySelector(".st-modal-footer");

        if (footer) {
            footer.style.display = hideFooter ? "none" : "";
        }

        const closeBtn = document.getElementById("st-modal-close");

        if (closeBtn) {

            closeBtn.onclick = () => {
                if (onClose) onClose();
                this.hide();
            };

        }

        const backdrop = modal.querySelector(".st-modal-backdrop");

        if (backdrop) {

            backdrop.onclick = closeOnBackdrop
                ? () => {
                    if (onClose) onClose();
                    this.hide();
                }
                : null;

        }

        this._bindEscape();

        return body;

    }

    static hide() {

        const modal = document.getElementById("st-modal");

        if (!modal) return;

        modal.classList.add("hidden");

        // Restore the footer for the next standard show()
        // call, in case showCustom() hid it.
        const footer = modal.querySelector(".st-modal-footer");

        if (footer) footer.style.display = "";

    }

    static _bindEscape() {

        if (this._escapeBound) return;

        this._escapeBound = true;

        document.addEventListener("keydown", event => {

            if (event.key !== "Escape") return;

            const modal = document.getElementById("st-modal");

            if (modal && !modal.classList.contains("hidden")) {

                this.hide();

            }

        });

    }

}

window.Modal = Modal;
