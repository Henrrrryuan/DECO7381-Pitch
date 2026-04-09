import { analyzeHtmlText, loadDashboardSession, saveDashboardSession } from "./common.js";

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
  selectedFileName.textContent = file ? file.name : "or choose an HTML file";
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
    const html = await state.file.text();
    const payload = await analyzeHtmlText(html, state.file.name);
    const previousSession = loadDashboardSession();
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
    if (!file.name.toLowerCase().match(/\.(html?|HTML?)$/)) {
      setStatus("Only HTML files are supported on the upload page.", true);
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
  if (!file.name.toLowerCase().match(/\.(html?|HTML?)$/)) {
    event.target.value = "";
    syncFile(null);
    setStatus("Only HTML files are supported on the upload page.", true);
    return;
  }
  syncFile(file);
});

uploadForm.addEventListener("submit", handleSubmit);
bindDropzone();
