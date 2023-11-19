import { useContext, useEffect, useRef, useState } from "react";
import styles from "@renderer/css/pages/Home.module.css";
import { Context } from "@renderer/util";
import PfpBorder from "@renderer/components/PfpBorder";
import {
	APIUser,
	GatewayOpcodes,
	PresenceUpdateStatus,
} from "discord-api-types/v9";
import defaultPfp from "@renderer/assets/login/sample-pfp.png";
import { sendOp } from "../../../shared/gateway";
// const { Menu, getCurrentWindow, nativeImage } =
// 	require("@electron/remote") as typeof import("@electron/remote");
import active from "@renderer/assets/home/context-menu/active.png";
import idle from "@renderer/assets/home/context-menu/idle.png";
import invisible from "@renderer/assets/home/context-menu/invisible.png";
import dnd from "@renderer/assets/home/context-menu/dnd.png";
import { Friend, FriendActivity, Guild, Status } from "../../../shared/types";
import { contextMenu } from "@renderer/util/ipc";
const remote = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");
import hasEmoji from "has-emoji";
import gameIcon from "@renderer/assets/home/statuses/game.png";
import musicIcon from "@renderer/assets/home/statuses/music.png";

function getActivityText(activities: FriendActivity[]) {
	const music = activities.find((a) => a.type === 2);
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
	const game = activities.find((a) => a.type === 0);
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
	const custom = activities.find((a) => a.type === 4);
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
								width="14"
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

function calcWidth(text: string, offset: number = 1): number {
	const body = document.querySelector("body");
	const el = document.createElement("div");
	el.style.width = "fit-content";
	el.innerText = text;
	body?.appendChild(el);
	const width = el.offsetWidth;
	el.remove();
	return offset ? width + offset : width;
}

function generateRandBetween(min: number, max: number, prev: number) {
	let rand = Math.floor(Math.random() * (max - min + 1) + min);
	if (rand === prev) rand = generateRandBetween(min, max, prev);
	return rand;
}

function calculateCaretPosition(
	element: Element,
	mouseX: number,
	text: string,
) {
	const { left } = element.getBoundingClientRect();
	const computedStyle = window.getComputedStyle(element);
	const paddingLeft = parseInt(computedStyle.paddingLeft, 10);
	const paddingRight = parseInt(computedStyle.paddingRight, 10);
	const mouseXRelative = mouseX - (left + paddingLeft + paddingRight);

	let cumulativeWidth = 0;
	let caretPos = 0;

	for (let i = 0; i < text.length; i++) {
		const charWidth = calcWidth(text[i], 0);
		cumulativeWidth += charWidth;
		if (cumulativeWidth >= mouseXRelative) {
			caretPos = i;
			break;
		}
	}

	return caretPos + 1;
}

function Dropdown({
	header,
	children,
	info,
}: {
	header: string;
	children: JSX.Element[];
	info?: string;
}) {
	const [open, setOpen] = useState(false);
	return (
		<div className={styles.dropdown}>
			<div className={styles.dropdownHeader} onClick={() => setOpen(!open)}>
				<div className={styles.dropdownArrow} data-toggled={open} />
				<h1>{header}</h1>
				<div className={styles.dropdownInfo}>{info}</div>
			</div>
			<div className={styles.dropdownContent} data-toggled={open}>
				{children}
			</div>
		</div>
	);
}

function Contact(
	props: React.DetailedHTMLProps<
		React.HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & { user: APIUser; status: Friend; guild?: boolean },
) {
	const p = { ...props, user: undefined, status: undefined, guild: undefined };
	return (
		<div {...p} className={styles.contact}>
			<PfpBorder
				pfp={
					props?.user?.avatar
						? `https://cdn.discordapp.com/avatars/${props?.user?.id}/${props?.user?.avatar}.png`
						: defaultPfp
				}
				variant="small"
				stateInitial={props?.status?.status as unknown as PresenceUpdateStatus}
				guild={props.guild}
			/>
			<div className={styles.contactInfo}>
				<div className={styles.contactUsername}>
					{props.user.global_name || props.user.username}
				</div>
				<div className={styles.contactStatus}>
					{getActivityText(props.status.activities)}
				</div>
			</div>
		</div>
	);
}

function Home() {
	const adRef = useRef<HTMLImageElement>(null);
	const { state, setState } = useContext(Context);
	function contactContextMenu() {
		const cursor = remote.screen.getCursorScreenPoint();
		contextMenu(
			[
				{
					label: "Remove friend",
					click() {},
				},
			],
			cursor.x,
			cursor.y,
		);
	}
	const inputRef = useRef<HTMLInputElement>(null);
	const [paperSrc] = useState("");
	function setStatus(status: PresenceUpdateStatus) {
		let mutState = { ...state };
		mutState.ready.sessions.find((s) => s.active)!.status = status;
		sendOp(GatewayOpcodes.PresenceUpdate, {
			status:
				status === PresenceUpdateStatus.Offline
					? PresenceUpdateStatus.Invisible
					: status,
			since: 0,
			activities: [
				localStorage.getItem("statusMessage")
					? ({
							name: "Custom Status",
							type: 4,
							state: localStorage.getItem("statusMessage") || "",
							emoji: null,
					  } as any)
					: null,
			],
			afk: false,
		});
		setState(mutState);
	}
	let lastAd = -1;

	useEffect(() => {
		if (!adRef.current) return;
		let interval: NodeJS.Timeout;
		(async () => {
			const ads = (
				await Promise.all(
					Object.values(import.meta.glob("@renderer/assets/home/ads/*")).map(
						(v) => v(),
					),
				)
			).map((v) => (v as any).default) as string[];
			adRef.current!.style.backgroundImage = `url(${
				ads[generateRandBetween(0, ads.length - 1, lastAd)]
			}`;
			interval = setInterval(() => {
				adRef.current!.style.backgroundImage = `url(${
					ads[generateRandBetween(0, ads.length - 1, lastAd)]
				})`;
			}, 20000);
		})();
		return () => {
			if (interval) clearInterval(interval);
		};
	}, []);
	// useEffect(() => {
	// 	if (!editingStatus) return;
	// 	inputRef.current?.focus();
	// }, [editingStatus]);
	useEffect(() => {
		if (!inputRef.current) return;
		inputRef.current.placeholder = inputRef.current.value
			? ""
			: "Share a quick message";
		inputRef.current.style.width = `${calcWidth(
			inputRef.current.value || inputRef.current.placeholder,
		)}px`;
	}, []);
	const [_, setSearch] = useState("");
	const [contextMenuOpacity, setContextMenuOpacity] = useState("0");
	useEffect(() => {
		function mouseDown(e: MouseEvent) {
			if (e.button !== 0) return;
			const el = e.target as HTMLDivElement;
			if (el.closest(`.${styles.contextMenu}`)) return;
			if (el.closest(`.${styles.contextMenuItem}`)) return;
			setContextMenuOpacity("0");
		}
		document.addEventListener("mousedown", mouseDown);
		return () => {
			document.removeEventListener("mousedown", mouseDown);
		};
	}, []);
	const userStatus = state.ready?.sessions?.find((s) => s.active);
	const status = state.ready?.sessions
		?.find((s) => s.active)
		?.activities?.find((a) => a.type === 4);
	const friends = state?.ready?.relationships
		?.filter((r) => r.type === 1)
		.map((u) => ({
			user: state?.ready?.users?.find(
				(v) => v.id === u.id,
			) as unknown as APIUser,
			status: state?.ready?.merged_presences?.friends?.find(
				(v) => v.user_id === u.id,
			) || {
				activities: [],
				client_status: {},
				status: "offline" as Status,
				user_id: u.id,
			},
		}));
	const online = friends?.filter((f) => f.status.status !== Status.Offline);
	const offline = friends?.filter((f) => f.status.status === Status.Offline);
	return !state.ready?.user?.id ? (
		<></>
	) : (
		<div className={styles.window}>
			<div
				className={styles.background}
				onMouseEnter={() => {
					// setPaperSrc(paperOpen);
					// setTimeout(() => {
					// 	setPaperSrc((p) => {
					// 		if (p === paperOpen) return paperStatic;
					// 		return p;
					// 	});
					// }, 450);
				}}
				onMouseLeave={() => {
					// setPaperSrc(paperClose);
					// setTimeout(() => {
					// 	setPaperSrc("");
					// }, 450);
				}}
			>
				<img src={paperSrc} className={styles.paper} />
				<div className={styles.topInfo}>
					<PfpBorder
						stateInitial={userStatus?.status as PresenceUpdateStatus}
						pfp={`https://cdn.discordapp.com/avatars/${state.ready.user.id}/${state.ready.user.avatar}.png`}
					/>
					<div className={styles.userInfo}>
						<div
							onClick={() => {
								setContextMenuOpacity("1");
								const window = remote.getCurrentWindow();
								const windowPos = window.getContentBounds();
								const usernameContainer = document.querySelector(
									`.${styles.usernameContainer}`,
								) as HTMLDivElement;
								const bounds = usernameContainer.getBoundingClientRect();
								contextMenu(
									[
										{
											click() {
												setStatus(PresenceUpdateStatus.Online);
											},
											label: "Available",
											icon: active,
										},
										{
											click() {
												setStatus(PresenceUpdateStatus.DoNotDisturb);
											},
											label: "Busy",
											icon: dnd,
										},
										{
											click() {
												setStatus(PresenceUpdateStatus.Idle);
											},
											label: "Away",
											icon: idle,
										},
										{
											click() {
												setStatus(PresenceUpdateStatus.Invisible);
											},
											label: "Appear offline",
											icon: invisible,
										},
									],
									windowPos.x + bounds.left,
									windowPos.y + bounds.top + bounds.height,
									1000,
								).then(() => setContextMenuOpacity("0"));
							}}
							className={styles.usernameContainer}
							data-toggled={`${contextMenuOpacity === "1"}`}
						>
							<span className={styles.username}>
								{state.ready.user.global_name || state.ready.user.username}
							</span>
							{/* <img src={dropdown} /> */}
						</div>
						<input
							ref={inputRef}
							className={styles.message}
							defaultValue={status?.state}
							contentEditable={true}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.currentTarget.blur();
								}
							}}
							onChange={(e) => {
								e.currentTarget.style.width = `${calcWidth(
									e.currentTarget.value,
								)}px`;
							}}
							onFocus={(e) => {
								e.currentTarget.placeholder = "";
								e.currentTarget.style.width = `${calcWidth(
									e.currentTarget.value || e.currentTarget.placeholder,
								)}px`;
							}}
							// defaultValue={liveState.statusMessage || ""}
							onBlur={(e) => {
								const statusMessage = e.currentTarget.value;
								localStorage.setItem("statusMessage", statusMessage);
								e.currentTarget.placeholder = "Share a quick message";
								e.currentTarget.style.width = `${calcWidth(
									e.currentTarget.value || e.currentTarget.placeholder,
								)}px`;
								sendOp(GatewayOpcodes.PresenceUpdate, {
									status: PresenceUpdateStatus.Online,
									since: 0,
									activities: [
										{
											name: "Custom Status",
											type: 4,
											state: statusMessage,
											emoji: null,
										} as any,
									],
									afk: false,
								});
							}}
							onMouseDown={(e) => {
								if (document.activeElement === e.currentTarget) return;
								e.preventDefault();
							}}
							onMouseUp={(e) => {
								const target = e.currentTarget;
								if (document.activeElement === target) return;

								e.preventDefault();
								target.focus();

								const mouseX = e.clientX; // Replace with e.pageX if needed
								const text = target.value;
								const caretPos = calculateCaretPosition(target, mouseX, text);

								if (target.setSelectionRange) {
									target.setSelectionRange(caretPos, caretPos);
								}
							}}
						/>
					</div>
				</div>
			</div>
			<div className={styles.divider} />
			<div className={styles.content}>
				<div className={styles.padded}>
					<div className={styles.searchContainer}>
						<input
							required
							onChange={(e) => setSearch(e.target.value)}
							className={styles.search}
							placeholder="Search contacts or the Web..."
						/>
					</div>
				</div>
				<div className={styles.contactsContainer}>
					<div className={styles.contacts}>
						<Dropdown
							header="Online"
							info={`(${online.length}/${friends.length})`}
						>
							{online?.map((c) => (
								<Contact
									onContextMenu={contactContextMenu}
									key={c.user.id}
									{...c}
								/>
							))}
						</Dropdown>
						<Dropdown header="Offline" info={`(${offline.length})`}>
							{offline?.map((c) => (
								<Contact
									onContextMenu={contactContextMenu}
									key={c.user.id}
									{...c}
								/>
							))}
						</Dropdown>
					</div>
					<div className={styles.dividerAlt} />
					<div ref={adRef} className={styles.ad} />
				</div>
			</div>
		</div>
	);
}

export default Home;
