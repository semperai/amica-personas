import { createContext } from "react";
import { SceneCoordinator } from "./SceneCoordinator";

const viewer = new SceneCoordinator();

// Expose to window for debugging and screenshot tool access
if (typeof window !== 'undefined') {
  (window as any).__amicaCoordinator = viewer;
}

export const ViewerContext = createContext({ viewer });
