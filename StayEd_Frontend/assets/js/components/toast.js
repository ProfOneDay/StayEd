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

window.Toast = Toast;
