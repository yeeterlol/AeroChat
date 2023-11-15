import { createContext } from "react";
import * as ipc from "./ipc";
import { IContext } from "src/shared/types";

export const Context = createContext<IContext>({} as IContext);

export function joinClasses(...classes: string[]) {
	return classes.join(" ");
}

export { ipc };
