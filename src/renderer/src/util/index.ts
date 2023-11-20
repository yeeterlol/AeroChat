import { createContext } from "react";
import * as ipc from "./ipc";
import { IContext } from "src/shared/types";

export const Context = createContext<IContext>({} as IContext);

export function joinClasses(...classes: string[]) {
	return classes.join(" ");
}

export const RelationshipRemove = "RELATIONSHIP_REMOVE";

export function hasParentWithClass(el: HTMLElement, className: string) {
	if (el.classList.contains(className)) return true;
	if (el.parentElement) {
		return hasParentWithClass(el.parentElement, className);
	}
	return false;
}

export { ipc };
