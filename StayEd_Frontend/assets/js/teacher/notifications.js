class NotificationsPage {
  static all = [];

  static filter = "all";

  static async init() {
    if (window.Guards) Guards.teacher();

    this.bindTabs();
    this.bindMarkAll();

    await this.load();
  }

  static async load() {
    if (window.Layout) Layout.showLoader();

    this.showSkeleton();

    try {
      const res = await API.getNotifications();

      this.all = res.data || [];

      this.renderCounts();
      this.render();

      // ITEM 3 FIX:
      // Synchronize the top-right bell after notifications load.
      await this.refreshBellIndicator();
    } catch (error) {
      console.error("[Notifications]", error);
      Toast?.error("Unable to load notifications.");
    } finally {
      if (window.Layout) Layout.hideLoader();
    }
  }

  static bindTabs() {
    document.querySelectorAll("[data-notif-filter]").forEach((tab) => {
      tab.addEventListener("click", () => {
        document
          .querySelectorAll("[data-notif-filter]")
          .forEach((t) => t.classList.remove("is-active"));

        tab.classList.add("is-active");
        this.filter = tab.dataset.notifFilter;
        this.render();
      });
    });
  }

  static bindMarkAll() {
    document
      .querySelector("[data-notif-mark-all]")
      ?.addEventListener("click", async () => {
        try {
          await API.markAllNotificationsRead();

          this.all.forEach((n) => {
            n.read = true;
          });

          this.renderCounts();
          this.render();

          await this.refreshBellIndicator();

          Toast?.success("All notifications marked as read.");
        } catch (error) {
          console.error("[Notifications]", error);
          Toast?.error("Unable to update notifications.");
        }
      });
  }

  static renderCounts() {
    const unreadCount = this.all.filter((n) => !n.read).length;

    this.set("[data-notif-count-all]", this.all.length);
    this.set("[data-notif-count-unread]", unreadCount);

    // ITEM 3 FIX: Keep the bell synchronized with local unread count.
    this.updateBellIndicator(unreadCount);
  }

  static filtered() {
    if (this.filter === "all") return this.all;

    if (this.filter === "unread") {
      return this.all.filter((n) => !n.read);
    }

    return this.all.filter((n) => n.type === this.filter);
  }

  static render() {
    const container = document.querySelector("[data-notif-list]");

    if (!container) return;

    const rows = this.filtered();

    if (!rows.length) {
      container.innerHTML = `
        <div class="st-empty">
          <span class="material-symbols-outlined">notifications_off</span>
          <p class="st-empty-title">No notifications here</p>
          <p class="st-empty-text">You're all caught up.</p>
        </div>
      `;
      return;
    }

    const iconMap = {
      risk: "warning",
      intervention: "support_agent",
    };

    const metaBadgeClass = (n) => {
      const label = (n.metaLabel || "").toLowerCase();
      if (label.includes("high") || label.includes("overdue")) return "high";
      if (label.includes("moderate")) return "moderate";
      if (label.includes("low")) return "low";
      return n.type;
    };

    container.innerHTML = rows
      .map(
        (n) => `
          <div class="st-notif-item ${n.read ? "" : "is-unread"}" data-notif-id="${n.id}">
            <div class="st-notif-icon st-notif-icon--${n.type}">
              <span class="material-symbols-outlined">${iconMap[n.type] || "notifications"}</span>
            </div>

            <div class="st-notif-body">
              <div class="st-notif-title-row">
                <p class="st-notif-title">${n.title}</p>
                ${
                  n.metaLabel
                    ? `<span class="st-notif-meta-badge st-notif-meta-badge--${metaBadgeClass(n)}">${n.metaLabel}</span>`
                    : ""
                }
                ${n.read ? "" : '<span class="st-notif-unread-dot"></span>'}
              </div>

              <p class="st-notif-text">${n.message}</p>
              <p class="st-notif-time">${n.time}</p>

              ${
                n.link
                  ? `<button type="button" class="st-btn st-btn-primary st-btn-xs" data-notif-action="${n.link}">${
                      n.type === "intervention"
                        ? "View Intervention"
                        : "View Learner"
                    }</button>`
                  : ""
              }
            </div>

            <div class="st-notif-item-actions">
              ${
                n.read
                  ? ""
                  : `<button type="button" class="st-icon-btn-sm" data-notif-mark-read="${n.id}" aria-label="Mark as read" title="Mark as read"><span class="material-symbols-outlined">done</span></button>`
              }

              <button type="button" class="st-icon-btn-sm" data-notif-delete="${n.id}" aria-label="Delete notification" title="Delete">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>
        `,
      )
      .join("");

    this.bindItemActions(container);
  }

  static bindItemActions(container) {
    // ITEM 3 FIX:
    // Opening View Learner / View Intervention marks an unread notification
    // as read before redirecting.
    container.querySelectorAll("[data-notif-action]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();

        const item = btn.closest("[data-notif-id]");
        const id = item?.dataset.notifId;

        try {
          if (id) {
            const notif = this.all.find(
              (n) => String(n.id) === String(id),
            );

            if (notif && !notif.read) {
              await API.markNotificationRead(id);
              notif.read = true;

              this.renderCounts();
              this.render();
              await this.refreshBellIndicator();
            }
          }

          window.location.href = btn.dataset.notifAction;
        } catch (error) {
          console.error(
            "[Notifications] Failed to mark notification as read",
            error,
          );

          // Still allow the requested page to open.
          window.location.href = btn.dataset.notifAction;
        }
      });
    });

    // ITEM 3 FIX:
    // Explicit Mark as Read updates the unread count and bell immediately.
    container.querySelectorAll("[data-notif-mark-read]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();

        const id = btn.dataset.notifMarkRead;

        try {
          await API.markNotificationRead(id);

          const notif = this.all.find(
            (n) => String(n.id) === String(id),
          );

          if (notif) notif.read = true;

          this.renderCounts();
          this.render();
          await this.refreshBellIndicator();
        } catch (error) {
          console.error(error);
          Toast?.error("Unable to mark as read.");
        }
      });
    });

    container.querySelectorAll("[data-notif-delete]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();

        const id = btn.dataset.notifDelete;

        try {
          await API.deleteNotification(id);

          this.all = this.all.filter(
            (n) => String(n.id) !== String(id),
          );

          this.renderCounts();
          this.render();
          await this.refreshBellIndicator();

          window.Layout?.updateNotificationDot?.();

          Toast?.success("Notification removed.");
        } catch (error) {
          console.error(error);
          Toast?.error("Unable to remove notification.");
        }
      });
    });
  }

  static showSkeleton() {
    const container = document.querySelector("[data-notif-list]");

    if (container && window.Skeletons) {
      container.innerHTML = Skeletons.listItems(5);
    }
  }

  static set(selector, value) {
    const el = document.querySelector(selector);

    if (el && value !== undefined && value !== null) {
      el.textContent = value;
    }
  }

  // ITEM 3 FIX:
  // One UI rule for the bell:
  // unread_count > 0 -> visible
  // unread_count = 0 -> hidden
  static updateBellIndicator(unreadCount) {
    const dot = document.querySelector(
      "[data-st-notification-dot]",
    );

    if (!dot) return;

    const count = Number(unreadCount) || 0;

    dot.classList.toggle(
      "st-hidden",
      count <= 0,
    );

    dot.dataset.unreadCount = String(count);
  }

  // ITEM 3 FIX:
  // Re-fetch the backend count so the bell cannot stay stale after
  // notifications are changed elsewhere in the application.
  static async refreshBellIndicator() {
    try {
      const res = await API.getNotifications();

      const unreadCount = Array.isArray(res?.data)
        ? res.data.filter((n) => !n.read).length
        : Number(res?.unread || 0);

      this.updateBellIndicator(unreadCount);
    } catch (error) {
      console.error(
        "[Notifications] Unable to refresh bell indicator",
        error,
      );
    }
  }
}

(function bootNotifications() {
  let started = false;

  const start = () => {
    if (!started) {
      started = true;
      NotificationsPage.init();
    }
  };

  document.addEventListener(
    "components:loaded",
    start,
  );

  document.addEventListener(
    "DOMContentLoaded",
    () => setTimeout(start, 400),
  );
})();

window.NotificationsPage = NotificationsPage;
