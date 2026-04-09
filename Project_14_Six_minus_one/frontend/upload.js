import {
  analyzeUploadFile,
  isHtmlFile,
  isZipFile,
  loadDashboardSession,
  saveDashboardSession,
} from "./common.js";

const state = {
  file: null,
  loading: false,
};

const uploadInput = document.getElementById("uploadInput");
const uploadForm = document.getElementById("uploadForm");
const dropzone = document.getElementById("dropzone");
const selectedFileName = document.getElementById("selectedFileName");
const analyzeButton = document.getElementById("analyzeButton");
const uploadStatus = document.getElementById("uploadStatus");

function setStatus(message, isError = false) {
  uploadStatus.textContent = message;
  uploadStatus.classList.toggle("error", isError);
}

function syncFile(file) {
  state.file = file || null;
  selectedFileName.textContent = file ? file.name : "or choose an HTML / ZIP file";
  analyzeButton.disabled = !file || state.loading;
  if (file) {
    setStatus(`${file.name} is ready for analysis.`);
  } else {
    setStatus("");
  }
}

function setLoading(loading) {
  state.loading = loading;
  analyzeButton.disabled = loading || !state.file;
  analyzeButton.textContent = loading ? "Analyzing..." : "Analyze";
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!state.file || state.loading) {
    return;
  }

  setLoading(true);
  setStatus("Running cognitive accessibility analysis...");

  try {
    const previousSession = loadDashboardSession();
    const baselineRunId = previousSession?.current?.payload?.run?.run_id || null;
    const payload = await analyzeUploadFile(state.file, baselineRunId);
    const html = isHtmlFile(state.file)
      ? await state.file.text()
      : payload.html_content || "";
    saveDashboardSession({
      current: {
        payload,
        html,
        sourceName: state.file.name,
        savedAt: new Date().toISOString(),
      },
      previous: previousSession?.current || null,
      html,
      sourceName: state.file.name,
      savedAt: new Date().toISOString(),
    });
    window.location.href = "./dashboard.html";
  } catch (error) {
    setStatus(error.message, true);
    setLoading(false);
  }
}

function bindDropzone() {
  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "dragend", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer?.files || [];
    if (!file) {
      return;
    }
    if (!isHtmlFile(file) && !isZipFile(file)) {
      setStatus("Only HTML and ZIP files are supported on the upload page.", true);
      return;
    }
    uploadInput.files = event.dataTransfer.files;
    syncFile(file);
  });
}

uploadInput.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  if (!file) {
    syncFile(null);
    return;
  }
  if (!isHtmlFile(file) && !isZipFile(file)) {
    event.target.value = "";
    syncFile(null);
    setStatus("Only HTML and ZIP files are supported on the upload page.", true);
    return;
  }
  syncFile(file);
});

uploadForm.addEventListener("submit", handleSubmit);
bindDropzone();
