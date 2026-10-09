class StudentAccess {
  static init() {
    this.form = document.querySelector("[data-access-form]");
    this.lrnInput = document.querySelector("[data-access-lrn]");
    this.lrnCount = document.querySelector("[data-lrn-count]");
    this.dobInput = document.querySelector("[data-access-dob]");
    this.submitBtn = document.querySelector("[data-access-submit]");
    this.submitLabel = document.querySelector("[data-access-submit-label]");
    this.errorBox = document.querySelector("[data-access-error]");
    this.errorText = document.querySelector("[data-access-error-text]");

    if (!this.form) return;

    this.lrnInput.addEventListener("input", () => this.onLrnInput());
    this.dobInput.addEventListener("input", () => this.updateSubmitState());
    this.form.addEventListener("submit", (e) => this.onSubmit(e));
  }

  static digitsOf(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 12);
  }

  static onLrnInput() {
    const digits = this.digitsOf(this.lrnInput.value);
    this.lrnInput.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
    this.lrnCount.textContent = `${digits.length}/12`;
    this.lrnCount.classList.toggle("is-done", digits.length === 12);
    this.updateSubmitState();
  }

  static updateSubmitState() {
    const ready = this.digitsOf(this.lrnInput.value).length === 12 && Boolean(this.dobInput.value);
    this.submitBtn.disabled = !ready;
  }

  static showError(message) {
    this.errorText.textContent = message;
    this.errorBox.hidden = false;
    this.errorBox.style.animation = "none";
    requestAnimationFrame(() => {
      this.errorBox.style.animation = "";
    });
    document.querySelector("[data-lrn-wrap]").classList.add("is-error");
    document.querySelector("[data-dob-wrap]").classList.add("is-error");
  }

  static clearError() {
    this.errorBox.hidden = true;
    document.querySelector("[data-lrn-wrap]").classList.remove("is-error");
    document.querySelector("[data-dob-wrap]").classList.remove("is-error");
  }

  static setLoading(loading) {
    this.submitBtn.disabled = loading;
    this.submitLabel.innerHTML = loading
      ? '<span class="st-sa-spin" aria-hidden="true"></span> Checking&hellip;'
      : "View my report";
  }

  static async onSubmit(e) {
    e.preventDefault();
    this.clearError();

    const lrn = this.digitsOf(this.lrnInput.value);
    const dateOfBirth = this.dobInput.value;
    if (lrn.length !== 12 || !dateOfBirth) return;

    this.setLoading(true);

    try {
      const res = await fetch(`${CONFIG.API_URL}/public/student-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lrn, dateOfBirth }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.token) {
        this.showError(
          data.message ||
            "We couldn't open a report for this LRN. Check the number, or ask your teacher to turn on your student view.",
        );
        this.setLoading(false);
        this.updateSubmitState();
        return;
      }

      window.location.href = `view.html?token=${encodeURIComponent(data.token)}`;
    } catch (error) {
      console.error("[StudentAccess] Lookup failed", error);
      this.showError("Something went wrong. Please try again.");
      this.setLoading(false);
      this.updateSubmitState();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => StudentAccess.init());
