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

    closeOnBackdrop = true,

    // Opt-in: when true, the confirm button disables itself (blocking
    // double-submits), awaits onConfirm(), and only hides the modal once
    // that resolves. If onConfirm throws, the button re-enables and the
    // modal stays open -- the caller's own catch is expected to show a
    // Toast with the specific reason, so the modal doesn't duplicate it.
    // Default (false) keeps every existing call site's behavior exactly as
    // it was: hide immediately, don't wait on onConfirm's result.
    asyncConfirm = false,
  } = {}) {
    const modal = document.getElementById("st-modal");

    if (!modal) return;

    modal.className = modal.className
      .split(" ")
      .filter((c) => !c.startsWith("st-modal--"))
      .join(" ");

    modal.classList.add(`st-modal--${size}`);

    modal.classList.remove("hidden");

    const card = modal.querySelector(".st-modal-card");
    if (card) card.className = "st-modal-card";

    document.getElementById("st-modal-title").textContent = title;

    document.getElementById("st-modal-body").innerHTML = message;

    const confirmBtn = document.getElementById("st-modal-confirm");

    const cancelBtn = document.getElementById("st-modal-cancel");

    confirmBtn.textContent = confirmLabel;

    confirmBtn.style.display = hideConfirm ? "none" : "";

    if (asyncConfirm) {
      confirmBtn.onclick = async () => {
        if (confirmBtn.disabled) return;

        confirmBtn.disabled = true;

        try {
          if (onConfirm) await onConfirm();

          this.hide();
        } catch (err) {
          console.error("[Modal] asyncConfirm onConfirm failed", err);
        } finally {
          confirmBtn.disabled = false;
        }
      };
    } else {
      confirmBtn.onclick = () => {
        if (onConfirm) onConfirm();

        this.hide();
      };
    }

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

  static showCustom({
    title = "",

    bodyHtml = "",
    bodyElement = null,

    size = "lg",

    onClose = null,

    closeOnBackdrop = true,

    hideFooter = true,
  } = {}) {
    const modal = document.getElementById("st-modal");

    if (!modal) return;

    modal.className = modal.className
      .split(" ")
      .filter((c) => !c.startsWith("st-modal--"))
      .join(" ");

    modal.classList.add(`st-modal--${size}`);

    modal.classList.remove("hidden");

    const card = modal.querySelector(".st-modal-card");
    if (card) card.className = "st-modal-card";

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

    const footer = modal.querySelector(".st-modal-footer");

    if (footer) footer.style.display = "";
  }

  static _bindEscape() {
    if (this._escapeBound) return;

    this._escapeBound = true;

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;

      const modal = document.getElementById("st-modal");

      if (modal && !modal.classList.contains("hidden")) {
        this.hide();
      }
    });
  }
}

window.Modal = Modal;
