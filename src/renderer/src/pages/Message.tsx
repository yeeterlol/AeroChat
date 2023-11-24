import PfpBorder from "@renderer/components/PfpBorder";
import styles from "@renderer/css/pages/Message.module.css";
import { Context, apiReq } from "@renderer/util";
import React, { useContext, useEffect, useState } from "react";
import defaultPfp from "@renderer/assets/login/sample-pfp.png";
import {
	APIUser,
	APIMessage,
	GatewayDispatchEvents,
	APITextChannel,
	APIDMChannel,
	ChannelType,
	APIGuild,
	PresenceUpdateStatus,
	APIGuildCategoryChannel,
	APINewsChannel,
	MessageType,
	GuildChannelType,
} from "discord-api-types/v9";
import { useSearchParams } from "react-router-dom";
import { addDispatchListener, removeGatewayListener } from "@renderer/util/ipc";
import { IGuild } from "../../../shared/types";
import typingIcon from "@renderer/assets/message/typing.png";
import { sendOp } from "../../../shared/gateway";
import { APIChannel, PermissionFlagsBits } from "discord-api-types/v10";
import {
	DiscordUtil,
	hasPermission,
	computePermissions,
	Member,
	Channel,
} from "@renderer/classes/DiscordUtil";
import { Dropdown } from "./Home";
import lilGuy from "@renderer/assets/message/buddies.png";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
const remote = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");
import speen from "@renderer/assets/login/speen.png";

function isGuildChannel(type: ChannelType): type is GuildChannelType {
	return Object.keys(ChannelType)
		.filter((k) => k.startsWith("Guild"))
		.includes(ChannelType[type]);
}

function generateNonce() {
	let result = "";
	const characters = "0123456789";
	const charactersLength = characters.length;

	for (let i = 0; i < 25; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}

	return result;
}

function getPfp(user: APIUser | APIGuild | IGuild | undefined) {
	if (!user) return defaultPfp;
	if ("icon" in user) {
		return `https://cdn.discordapp.com/icons/${user.id}/${user.icon}.webp?size=256`;
	}
	if ("properties" in user) {
		return `https://cdn.discordapp.com/avatars/${user.id}/${user.properties.icon}.png?size=256`;
	}
	if (user.avatar) {
		return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
	}
	return defaultPfp;
}

function parseEmoji(emoji: string): { name: string; url: string } {
	const animated = emoji.startsWith("<a:");
	const name = emoji.split(":")[1];
	const url = `https://cdn.discordapp.com/emojis/${emoji
		.split(":")[2]
		.replace(">", "")}${animated ? ".gif" : ".webp"}`;
	return { name, url };
}

type ReplacementRule = {
	pattern: RegExp;
	replacement: React.ReactNode | ((match: RegExpExecArray) => React.ReactNode);
};

function parseMessage(
	message: APIMessage,
	rules: ReplacementRule[],
): React.ReactNode {
	const msg = message.content;
	const tokens: React.ReactNode[] = [];
	let lastIndex = 0;

	rules.forEach(({ pattern, replacement }) => {
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(msg)) !== null) {
			const [fullMatch] = match;
			tokens.push(msg.slice(lastIndex, match.index));

			const replaced =
				typeof replacement === "function" ? replacement(match) : replacement;
			tokens.push(replaced);

			lastIndex = match.index + fullMatch.length;
		}
	});

	tokens.push(msg.slice(lastIndex));

	message.attachments.forEach((a) => {
		let shouldBreak = false;
		if (tokens.filter((t) => t).length > 0) shouldBreak = true;
		tokens.unshift(
			<a
				href="#"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					if (!a?.url.startsWith("https://")) return;
					remote.require("electron").shell.openExternal(a.url);
				}}
				target="_blank"
			>
				View attachment
			</a>,
			shouldBreak ? <br /> : null,
		);
	});
	return tokens;
}

function generateTyping(...usernames: string[]): React.JSX.Element {
	// if none, return ""
	// if 1, return "user is typing..."
	// if 2, return "user1 and user2 are typing..."
	// if 3+, return "user1, user2, and user3 are typing..."
	/* <span style={{ fontWeight: "bold" }}>user</span> is typing... */
	if (usernames.length === 0) return <></>;
	if (usernames.length === 1)
		return (
			<div>
				<span style={{ fontWeight: "bold" }}>{usernames[0]}</span>{" "}
				<span className={styles.typingInfoText}>is writing...</span>
			</div>
		);
	if (usernames.length === 2)
		return (
			<div>
				<span style={{ fontWeight: "bold" }}>{usernames[0]}</span>{" "}
				<span className={styles.typingInfoText}>and</span>{" "}
				<span style={{ fontWeight: "bold" }}>{usernames[1]}</span>{" "}
				<span className={styles.typingInfoText}>are writing...</span>
			</div>
		);
	if (usernames.length > 2)
		// make sure the commas and "and" aren't bold
		return (
			<div>
				{usernames.slice(0, -1).map((u, i) => (
					<span>
						<span style={{ fontWeight: "bold" }}>{u}</span>
						<span className={styles.typingInfoText}>
							{i === usernames.length - 2 ? " " : ", "}
						</span>
					</span>
				))}
				<span className={styles.typingInfoText}>and</span>{" "}
				<span style={{ fontWeight: "bold" }}>{usernames.at(-1)}</span>{" "}
				<span className={styles.typingInfoText}> are writing...</span>
			</div>
		);
	return <></>;
}

function MessagePage() {
	const [messageContainer, setMessageContainer] =
		useState<HTMLDivElement | null>();
	const [params] = useSearchParams();
	const channelParam = params.get("channelId");
	const [channelId, setChannelId] = useState(channelParam);
	const [channel, setChannel] = useState<
		APITextChannel | APIDMChannel | APINewsChannel
	>();
	const [channels, setChannels] = useState<
		Channel<APITextChannel | APIGuildCategoryChannel | APINewsChannel>[]
	>([]);
	const { state } = useContext(Context);
	const [messages, setMessages] = useState<APIMessage[]>([]);
	async function fetchMessages() {
		if (!channelId) return;
		const messages = (
			await apiReq(`/channels/${channelId}/messages`, "GET", state?.token || "")
		).body as APIMessage[];
		setMessages(messages.reverse());
		if (!messageContainer) return;
	}
	const [typing, setTyping] = useState<
		{
			name: string;
			id: string;
			timeout: NodeJS.Timeout;
		}[]
	>([]);
	useEffect(() => {
		if (!channel) return;
		let data: any = {};
		if (channel.type === ChannelType.DM) {
			data.channel_id = channel.id;
		} else if ("guild_id" in channel) {
			data.guild_id = channel.guild_id;
			data.typing = true;
			data.threads = true;
			data.activities = true;
			data.members = [];
			data.thread_member_lists = [];
			data.channels = {
				[channel.id]: [[0, 99]],
			};
		}
		sendOp("guild_id" in channel ? (14 as any) : (13 as any), data as any);
	}, [channel]);
	useEffect(() => {
		const id = addDispatchListener(GatewayDispatchEvents.TypingStart, (d) => {
			if (d.channel_id !== channelId) return;
			let typingMut = [...typing];
			const typingUser = typingMut.find((t) => t.id === d.user_id);
			const user = state?.ready?.users?.find((u) => u.id === d.user_id);
			if (typingUser) {
				clearTimeout(typingUser.timeout);
				typingMut = typingMut.filter((t) => t.id !== d.user_id);
			}
			typingMut = [
				...typingMut,
				{
					name:
						d.member?.nick ||
						d.member?.user?.global_name ||
						d.member?.user?.username ||
						user?.global_name ||
						user?.username ||
						"Unknown user",
					id: d.user_id,
					timeout: setTimeout(() => {
						setTyping((t) => t.filter((t) => t.id !== d.user_id));
					}, 10000),
				},
			];
			setTyping(typingMut);
		});
		return () => {
			removeGatewayListener(id);
		};
	}, [channel, typing]);
	async function fetchChannel() {
		console.log(channelId);
		if (!channelId) return;
		const channel = (
			await apiReq(`/channels/${channelId}`, "GET", state?.token || "")
		).body;
		setChannel(channel);
	}
	// const recepient = {
	// 	user: state?.ready?.users.find((u) => u.id === userId),
	// 	presence: state?.ready?.merged_presences?.friends.find(
	// 		(f) => f.user_id === userId,
	// 	),
	// };
	const [guild, setGuild] = useState<APIGuild | IGuild | undefined>();
	useEffect(() => {
		fetchMessages();
		fetchChannel();
		console.log(guild);
		if (!guild) return;
		if ("properties" in guild) {
			setChannel({
				...(guild.channels.find((c) => c.id === channelId) as any),
				guild_id: guild.id,
			});
			setMessages([]);
			// setChannel(guild.channels.find((c) => c.id === channelId) as any);
		}
	}, [channelId]);
	useEffect(() => {
		console.log(channel);
	}, [channel]);
	const [canSendChannel, setCanSendChannel] = useState(false);
	useEffect(() => {
		if (!guild || !("properties" in guild)) return;
		const memberReady = DiscordUtil.getMembership(guild);
		if (!memberReady) throw new Error("member not found??");
		const member = new Member(memberReady);
		const channels = guild.channels
			.map((c) => new Channel(c as any))
			.filter((c) =>
				hasPermission(
					computePermissions(member, c),
					PermissionFlagsBits.ViewChannel,
				),
			)
			.sort((a, b) => a.properties.position - b.properties.position);
		setChannels(channels);
	}, [guild]);
	const recepient =
		channel?.type === ChannelType.DM
			? {
					user: state?.ready?.users.find(
						(u) => u.id === channel?.recipients?.[0].id,
					),
					presence:
						state?.ready?.merged_presences?.friends.find(
							(f) => f.user_id === channel?.recipients?.[0].id,
						) ||
						state?.ready?.merged_presences?.guilds
							?.flat()
							?.find((p) => p.user_id === channel?.recipients?.[0].id),
			  }
			: undefined;
	useEffect(() => {
		if (!guild || !("properties" in guild) || !channel) return;
		const memberReady = DiscordUtil.getMembership(guild);
		if (!memberReady) throw new Error("member not found??");
		const member = new Member(memberReady);
		setCanSendChannel(
			!hasPermission(
				computePermissions(member, new Channel(channel as any)),
				PermissionFlagsBits.SendMessages,
			),
		);
	}, [channel, guild, recepient]);
	useEffect(() => {
		// observe the element for child changes
		if (!messageContainer) return;
		const observer = new MutationObserver(() => {
			messageContainer.scrollTop = messageContainer.scrollHeight;
		});
		observer.observe(messageContainer, { childList: true });
		return () => {
			observer.disconnect();
		};
	}, [messageContainer]);
	useEffect(() => {
		if (!messageContainer) return;
		messageContainer.scrollTop = messageContainer.scrollHeight;
	}, [messages, typing, messageContainer]);
	async function sendMessage(message: string) {
		if (!channelId) return;
		const tempId = generateNonce() + generateNonce();
		const nonce = generateNonce();
		setMessages([
			...messages,
			{
				id: tempId,
				content: message,
				attachments: [],
				author: state.ready.user as any,
				channel_id: channelId,
				timestamp: new Date().toISOString(),
				edited_timestamp: null,
				mention_everyone: false,
				embeds: [],
				mentions: [],
				mention_roles: [],
				pinned: false,
				tts: false,
				type: 1,
				nonce,
			},
		]);
		const res = await apiReq(
			`/channels/${channelId}/messages`,
			"POST",
			state?.token || "",
			{
				content: message,
				nonce,
			},
		);
		if (res.status === 200) {
			setMessages((msgs) => {
				let newMsgs = [...msgs];
				newMsgs = newMsgs.filter((msg) => msg.nonce !== nonce);
				newMsgs.push(res.body);
				return [...newMsgs];
			});
		} else {
			setMessages(messages.filter((msg) => msg.id !== tempId));
		}
	}
	useEffect(() => {
		const id = addDispatchListener(GatewayDispatchEvents.MessageCreate, (d) => {
			if (d.channel_id !== channelId || d.author.id === state?.ready?.user?.id)
				return;
			let typingMut = [...typing];
			const typingUser = typingMut.find((t) => t.id === d.author.id);
			if (typingUser) {
				clearTimeout(typingUser.timeout);
				typingMut = typingMut.filter((t) => t.id !== d.author.id);
			}
			setTyping(typingMut);
			setMessages([...messages, d]);
		});
		return () => {
			removeGatewayListener(id);
		};
	}, [channelId, messages, typing]);
	// if (!userId || !recepient.user || !recepient.presence) return <></>;
	useEffect(() => {
		if (!channel) return;
		setGuild(
			isGuildChannel(channel.type)
				? state?.ready?.guilds.find((g) => g.id === (channel as any).guild_id)
				: undefined,
		);
	}, [channel, channelId]);
	const myPresence = state?.ready?.sessions[0];

	useEffect(() => {
		remote
			.getCurrentWindow()
			.setIcon(remote.nativeImage.createFromPath("resources/icon-chat.ico"));
	}, []);
	useEffect(() => {
		if (recepient) {
			document.title = recepient.user?.global_name
				? `${recepient.user?.global_name}  <${recepient.user?.username}>`
				: `${recepient.user?.username}`;
		} else if (guild && channel) {
			if ("properties" in guild) {
				document.title = `${channel.name}  <${guild.properties.name}>`;
			} else {
				document.title = `${channel.name}  <${guild.name}>`;
			}
		}
	}, [channel, recepient, guild]);
	if (!channel) return <></>;
	return (
		<div className={styles.window}>
			<div className={styles.content}>
				<div className={styles.toolbarContainer}>
					<div className={styles.toolbar}>
						<div
							onClick={async () => {
								const { dialog } = remote.require(
									"electron",
								) as typeof import("electron");
								const fs = remote.require("fs") as typeof import("fs");
								const res = await dialog.showOpenDialog({
									properties: ["openFile"],
									filters: [
										{
											name: "Images (*.png, *.jpg, *.jpeg, *.gif, *.webp)",
											extensions: ["png", "jpg", "jpeg", "gif", "webp"],
										},
										{
											name: "Videos (*.mp4, *.mov, *.webm)",
											extensions: ["mp4", "mov", "webm"],
										},
										{
											name: "Other (*.*)",
											extensions: ["*"],
										},
									],
								});
								if (res.canceled) return;
								const nonce = generateNonce();
								const file = res.filePaths[0];
								const info = fs.statSync(file);
								const data = {
									// id should be rand between 0 100
									files: [
										{
											file_size: info.size,
											filename: file
												.split("/")
												.map((f) => f.split("\\"))
												.flat()
												.at(-1),
											id: Math.floor(Math.random() * 100),
											is_clip: false,
										},
									],
								};
								setMessages([
									...messages,
									{
										id: nonce + nonce,
										content: "",
										attachments: data.files.map((f) => ({
											url: "#",
											filename: f.filename,
											id: f.id.toString(),
										})) as any,
										author: state.ready.user as any,
										channel_id: channelId || "",
										timestamp: new Date().toISOString(),
										edited_timestamp: null,
										mention_everyone: false,
										embeds: [],
										mentions: [],
										mention_roles: [],
										pinned: false,
										tts: false,
										type: 1,
										nonce,
									},
								]);
								const {
									attachments,
								}: {
									attachments: {
										id: string;
										upload_url: string;
										upload_filename: string;
									}[];
								} = await (
									await fetch(
										`https://discord.com/api/v9/channels/${channelId}/attachments`,
										{
											method: "POST",
											headers: {
												authorization: state?.token,
												"content-type": "application/json",
											},
											body: JSON.stringify(data),
										},
									)
								).json();
								const listOfAttachments: {
									filename: string;
									id: string;
									uploaded_filename: string;
								}[] = [];
								for await (const attachment of attachments) {
									await fetch(attachment.upload_url, {
										method: "PUT",
										headers: {
											"content-type": "application/octet-stream",
											authorization: state?.token,
										},
										body: fs.readFileSync(file),
									});
									listOfAttachments.push({
										filename: attachment.upload_filename,
										id: attachment.id,
										uploaded_filename: attachment.upload_filename,
									});
								}
								const msg = await (
									await fetch(
										`https://discord.com/api/v9/channels/${channelId}/messages`,
										{
											method: "POST",
											headers: {
												authorization: state?.token,
												"content-type": "application/json",
											},
											body: JSON.stringify({
												content: "",
												nonce,
												type: MessageType.Default,
												attachments: listOfAttachments,
											}),
										},
									)
								).json();
								setMessages((msgs) => {
									let newMsgs = [...msgs];
									newMsgs = newMsgs.filter((msg) => msg.nonce !== nonce);
									newMsgs.push(msg);
									return [...newMsgs];
								});
							}}
							className={styles.toolbarItem}
						>
							Attachment
						</div>
					</div>
				</div>
				<div className={styles.contentContainer}>
					{!guild ? (
						<div className={styles.pfpContainer}>
							<div className={styles.recepientPfp}>
								<PfpBorder
									pfp={getPfp(recepient?.user || guild)}
									variant="large"
									stateInitial={
										recepient?.user
											? (recepient?.presence?.status as any) ||
											  PresenceUpdateStatus.Offline
											: PresenceUpdateStatus.Idle
									}
									guild={!!guild}
								/>
							</div>
							<div className={styles.ownPfp}>
								<PfpBorder
									pfp={getPfp(state?.ready?.user)}
									variant="large"
									stateInitial={myPresence.status as any}
								/>
							</div>
						</div>
					) : (
						<div className={styles.channelsContainer}>
							<img src={lilGuy} className={styles.lilGuy} />
							<div className={styles.channels}>
								{channels
									.filter(
										(c) => c.properties.type === ChannelType.GuildCategory,
									)
									.map((cat) => (
										<Dropdown
											key={cat.properties.id}
											header={cat.properties.name
												.toLowerCase()
												.split(" ")
												.map(
													(word) =>
														word.charAt(0).toUpperCase() + word.slice(1),
												)
												.join(" ")}
										>
											{channels
												.filter(
													(c) =>
														(c.properties.type === ChannelType.GuildText ||
															c.properties.type ===
																ChannelType.GuildAnnouncement) &&
														c.properties.parent_id === cat.properties.id,
												)
												.map((c) => (
													<div
														onClick={() => setChannelId(c.properties.id)}
														key={c.properties.id}
														className={styles.channel}
													>
														#{c.properties.name}
													</div>
												))}
										</Dropdown>
									))}
							</div>
						</div>
					)}
					<div className={styles.messagingContainer}>
						<div className={styles.username}>
							{guild
								? `#${channel.name || "unknown-channel"} - ${
										"properties" in guild
											? guild.properties.name
											: guild.name || "Unknown Server"
								  }`
								: recepient?.user?.global_name || recepient?.user?.username}
							{guild ? (
								<div className={styles.topic}>
									{(channel as APITextChannel).topic}
								</div>
							) : null}
						</div>
						<div
							style={{
								marginTop: !guild ? 4 : !(channel as any).topic ? -20 : 8,
							}}
							className={styles.divider}
						/>
						<div ref={setMessageContainer} className={styles.messagesContainer}>
							{messages.length > 0 ? (
								messages.map((m, i) => (
									<div key={m.nonce} className={styles.messageGroup}>
										<div
											style={{
												display:
													messages[i - 1]?.author.id === m.author.id &&
													messages[i - 1]?.attachments.length === 0 &&
													new Date(m.timestamp).getTime() -
														new Date(messages[i - 1]?.timestamp).getTime() <=
														7 * 60 * 1000
														? "none"
														: undefined,
											}}
											className={styles.messageUsername}
										>
											{m.author.global_name || m.author.username} says
											{m.referenced_message
												? ` (in reply to ${
														m.referenced_message.author.global_name ||
														m.referenced_message.author.username
												  }'s message '${m.referenced_message.content}')`
												: ""}{" "}
											{`(${new Date(m.timestamp)
												.toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit",
													hour12: true,
												})
												.toUpperCase()})`}
											:
										</div>
										<div className={styles.messageContainer}>
											<span
												style={{ opacity: m.id.length > 26 ? 0.5 : 1 }}
												contentEditable
												suppressContentEditableWarning // the user shouldn't be able to edit the message, we only want the caret
												onKeyDown={(e) => {
													if (e.metaKey || e.ctrlKey) return;
													e.preventDefault();
												}}
												spellCheck={false}
												className={styles.message}
											>
												{parseMessage(m, [
													{
														pattern:
															/(<|)(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/g,
														replacement(match) {
															// remove < and > from the match at the beginning and end if they exist
															return (
																<a
																	href="#"
																	onClick={(e) => {
																		e.preventDefault();
																		e.stopPropagation();
																		remote
																			.require("electron")
																			.shell.openExternal(match[0]);
																	}}
																>
																	{match[0].replace(/^(<)|(>)$/g, "")}
																</a>
															);
														},
													},
													{
														pattern: /<(a|):.+?:\d+>/gm,
														replacement(match) {
															const { name, url } = parseEmoji(match[0]);
															return (
																<img
																	style={{
																		width: 20,
																		height: 20,
																	}}
																	src={url}
																	alt={name}
																/>
															);
														},
													},
												])}
											</span>
										</div>
									</div>
								))
							) : (
								<img src={speen} className={styles.speen} />
							)}
						</div>
						{typing.length !== 0 && (
							<div className={styles.typing}>
								<img src={typingIcon} />
								{generateTyping(...typing.map((t) => t.name))}
							</div>
						)}
						<div className={styles.inputWidgets}>
							<div
								className={styles.divider}
								style={{
									transform: "rotate(180deg)",
									marginTop: 4,
									marginBottom: 2,
								}}
							/>
							<textarea
								disabled={canSendChannel ? true : false}
								style={{
									border: canSendChannel ? "solid thin #a9b6bb" : undefined,
									fontStyle: canSendChannel ? "italic" : undefined,
									backgroundColor: canSendChannel ? "#e6ede9" : undefined,
									fontSize: canSendChannel ? 12 : undefined,
									paddingTop: canSendChannel ? 5 : undefined,
								}}
								placeholder={
									canSendChannel ? "You can't chat here." : undefined
								}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										// setMessages([
										// 	...messages,
										// 	{
										// 		from: liveState,
										// 		message: e.currentTarget.value,
										// 		id: v4(),
										// 	},
										// ]);
										sendMessage(e.currentTarget.value);
										e.currentTarget.value = "";
									}
								}}
								spellCheck={false}
								className={styles.messageBox}
							></textarea>

							<div className={styles.inputToolbar}>
								{/* <ImageButton
									className="emoji-button"
									onClick={() => {
										setEmoji((emoji) => !emoji);
									}}
									image={images.find((i) => i.includes("smile.png")) || ""}
								/>
								<ImageButton
									onClick={() => {
										win?.broadcast("send-websocket", "MESSAGE", {
											messageType: MessageType.NUDGE_REQUEST,
											to: user.id,
										} as ClientMessage);
									}}
									image={`${
										import.meta.env.BASE_URL
									}ui/wlm/icons/messenger/nudge.png`}
								/>
								<ImageButton
									className="emoji-button"
									onClick={() => {
										setDrawing((drawing) => !drawing);
									}}
									image={images.find((i) => i.includes("wlm.png")) || ""}
								/> */}
							</div>
						</div>
						{/* <div
							ref={emoticonRef}
							className={styles.emoticons}
							style={{
								pointerEvents: emoji ? "all" : "none",
								opacity: emoji ? 1 : 0,
							}}
						>
							{images.map((i) => (
								<ImageButton
									key={i}
									onClick={() => {
										if (!messageBoxRef.current) return;
										const emoticon = `:${i
											.split("/")
											.at(-1)
											?.replace(".png", "")}:`;
										if (
											messageBoxRef.current.value.endsWith(" ") ||
											messageBoxRef.current.value.length === 0
										) {
											messageBoxRef.current.value += `${emoticon} `;
										} else {
											messageBoxRef.current.value += ` ${emoticon} `;
										}
										messageBoxRef.current.focus();
										setEmoji(false);
									}}
									image={i}
								/>
							))}
						</div> */}
					</div>
				</div>
			</div>
			<div className={styles.backgroundContainer}>
				<div className={styles.backgroundImage} />
				<div className={styles.background} />
			</div>
		</div>
	);
}

export default MessagePage;
