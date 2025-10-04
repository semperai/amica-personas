import { createContext } from "react";
import { SceneCoordinator } from "./SceneCoordinator";

const viewer = new SceneCoordinator();

export const ViewerContext = createContext({ viewer });
