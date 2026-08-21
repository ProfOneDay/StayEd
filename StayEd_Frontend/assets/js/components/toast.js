class Toast {
  static show(
    message,

    type = "success",

    duration = 3000,
  ) {
    const container = document.getElementById("st-toast-container");

    if (!container) {
      return;
    }

    const toast = document.createElement("div");

    toast.className = `st-toast st-toast-${type}`;

    toast.innerHTML = `

            <span class="material-symbols-outlined">

                ${this.icon(type)}

            </span>

            <span>${message}</span>

        `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {
      toast.classList.remove("show");

      setTimeout(() => {
        toast.remove();
      }, 300);
    }, duration);
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
