export function InputMethodTabs({
  selectedInputMethod,
  onSelectedInputMethodChange,
}) {
  // Two-button selector for the main analysis input method.
  //
  // HomePage.jsx owns selectedInputMethod. This component only displays the
  // current value and asks HomePage.jsx to switch between Website URL and File
  // Upload when a button is clicked. The class names mirror the old
  // frontend/index.html tabs so the Vite Home page keeps the same visual style.
  const inputMethodOptions = [
    {
      value: "website",
      title: "Website URL",
      description: "Check a page from your local development server only.",
    },
    {
      value: "file",
      title: "Upload File",
      description: "Check an HTML file or ZIP package from your computer.",
    },
  ];

  return (
    <div className="workflow-options" role="tablist" aria-label="Input method">
      {inputMethodOptions.map((inputMethodOption) => {
        const optionIsSelected = selectedInputMethod === inputMethodOption.value;
        return (
          <button
            key={inputMethodOption.value}
            type="button"
            className={`workflow-option${optionIsSelected ? " is-active" : ""}`}
            role="tab"
            aria-selected={optionIsSelected}
            onClick={() => onSelectedInputMethodChange(inputMethodOption.value)}
          >
            <span className="workflow-option-title">{inputMethodOption.title}</span>
            <span className="workflow-option-copy">{inputMethodOption.description}</span>
          </button>
        );
      })}
    </div>
  );
}
