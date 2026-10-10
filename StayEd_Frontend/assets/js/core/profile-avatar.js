// Shared profile-photo avatar behavior for both Profile Settings pages
// (teacher + admin): rendering the circle (photo or letter initials),
// the upload flow (camera button -> file picker -> preview-before-save
// modal), and "Remove photo". One instance instead of each page keeping
// its own near-identical copy, so the initials-placeholder behavior (and
// its error handling) can't drift between the two pages the way it did
// before -- the admin page used to have no onerror fallback at all, so a
// stale/invalid stored avatar URL rendered as broken-image alt text
// ("Profile Photo") instead of falling back to initials like the teacher
// page already did.
//
// Markup contract (same on both pages): a `[data-profile-photo]` element
// to render into, `[data-change-photo]` button, `[data-profile-photo-input]`
// hidden file input, and an optional `[data-remove-photo]` button.
class ProfileAvatar {
  static initialsOf(name, fallback = "") {
    const computed = String(name || "")
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    return computed || fallback;
  }

  // Reads the currently signed-in user and computes their initials,
  // falling back to the first letter of `fallbackName` (e.g. "Teacher",
  // "Admin") if there's no name on record yet.
  static currentInitials(fallbackName = "") {
    const user = (window.Auth && Auth.user && Auth.user()) || {};
    const fullName =
      user.full_name ||
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      fallbackName;

    return this.initialsOf(fullName, fallbackName.charAt(0).toUpperCase());
  }

  // Renders the avatar photo (or its initials fallback) into
  // [data-profile-photo]. If the photo URL turns out to be broken/stale,
  // self-heals by clearing it from the stored user and falling back to
  // initials instead of leaving a broken-image icon or alt text on screen
  // -- and refreshes the navbar avatar too, since it reads the same
  // stored value.
  static render(avatar, initials, fallbackName = "") {
    const photo = document.querySelector("[data-profile-photo]");
    if (!photo) return;

    photo.innerHTML = "";

    if (avatar) {
      const image = document.createElement("img");
      image.alt = "Profile photo";
      image.onerror = () => {
        Auth.updateUser({ avatar: "" });
        this.render("", this.currentInitials(fallbackName), fallbackName);
        window.Layout?.restoreUser?.();
      };
      image.src = avatar;
      photo.appendChild(image);
    } else {
      photo.textContent = initials || "";
    }

    const removeButton = document.querySelector("[data-remove-photo]");
    if (removeButton) removeButton.hidden = !avatar;
  }

  static escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  static bindUpload(fallbackName = "User") {
    const input = document.querySelector("[data-profile-photo-input]");
    const button = document.querySelector("[data-change-photo]");
    const removeButton = document.querySelector("[data-remove-photo]");
    if (!input || !button) return;

    button.addEventListener("click", () => input.click());
    removeButton?.addEventListener("click", () => this.confirmRemove(fallbackName));

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;

      const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
      if (!allowed.has(file.type)) {
        Toast?.error("Choose a JPG, PNG, or WEBP image.");
        return;
      }

      const maxBytes = 2 * 1024 * 1024;
      if (file.size > maxBytes) {
        Toast?.error("Profile photo must be 2 MB or smaller.");
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => Toast?.error("Unable to read that image.");
      reader.onload = () =>
        this.previewUpload(String(reader.result || ""), file, fallbackName);
      reader.readAsDataURL(file);
    });
  }

  static previewUpload(dataUrl, file, fallbackName) {
    if (!dataUrl || !window.Modal) return;

    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    Modal.show({
      title: "Update Profile Photo",
      size: "sm",
      confirmLabel: "Save Photo",
      asyncConfirm: true,
      message: `
        <div class="st-avatar-preview-dialog">
          <img src="${dataUrl}" alt="Selected profile photo preview">
          <div>
            <strong>${this.escapeHtml(file.name)}</strong>
            <p>${sizeKb} KB · Preview before saving</p>
          </div>
        </div>
      `,
      onConfirm: async () => {
        try {
          const result = await API.updateAvatar(dataUrl);
          const avatar = result.avatar || dataUrl;
          Auth.updateUser({ avatar });
          this.render(avatar, this.currentInitials(fallbackName), fallbackName);
          window.Layout?.restoreUser?.();
          Toast?.success("Profile photo updated.");
        } catch (error) {
          console.error("[ProfileAvatar] Avatar upload failed", error);
          Toast?.error(error?.data?.message || error?.message || "Unable to update profile photo.");
          throw error;
        }
      },
    });
  }

  static confirmRemove(fallbackName) {
    const user = (window.Auth && Auth.user && Auth.user()) || {};
    if (!user.avatar) return;

    const remove = async () => {
      try {
        await API.updateAvatar(null);
        Auth.updateUser({ avatar: "" });
        this.render("", this.currentInitials(fallbackName), fallbackName);
        window.Layout?.restoreUser?.();
        Toast?.success("Profile photo removed.");
      } catch (error) {
        console.error("[ProfileAvatar] Avatar removal failed", error);
        Toast?.error(error?.data?.message || error?.message || "Unable to remove profile photo.");
        throw error;
      }
    };

    if (window.Modal) {
      Modal.show({
        title: "Remove Profile Photo",
        size: "sm",
        confirmLabel: "Remove Photo",
        asyncConfirm: true,
        message: "Remove your current profile photo? Your initials will be shown instead.",
        onConfirm: remove,
      });
      return;
    }

    if (window.confirm("Remove your current profile photo?")) remove();
  }
}

window.ProfileAvatar = ProfileAvatar;
