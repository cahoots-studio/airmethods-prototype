/* Page entry for Supercomponent motion. The presets themselves live in
   src/motion/presets.js (copied beside this file at build time). Waits for the
   web fonts so headline line-splitting measures the real wrap. */
import { initMotion } from './presets.js';

const start = () => initMotion({ gsap: window.gsap, ScrollTrigger: window.ScrollTrigger });
(document.fonts ? document.fonts.ready : Promise.resolve()).then(start, start);
