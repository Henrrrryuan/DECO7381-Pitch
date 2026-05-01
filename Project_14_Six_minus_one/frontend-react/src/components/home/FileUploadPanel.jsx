import { isSupportedUploadFile } from "../../utils/uploadUtils.js";

export function FileUploadPanel({
  selectedUploadFile,
  fileDropIsActive,
  analysisIsStarting,
  onSelectedUploadFileChange,
  onFileDropActiveChange,
  onFileAnalysisSubmit,
  onStatusMessageChange,
}) {
  // Form for the file-based fallback analysis path.
  //
  // FileUploadPanel validates the selected file type before passing the File
  // object back to HomePage.jsx. HomePage.jsx then asks uploadApi.js to read the
  // file and save the pending-analysis payload for loading.js. The markup keeps
  // the old Home page classes so the React page can visually match index.html.
  const selectedFileName = selectedUploadFile?.name || "or choose an HTML / ZIP file";

  function handleFileSelection(event) {
    const [chosenFile] = event.target.files || [];
    if (!chosenFile) {
      onSelectedUploadFileChange(null);
      return;
    }

    if (!isSupportedUploadFile(chosenFile)) {
      event.target.value = "";
      onSelectedUploadFileChange(null);
      onStatusMessageChange("Only HTML and ZIP files are supported.", true);
      return;
    }

    onSelectedUploadFileChange(chosenFile);
    onStatusMessageChange(`${chosenFile.name} is ready for analysis.`);
  }

  function handleFileDrop(event) {
    event.preventDefault();
    onFileDropActiveChange(false);

    const [droppedFile] = event.dataTransfer?.files || [];
    if (!droppedFile) {
      return;
    }

    if (!isSupportedUploadFile(droppedFile)) {
      onSelectedUploadFileChange(null);
      onStatusMessageChange("Only HTML and ZIP files are supported.", true);
      return;
    }

    onSelectedUploadFileChange(droppedFile);
    onStatusMessageChange(`${droppedFile.name} is ready for analysis.`);
  }

  return (
    <form className="workflow-panel upload-form secondary-upload-card is-active" onSubmit={onFileAnalysisSubmit} noValidate>
      <div className="input-card-copy">
        <h3>Check a file</h3>
        <p>Upload an HTML file or a ZIP package when you do not have a live page.</p>
      </div>

      <label
        className={`dropzone${fileDropIsActive ? " dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          onFileDropActiveChange(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          onFileDropActiveChange(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          onFileDropActiveChange(false);
        }}
        onDrop={handleFileDrop}
      >
        <input
          type="file"
          accept=".html,.htm,text/html,.zip,application/zip"
          onChange={handleFileSelection}
        />
        <span className="dropzone-label">Drag &amp; drop an HTML or ZIP file</span>
        <span className="dropzone-file">{selectedFileName}</span>
      </label>

      <button
        className="upload-analyze-button secondary-action"
        type="submit"
        disabled={analysisIsStarting || !selectedUploadFile}
      >
        {analysisIsStarting ? "Analyzing..." : "Analyze"}
      </button>
    </form>
  );
}
