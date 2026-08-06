class ConsultationModal {
  static learner = null;

  static open(learner) {
    this.learner = learner;

    const today = new Date().toISOString().split("T")[0];

    Modal.show({
      title: "Record Consultation",

      size: "sm",

      confirmLabel: "Save Consultation",

      message: `
                <div class="st-schedule-modal-field">
                    <label>Learner</label>
                    <p class="st-schedule-modal-learner">${learner.name}</p>
                </div>

                <div class="st-schedule-modal-row">
                    <div class="st-schedule-modal-field">
                        <label for="consultDate">Date</label>
                        <input type="date" id="consultDate" value="${today}" max="${today}">
                    </div>
                    <div class="st-schedule-modal-field">
                        <label for="consultMethod">Method</label>
                        <select id="consultMethod">
                            <option value="CALL">Call</option>
                            <option value="SMS">SMS</option>
                            <option value="CHAT">Chat</option>
                            <option value="HOME_VISIT">Home Visit</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>
                </div>

                <div class="st-schedule-modal-field">
                    <label for="consultResult">Result</label>
                    <select id="consultResult">
                        <option value="SUCCESSFUL">Successful</option>
                        <option value="UNSUCCESSFUL">Unsuccessful</option>
                    </select>
                </div>

                <div class="st-schedule-modal-field">
                    <label for="consultNotes">Notes (optional)</label>
                    <textarea id="consultNotes" placeholder="Add consultation notes..."></textarea>
                </div>
            `,

      onConfirm: () => this.save(),
    });
  }

  static async save() {
    const date = document.getElementById("consultDate")?.value;
    const method = document.getElementById("consultMethod")?.value;
    const result = document.getElementById("consultResult")?.value;
    const notes = document.getElementById("consultNotes")?.value.trim();

    if (!date) {
      Toast?.error("Please choose a consultation date.");
      return;
    }

    try {
      await API.recordConsultation(this.learner.id, { date, method, result, notes });

      Toast?.success(`Consultation recorded for ${this.learner?.name}.`);

      if (window.LearnerRecordsHub) {
        LearnerRecordsHub.load();
      }
    } catch (error) {
      console.error("[ConsultationModal] Unable to record consultation", error);
      Toast?.error(error?.message || error?.data?.message || "Unable to record consultation.");
    }
  }
}

window.ConsultationModal = ConsultationModal;
