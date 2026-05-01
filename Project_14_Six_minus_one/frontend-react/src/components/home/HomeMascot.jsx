import { useEffect, useRef } from "react";

export function HomeMascot() {
  // Decorative character group copied from the old Home page structure.
  //
  // The old upload.js file moved the pupils with pointer events. In React, this
  // component owns that same pointer-following behavior locally so HomePage.jsx
  // can stay focused on the analysis workflow.
  const mascotRootRef = useRef(null);

  useEffect(() => {
    const pupilElements = Array.from(
      mascotRootRef.current?.querySelectorAll("[data-eye-pupil]") || [],
    );
    if (!pupilElements.length) {
      return undefined;
    }

    const maximumPupilOffset = 5.5;
    const updatePupilPosition = (clientX, clientY) => {
      pupilElements.forEach((pupilElement) => {
        const eyeElement = pupilElement.parentElement;
        if (!eyeElement) {
          return;
        }

        const eyeRect = eyeElement.getBoundingClientRect();
        const eyeCenterX = eyeRect.left + eyeRect.width / 2;
        const eyeCenterY = eyeRect.top + eyeRect.height / 2;
        const deltaX = clientX - eyeCenterX;
        const deltaY = clientY - eyeCenterY;
        const angleRadians = Math.atan2(deltaY, deltaX);
        const distance = Math.min(maximumPupilOffset, Math.hypot(deltaX, deltaY) * 0.09);
        const offsetX = Math.cos(angleRadians) * distance;
        const offsetY = Math.sin(angleRadians) * distance;
        pupilElement.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
      });
    };

    const handlePointerMove = (event) => {
      updatePupilPosition(event.clientX, event.clientY);
    };

    const handlePointerLeave = () => {
      pupilElements.forEach((pupilElement) => {
        pupilElement.style.transform = "translate3d(0, 0, 0)";
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  return (
    <aside className="upload-character-panel" aria-hidden="true" ref={mascotRootRef}>
      <div className="character-stage">
        <div className="character figure-purple">
          <div className="character-eyes">
            <span className="eye-ball"><span className="eye-pupil" data-eye-pupil /></span>
            <span className="eye-ball"><span className="eye-pupil" data-eye-pupil /></span>
          </div>
        </div>
        <div className="character figure-dark">
          <div className="character-eyes">
            <span className="eye-ball"><span className="eye-pupil" data-eye-pupil /></span>
            <span className="eye-ball"><span className="eye-pupil" data-eye-pupil /></span>
          </div>
        </div>
        <div className="character figure-orange">
          <div className="character-eyes">
            <span className="eye-ball"><span className="eye-pupil" data-eye-pupil /></span>
            <span className="eye-ball"><span className="eye-pupil" data-eye-pupil /></span>
          </div>
        </div>
        <div className="character figure-yellow">
          <div className="character-eyes">
            <span className="eye-ball"><span className="eye-pupil" data-eye-pupil /></span>
            <span className="eye-ball"><span className="eye-pupil" data-eye-pupil /></span>
          </div>
          <span className="character-mouth" aria-hidden="true" />
        </div>
      </div>
    </aside>
  );
}
