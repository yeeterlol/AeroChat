import { useContext, useEffect, useRef, useState } from "react";
import styles from "@renderer/css/pages/Home.module.css";
import { Context, apiReq, hasParentWithClass } from "@renderer/util";
import PfpBorder from "@renderer/components/PfpBorder";
import {
	APIChannel,
	APIDMChannel,
	APIGuild,
	APITextChannel,
	APIUser,
	ChannelType,
	GatewayOpcodes,
	PermissionFlagsBits,
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
import {
	ContextMenuItemType,
	ContextMenuStyle,
	Friend,
	FriendActivity,
	IGuild,
	State,
	Status,
} from "../../../shared/types";
import { contextMenu, createWindow } from "@renderer/util/ipc";
const remote = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");
import hasEmoji from "has-emoji";
import gameIcon from "@renderer/assets/home/statuses/game.png";
import musicIcon from "@renderer/assets/home/statuses/music.png";
import { RelationshipTypes } from "../../../shared/types";
import Fuse from "fuse.js";
import {
	Channel,
	DiscordUtil,
	Guild,
	Member,
	computePermissions,
	convertPermsToArray,
	hasPermission,
} from "@renderer/classes/DiscordUtil";

function getActivityText(activities?: FriendActivity[]) {
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

export function Dropdown({
	color,
	header,
	children,
	info,
}: {
	color?: string;
	header: string;
	children: React.ReactNode;
	info?: string;
}) {
	const [open, setOpen] = useState(false);
	return (
		<div className={styles.dropdown}>
			<div className={styles.dropdownHeader} onClick={() => setOpen(!open)}>
				<div className={styles.dropdownArrow} data-toggled={open} />
				<h1 style={{ color }}>
					{header} <span className={styles.dropdownInfo}>{info}</span>
				</h1>
			</div>
			<div className={styles.dropdownContent} data-toggled={open}>
				{open ? children : <></>}
			</div>
		</div>
	);
}

function Contact(
	props: React.DetailedHTMLProps<
		React.HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & { format?: string; user: APIUser; status: Friend; guild?: boolean },
) {
	const p = { ...props, user: undefined, status: undefined, guild: undefined };
	return (
		<div
			{...p}
			onMouseDown={(e) => {
				const contact = e.currentTarget.closest(
					`.${styles.contact}`,
				) as HTMLDivElement;
				document.querySelectorAll(`.${styles.contact}`).forEach((c) => {
					c.classList.remove(styles.selected);
				});
				contact.classList.add(styles.selected);
				props.onClick?.(e);
			}}
			className={styles.contact}
		>
			<PfpBorder
				pfp={
					props?.user?.avatar
						? `https://cdn.discordapp.com/${
								props.guild ? "icons" : "avatars"
						  }/${props?.user?.id}/${props?.user?.avatar}${
								props.format || ".png"
						  }`
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
	const [ad, setAd] = useState<HTMLDivElement | null>(null);
	const { state, setState } = useContext(Context);
	function contactContextMenu(user: APIUser) {
		const cursor = remote.screen.getCursorScreenPoint();
		contextMenu(
			[
				{
					type: ContextMenuItemType.Item,
					label: `[b]Send message (${user.username})[/b]`,
					click() {
						doubleClick(user);
					},
				},
				{
					type: ContextMenuItemType.Item,
					label: `Lazily pad out the context menu with a long label`,
				},
				{
					type: ContextMenuItemType.Item,
					label: `Apologies, by the way; the divider looks bad with just one item`,
				},
				{
					type: ContextMenuItemType.Divider,
				},
				{
					type: ContextMenuItemType.Item,
					label: `View contact card`,
				},
				{
					type: ContextMenuItemType.Item,
					label: `Call this person a dummy`,
				},
				{
					type: ContextMenuItemType.Item,
					label: `Blehhh :p :p :p :p :p :p :p :p :p :p :p :p :p :p :p :p`,
				},
			],
			cursor.x,
			cursor.y,
			-50,
		);
	}
	async function doubleClick(data: APIUser | APIChannel) {
		if ("type" in data) {
			if (data.type !== ChannelType.GuildText) return;
			createWindow({
				customProps: {
					url: `/message?channelId=${data.id}`,
				},
				width: 550,
				height: 400,
			});
			return;
		}
		if ("global_name" in data) {
			const dmChannels = state?.ready?.private_channels?.filter(
				(c) => c.type === ChannelType.DM,
			) as (APIDMChannel & {
				recipient_ids: string[];
			})[];
			const channel = dmChannels.find(
				(c) => c.recipient_ids?.length === 1 && c.recipient_ids[0] === data.id,
			);
			if (channel) {
				createWindow({
					customProps: {
						url: `/message?channelId=${channel.id}`,
					},
					width: 550,
					height: 400,
				});
				return;
			}
			const channels = (
				await apiReq("/users/@me/channels", "POST", state?.token || "", {
					recipients: [data.id],
				})
			).body;
			if (!channels.id) return;
			createWindow({
				customProps: {
					url: `/message?channelId=${channels.id}`,
				},
				width: 550,
				height: 400,
			});
		}
	}
	const inputRef = useRef<HTMLInputElement>(null);
	const [paperSrc] = useState("");
	useEffect(() => {
		console.log(state.userSettings);
	}, []);
	function setStatus(status: PresenceUpdateStatus) {
		let mutState = { ...state };
		mutState.ready.sessions[0].status = status;
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
		function mouseDown(e: MouseEvent) {
			if (e.button !== 0) return;
			if (hasParentWithClass(e.target as HTMLElement, styles.contact)) return;
			document.querySelectorAll(`.${styles.contact}`).forEach((c) => {
				c.classList.remove(styles.selected);
			});
		}
		document.addEventListener("mousedown", mouseDown);
		return () => {
			document.removeEventListener("mousedown", mouseDown);
		};
	});
	useEffect(() => {
		if (!ad) return;
		let interval: NodeJS.Timeout;
		(async () => {
			const ads = (
				await Promise.all(
					Object.values(import.meta.glob("@renderer/assets/home/ads/*")).map(
						(v) => v(),
					),
				)
			).map((v) => (v as any).default) as string[];
			ad!.style.backgroundImage = `url(${
				ads[generateRandBetween(0, ads.length - 1, lastAd)]
			}`;
			interval = setInterval(() => {
				ad.style.backgroundImage = `url(${
					ads[generateRandBetween(0, ads.length - 1, lastAd)]
				})`;
			}, 20000);
		})();
		return () => {
			if (interval) clearInterval(interval);
		};
	}, [ad]);
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
	const [search, setSearch] = useState("");
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
	const userStatus = state.ready?.sessions[0];
	const status = state.ready?.sessions[0]?.activities?.find(
		(a) => a.type === 4,
	);
	const unfilteredFriends = state?.ready?.relationships
		?.filter((r) => r.type === RelationshipTypes.FRIEND)
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
				user: {
					id: u.id,
				},
			},
		}));
	const friends = search
		? new Fuse(unfilteredFriends, {
				keys: [
					{
						name: "username",
						weight: 1,
						getFn: (obj) => obj.user.global_name || obj.user.username,
					},
				],
		  })
				.search(search)
				.map((s) => s.item)
		: unfilteredFriends;
	const online = friends
		?.filter((f) => f.status.status !== Status.Offline)
		.sort((a, b) =>
			(a.user.global_name || a.user.username).localeCompare(
				b.user.global_name || b.user.username,
			),
		);
	const offline = friends
		?.filter((f) => f.status.status === Status.Offline)
		.sort((a, b) =>
			(a.user.global_name || a.user.username).localeCompare(
				b.user.global_name || b.user.username,
			),
		);
	// const channels = state?.ready?.guilds
	// 	?.map((g) =>
	// 		g.channels.map((c) => ({
	// 			guild: g,
	// 			channel: c,
	// 		})),
	// 	)
	// 	.flat();
	// const guilds = state?.ready?.guilds.sort((a, b) =>
	// 	a.properties?.name.localeCompare(b.properties?.name),
	// );
	// const noFolders =
	// 	state?.userSettings?.guildFolders?.folders
	// 		?.filter((f) => f.guildIds.length === 1)
	// 		?.map((f) => ({
	// 			properties: f,
	// 			guilds: f.guildIds.map(
	// 				(g) => state.ready.guilds.find((h) => h.id === g.toString()) as Guild,
	// 			),
	// 		}))
	// 		?.sort((a, b) =>
	// 			(
	// 				a.properties?.name?.value || a.guilds[0].properties?.name
	// 			).localeCompare(
	// 				b.properties?.name?.value || b.guilds[0].properties?.name,
	// 			),
	// 		) || [];
	// const folders =
	// 	state?.userSettings?.guildFolders?.folders
	// 		?.filter((f) => f.guildIds.length > 1)
	// 		?.map((f) => ({
	// 			properties: f,
	// 			guilds: f.guildIds.map(
	// 				(g) => state.ready.guilds.find((h) => h.id === g.toString()) as Guild,
	// 			),
	// 		})) || [];
	// const guilds = search
	// 	? new Fuse([...folders, ...noFolders], {
	// 			keys: [
	// 				{
	// 					name: "name",
	// 					weight: 1,
	// 					getFn: (obj) =>
	// 						obj.properties?.name?.value +
	// 						" " +
	// 						obj.guilds.map((g) => g.properties?.name).join(" "),
	// 				},
	// 			],
	// 	  })
	// 			.search(search)
	// 			.map((s) => s.item)
	// 	: [...folders, ...noFolders];
	const guildsUnsearched = state.ready?.guilds.sort(
		(a, b) => a.properties?.name.localeCompare(b.properties?.name),
	);
	const guilds = search
		? new Fuse(guildsUnsearched, {
				keys: [
					{
						name: "name",
						weight: 1,
						getFn: (obj) => obj.properties?.name,
					},
				],
		  })
				.search(search)
				.map((s) => s.item)
		: guildsUnsearched;
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
						pfp={
							state?.ready?.user?.avatar
								? `https://cdn.discordapp.com/avatars/${state?.ready?.user?.id}/${state?.ready?.user?.avatar}.png?size=256`
								: defaultPfp
						}
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
											type: ContextMenuItemType.Item,
										},
										{
											click() {
												setStatus(PresenceUpdateStatus.DoNotDisturb);
											},
											label: "Busy",
											icon: dnd,
											type: ContextMenuItemType.Item,
										},
										{
											click() {
												setStatus(PresenceUpdateStatus.Idle);
											},
											label: "Away",
											icon: idle,
											type: ContextMenuItemType.Item,
										},
										{
											click() {
												setStatus(PresenceUpdateStatus.Invisible);
											},
											label: "Appear offline",
											icon: invisible,
											type: ContextMenuItemType.Item,
										},
										{
											type: ContextMenuItemType.Divider,
										},
										{
											label: `Sign out from here (${remote
												.require("os")
												.hostname()})`,
											type: ContextMenuItemType.Item,
										},
										{
											type: ContextMenuItemType.Divider,
										},
										{
											type: ContextMenuItemType.Item,
											label: "Change display picture...",
										},
										{
											type: ContextMenuItemType.Item,
											label: "Change scene...",
										},
										{
											type: ContextMenuItemType.Item,
											label: "Change display name...",
										},
										{
											type: ContextMenuItemType.Divider,
										},
										{
											type: ContextMenuItemType.Item,
											label: "Options...",
										},
									],
									windowPos.x + bounds.left,
									windowPos.y + bounds.top + bounds.height,
									50,
									ContextMenuStyle.Classic,
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

								const mouseX = e.clientX;
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
									onDoubleClick={() => doubleClick(c.user)}
									onContextMenu={() => contactContextMenu(c.user)}
									key={c.user.id}
									{...c}
								/>
							))}
						</Dropdown>
						<Dropdown header="Servers" info={`(${guilds?.length})`}>
							{/* {guilds.map((c) => (
								<Dropdown
									color={`#${
										c.guilds.length > 1
											? c.properties?.color?.value
													.toString(16)
													.padStart(6, "0") || "0099ff"
											: ""
									}`}
									header={
										c.guilds.length === 1
											? c.guilds[0].properties?.name
											: c.properties?.name?.value || "Unknown Folder"
									}
									key={c.guilds.map((g) => g.properties?.id).join()}
								>
									{c.guilds.length === 1
										? c.guilds[0].channels
												.filter((c) => c.type === ChannelType.GuildText)
												.sort((a, b) => a.position - b.position)
												.map((d) => (
													<Contact
														format=".webp?size=256"
														onDoubleClick={() => doubleClick(d)}
														key={d.id}
														user={
															{
																id: c.guilds[0].properties?.id,
																avatar: c.guilds[0].properties?.icon,
																global_name: `#${d.name}`,
															} as any
														}
														status={PresenceUpdateStatus.Online as any}
														guild
													/>
												))
										: c.guilds.map((g) => (
												<Dropdown
													color={`#${
														c.guilds.length > 1
															? c.properties?.color?.value
																	.toString(16)
																	.padStart(6, "0") || "0099ff"
															: ""
													}`}
													header={g.properties?.name}
													key={g.id}
												>
													{g.channels
														.filter((c) => c.type === ChannelType.GuildText)
														.map((d) => (
															<Contact
																format=".webp?size=256"
																onDoubleClick={() => doubleClick(d)}
																key={d.id}
																user={
																	{
																		id: g.id,
																		avatar: g.properties?.icon,
																		global_name: `#${d.name}`,
																	} as any
																}
																status={PresenceUpdateStatus.Online as any}
																guild
															/>
														))}
												</Dropdown>
										  ))}
								</Dropdown>
							))} */}
							{guilds.map((c) => (
								<Contact
									format=".webp?size=256"
									onDoubleClick={() => {
										const memberReady = DiscordUtil.getMembership(c);
										if (!memberReady) throw new Error("member not found??");
										const member = new Member(memberReady);
										const channels = c.channels
											.filter((c) => c.type === ChannelType.GuildText)
											.sort((a, b) => a.position - b.position)
											.map((c) => new Channel(c as any));
										const channel = channels.find((c) =>
											hasPermission(
												computePermissions(member, c),
												PermissionFlagsBits.ViewChannel,
											),
										);
										// console.log(channel);
										if (!channel) return;
										doubleClick(channel.properties);
									}}
									key={c.id}
									user={
										{
											id: c.id,
											avatar: c.properties?.icon,
											global_name: c.properties?.name,
										} as any
									}
									status={PresenceUpdateStatus.Online as any}
									guild
								/>
							))}
						</Dropdown>
						<Dropdown header="Offline" info={`(${offline.length})`}>
							{offline?.map((c) => (
								<Contact
									onDoubleClick={() => doubleClick(c.user)}
									onContextMenu={() => contactContextMenu(c.user)}
									key={c.user.id}
									{...c}
								/>
							))}
						</Dropdown>
					</div>
					<div className={styles.dividerAlt} />
					<div ref={setAd} className={styles.ad} />
				</div>
			</div>
		</div>
	);
}

export default Home;
