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
const { Menu, getCurrentWindow, nativeImage } =
	require("@electron/remote") as typeof import("@electron/remote");
import active from "@renderer/assets/home/context-menu/active.png";
import idle from "@renderer/assets/home/context-menu/idle.png";
import invisible from "@renderer/assets/home/context-menu/invisible.png";
import dnd from "@renderer/assets/home/context-menu/dnd.png";

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

function Home() {
	const { state, setState } = useContext(Context);
	const inputRef = useRef<HTMLInputElement>(null);
	const [editingStatus] = useState(false);
	const [paperSrc] = useState("");
	function setStatus(status: PresenceUpdateStatus) {
		let mutState = { ...state };
		mutState.ready.sessions.find((s) => s.active)!.status = status;
		sendOp(GatewayOpcodes.PresenceUpdate, {
			status,
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
	useEffect(() => {
		if (!editingStatus) return;
		inputRef.current?.focus();
	}, [editingStatus]);
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
	useEffect(() => {
		if (contextMenuOpacity !== "1") return;
		const menu = Menu.buildFromTemplate([
			{
				label: "Available",
				id: "available",
				click() {
					setStatus(PresenceUpdateStatus.Online);
				},
				icon: nativeImage.createFromPath(active),
			},
			{
				label: "Busy",
				id: "busy",
				click() {
					setStatus(PresenceUpdateStatus.DoNotDisturb);
				},
				icon: nativeImage.createFromPath(dnd),
			},
			{
				label: "Away",
				id: "away",
				click() {
					setStatus(PresenceUpdateStatus.Idle);
				},
				icon: nativeImage.createFromPath(idle),
			},
			{
				label: "Appear offline",
				id: "invisible",
				click() {
					setStatus(PresenceUpdateStatus.Offline);
				},
				icon: nativeImage.createFromPath(invisible),
			},
		]);
		function mouseDown() {
			setContextMenuOpacity("0");
			menu.closePopup();
		}
		const username = document.getElementsByClassName(
			styles.usernameContainer,
		)[0] as HTMLDivElement;
		if (!username) return;
		const bounds = username.getBoundingClientRect();
		menu.popup({
			window: getCurrentWindow(),
			x: bounds.left,
			y: bounds.top + bounds.height,
		});
		menu.on("menu-will-close", () => {
			setContextMenuOpacity("0");
			menu.closePopup();
		});
		document.addEventListener("mousedown", mouseDown);
		return () => {
			document.removeEventListener("mousedown", mouseDown);
		};
	}, [contextMenuOpacity]);
	const userStatus = state.ready.sessions?.find((s) => s.active);
	const status = state.ready?.sessions
		?.find((s) => s.active)
		?.activities?.find((a) => a.type === 4);
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
							onClick={() =>
								setContextMenuOpacity((o) => (o === "0" ? "1" : "0"))
							}
							className={styles.usernameContainer}
							data-toggled={`${contextMenuOpacity === "1"}`}
						>
							<span className={styles.username}>
								{state.ready.user.global_name || state.ready.user.username}
							</span>
							{/* <img src={dropdown} /> */}
						</div>
						<input
							placeholder=""
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

								console.log("focus!!!");
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
				{/* <h1>Connection details</h1>
				<div>Currently online users (according to our state?):</div>
				{liveState.connections.map((c) => (
					<div
						key={c.id}
						style={{
							backgroundColor: "#57b9e7",
							marginBottom: "10px",
							padding: 8,
						}}
					>
						<h1>{c.username}</h1>
						<div>{c.id}</div>
						<PfpBorder pfp={pfp} state={c.status} />
					</div>
				))}
				<h1>Window info (state debugging??)</h1>
				Window ID: {win?.id} */}
				<div className={styles.padded}>
					<div className={styles.searchContainer}>
						<input
							required
							onChange={(e) => setSearch(e.target.value)}
							className={styles.search}
							placeholder="Search contacts or the Web..."
						/>
					</div>
					<h1>Users Online</h1>
					<div className={styles.contacts}>
						{/* {(() => {
							// const connections = search
							// 	? new Fuse(liveState.connections, { keys: ["username"] })
							// 			.search(search)
							// 			.map((c) => c.item)
							// 			.filter((c) => c)
							// 	: liveState.connections;
							const connections = state.ready.relationships;
							return search.trim() === "" && connections.length === 0 ? (
								<div className={styles.searchInfo}>
									<div
										style={{
											marginTop: 4,
										}}
									>
										No users are online right now.
									</div>
								</div>
							) : connections.length !== 0 ? (
								connections.map((c) => (
									<div
										className={styles.contact}
										key={c.id}
										onDoubleClick={() => {
											// const process = ProcessManager.getProcessByWindowId(
											// 	winState?.id || "",
											// );
											// process?.addWindow({
											// 	component: Live,
											// 	initialPath: `/message?user=${
											// 		c.id
											// 	}&initialState=${JSON.stringify(liveState)}`,
											// 	title: c.username,
											// 	icon: "msn.png",
											// 	defaultWidth: 483,
											// 	defaultHeight: 419,
											// 	minWidth: 483,
											// 	minHeight: 419,
											// });
										}}
									>
										<PfpBorder
											pfp={`https://cdn.discordapp.com/avatars/${c.user.id}/${c.user.avatar}.png`}
											stateInitial={
												c.user.presence?.status as PresenceUpdateStatus
											}
											variant="small"
										/>
										<div className={styles.contactInfo}>
											<div className={styles.contactUsername}>
												{c.user.username}
											</div>
											<div className={styles.contactStatus}>
												{c.user.presence?.status}
											</div>
										</div>
									</div>
								))
							) : (
								<div className={styles.searchInfo}>
									<div
										style={{
											marginBottom: 4,
										}}
									>
										No results found for "{search}"
									</div>
									<a
										href={`https://www.google.com/search?q=${search}`}
										target="_blank"
										rel="noreferrer"
									>
										Search the web for "{search}"
									</a>
								</div>
							);
						})()} */}
						{state.ready?.relationships
							?.map((r) => state.ready.users?.find((u) => u.id === r.id))
							.map((c) => {
								const status = state.ready?.merged_presences?.friends?.find(
									(p) => p.user_id === c?.id,
								);
								return (
									<div
										className={styles.contact}
										key={c?.id}
										onDoubleClick={() => {
											// const process = ProcessManager.getProcessByWindowId(
											// 	winState?.id || "",
											// );
											// process?.addWindow({
											// 	component: Live,
											// 	initialPath: `/message?user=${
											// 		c.id
											// 	}&initialState=${JSON.stringify(liveState)}`,
											// 	title: c.username,
											// 	icon: "msn.png",
											// 	defaultWidth: 483,
											// 	defaultHeight: 419,
											// 	minWidth: 483,
											// 	minHeight: 419,
											// });
										}}
									>
										<PfpBorder
											pfp={
												c?.avatar
													? `https://cdn.discordapp.com/avatars/${c?.id}/${c?.avatar}.png`
													: defaultPfp
											}
											variant="small"
											stateInitial={
												(status?.status as unknown as PresenceUpdateStatus) ||
												PresenceUpdateStatus.Offline
											}
										/>
										<div className={styles.contactInfo}>
											<div className={styles.contactUsername}>
												{(c as unknown as APIUser)?.global_name || c?.username}
											</div>
											<div className={styles.contactStatus}>
												{status?.activities?.find((a) => a.type === 4)?.state}
											</div>
										</div>
									</div>
								);
							})}
					</div>
				</div>
			</div>
		</div>
	);
}

export default Home;
