class ScheduleAttendanceModal {
  static learner = null;

  static open(learner) {
    this.learner = learner;

    const a = learner.attendance || {};

    const nextDate = this.toDateInputValue(a.nextSession?.date);

    Modal.show({
      title: "Session Schedule and Attendance",

      size: "sm",

      confirmLabel: "Save Changes",

      message: `
                <div class="st-schedule-modal-field">
                    <label>Learner</label>
                    <p class="st-schedule-modal-learner">${learner.name}</p>
                </div>

                <div class="st-schedule-modal-row">
                    <div class="st-schedule-modal-field">
                        <label for="scheduleNextDate">Next Session Date</label>
                        <input type="date" id="scheduleNextDate" value="${nextDate}">
                    </div>
                    <div class="st-schedule-modal-field">
                        <label for="scheduleSessionTime">Session Time</label>
                        <input type="time" id="scheduleSessionTime" value="09:00">
                    </div>
                </div>

                <div class="st-schedule-modal-field">
                    <label for="scheduleStatus">Attendance Status</label>
                    <select id="scheduleStatus">
                        <option ${a.nextSession?.status === "Scheduled" ? "selected" : ""}>Scheduled</option>
                        <option ${a.nextSession?.status === "Attendance Pending" ? "selected" : ""}>Attendance Pending</option>
                        <option>Attended</option>
                        <option>Absent</option>
                        <option>Excused</option>
                    </select>
                </div>

                <div class="st-schedule-modal-field">
                    <label for="scheduleNote">Optional Note</label>
                    <textarea id="scheduleNote" placeholder="Add session notes..."></textarea>
                </div>
            `,

      onConfirm: () => this.save(),
    });
  }

  static save() {
    const date = document.getElementById("scheduleNextDate")?.value;

    const status = document.getElementById("scheduleStatus")?.value;

    if (!date) {
      Toast?.error("Please choose a session date.");

      return;
    }

    Toast?.success(`Session schedule saved for ${this.learner?.name}.`);
  }

  static toDateInputValue(displayDate) {
    if (!displayDate) return "";

    const parsed = new Date(displayDate);

    if (isNaN(parsed.getTime())) return "";

    return parsed.toISOString().split("T")[0];
  }
}

window.ScheduleAttendanceModal = ScheduleAttendanceModal;
