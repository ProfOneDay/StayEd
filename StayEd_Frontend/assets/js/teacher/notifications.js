
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

        document.querySelectorAll("[data-notif-filter]").forEach(tab => {

            tab.addEventListener("click", () => {

                document.querySelectorAll("[data-notif-filter]").forEach(t => t.classList.remove("is-active"));

                tab.classList.add("is-active");

                this.filter = tab.dataset.notifFilter;

                this.render();

            });

        });

    }

    static bindMarkAll() {

        document.querySelector("[data-notif-mark-all]")?.addEventListener("click", async () => {

            try {

                await API.markAllNotificationsRead();

                this.all.forEach(n => { n.read = true; });

                this.renderCounts();

                this.render();

                Toast?.success("All notifications marked as read.");

            } catch (error) {

                console.error(error);
                Toast?.error("Unable to update notifications.");

            }

        });

    }

    static renderCounts() {

        this.set("[data-notif-count-all]", this.all.length);
        this.set("[data-notif-count-unread]", this.all.filter(n => !n.read).length);

    }

    static filtered() {

        if (this.filter === "all") return this.all;

        if (this.filter === "unread") return this.all.filter(n => !n.read);

        return this.all.filter(n => n.category === this.filter);

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
            alert: "warning", intervention: "support_agent",
            registration: "person_add", system: "settings_suggest"
        };

        container.innerHTML = rows.map(n => `
            <div class="st-notif-item ${n.read ? "" : "is-unread"}" data-notif-id="${n.id}">
                <div class="st-notif-icon st-notif-icon--${n.category}">
                    <span class="material-symbols-outlined">${iconMap[n.category] || "notifications"}</span>
                </div>
                <div class="st-notif-body" ${n.learnerId ? `data-notif-open="${n.learnerId}" style="cursor:pointer;"` : ""}>
                    <div class="st-notif-title-row">
                        <p class="st-notif-title">${n.title}</p>
                        ${n.read ? "" : '<span class="st-notif-unread-dot"></span>'}
                    </div>
                    <p class="st-notif-text">${n.text}</p>
                    <p class="st-notif-time">${n.time}</p>
                </div>
                <div class="st-notif-item-actions">
                    ${n.read ? "" : `<button type="button" class="st-icon-btn-sm" data-notif-mark-read="${n.id}" aria-label="Mark as read" title="Mark as read"><span class="material-symbols-outlined">done</span></button>`}
                    <button type="button" class="st-icon-btn-sm" data-notif-delete="${n.id}" aria-label="Delete notification" title="Delete">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </div>
        `).join("");

        this.bindItemActions(container);

    }

    static bindItemActions(container) {

        container.querySelectorAll("[data-notif-open]").forEach(el => {
            el.addEventListener("click", () => {
                window.location.href =
                    `learner-profile.html?id=${encodeURIComponent(el.dataset.notifOpen)}`;
            });
        });

        container.querySelectorAll("[data-notif-mark-read]").forEach(btn => {
            btn.addEventListener("click", async e => {

                e.stopPropagation();

                const id = btn.dataset.notifMarkRead;

                try {

                    await API.markNotificationRead(id);

                    const notif = this.all.find(n => String(n.id) === String(id));

                    if (notif) notif.read = true;

                    this.renderCounts();
                    this.render();

                } catch (error) {

                    console.error(error);
                    Toast?.error("Unable to mark as read.");

                }

            });
        });

        container.querySelectorAll("[data-notif-delete]").forEach(btn => {
            btn.addEventListener("click", async e => {

                e.stopPropagation();

                const id = btn.dataset.notifDelete;

                try {

                    await API.deleteNotification(id);

                    this.all = this.all.filter(n => String(n.id) !== String(id));

                    this.renderCounts();
                    this.render();

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
    const start = () => { if (!started) { started = true; NotificationsPage.init(); } };
    document.addEventListener("components:loaded", start);
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 400));
})();

window.NotificationsPage = NotificationsPage;
