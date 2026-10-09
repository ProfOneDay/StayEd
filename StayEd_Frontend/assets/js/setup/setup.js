class SetupWizard {
  static async completeDemoSession() {
    if (!(window.DemoAuthService && DemoAuthService.isEnabled())) {
      return;
    }

    await DemoAuthService.completeOnboarding();

    Auth.seedDemoSession?.(DemoAuthService.getSession().account);
  }

  // Called from both the step 3 "Skip" and step 5 "Finish" exits -- either
  // one is a legitimate way to leave the wizard, so both must mark setup
  // complete (not just "Finish"), or a teacher who skips the learner
  // import would be sent straight back to the wizard on their next login.
  static async completeSetup() {
    if (window.DemoAuthService && DemoAuthService.isEnabled()) {
      await this.completeDemoSession();
      return;
    }

    try {
      await API.completeSetup();
      Auth.updateUser({ setup_completed: true });
    } catch (error) {
      console.error("[SetupWizard] Unable to mark setup complete", error);
    }
  }

  static init() {
    const step = document.body.dataset.wizard;

    switch (step) {
      case "1":
        this.initWizard1();
        break;
      case "2":
        this.initWizard2();
        break;
      case "3":
        this.initWizard3();
        break;
      case "4":
        this.initWizard4();
        break;
      case "5":
        this.initWizard5();
        break;

      default:
        this.initWizard1();
        this.initWizard2();
        this.initWizard3();
        this.initWizard4();
        this.initWizard5();
    }
  }

  static initWizard1() {
    const nextBtn = document.getElementById("nextBtn");

    if (nextBtn) {
      nextBtn.addEventListener(
        "click",

        () => {
          Router.go("/setup/wizard-2");
        },
      );
    }

    const backBtn = document.getElementById("backBtn");

    if (backBtn) {
      backBtn.addEventListener(
        "click",

        () => {
          Router.go("/login");
        },
      );
    }
  }

  static async initWizard2() {
    const form = document.getElementById("classForm");

    if (!form) return;

    const municipality = document.getElementById("municipality");

    const clc = document.getElementById("clc");

    const schoolYear = document.getElementById("schoolYear");

    const learningLevel = document.getElementById("learningLevel");

    const summaryMunicipality = document.getElementById("summaryMunicipality");

    const summaryCLC = document.getElementById("summaryCLC");

    const summaryYear = document.getElementById("summaryYear");

    const summaryLevel = document.getElementById("summaryLevel");

    let availableClcs = [];

    function replaceOptions(select, placeholder, items, valueFor, labelFor) {
      if (!select) return;

      select.replaceChildren();

      const first = document.createElement("option");
      first.value = "";
      first.textContent = placeholder;
      select.appendChild(first);

      items.forEach((item) => {
        const option = document.createElement("option");
        option.value = valueFor(item);
        option.textContent = labelFor(item);
        select.appendChild(option);
      });
    }

    function populateMunicipalities() {
      const list = [...new Set(availableClcs.map((item) => item.municipality))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

      replaceOptions(
        municipality,
        "Select Municipality",
        list,
        (item) => item,
        (item) => item,
      );
    }

    function populateClcsForMunicipality(selected) {
      if (!clc) return;

      if (!selected) {
        replaceOptions(
          clc,
          "Select Municipality first",
          [],
          () => "",
          () => "",
        );
        clc.disabled = true;
        return;
      }

      const matching = availableClcs
        .filter((item) => item.municipality === selected)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      replaceOptions(
        clc,
        matching.length ? "Select CLC" : "No CLC registered",
        matching,
        (item) => item.name,
        (item) => item.name,
      );
      clc.disabled = matching.length === 0;
    }

    async function loadAvailableClcs() {
      try {
        const response = await API.getClcs();
        availableClcs = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];
      } catch (error) {
        console.error("[SetupWizard] Unable to load CLCs from the API", error);
      }

      populateMunicipalities();
      populateClcsForMunicipality(municipality?.value);

      if (!availableClcs.length) {
        Utils.toast(
          "No Community Learning Centers are registered in the database yet.",
          "warning",
        );
      }
    }

    await loadAvailableClcs();

    municipality?.addEventListener("change", () => {
      populateClcsForMunicipality(municipality.value);

      refreshSummary();
    });

    const nextBtn = document.getElementById("nextBtn");

    function refreshSummary() {
      const vals = {
        municipality: municipality?.value || "",
        clc: clc?.value || "",
        level: learningLevel?.value || "",
        year: schoolYear?.value || "",
      };

      if (summaryMunicipality)
        summaryMunicipality.textContent = vals.municipality || "Not selected";

      if (summaryCLC) summaryCLC.textContent = vals.clc || "Not selected";

      if (summaryYear) summaryYear.textContent = vals.year || "Not selected";

      if (summaryLevel) summaryLevel.textContent = vals.level || "Not selected";

      document.querySelectorAll("[data-summary-row]").forEach((row) => {
        row.classList.toggle("is-set", Boolean(vals[row.dataset.summaryRow]));
      });

      const ready = Boolean(
        vals.municipality && vals.clc && vals.level && vals.year,
      );

      const statusBox = document.querySelector("[data-summary-status]");

      if (statusBox) {
        statusBox.classList.toggle("is-ready", ready);
        statusBox.classList.toggle("is-wait", !ready);
        statusBox.innerHTML = ready
          ? '<span class="material-symbols-outlined">check_circle</span>Status: Ready for learner import'
          : '<span class="material-symbols-outlined">pending</span>Status: Complete all fields to continue';
      }

      if (nextBtn) nextBtn.disabled = !ready;
    }

    [clc, schoolYear, learningLevel].forEach((element) => {
      if (!element) return;

      element.addEventListener(
        "change",

        refreshSummary,
      );
    });

    refreshSummary();

    if (nextBtn) {
      nextBtn.addEventListener(
        "click",

        (event) => {
          event.preventDefault();

          if (typeof form.requestSubmit === "function") {
            form.requestSubmit();
          } else {
            form.dispatchEvent(
              new Event("submit", {
                cancelable: true,
                bubbles: true,
              }),
            );
          }
        },
      );
    }

    form.addEventListener(
      "submit",

      async function (event) {
        event.preventDefault();

        const payload = {
          municipality: municipality?.value,

          communityLearningCenter: clc.value,

          schoolYear: schoolYear.value,

          learningLevel: learningLevel.value,
        };

        try {
          await API.createClass(payload);

          Router.go("/setup/wizard-3");
        } catch (error) {
          console.error(error);

          Utils.toast(error?.message || error?.data?.message || "Unable to create class.", "error");
        }
      },
    );

    const backBtn = document.getElementById("backBtn");

    if (backBtn) {
      backBtn.onclick = () => {
        Router.go("/setup/wizard-1");
      };
    }
  }

  // Steps 3 (Upload) and 4 (Preview) share their actual validate/import
  // calls with the Class Management "Import Learners" feature via
  // LearnerImportCore (assets/js/core/learner-import-core.js) -- one
  // source for /learners/import* instead of two. Since the wizard is a
  // separate page per step, the parsed preview (not the File object,
  // which can't survive a navigation) is handed from step 3 to step 4
  // through sessionStorage.
  static IMPORT_PREVIEW_KEY = "setupImportPreview";

  static initWizard3() {
    const browseBtn = document.getElementById("browseBtn");

    if (!browseBtn) return;

    const fileInput = document.getElementById("fileInput");

    const dropZone = document.getElementById("dropZone");

    const uploadPreview = document.getElementById("uploadPreview");

    const importBtn = document.getElementById("importBtn");

    const skipBtn = document.getElementById("skipBtn");

    const backBtn = document.getElementById("backBtn");

    const downloadTemplateLink = document.getElementById(
      "setupDownloadTemplateLink",
    );

    if (downloadTemplateLink) {
      downloadTemplateLink.addEventListener(
        "click",

        (event) => {
          event.preventDefault();

          LearnerImportCore.downloadTemplate();

          if (window.Toast) {
            Toast.success("Template downloaded.");
          }
        },
      );
    }

    const fileName = document.getElementById("fileName");

    const fileSize = document.getElementById("fileSize");

    const uploadStatus = document.getElementById("uploadStatus");

    const uploadStatusText = uploadStatus?.querySelector("[data-status-text]") || uploadStatus;

    const uploadProgress = document.getElementById("uploadProgress");

    let selectedFile = null;

    function handleFile(file) {
      const validationError = LearnerImportCore.validateFile(file);

      if (validationError) {
        Utils.toast(validationError, "warning");

        return;
      }

      selectedFile = file;

      uploadPreview.hidden = false;

      fileName.textContent = file.name;

      fileSize.textContent = LearnerImportCore.formatBytes(file.size);

      importBtn.disabled = true;

      if (uploadProgress) uploadProgress.style.width = "0%";

      LearnerImportCore.animateProgress(
        uploadProgress,

        uploadStatusText,

        "Ready to import.",

        () => {
          importBtn.disabled = false;
        },
      );
    }

    LearnerImportCore.bindDropzone({
      zone: dropZone,

      input: fileInput,

      browseBtn,

      onFile: handleFile,
    });

    importBtn.addEventListener(
      "click",

      async () => {
        if (!selectedFile) return;

        importBtn.disabled = true;

        browseBtn.disabled = true;

        try {
          const preview = await LearnerImportCore.preview(selectedFile);

          sessionStorage.setItem(
            SetupWizard.IMPORT_PREVIEW_KEY,

            JSON.stringify(preview),
          );

          Router.go("/setup/wizard-4");
        } catch (error) {
          console.error(error);

          Utils.toast(
            error?.message || "Unable to validate the file. Please try again.",

            "error",
          );

          importBtn.disabled = false;

          browseBtn.disabled = false;
        }
      },
    );

    if (skipBtn) {
      skipBtn.addEventListener(
        "click",

        async () => {
          sessionStorage.removeItem(SetupWizard.IMPORT_PREVIEW_KEY);

          await SetupWizard.completeSetup();

          Router.go("/dashboard");
        },
      );
    }

    if (backBtn) {
      backBtn.addEventListener(
        "click",

        () => {
          Router.go("/setup/wizard-2");
        },
      );
    }
  }

  static async initWizard4() {
    const learnerTable = document.getElementById("learnerTable");

    if (!learnerTable) return;

    const statTotal = document.getElementById("statTotal");

    const statImported = document.getElementById("statImported");

    const statDuplicates = document.getElementById("statDuplicates");

    const statInvalid = document.getElementById("statInvalid");

    const previewCount = document.querySelector("[data-preview-count]");

    const finishBtn = document.getElementById("finishBtn");

    const reuploadBtn = document.getElementById("reuploadBtn");

    const raw = sessionStorage.getItem(SetupWizard.IMPORT_PREVIEW_KEY);

    if (!raw) {
      // No parsed file in this tab (direct link, or a refresh lost the
      // sessionStorage entry) -- there's nothing to preview, so send the
      // teacher back to pick a file again rather than show an empty table.
      Router.go("/setup/wizard-3");

      return;
    }

    let preview;

    try {
      preview = JSON.parse(raw);
    } catch (error) {
      console.error("[SetupWizard] Unable to parse stored import preview", error);

      Router.go("/setup/wizard-3");

      return;
    }

    const rows = preview.rows || [];

    const stats = LearnerImportCore.stats(preview);

    statTotal.textContent = stats.total;

    statImported.textContent = stats.valid;

    statDuplicates.textContent = stats.duplicates;

    statInvalid.textContent = stats.invalid;

    if (previewCount) {
      previewCount.textContent = `Showing ${rows.length} of ${stats.total} row${stats.total === 1 ? "" : "s"}`;
    }

    const PILL = {
      valid: ["ok", "Valid"],
      duplicate: ["warn", "Duplicate"],
      error: ["err", "Invalid"],
    };

    learnerTable.innerHTML = rows.length
      ? rows
          .map((row) => {
            const [cls, label] = PILL[row.status] || PILL.valid;

            return `
              <tr>
                <td class="lrn">${LearnerImportCore.cell(row.lrn)}</td>
                <td><b>${LearnerImportCore.cell(row.last_name)}</b></td>
                <td>${LearnerImportCore.cell(row.first_name)}</td>
                <td>${LearnerImportCore.titleCase(row.sex)}</td>
                <td>${LearnerImportCore.cell(row.level)}</td>
                <td><span class="setup-pill setup-pill--${cls}">${label}</span></td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="6" class="setup-preview-empty-cell">No rows to preview.</td></tr>`;

    if (reuploadBtn) {
      reuploadBtn.addEventListener(
        "click",

        () => {
          sessionStorage.removeItem(SetupWizard.IMPORT_PREVIEW_KEY);

          Router.go("/setup/wizard-3");
        },
      );
    }

    if (finishBtn) {
      finishBtn.addEventListener(
        "click",

        async () => {
          const originalHtml = finishBtn.innerHTML;

          finishBtn.disabled = true;

          finishBtn.innerHTML = `<span class="material-symbols-outlined">progress_activity</span> Importing…`;

          try {
            await LearnerImportCore.confirm(rows, null);

            sessionStorage.removeItem(SetupWizard.IMPORT_PREVIEW_KEY);

            Router.go("/setup/wizard-5");
          } catch (error) {
            console.error(error);

            Utils.toast("Import failed. Please try again.", "error");

            finishBtn.disabled = false;

            finishBtn.innerHTML = originalHtml;
          }
        },
      );
    }
  }

  static async initWizard5() {
    const finishBtn = document.getElementById("finishBtn");

    if (!finishBtn) return;

    try {
      const cls = await API.getCurrentClass();

      if (cls) {
        document.getElementById("summaryMunicipality").textContent =
          cls.municipality || "—";

        document.getElementById("summaryCLC").textContent =
          cls.communityLearningCenter || "—";

        document.getElementById("summaryYear").textContent =
          cls.schoolYear || "—";

        document.getElementById("summaryLevel").textContent =
          cls.learningLevel || "—";
      }

      const stats = await API.getImportedLearners();

      document.getElementById("statTotal").textContent = stats.total;

      document.getElementById("statImported").textContent = stats.imported;

      document.getElementById("statDuplicates").textContent = stats.duplicates;

      document.getElementById("statInvalid").textContent = stats.invalid;
    } catch (error) {
      console.error(error);
    }

    const createAnotherBtn = document.getElementById("createAnotherBtn");

    if (createAnotherBtn) {
      createAnotherBtn.addEventListener(
        "click",

        () => {
          Router.go("/setup/wizard-2");
        },
      );
    }

    finishBtn.addEventListener(
      "click",

      async () => {
        await SetupWizard.completeSetup();

        Utils.toast(
          "Setup completed successfully.",

          "success",
        );

        setTimeout(
          () => {
            Router.go("/dashboard");
          },

          500,
        );
      },
    );

    // The success icon (#successIcon / .setup-success-icon) already gets
    // a pop-in entrance via its own CSS "animation: setup-check ..." rule
    // (setup.css) -- no JS-triggered class needed here.
  }
}

document.addEventListener(
  "DOMContentLoaded",

  () => {
    SetupWizard.init();
  },
);
