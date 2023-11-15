import { useContext, useEffect, useRef, useState } from "react";
// import pfp from "../../../assets/wlm/default-pfp.png";
// import dropdown from "../../../assets/wlm/icons/dropdown.png";
// import styles from "../../../css/Live.module.css";
// import Fuse from "fuse.js";
// import PfpBorder from "../components/PfpBorder";
import styles from "@renderer/css/pages/Home.module.css";
import { Context } from "@renderer/util";
import PfpBorder from "@renderer/components/PfpBorder";
import { PresenceUpdateStatus } from "discord-api-types/v9";
// const { Menu } =
// 	require("@electron/remote") as typeof import("@electron/remote");

function Home() {
	const { state } = useContext(Context);
	const inputRef = useRef<HTMLInputElement>(null);
	const [editingStatus] = useState(false);
	const [paperSrc] = useState("");
	useEffect(() => {
		if (!editingStatus) return;
		inputRef.current?.focus();
	}, [editingStatus]);
	const [_, setSearch] = useState("");
	useEffect(() => {
		console.log(state);
	}, [state]);
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
	return (
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
						stateInitial={
							state.ready.sessions.find((s) => s.active)
								?.status as PresenceUpdateStatus
						}
						pfp={`https://cdn.discordapp.com/avatars/${state.ready.user.id}/${state.ready.user.avatar}.png`}
					/>
					<div className={styles.userInfo}>
						<div
							style={{
								opacity: contextMenuOpacity,
								pointerEvents: contextMenuOpacity === "0" ? "none" : "all",
								transition:
									contextMenuOpacity === "0" ? "none" : "opacity 0.1s linear",
							}}
							className={`
								${styles.contextMenu} ${styles.nameContextMenu}
							`}
						>
							{/* <div className={styles.contextMenuItem}>
								<div className={styles.contextMenuText}>Available</div>
							</div>
							<div className={styles.contextMenuItem}>
								<div className={styles.contextMenuText}>Busy</div>
							</div>
							<div className={styles.contextMenuItem}>
								<div className={styles.contextMenuText}>Away</div>
							</div>
							<div className={styles.contextMenuItem}>
								<div className={styles.contextMenuText}>Appear offline</div>
							</div> */}
							{/* <ContextMenuItems
								items={[
									{
										label: "Available",
										id: "available",
										onClick() {},
										icon: `${import.meta.env.BASE_URL}ui/wlm/icons/active.png`,
									},
									{
										label: "Busy",
										id: "busy",
										onClick() {},
										icon: `${import.meta.env.BASE_URL}ui/wlm/icons/dnd.png`,
									},
									{
										label: "Away",
										id: "away",
										onClick() {},
										icon: `${import.meta.env.BASE_URL}ui/wlm/icons/idle.png`,
									},
									{
										label: "Appear offline",
										id: "invisible",
										onClick() {},
										icon: `${
											import.meta.env.BASE_URL
										}ui/wlm/icons/invisible.png`,
									},
									{
										label: "Change Username",
										id: "changeusername",
										onClick() {
											const res = prompt(
												"Enter your new username (don't worry, this box is only temporary while I sort out application state):",
											);
											if (!res) return;
											localStorage.setItem("username", res);
										},
									},
								]}
							/> */}
						</div>
						<div
							onClick={() =>
								setContextMenuOpacity((o) => (o === "0" ? "1" : "0"))
							}
							className={styles.usernameContainer}
							data-toggled={`${contextMenuOpacity === "1"}`}
						>
							<span className={styles.username}>
								{state.ready.user.global_name}
							</span>
							{/* <img src={dropdown} /> */}
						</div>
						<input
							placeholder="Share a quick message"
							className={styles.message}
							defaultValue={state.ready.sessions.find((s) => s.active)?.status}
							contentEditable={true}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.currentTarget.blur();
								}
							}}
							// defaultValue={liveState.statusMessage || ""}
							onBlur={(e) => {
								const statusMessage = e.currentTarget.value;
								localStorage.setItem("statusMessage", statusMessage);
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
						{state.ready?.relationships?.map((c) => (
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
									stateInitial={c.user.presence?.status as PresenceUpdateStatus}
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
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

export default Home;
