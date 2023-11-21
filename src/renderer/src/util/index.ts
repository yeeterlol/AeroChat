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

export async function apiReq<B = any, R = any>(
	route: string,
	method: "GET" | "POST" | "PATCH" | "DELETE",
	token: string,
	body?: B,
): Promise<{ status: number; body: R }> {
	const res = await fetch(`https://discord.com/api/v9${route}`, {
		headers: {
			Authorization: token,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		method,
	});
	return {
		status: res.status,
		body: await res.json(),
	};
}

export { ipc };
