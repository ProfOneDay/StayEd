class Toast {
  // How long each kind of message stays on screen before fading out.
  // Problems (warning/error) stay longer than confirmations because the
  // reader usually needs to act on them. Longer messages get extra time
  // (see readingTime) so nobody has to rush to finish reading.
  static DURATIONS = {
    success: 5000,
    info: 6000,
    warning: 8000,
    error: 9000,
  };

  static readingTime(message) {
    const extraChars = Math.max(0, String(message || "").length - 60);
    return Math.min(extraChars * 50, 6000);
  }

  static show(message, type = "success", duration) {
    // Problems raised while the user is filling in a modal form belong in
    // that form, next to what they're fixing -- not in a corner toast that
    // can disappear behind the overlay. Confirmations still toast.
    if ((type === "error" || type === "warning") && ModalInlineError.show(message, type)) {
      return;
    }

    const container = document.getElementById("st-toast-container");

    if (!container) {
      return;
    }

    const total =
      (duration ?? this.DURATIONS[type] ?? this.DURATIONS.info) + this.readingTime(message);

    const toast = document.createElement("div");
    toast.className = `st-toast st-toast-${type}`;
    toast.setAttribute("role", type === "error" || type === "warning" ? "alert" : "status");

    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = this.icon(type);

    // textContent, not innerHTML: messages can include text that came back
    // from the server, which must never be run as markup.
    const text = document.createElement("span");
    text.className = "st-toast-text";
    text.textContent = message;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "st-toast-close";
    close.setAttribute("aria-label", "Close message");
    close.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">close</span>';

    // Thin bar along the bottom that shrinks as time runs out, so the
    // reader can see how long the message will stay.
    const timer = document.createElement("span");
    timer.className = "st-toast-timer";
    timer.style.animationDuration = `${total}ms`;

    toast.append(icon, text, close, timer);
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    let remaining = total;
    let startedAt = Date.now();
    let hideTimer = setTimeout(dismiss, remaining);

    function dismiss() {
      clearTimeout(hideTimer);
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }

    // Hovering (or keyboard-focusing) the message pauses the countdown.
    const pause = () => {
      clearTimeout(hideTimer);
      remaining -= Date.now() - startedAt;
      toast.classList.add("is-paused");
    };
    const resume = () => {
      startedAt = Date.now();
      clearTimeout(hideTimer);
      hideTimer = setTimeout(dismiss, Math.max(remaining, 1500));
      toast.classList.remove("is-paused");
    };

    toast.addEventListener("mouseenter", pause);
    toast.addEventListener("mouseleave", resume);
    toast.addEventListener("focusin", pause);
    toast.addEventListener("focusout", resume);
    close.addEventListener("click", dismiss);
  }

  static success(message) {
    this.show(message, "success");
  }

  static error(message) {
    this.show(message, "error");
  }

  static warning(message) {
    this.show(message, "warning");
  }

  static info(message) {
    this.show(message, "info");
  }

  static icon(type) {
    switch (type) {
      case "success":
        return "check_circle";

      case "error":
        return "error";

      case "warning":
        return "warning";

      default:
        return "info";
    }
  }
}

// Error/warning banner shown inside whichever input modal is open on top.
// Covers both modal systems -- the admin .overlay.show > .modal dialogs and
// the shared #st-modal -- plus any other [role="dialog"] / <dialog open>.
class ModalInlineError {
  static DIALOGS = [
    ".overlay.show .modal",
    "#st-modal:not(.hidden) .st-modal-card",
    '[role="dialog"]',
    '[aria-modal="true"]',
    "dialog[open]",
  ].join(",");

  static FIELDS = 'input:not([type="hidden"]), select, textarea';

  static ACTIONS = ".modal-actions, .st-modal-footer, .st-module-modal-footer";

  // Bumped every time an error lands in a modal, so Modal can tell whether
  // its onConfirm reported a problem (and should stay open).
  static count = 0;

  static isVisible(el) {
    return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  }

  static activeDialog() {
    const open = [...document.querySelectorAll(this.DIALOGS)].filter(
      (el) => this.isVisible(el) && [...el.querySelectorAll(this.FIELDS)].some((f) => this.isVisible(f))
    );

    if (open.length <= 1) return open[0] || null;

    // Several open (e.g. a nested dialog): take the one actually on top.
    return (
      open.find((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit && el.contains(hit);
      }) || open[open.length - 1]
    );
  }

  static show(message, type = "error") {
    const dialog = this.activeDialog();

    if (!dialog) return false;

    this.clear(dialog);

    const banner = document.createElement("div");
    banner.className = `st-inline-error st-inline-error--${type}`;
    banner.setAttribute("role", "alert");

    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = type === "warning" ? "warning" : "error";

    // textContent: server messages must never be run as markup.
    const text = document.createElement("span");
    text.textContent = message;

    banner.append(icon, text);

    // Sit just above the modal's button row so it's next to the button the
    // user just pressed; fall back to the end of the dialog.
    const actions = [...dialog.querySelectorAll(this.ACTIONS)].filter((el) => this.isVisible(el)).pop();
    if (actions) actions.before(banner);
    else dialog.appendChild(banner);

    banner.scrollIntoView({ block: "nearest" });

    // Gone once the user starts fixing things, or the modal closes.
    const onEdit = () => this.clear(dialog);
    dialog.addEventListener("input", onEdit, { once: true });
    dialog.addEventListener("change", onEdit, { once: true });

    const root = dialog.closest(".overlay, #st-modal") || dialog;
    const observer = new MutationObserver(() => {
      if (!this.isVisible(dialog)) this.clear(dialog);
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class", "hidden", "style", "open"] });
    banner._observer = observer;

    this.count += 1;
    return true;
  }

  static clear(dialog) {
    dialog.querySelectorAll(".st-inline-error").forEach((el) => {
      el._observer?.disconnect();
      el.remove();
    });
  }
}

window.Toast = Toast;
window.ModalInlineError = ModalInlineError;
