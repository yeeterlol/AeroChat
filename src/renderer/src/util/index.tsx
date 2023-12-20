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

export const keyMap: { [key: string]: React.ReactNode } = {
	a: "a",
	b: "b",
	c: "c",
	d: "d",
	e: "e",
	f: "f",
	g: "g",
	h: "h",
	i: "i",
	j: "j",
	k: "k",
	l: "l",
	m: "m",
	n: "n",
	o: "o",
	p: "p",
	q: "q",
	r: "r",
	s: "s",
	t: "t",
	u: "u",
	v: "v",
	w: "w",
	x: "x",
	y: "y",
	z: "z",
	"0": "0",
	"1": "1",
	"2": "2",
	"3": "3",
	"4": "4",
	"5": "5",
	"6": "6",
	"7": "7",
	"8": "8",
	"9": "9",
	Control: "Ctrl",
	Shift: "Shift",
	Alt: "Alt",
	Meta: (
		<div className="meta">
			<svg
				className="windows-logo"
				xmlns="http://www.w3.org/2000/svg"
				height="150"
				width="125"
				viewBox="0 0 150 150"
			>
				<path
					xmlns="http://www.w3.org/2000/svg"
					d="M170 20.7c-33 13.7-49 6-63.2-3.6L90.8 73.5c14.3 9.7 31.5 17.7 63.2 3.5l16.3-56.3z"
				/>
				<path
					xmlns="http://www.w3.org/2000/svg"
					d="M63 134.2c-14.3-9.6-30-17.6-63-3.9l16.2-56.6c33-13.6 49-5.9 63.3 3.8L63 134.2z"
				/>
				<path
					xmlns="http://www.w3.org/2000/svg"
					d="M82.2 67.3a53.9 53.9 0 0 0-31-11.3c-8.7-.1-19.1 2.4-32.2 7.8L35.2 7.4c33.1-13.7 49-6 63.3 3.7L82.2 67.3z"
				/>
				<path
					xmlns="http://www.w3.org/2000/svg"
					d="M88 83c14.4 9.6 30.3 17.3 63.3 3.6L135 142.8c-33 13.7-48.9 6-63.2-3.7L88.1 83z"
				/>
			</svg>
		</div>
	),
	Enter: "Enter",
	Escape: "Esc",
	Backspace: "Backspace",
	Tab: "Tab",
	CapsLock: "Caps Lock",
	" ": "Space",
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
	"`": "`",
	"~": "~",
	"!": "!",
	"@": "@",
	"#": "#",
	$: "$",
	"%": "%",
	"^": "^",
	"&": "&",
	"*": "*",
	"(": "(",
	")": ")",
	_: "_",
	"-": "-",
	"=": "=",
	"+": "+",
	"[": "[",
	"{": "{",
	"]": "]",
	"}": "}",
	"\\": "\\",
	"|": "|",
	";": ";",
	":": ":",
	"'": "'",
	'"': '"',
	",": ",",
	"<": "<",
	".": ".",
	">": ">",
	"/": "/",
	"?": "?",
};

export { ipc };
