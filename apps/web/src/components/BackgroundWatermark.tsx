/**
 * A presentational brand mark shared by every application shell. A real DOM
 * element is used instead of a pseudo-element so it remains consistently
 * rendered across Vite, Vercel, and browser paint/compositing paths.
 */
export function BackgroundWatermark() {
  return <img
    className="background-watermark"
    src="/.well-known/infinity-logo.svg"
    alt=""
    aria-hidden="true"
    draggable={false}
  />;
}
