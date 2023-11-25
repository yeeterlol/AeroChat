import { createContext } from "react";
import * as ipc from "./ipc";
import { FriendActivity, IContext } from "../../../shared/types";
import hasEmoji from "has-emoji";
import gameIcon from "@renderer/assets/home/statuses/game.png";
import musicIcon from "@renderer/assets/home/statuses/music.png";
import styles from "@renderer/css/pages/Home.module.css";

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

export function getActivityText(activities?: FriendActivity[]) {
	const music = activities?.find((a) => a.type === 2);
	if (music) {
		return (
			<span className={styles.customStatus}>
				<span>
					<img src={musicIcon} width="14" />
				</span>
				<span className={styles.customStatusText}>
					<i>
						{music.state} - {music.details}
					</i>
				</span>
			</span>
		);
	}
	const game = activities?.find((a) => a.type === 0);
	if (game) {
		return (
			<span className={styles.customStatus}>
				<span>
					<img src={gameIcon} width="14" />
				</span>
				<span className={styles.customStatusText}>
					<b>{game.name}</b>{" "}
					{game.details && (
						<span>
							(<i>{game.details}</i>)
						</span>
					)}
				</span>
			</span>
		);
	}
	const custom = activities?.find((a) => a.type === 4);
	if (custom) {
		return (
			<span className={styles.customStatus}>
				{custom.emoji ? (
					hasEmoji(custom.emoji.name) ? (
						<span>{custom.emoji.name}</span>
					) : (
						<span>
							<img
								src={`https://cdn.discordapp.com/emojis/${custom.emoji.id}.webp?quality=lossless&size=128`}
							/>
						</span>
					)
				) : (
					<></>
				)}
				{custom.state ? (
					<span className={styles.customStatusText}>{custom.state}</span>
				) : (
					<></>
				)}
			</span>
		);
	}
	return "";
}

export { ipc };
