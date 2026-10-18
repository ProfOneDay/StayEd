// Shared "Security" section behavior for both Profile Settings pages
// (teacher + admin): the Change Password modal (with its forgot-password
// sub-flow). Both pages already share the same data-page="Profile Settings"
// CSS layer and both load the shared Modal component -- this is the one
// place the flow is defined instead of each page keeping its own copy
// (teacher used to have an inline password form; admin used a separate
// .overlay/.modal dialog system). Markup contract: a [data-change-password]
// button somewhere on the page.
class ProfileSecurity {
  static init() {
    const changeButton = document.querySelector("[data-change-password]");
    changeButton?.addEventListener("click", () => this.openChangePasswordModal());
  }

  static eyeIcon() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }

  static openChangePasswordModal() {
    if (!window.Modal) return;

    const email = (window.Auth?.user && Auth.user()?.email) || "";

    const body = Modal.showCustom({
      title: "",
      size: "md",
      headerless: true,
      bodyHtml: `
        <div data-cp-view="main">
          <div class="st-cp-icon"><span class="material-symbols-outlined">lock_reset</span></div>
          <h3 class="st-cp-view-title">Change Password</h3>
          <p class="st-cp-sub">Use a strong password you don't use anywhere else.</p>
          <hr class="st-cp-divider">

          <div class="st-field">
            <label>Current password</label>
            <div class="st-cp-password-wrap">
              <input type="password" class="st-input" data-cp-field="current" placeholder="Enter current password" autocomplete="current-password">
              <button type="button" class="st-cp-eye" data-cp-eye="current" aria-label="Show or hide password">${this.eyeIcon()}</button>
            </div>
          </div>

          <button type="button" class="st-cp-link" data-cp-forgot>Forgot your password?</button>

          <div class="st-field st-mt-12">
            <label>New password</label>
            <div class="st-cp-password-wrap">
              <input type="password" class="st-input" data-cp-field="new" placeholder="Enter new password" autocomplete="new-password">
              <button type="button" class="st-cp-eye" data-cp-eye="new" aria-label="Show or hide password">${this.eyeIcon()}</button>
            </div>
          </div>

          <div class="st-field st-mt-12">
            <label>Confirm new password</label>
            <div class="st-cp-password-wrap">
              <input type="password" class="st-input" data-cp-field="confirm" placeholder="Confirm new password" autocomplete="new-password">
              <button type="button" class="st-cp-eye" data-cp-eye="confirm" aria-label="Show or hide password">${this.eyeIcon()}</button>
            </div>
          </div>

          <ul class="st-cp-reqs">
            <li data-cp-req="length">At least 8 characters</li>
            <li data-cp-req="upper">One uppercase letter</li>
            <li data-cp-req="lower">One lowercase letter</li>
            <li data-cp-req="number">One number</li>
          </ul>

          <div class="st-cp-actions">
            <button type="button" class="st-btn st-btn-outline" data-cp-cancel>Cancel</button>
            <button type="button" class="st-btn st-btn-primary" data-cp-submit>Continue</button>
          </div>
        </div>

        <div data-cp-view="verify" hidden>
          <div class="st-cp-icon"><span class="material-symbols-outlined">mark_email_unread</span></div>
          <h3 class="st-cp-view-title">Check your email</h3>
          <p class="st-cp-sub">
            To confirm it's really you, we sent a 6-digit code to
            <b data-cp-code-email>${this.escapeHtml(email)}</b>. It expires in 10 minutes.
          </p>
          <hr class="st-cp-divider">

          <div class="st-field">
            <label for="cpCode">Verification code</label>
            <input type="text" id="cpCode" class="st-input st-cp-code" data-cp-field="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" placeholder="••••••">
          </div>

          <button type="button" class="st-cp-link" data-cp-resend>Resend code</button>

          <div class="st-cp-actions">
            <button type="button" class="st-btn st-btn-outline" data-cp-verify-back>Back</button>
            <button type="button" class="st-btn st-btn-primary" data-cp-confirm>Update password</button>
          </div>
        </div>

        <div data-cp-view="forgot" hidden>
          <div class="st-cp-icon"><span class="material-symbols-outlined">mail</span></div>
          <h3 class="st-cp-view-title">Reset your password</h3>
          <div class="st-cp-banner">
            We'll send a password reset link to your registered DepEd email,
            <b data-cp-forgot-email>${this.escapeHtml(email)}</b>. The link expires in 30 minutes.
          </div>
          <div class="st-cp-actions">
            <button type="button" class="st-btn st-btn-outline" data-cp-back>Back</button>
            <button type="button" class="st-btn st-btn-primary" data-cp-send>Send reset link</button>
          </div>
        </div>

        <div data-cp-view="sent" hidden>
          <div class="st-cp-icon st-cp-icon--success"><span class="material-symbols-outlined">check_circle</span></div>
          <h3 class="st-cp-view-title">Reset link sent</h3>
          <p class="st-cp-sub">Check your inbox for instructions to reset your password.</p>
          <div class="st-cp-actions st-cp-actions--center">
            <button type="button" class="st-btn st-btn-primary" data-cp-done>Done</button>
          </div>
        </div>
      `,
    });

    if (body) this.bindChangePasswordModal(body, email);
  }

  static bindChangePasswordModal(root, email) {
    const showView = (name) => {
      root.querySelectorAll("[data-cp-view]").forEach((view) => {
        view.hidden = view.dataset.cpView !== name;
      });
    };

    root.querySelectorAll("[data-cp-eye]").forEach((button) => {
      button.addEventListener("click", () => {
        const field = root.querySelector(`[data-cp-field="${button.dataset.cpEye}"]`);
        if (!field) return;
        field.type = field.type === "password" ? "text" : "password";
      });
    });

    const newField = root.querySelector('[data-cp-field="new"]');
    const setReq = (key, met) => {
      root.querySelector(`[data-cp-req="${key}"]`)?.classList.toggle("is-met", met);
    };
    const checkStrength = () => {
      const value = newField?.value || "";
      setReq("length", value.length >= 8);
      setReq("upper", /[A-Z]/.test(value));
      setReq("lower", /[a-z]/.test(value));
      setReq("number", /[0-9]/.test(value));
    };
    newField?.addEventListener("input", checkStrength);
    checkStrength();

    root.querySelector("[data-cp-forgot]")?.addEventListener("click", () => {
      const target = root.querySelector("[data-cp-forgot-email]");
      if (target) target.textContent = email || "your email";
      showView("forgot");
    });

    root.querySelector("[data-cp-back]")?.addEventListener("click", () => showView("main"));

    root.querySelector("[data-cp-cancel]")?.addEventListener("click", () => Modal.hide());

    root.querySelector("[data-cp-done]")?.addEventListener("click", () => Modal.hide());

    root.querySelector("[data-cp-send]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;

      try {
        await Auth.forgotPassword(email);
        showView("sent");
      } catch (error) {
        console.error("[ProfileSecurity] Forgot password request failed", error);
        Toast?.error(error?.message || "Unable to send the reset link. Please try again.");
      } finally {
        button.disabled = false;
      }
    });

    const passwords = () => ({
      current_password: root.querySelector('[data-cp-field="current"]')?.value || "",
      password: root.querySelector('[data-cp-field="new"]')?.value || "",
    });
    const codeField = root.querySelector('[data-cp-field="code"]');
    const resendButton = root.querySelector("[data-cp-resend]");

    // Short cooldown on "Resend code" so it can't be hammered (the server
    // also caps how many codes an account can request).
    let resendTimer = null;
    const startResendCooldown = (seconds = 60) => {
      if (!resendButton) return;
      clearInterval(resendTimer);
      let left = seconds;
      resendButton.disabled = true;
      resendButton.textContent = `Resend code in ${left}s`;
      resendTimer = setInterval(() => {
        left -= 1;
        if (left <= 0 || !root.isConnected) {
          clearInterval(resendTimer);
          resendButton.disabled = false;
          resendButton.textContent = "Resend code";
          return;
        }
        resendButton.textContent = `Resend code in ${left}s`;
      }, 1000);
    };

    // Step 1: server checks the current + new password, then emails a code.
    const requestCode = async (button) => {
      button.disabled = true;
      try {
        const response = await Auth.requestPasswordChangeCode(passwords());
        const target = root.querySelector("[data-cp-code-email]");
        if (target && response?.email) target.textContent = response.email;
        if (codeField) codeField.value = "";
        showView("verify");
        codeField?.focus();
        startResendCooldown();
        if (response?.devCode) {
          // Only returned when the backend runs in debug mode without email.
          Toast?.info(`Dev mode: your code is ${response.devCode}`);
        }
        return true;
      } catch (error) {
        console.error("[ProfileSecurity] Requesting code failed", error);
        Toast?.error(error?.message || "Unable to send the verification code.");
        return false;
      } finally {
        button.disabled = false;
      }
    };

    root.querySelector("[data-cp-submit]")?.addEventListener("click", (event) => {
      const { current_password: current, password: next } = passwords();
      const confirm = root.querySelector('[data-cp-field="confirm"]')?.value || "";

      if (!current || !next || !confirm) {
        Toast?.error("Please fill in all password fields");
        return;
      }
      if (next !== confirm) {
        Toast?.error("New passwords don't match");
        return;
      }
      if (next.length < 8 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/[0-9]/.test(next)) {
        Toast?.error("Password does not meet all requirements");
        return;
      }

      requestCode(event.currentTarget);
    });

    codeField?.addEventListener("input", () => {
      codeField.value = codeField.value.replace(/\D/g, "").slice(0, 6);
    });
    codeField?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") root.querySelector("[data-cp-confirm]")?.click();
    });

    resendButton?.addEventListener("click", (event) => requestCode(event.currentTarget));

    root.querySelector("[data-cp-verify-back]")?.addEventListener("click", () => showView("main"));

    // Step 2: same passwords again plus the code -- only now does it change.
    root.querySelector("[data-cp-confirm]")?.addEventListener("click", async (event) => {
      const code = codeField?.value.trim() || "";
      if (!/^\d{6}$/.test(code)) {
        Toast?.error("Enter the 6-digit code we emailed you.");
        return;
      }

      const button = event.currentTarget;
      button.disabled = true;

      try {
        await Auth.changePassword({ ...passwords(), code });
        clearInterval(resendTimer);
        Modal.hide();
        Toast?.success("Password updated");
      } catch (error) {
        console.error("[ProfileSecurity] Change password failed", error);
        Toast?.error(error?.data?.message || error?.message || "Unable to update password.");
      } finally {
        button.disabled = false;
      }
    });
  }

  static escapeHtml(value) {
    return Utils.esc(value);
  }
}

(function bootProfileSecurity() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      ProfileSecurity.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 400));
})();

window.ProfileSecurity = ProfileSecurity;
