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

          if (window.Layout) Layout.refreshNotificationDot();

          Toast?.success("All notifications marked as read.");
        } catch (error) {
          console.error(error);
          Toast?.error("Unable to update notifications.");
        }
      });
  }

  static renderCounts() {
    this.set("[data-notif-count-all]", this.all.length);
    this.set(
      "[data-notif-count-unread]",
      this.all.filter((n) => !n.read).length,
    );
  }

  static filtered() {
    if (this.filter === "all") return this.all;

    if (this.filter === "unread") return this.all.filter((n) => !n.read);

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
            <div class="st-notif-item ${n.read ? "" : "is-unread"}" data-notif-id="${n.id}" data-notif-open="${n.id}" role="button" tabindex="0">
                <div class="st-notif-icon st-notif-icon--${n.type}">
                    <span class="material-symbols-outlined">${iconMap[n.type] || "notifications"}</span>
                </div>
                <div class="st-notif-body">
                    <div class="st-notif-title-row">
                        <p class="st-notif-title">${n.title}</p>
                        ${n.metaLabel ? `<span class="st-notif-meta-badge st-notif-meta-badge--${metaBadgeClass(n)}">${n.metaLabel}</span>` : ""}
                        ${n.read ? "" : '<span class="st-notif-unread-dot"></span>'}
                    </div>
                    <p class="st-notif-text">${n.message}</p>
                    <p class="st-notif-time">${n.time}</p>
                    ${n.link ? `<button type="button" class="st-btn st-btn-primary st-btn-xs" data-notif-action="${n.link}" data-notif-action-id="${n.id}">${n.type === "intervention" ? "View Intervention" : "View Learner"}</button>` : ""}
                </div>
                <div class="st-notif-item-actions">
                    ${n.read ? "" : `<button type="button" class="st-icon-btn-sm" data-notif-mark-read="${n.id}" aria-label="Mark as read" title="Mark as read"><span class="material-symbols-outlined">done</span></button>`}
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

  static async markReadLocally(id) {
    const notif = this.all.find((n) => String(n.id) === String(id));

    if (!notif || notif.read) return;

    try {
      await API.markNotificationRead(id);

      notif.read = true;

      this.renderCounts();

      if (window.Layout) Layout.refreshNotificationDot();
    } catch (error) {
      console.error(error);
    }
  }

  static bindItemActions(container) {
    // Opening/clicking a notification is itself what marks it read (in
    // addition to explicit "mark as read" / "Mark All Read") -- loading the
    // Notifications page must never silently mark everything as read.
    container.querySelectorAll("[data-notif-open]").forEach((el) => {
      el.addEventListener("click", async (e) => {
        if (e.target.closest("[data-notif-action], [data-notif-mark-read], [data-notif-delete]")) {
          return;
        }

        const id = el.dataset.notifOpen;
        const wasUnread = !this.all.find((n) => String(n.id) === String(id))?.read;

        await this.markReadLocally(id);

        if (wasUnread) this.render();
      });
    });

    container.querySelectorAll("[data-notif-action]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();

        await this.markReadLocally(btn.dataset.notifActionId);

        window.location.href = btn.dataset.notifAction;
      });
    });

    container.querySelectorAll("[data-notif-mark-read]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();

        const id = btn.dataset.notifMarkRead;

        try {
          await API.markNotificationRead(id);

          const notif = this.all.find((n) => String(n.id) === String(id));

          if (notif) notif.read = true;

          this.renderCounts();
          this.render();

          if (window.Layout) Layout.refreshNotificationDot();
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

          this.all = this.all.filter((n) => String(n.id) !== String(id));

          this.renderCounts();
          this.render();

          if (window.Layout) Layout.refreshNotificationDot();

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
}

(function bootNotifications() {
  let started = false;
  const start = () => {
    if (!started) {
      started = true;
      NotificationsPage.init();
    }
  };
  document.addEventListener("components:loaded", start);
  document.addEventListener("DOMContentLoaded", () => setTimeout(start, 400));
})();

window.NotificationsPage = NotificationsPage;
