import { useContext, useEffect, useState } from "react";
import styles from "@renderer/css/pages/Home.module.css";
import {
	Context,
	apiReq,
	getActivityText,
	hasParentWithClass,
	joinClasses,
} from "@renderer/util";
import PfpBorder from "@renderer/components/PfpBorder";
import {
	APIChannel,
	APIDMChannel,
	APIGuild,
	APITextChannel,
	APIUser,
	ChannelType,
	GatewayDispatchEvents,
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
	// ContextMenuItemType,
	// ContextMenuStyle,
	Friend,
	GuildPresence,
	State,
	// State,
	Status,
} from "../../../shared/types";
import {
	addDispatchListener,
	closeGateway,
	contactCard,
	contextMenu,
	createWindow,
	removeGatewayListener,
} from "@renderer/util/ipc";
const remote = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");
import { RelationshipTypes } from "../../../shared/types";
import Fuse from "fuse.js";
import {
	Channel,
	DiscordUtil,
	Member,
	computePermissions,
	hasPermission,
} from "@renderer/classes/DiscordUtil";
import { useNavigate } from "react-router-dom";
const Store = remote.require(
	"electron-store",
) as typeof import("electron-store");
import receiveAudio from "@renderer/assets/audio/type.mp3";
import semver from "semver";
import sanitizeHtml from "sanitize-html";
const { ipcRenderer } = window.require("electron");

const store = new Store();

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

function Notification({
	notifications,
}: {
	notifications: HomeNotification[];
}) {
	const [icons, setIcons] = useState<{ name: string; url: string }[]>([]);
	const [seen, setSeen] = useState<number[]>(
		Object.values(store.get("seenNotifications") || []),
	);
	useEffect(() => {
		async function fetchIcons() {
			// import meta glob the icons
			const glob = import.meta.glob("../assets/home/notification/*.png");
			// convert into {name: string; url: string;}[]
			const icons = await Promise.all(
				Object.entries(glob).map(async ([key, val]) => ({
					name: key.split("/").at(-1)!.replace(".png", ""),
					url: ((await val()) as any).default,
				})),
			);
			setIcons(icons);
		}
		fetchIcons();
	}, [notifications]);
	useEffect(() => {
		store.set("seenNotifications", seen);
	}, [seen]);
	const version = remote.app.getVersion();
	const notification = notifications.find((n) => {
		const satifies = n.targets ? semver.satisfies(version, n.targets) : true;
		return satifies && !seen.includes(n.date);
	});
	return notification ? (
		<div className={styles.notificationContainer}>
			<div
				className={joinClasses(styles.notification, styles[notification.type])}
			>
				<img
					className={styles.icon}
					src={icons.find((i) => i.name === notification.type)?.url}
				/>
				<span
					className={styles.contentContainer}
					dangerouslySetInnerHTML={{
						__html: sanitizeHtml(notification.message),
						// this is vulnerable to xss but im the only one who can edit the notifications
					}}
				/>
				<div
					onClick={() => setSeen((s) => [...s, notification.date])}
					className={styles.close}
				/>
			</div>
		</div>
	) : null;
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
				{children}
			</div>
		</div>
	);
}

export function Contact(
	props: React.DetailedHTMLProps<
		React.HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		format?: string;
		user: APIUser;
		status: Friend | GuildPresence;
		guild?: boolean;
		groupchat?: boolean;
	},
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
			className={`${styles.contact} ${props.className || ""}`}
		>
			<PfpBorder
				pfp={
					props?.user?.avatar
						? `https://cdn.discordapp.com/${
								props.guild
									? "icons"
									: props.groupchat
									  ? "channel-icons"
									  : "avatars"
						  }/${props?.user?.id}/${props?.user?.avatar}${
								props.format || ".png"
						  }`
						: defaultPfp
				}
				variant="small"
				stateInitial={props?.status?.status as unknown as PresenceUpdateStatus}
				guild={props.guild || props.groupchat}
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

/**
 * A notification to be displayed on the home page
 */
interface HomeNotification {
	/**
	 * The type of notification
	 */
	type: "information" | "warning" | "error";
	/**
	 * The notification's contents
	 */
	message: string;
	/**
	 * The date the notification was sent
	 */
	date: number;
	/**
	 * The targeted version(s) which the notification is for
	 * @example targets: ">=1.0.0-rc.2"
	 */
	targets?: string;
}

function Home() {
	const [input, setInput] = useState<HTMLInputElement | null>(null);
	const [ad, setAd] = useState<HTMLDivElement | null>(null);
	const { state, setState } = useContext(Context);
	const [notifications, setNotifications] = useState<HomeNotification[]>([]);
	function contactContextMenu(
		user: APIUser,
		e: React.MouseEvent<HTMLDivElement, MouseEvent>,
	) {
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
					type: ContextMenuItemType.Divider,
				},
				{
					type: ContextMenuItemType.Item,
					label: `View contact card`,
					click() {
						const closest = (e.target as HTMLDivElement).closest(
							`.${styles.contact}`,
						) as HTMLDivElement;
						const window = remote.getCurrentWindow();
						const windowPos = window.getContentBounds();
						const bounds = closest.getBoundingClientRect();
						contactCard(
							user,
							windowPos.x + bounds.left,
							windowPos.y + bounds.top + bounds.height,
						);
					},
				},
			],
			cursor.x,
			cursor.y,
			-50,
		);
	}
	async function doubleClick(data: APIUser | APIChannel) {
		if ("avatar" in data) {
			let frequentUsers: { [key: string]: number } =
				store.get("frequentUsers") || ({} as any);
			frequentUsers = {
				...frequentUsers,
				[data.id]: (frequentUsers[data.id] || 0) + 1,
			};
			store.set("frequentUsers", frequentUsers);
		} else {
			const guild = state?.ready?.guilds?.find((g) =>
				g.channels.map((c) => c.id).includes(data.id),
			);
			if (!guild) return console.log(guild);
			let frequentGuilds: { [key: string]: number } =
				store.get("frequentGuilds") || ({} as any);
			frequentGuilds = {
				...frequentGuilds,
				[guild.id]: (frequentGuilds[guild.id] || 0) + 1,
			};
			console.log(frequentGuilds);
			store.set("frequentGuilds", frequentGuilds);
		}

		function openMessageWindow(id: string) {
			createWindow({
				customProps: {
					url: `/message?channelId=${id}`,
				},
				width: 550,
				height: 400,
				minWidth: 366,
				minHeight: 248,
				icon: remote.nativeImage.createFromPath("resources/icon-chat.ico"),
			});
		}
		if ("type" in data) {
			if (data.type !== ChannelType.GuildText) return;
			openMessageWindow(data.id);
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
				openMessageWindow(channel.id);
				return;
			}
			const channels = (
				await apiReq("/users/@me/channels", "POST", state?.token || "", {
					recipients: [data.id],
				})
			).body;
			if (!channels.id) return;
			openMessageWindow(channels.id);
			return;
		}
	}
	const [paperSrc] = useState("");
	useEffect(() => {
		ipcRenderer.on("open-guild", (e, id: string) => {
			const guild = DiscordUtil.getGuildById(id);
			if (!guild) return;
			const memberReady = DiscordUtil.getMembership(guild);
			if (!memberReady) throw new Error("member not found??");
			const member = new Member(memberReady);
			const channels = guild.channels
				.filter((c) => c.type === ChannelType.GuildText)
				.sort((a, b) => a.position - b.position)
				.map((c) => new Channel(c as any));
			const channel = channels.find((c) =>
				hasPermission(
					computePermissions(member, c),
					PermissionFlagsBits.ViewChannel,
				),
			);
			console.log(channel);
			if (!channel) return;
			doubleClick(channel.properties);
		});
		ipcRenderer.on("open-dm", async (e, userId: string) => {
			doubleClick(state?.ready?.users?.find((u) => u.id === userId)!);
		});
		return () => {
			ipcRenderer.removeAllListeners("open-guild");
		};
	}, []);
	useEffect(() => {
		async function getNotifications() {
			const res = await fetch(
				`https://gist.github.com/not-nullptr/26108f2ac8fcb8a24965a148fcf17363/raw?bust=${Date.now()}`,
			);
			const json = await res.json();
			const seen = Object.values(
				new Store().get("seenNotifications") || {},
			) as number[];
			/*
						const trayIcon: Electron.CrossProcessExports.Tray =
			remote.getGlobal("trayIcon");
		trayIcon.displayBalloon({
			title: "Windows Live Messenger",
			content: "A new notification has arrived. Open the home page to read it.",
			iconType: "info",
		});
			*/
			// check if theres a new notification we havent seen yet
			const newNotification = json.find(
				(n: HomeNotification) =>
					!seen.includes(n.date) &&
					(n.targets
						? semver.satisfies(remote.app.getVersion(), n.targets)
						: true),
			);
			const canRecieve = state.ready.sessions.every((val) => val.status != "dnd");
			if (newNotification && canRecieve) {
				console.log(state)
				const trayIcon: Electron.CrossProcessExports.Tray =
					remote.getGlobal("trayIcon");
				trayIcon.displayBalloon({
					title: "Windows Live Messenger",
					content:
						"A new notification has arrived. Open the home page to read it.",
					iconType: "info",
				});
			}
			setNotifications(json);
			console.log(json);
		}
		// grab notifications every 1 minute
		const interval = setInterval(getNotifications, 1000 * 60);
		getNotifications();
		const fn = async () => {
			const jumpList: Electron.JumpListCategory[] = [];
			let listOfDmedUsers: { [key: string]: number } =
				store.get("frequentUsers") || ({} as any);
			let listOfGuilds: { [key: string]: number } =
				store.get("frequentGuilds") || ({} as any);
			if (Object.keys(listOfDmedUsers).length) {
				listOfDmedUsers = Object.fromEntries(
					Object.entries(listOfDmedUsers)
						.sort(([, a], [, b]) => b - a)
						.slice(0, 5),
				);
				console.log(JSON.parse(JSON.stringify(listOfDmedUsers)));
				jumpList.push({
					name: "Frequent Users",
					items: await Promise.all(
						Object.entries(listOfDmedUsers).map(
							async ([id, count]): Promise<Electron.JumpListItem> => {
								const user = DiscordUtil.getUserById(id);
								const avatar = await DiscordUtil.getAvatarPath(user);
								return {
									type: "task",
									args: "",
									description: `Opens a DM with ${DiscordUtil.getUserById(id)
										?.username}`,

									program: `aerochat://dm/${id}`,
									iconPath: avatar || "",
									iconIndex: 0,
									title: user?.global_name || user?.username || "Unknown",
								};
							},
						),
					),
				});
			}
			if (Object.keys(listOfGuilds).length) {
				listOfGuilds = Object.fromEntries(
					Object.entries(listOfGuilds)
						.sort(([, a], [, b]) => b - a)
						.slice(0, 5),
				);
				jumpList.push({
					name: "Frequent Guilds",
					items: await Promise.all(
						Object.entries(listOfGuilds).map(
							async ([id, count]): Promise<Electron.JumpListItem> => {
								const guild = DiscordUtil.getGuildById(id);
								const icon = await DiscordUtil.getAvatarPath(
									guild?.properties as any,
								);
								return {
									type: "task",
									description: `Opens ${guild?.properties?.name}`,
									program: `aerochat://guild/${id}`,
									iconPath: icon || "",
									iconIndex: 0,
									title: guild?.properties?.name || "Unknown",
								};
							},
						),
					),
				});
			}
			remote.app.setJumpList(jumpList);
		};
		fn();
		const frequent = setInterval(fn, 1000);
		return () => {
			clearInterval(interval);
			clearInterval(frequent);
		};
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
				(
					await Promise.all(
						Object.values(import.meta.glob("../assets/home/ads/*.png")).map(
							(v) => v(),
						),
					)
				).map((v) => (v as any).default) as string[]
			).map((v) => v.replace("/@fs", ""));
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
		if (!input) return;
		input.placeholder = input.value ? "" : "Share a quick message";
		input.style.width = `${calcWidth(input.value || input.placeholder)}px`;
	}, [input]);
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
	useEffect(() => {
		function getWindow(path: string) {
			for (const window of remote.BrowserWindow.getAllWindows()) {
				const rawUrl = window.webContents.getURL();
				if (!rawUrl) continue;
				const url = new URL(rawUrl);
				if (url.hash.replace("#", "") === path) return window;
			}
			return null;
		}
		const id = addDispatchListener(GatewayDispatchEvents.MessageCreate, (d) => {
			const privateChannel = state?.ready?.private_channels?.find(
				(c) => c.id === d.channel_id,
			);
			const shouldOpen =
				(!!d.mentions.find((m) => m.id === state?.ready?.user?.id) ||
					(privateChannel && privateChannel.type !== ChannelType.GroupDM)) &&
				d.author.id !== state?.ready?.user?.id;
			if (shouldOpen) {
				const oldWin = getWindow(`/message?channelId=${d.channel_id}`);
				const audio = new Audio(receiveAudio);
				if (oldWin) {
					oldWin.flashFrame(true);
					oldWin.setAlwaysOnTop(true);
					oldWin.setAlwaysOnTop(false);
					oldWin.focus();
					return;
				}
				audio.play();
				createWindow({
					customProps: {
						url: `/message?channelId=${d.channel_id}`,
					},
					width: 550,
					height: 400,
					minWidth: 366,
					minHeight: 248,
					icon: remote.nativeImage.createFromPath("resources/icon-chat.ico"),
				});
				const window = getWindow(`/message?channelId=${d.channel_id}`);
				if (!window) return;
				window.flashFrame(true);
				window.focus();
			}
			// // open a window
			// createWindow({
			// 	customProps: {
			// 		url: `/message?channelId=${d.channel_id}`,
			// 	},
			// 	width: 550,
			// 	height: 400,
			// 	minWidth: 366,
			// 	minHeight: 248,
			// 	icon: remote.nativeImage.createFromPath("resources/icon-chat.ico"),
			// });
		});
		return () => {
			removeGatewayListener(id);
		};
	}, []);
	const userStatus = state.ready?.sessions[0];
	const status = state.ready?.sessions[0]?.activities?.find(
		(a) => a.type === 4,
	);
	const friends = state?.ready?.relationships
		?.filter((r) => r.type === RelationshipTypes.FRIEND)
		?.filter(Boolean)
		?.map((u) => ({
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
		}))
		.filter(Boolean);
	const onlineUnsearched = friends
		?.filter((f) => f.status.status !== Status.Offline)
		.sort((a, b) =>
			(a.user.global_name || a.user.username).localeCompare(
				b.user.global_name || b.user.username,
			),
		)
		.filter(Boolean);
	const online = search
		? new Fuse(onlineUnsearched, {
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
		: onlineUnsearched;
	const offlineUnsearched = friends
		?.filter((f) => f.status.status === Status.Offline)
		.sort((a, b) =>
			(a.user.global_name || a.user.username).localeCompare(
				b.user.global_name || b.user.username,
			),
		)
		.filter(Boolean);
	const offline = search
		? new Fuse(offlineUnsearched, {
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
		: offlineUnsearched;
	const dmsUnsearched = state?.ready?.private_channels
		?.filter((c) => c.type === ChannelType.DM)
		?.filter((c) => c.last_message_id !== null)
		?.filter(
			(c) =>
				!state?.ready?.relationships
					?.map((r) => r.user_id)
					.includes(c.recipient_ids[0]),
		)
		.filter((c) => c.recipient_ids.length === 1)
		.sort(
			(a, b) =>
				(DiscordUtil.getDateById(b.last_message_id) || 0) -
				(DiscordUtil.getDateById(a.last_message_id) || 0),
		)
		.map((c) => ({
			user: state?.ready?.users?.find((v) => v.id === c.recipient_ids[0])!,
			status: state?.ready?.merged_presences?.guilds
				?.flat()
				?.find((p) => p.user_id === c.recipient_ids[0]) || {
				activities: [],
				client_status: {},
				status: "offline" as Status,
				user_id: c.recipient_ids[0],
				user: {
					id: c.recipient_ids[0],
				},
			},
		}));
	const dms = search
		? new Fuse(dmsUnsearched, {
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
		: dmsUnsearched;
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
	let guilds =
		state.userSettings?.guildFolders?.folders
			.map((folder) => {
				const guilds = folder.guildIds.map(
					(g) => state.ready.guilds?.find((h) => h.id === g.toString())!,
				);
				return {
					folder: folder,
					guilds: guilds?.filter((g) => !!g),
					isFolder: guilds?.length !== 1,
				};
			})
			.flat()
			.filter((g) => !!g.guilds) || [];
	guilds = [
		{
			folder: undefined as any,
			isFolder: false,
			guilds: state.ready.guilds
				.filter(
					(g) =>
						!guilds
							.map((g) => g.guilds)
							.flat()
							.map((g) => g.id)
							.includes(g.id),
					// sort by joined_at, which we need to parse into a number
				)
				.sort((a, b) => {
					const aDate = new Date(a.joined_at || 0).getTime();
					const bDate = new Date(b.joined_at || 0).getTime();
					return aDate - bDate;
				}),
		},
		...guilds,
	];
	const groupChats =
		state?.ready?.private_channels?.filter(
			(c) => c.type === ChannelType.GroupDM,
		) || [];
	const navigate = useNavigate();
	return !state.ready?.user?.id ? (
		<>
			error: user is undefined! contact me on my discord:{" "}
			<code>notnullptr</code>
		</>
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
								setContextMenuOpacity("0");
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
											click() {
												closeGateway();
												store.set("token", null);
												store.set("autoLogin", null);
												setState({} as State);
												navigate("/");
											},
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
											click() {
												createWindow({
													customProps: {
														url: "/options",
													},
													width: 550,
													height: 400,
													minWidth: 366,
													minHeight: 248,
													icon: remote.nativeImage.createFromPath(
														"resources/icon.ico",
													),
												});
											},
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
							ref={setInput}
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
				<Notification notifications={notifications} />
				<div className={styles.contactsContainer}>
					<div className={styles.contacts}>
						<Dropdown
							header="Online"
							info={`(${online.length}/${friends.length})`}
						>
							{onlineUnsearched?.map((c) => (
								<Contact
									style={{
										display: search
											? online?.map((d) => d.user?.id).includes(c.user?.id)
												? ""
												: "none"
											: "",
									}}
									onDoubleClick={() => doubleClick(c.user)}
									onContextMenu={(e) => contactContextMenu(c.user, e)}
									key={c.user?.id}
									{...c}
								/>
							))}
						</Dropdown>
						<Dropdown header="Unfriended DMs" info={`(${dms?.length})`}>
							{dmsUnsearched?.filter(Boolean).map((c) => (
								<Contact
									style={{
										display: search
											? dms?.map((d) => d.user?.id).includes(c.user?.id)
												? ""
												: "none"
											: "",
									}}
									onDoubleClick={() => doubleClick(c.user)}
									onContextMenu={(e) => contactContextMenu(c.user, e)}
									key={c.user?.id}
									status={c.status}
									user={c.user}
								/>
							))}
						</Dropdown>
						<Dropdown header="Group Chats" info={`(${groupChats?.length})`}>
							{groupChats.map((c) => (
								<Contact
									onDoubleClick={() => {
										createWindow({
											customProps: {
												url: `/message?channelId=${c.id}`,
											},
											width: 550,
											height: 400,
											minWidth: 366,
											minHeight: 248,
											icon: remote.nativeImage.createFromPath(
												"resources/icon-chat.ico",
											),
										});
									}}
									key={c.id}
									user={
										{
											id: c.id,
											avatar: c?.icon,
											global_name:
												c?.name ||
												c?.recipient_ids
													.map(
														(id) =>
															state.ready.users.find((u) => u.id === id)
																?.global_name ||
															state.ready.users.find((u) => u.id === id)
																?.username,
													)
													.join(", "),
										} as any
									}
									status={PresenceUpdateStatus.Online as any}
									groupchat
								/>
							))}
						</Dropdown>
						<Dropdown
							header="Servers"
							info={`(${guilds?.map((g) => g.guilds).length})`}
						>
							{guilds?.map((f) =>
								f.isFolder ? (
									<Dropdown
										header={f.folder.name?.value || "Unnamed folder"}
										info={`(${f.guilds?.length})`}
										color={
											"#" +
												f.folder.color?.value.toString(16).padStart(6, "0") ||
											undefined
										}
									>
										{f.guilds
											?.filter((g) => !!g)
											.map((c) => (
												<Contact
													// style={{
													// 	display: search
													// 		? guilds?.map((d) => d.id).includes(c.id)
													// 			? ""
													// 			: "none"
													// 		: "",
													// }}
													format=".webp?size=256"
													onDoubleClick={() => {
														const memberReady = DiscordUtil.getMembership(c);
														if (!memberReady)
															throw new Error("member not found??");
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
														console.log(channel);
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
								) : (
									f.guilds?.map((c) => (
										<Contact
											// style={{
											// 	display: search
											// 		? guilds?.map((d) => d.id).includes(c.id)
											// 			? ""
											// 			: "none"
											// 		: "",
											// }}
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
												console.log(channel);
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
									))
								),
							)}
						</Dropdown>
						<Dropdown header="Offline" info={`(${offline.length})`}>
							{offlineUnsearched?.map((c) => (
								<Contact
									style={{
										display: search
											? offline?.map((d) => d.user?.id).includes(c.user?.id)
												? ""
												: "none"
											: "",
									}}
									onDoubleClick={() => doubleClick(c.user)}
									onContextMenu={(e) => contactContextMenu(c.user, e)}
									key={c.user?.id}
									{...c}
								/>
							))}
						</Dropdown>
					</div>
				</div>
			</div>
			<div className={styles.dividerAlt} />
			<div ref={setAd} className={styles.ad} />
		</div>
	);
}

export default Home;
