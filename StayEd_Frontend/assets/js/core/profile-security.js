// Shared "Security" section behavior for both Profile Settings pages
// (teacher + admin): the Change Password modal (with its forgot-password
// sub-flow) and the two-factor authentication toggle. Both pages already
// share the same data-page="Profile Settings" CSS layer and both load the
// shared Modal component -- this is the one place the flow is defined
// instead of each page keeping its own copy (teacher used to have an inline
// password form with no MFA at all; admin used a separate .overlay/.modal
// dialog system). Markup contract: a [data-change-password] button and a
// [data-mfa-toggle] checkbox somewhere on the page.
class ProfileSecurity {
  static init() {
    const changeButton = document.querySelector("[data-change-password]");
    changeButton?.addEventListener("click", () => this.openChangePasswordModal());

    const mfaToggle = document.querySelector("[data-mfa-toggle]");
    mfaToggle?.addEventListener("change", async (event) => {
      const checked = event.target.checked;

      try {
        await API.updateSettings({ twoFactorEnabled: checked });
        Toast?.success(
          checked
            ? "Two-factor authentication preference saved"
            : "Two-factor authentication preference disabled",
        );
      } catch (error) {
        console.error("[ProfileSecurity] Unable to save 2FA preference", error);
        Toast?.error("Unable to save this preference.");
        event.target.checked = !checked;
      }
    });

    this.restoreMfaPreference();
  }

  static async restoreMfaPreference() {
    const mfaToggle = document.querySelector("[data-mfa-toggle]");
    if (!mfaToggle) return;

    try {
      const settings = await API.getSettings();
      mfaToggle.checked = Boolean(settings.preferences?.twoFactorEnabled);
    } catch (error) {
      console.error("[ProfileSecurity] Unable to load security settings", error);
    }
  }

  static eyeIcon() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }

  static openChangePasswordModal() {
    if (!window.Modal) return;

    const email = (window.Auth?.user && Auth.user()?.email) || "";

    const body = Modal.showCustom({
      title: "Change Password",
      size: "sm",
      bodyHtml: `
        <div data-cp-view="main">
          <div class="st-cp-icon"><span class="material-symbols-outlined">lock_reset</span></div>
          <p class="st-cp-sub">Use a strong password you don't use anywhere else.</p>

          <div class="st-field">
            <label>Current password</label>
            <div class="st-cp-password-wrap">
              <input type="password" data-cp-field="current" placeholder="Enter current password" autocomplete="current-password">
              <button type="button" class="st-cp-eye" data-cp-eye="current" aria-label="Show or hide password">${this.eyeIcon()}</button>
            </div>
          </div>

          <button type="button" class="st-cp-link" data-cp-forgot>Forgot your password?</button>

          <div class="st-field" style="margin-top:12px">
            <label>New password</label>
            <div class="st-cp-password-wrap">
              <input type="password" data-cp-field="new" placeholder="Enter new password" autocomplete="new-password">
              <button type="button" class="st-cp-eye" data-cp-eye="new" aria-label="Show or hide password">${this.eyeIcon()}</button>
            </div>
          </div>

          <div class="st-field">
            <label>Confirm new password</label>
            <div class="st-cp-password-wrap">
              <input type="password" data-cp-field="confirm" placeholder="Confirm new password" autocomplete="new-password">
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
            <button type="button" class="st-btn st-btn-primary" data-cp-submit>Update password</button>
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
      } catch (error) {
        console.error("[ProfileSecurity] Forgot password request failed", error);
      } finally {
        button.disabled = false;
      }

      showView("sent");
    });

    root.querySelector("[data-cp-submit]")?.addEventListener("click", async (event) => {
      const current = root.querySelector('[data-cp-field="current"]')?.value || "";
      const next = root.querySelector('[data-cp-field="new"]')?.value || "";
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

      const button = event.currentTarget;
      button.disabled = true;

      try {
        await Auth.changePassword({ current_password: current, password: next });
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
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
