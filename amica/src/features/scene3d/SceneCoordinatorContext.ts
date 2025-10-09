import { createContext } from "react";
import { SceneCoordinator } from "./SceneCoordinator";

// Extend Window interface for type-safe global exposure
declare global {
  interface Window {
    __amicaCoordinator?: SceneCoordinator;
  }
}

const viewer = new SceneCoordinator();

// Expose to window for debugging and screenshot tool access
if (typeof window !== 'undefined') {
  window.__amicaCoordinator = viewer;
}

export const ViewerContext = createContext({ viewer });
