class SetupWizard {
  static async completeDemoSession() {
    if (!(window.DemoAuthService && DemoAuthService.isEnabled())) {
      return;
    }

    await DemoAuthService.completeOnboarding();

    Auth.seedDemoSession?.(DemoAuthService.getSession().account);
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

  static initWizard2() {
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

    function populateMunicipalities() {
      if (!municipality || !window.MockDB?.getMunicipalities) return;

      const list = MockDB.getMunicipalities();

      municipality.innerHTML =
        `<option value="">Select Municipality</option>` +
        list.map((m) => `<option value="${m}">${m}</option>`).join("");
    }

    function populateClcsForMunicipality(selected) {
      if (!clc) return;

      if (!selected) {
        clc.innerHTML = `<option value="">Select Municipality first</option>`;

        clc.disabled = true;

        return;
      }

      const clcs = window.MockDB?.getClcsByMunicipality
        ? MockDB.getClcsByMunicipality(selected)
        : [];

      clc.innerHTML =
        `<option value="">Select CLC</option>` +
        clcs
          .map((c) => `<option value="${c.name}">${c.name}</option>`)
          .join("");

      clc.disabled = false;
    }

    populateMunicipalities();

    populateClcsForMunicipality(municipality?.value);

    municipality?.addEventListener("change", () => {
      populateClcsForMunicipality(municipality.value);

      refreshSummary();
    });

    function refreshSummary() {
      if (summaryMunicipality)
        summaryMunicipality.textContent = municipality?.value || "—";

      if (summaryCLC) summaryCLC.textContent = clc.value || "—";

      if (summaryYear) summaryYear.textContent = schoolYear.value;

      if (summaryLevel) summaryLevel.textContent = learningLevel.value || "—";
    }

    [clc, schoolYear, learningLevel].forEach((element) => {
      if (!element) return;

      element.addEventListener(
        "change",

        refreshSummary,
      );
    });

    refreshSummary();

    const submitBtn = document.getElementById("nextBtn");

    if (submitBtn) {
      submitBtn.addEventListener(
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

          Utils.toast("Unable to create class.", "error");
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

          Utils.downloadLearnerImportTemplate();

          if (window.Toast) {
            Toast.success("Template downloaded.");
          }
        },
      );
    }

    const fileName = document.getElementById("fileName");

    const fileSize = document.getElementById("fileSize");

    const uploadStatus = document.getElementById("uploadStatus");

    const uploadProgress = document.getElementById("uploadProgress");

    let selectedFile = null;

    browseBtn.addEventListener(
      "click",

      () => fileInput.click(),
    );

    dropZone.addEventListener(
      "click",

      () => fileInput.click(),
    );

    ["dragenter", "dragover"].forEach((event) => {
      dropZone.addEventListener(
        event,

        (e) => {
          e.preventDefault();

          e.stopPropagation();

          dropZone.classList.add("drop-zone-active");
        },
      );
    });

    ["dragleave", "drop"].forEach((event) => {
      dropZone.addEventListener(
        event,

        (e) => {
          e.preventDefault();

          e.stopPropagation();

          dropZone.classList.remove("drop-zone-active");
        },
      );
    });

    dropZone.addEventListener(
      "drop",

      (e) => {
        if (e.dataTransfer.files.length === 0) return;

        handleFile(e.dataTransfer.files[0]);
      },
    );

    fileInput.addEventListener(
      "change",

      () => {
        if (!fileInput.files.length) return;

        handleFile(fileInput.files[0]);
      },
    );

    function handleFile(file) {
      const extension = file.name

        .split(".")

        .pop()

        .toLowerCase();

      if (extension !== "csv" && extension !== "xlsx") {
        Utils.toast(
          "Only CSV or XLSX files are allowed.",

          "warning",
        );

        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        Utils.toast(
          "Maximum upload size is 5MB.",

          "warning",
        );

        return;
      }

      selectedFile = file;

      uploadPreview.classList.remove("hidden");

      fileName.textContent = file.name;

      fileSize.textContent = Utils.formatFileSize(file.size);

      uploadStatus.textContent = "Ready to import.";

      uploadProgress.style.width = "0%";

      importBtn.disabled = false;
    }

    importBtn.addEventListener(
      "click",

      async () => {
        if (!selectedFile) return;

        importBtn.disabled = true;

        browseBtn.disabled = true;

        uploadStatus.textContent = "Uploading learner records...";

        uploadProgress.style.width = "20%";

        try {
          await API.importLearners(
            selectedFile,

            (progress) => {
              uploadProgress.style.width = `${progress}%`;
            },
          );

          uploadProgress.style.width = "100%";

          uploadStatus.textContent = "Learners imported successfully.";

          Utils.toast(
            "Import completed.",

            "success",
          );

          setTimeout(() => {
            Router.go("/setup/wizard-4");
          }, 700);
        } catch (error) {
          console.error(error);

          uploadStatus.textContent = "Import failed.";

          uploadProgress.style.width = "0%";

          Utils.toast(
            "Unable to import learners.",

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
          await SetupWizard.completeDemoSession();

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

    const finishBtn = document.getElementById("finishBtn");

    const reuploadBtn = document.getElementById("reuploadBtn");

    const backBtn = document.getElementById("backBtn");

    try {
      const result = await API.getImportedLearners();

      statTotal.textContent = result.total;

      statImported.textContent = result.imported;

      statDuplicates.textContent = result.duplicates;

      statInvalid.textContent = result.invalid;

      learnerTable.innerHTML = "";

      (result.learners || []).forEach((learner, index) => {
        learnerTable.insertAdjacentHTML(
          "beforeend",

          `
<tr>

<td class="px-4 py-3">

${index + 1}

</td>

<td class="px-4 py-3">

${learner.lrn}

</td>

<td class="px-4 py-3">

${learner.name}

</td>

<td class="px-4 py-3">

${learner.level}

</td>

<td class="px-4 py-3">

<span
class="inline-flex
items-center
rounded-full
bg-green-100
text-green-700
px-3
py-1
text-xs
font-semibold">

Imported

</span>

</td>

</tr>

`,
        );
      });
    } catch (error) {
      console.error(error);

      Utils.toast(
        "Unable to load imported learners.",

        "error",
      );
    }

    if (backBtn) {
      backBtn.addEventListener(
        "click",

        () => {
          Router.go("/setup/wizard-3");
        },
      );
    }

    if (reuploadBtn) {
      reuploadBtn.addEventListener(
        "click",

        () => {
          Router.go("/setup/wizard-3");
        },
      );
    }

    if (finishBtn) {
      finishBtn.addEventListener(
        "click",

        () => {
          Router.go("/setup/wizard-5");
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
        await SetupWizard.completeDemoSession();

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

    const successIcon = document.getElementById("successIcon");

    if (successIcon) {
      successIcon.classList.add("animate-bounce");
    }
  }
}

document.addEventListener(
  "DOMContentLoaded",

  () => {
    SetupWizard.init();
  },
);
