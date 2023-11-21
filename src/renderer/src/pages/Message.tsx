import PfpBorder from "@renderer/components/PfpBorder";
import styles from "@renderer/css/pages/Message.module.css";
import { Context, apiReq } from "@renderer/util";
import React, { useContext, useEffect, useRef, useState } from "react";
import defaultPfp from "@renderer/assets/login/sample-pfp.png";
import {
	APIUser,
	APIMessage,
	GatewayDispatchEvents,
	APIChannel,
	APITextChannel,
	APIDMChannel,
	ChannelType,
	APIGuild,
	PresenceUpdateStatus,
} from "discord-api-types/v9";
import { useSearchParams } from "react-router-dom";
import ScrollToBottom from "react-scroll-to-bottom";
import { v4 } from "uuid";
import { addDispatchListener, removeGatewayListener } from "@renderer/util/ipc";
import { Guild } from "../../../shared/types";

function generateNonce() {
	let result = "";
	const characters = "0123456789";
	const charactersLength = characters.length;

	for (let i = 0; i < 25; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}

	return result;
}

function getPfp(user: APIUser | APIGuild | Guild | undefined) {
	if (!user) return defaultPfp;
	console.log(user);
	if ("icon" in user) {
		console.log(user);
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
	const name = emoji.split(":")[1];
	const url = `https://cdn.discordapp.com/emojis/${emoji
		.split(":")[2]
		.replace(">", "")}.png`;
	return { name, url };
}

function parseMessage(msg: string): React.ReactNode {
	const tokens: (string | React.ReactNode)[] = [];
	// split the message into tokens, wherever we match /<:.+?:\d+>/gm
	let match;
	let lastIndex = 0;
	const regex = /<:.+?:\d+>/gm;
	while ((match = regex.exec(msg)) !== null) {
		const [fullMatch] = match;
		const { name, url } = parseEmoji(fullMatch);
		tokens.push(msg.slice(lastIndex, match.index));
		tokens.push(<img src={url} alt={name} />);
		lastIndex = match.index + fullMatch.length;
	}
	tokens.push(msg.slice(lastIndex));
	return tokens;
}

function MessagePage() {
	const [messageContainer, setMessageContainer] =
		useState<HTMLDivElement | null>();
	const [params] = useSearchParams();
	const channelId = params.get("channelId");
	const [channel, setChannel] = useState<APITextChannel | APIDMChannel>();
	const { state } = useContext(Context);
	const [messages, setMessages] = useState<APIMessage[]>([]);
	async function fetchMessages() {
		if (!channelId) return;
		const messages = (
			await apiReq(`/channels/${channelId}/messages`, "GET", state?.token || "")
		).body as APIMessage[];
		setMessages(messages.reverse());
		if (!messageContainer) return;
		console.log(messageContainer.scrollHeight, messageContainer.scrollTop);
	}
	async function fetchChannel() {
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
	useEffect(() => {
		fetchMessages();
		fetchChannel();
	}, []);
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
		console.log(messages);
	}, [messages]);
	useEffect(() => {
		const id = addDispatchListener(GatewayDispatchEvents.MessageCreate, (d) => {
			if (d.channel_id !== channelId || d.author.id === state?.ready?.user?.id)
				return;
			setMessages([...messages, d]);
		});
		return () => {
			removeGatewayListener(id);
		};
	}, [channelId, messages]);
	// if (!userId || !recepient.user || !recepient.presence) return <></>;
	const [guild, setGuild] = useState<APIGuild | Guild | undefined>();
	useEffect(() => {
		setGuild(
			channel?.type === ChannelType.GuildText
				? state?.ready?.guilds.find((g) => g.id === channel.guild_id)
				: undefined,
		);
		const guild =
			channel?.type === ChannelType.GuildText
				? state?.ready?.guilds.find((g) => g.id === channel.guild_id)
				: undefined;
		(async () => {
			if (!guild) return;
			const req = await apiReq(
				`/guilds/${guild.id}`,
				"GET",
				state?.token || "",
			);
			const res = req.body as APIGuild;
			setGuild(res);
		})();
	}, [channel]);
	if (!channel) return <></>;
	const recepient =
		channel.type === ChannelType.DM
			? {
					user: state?.ready?.users.find(
						(u) => u.id === channel?.recipients?.[0].id,
					),
					presence: state?.ready?.merged_presences?.friends.find(
						(f) => f.user_id === channel?.recipients?.[0].id,
					),
			  }
			: undefined;
	const myPresence = state?.ready?.sessions[0];
	return (
		<div className={styles.window}>
			<div className={styles.content}>
				<div className={styles.toolbarContainer}>
					<div className={styles.toolbar} />
				</div>
				<div className={styles.contentContainer}>
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
								guild
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
					<div className={styles.messagingContainer}>
						<div className={styles.username}>
							{guild
								? `#${channel.name || "unknown-channel"} - ${
										"properties" in guild
											? guild.properties.name
											: guild.name || "Unknown Server"
								  }`
								: recepient?.user?.global_name || recepient?.user?.username}
						</div>
						<div
							style={{
								marginTop: 12,
							}}
							className={styles.divider}
						/>
						<div ref={setMessageContainer} className={styles.messagesContainer}>
							{messages.map((m, i) => (
								<div key={m.nonce} className={styles.messageGroup}>
									<div
										style={{
											display:
												messages[i - 1]?.author.id === m.author.id
													? "none"
													: undefined,
										}}
										className={styles.messageUsername}
									>
										{m.author.global_name || m.author.username} said:
									</div>
									<div className={styles.messageContainer}>
										<span
											style={{
												opacity: m.id.length > 25 ? 0.5 : 1,
											}}
											contentEditable
											suppressContentEditableWarning // the user shouldn't be able to edit the message, we only want the caret
											onKeyDown={(e) => {
												if (e.metaKey || e.ctrlKey) return;
												e.preventDefault();
											}}
											spellCheck={false}
											className={styles.message}
										>
											{parseMessage(m.content)}
										</span>
									</div>
									{/* {(() => {
										const potentialUsername = (() => {
											const msg = (
												<div className={styles.messageUsername}>
													{liveState.connections.find((c) => c.id === m.from)
														?.username || liveState.username}{" "}
													said:
												</div>
											);
											if (i === 0) return msg;
											if (messages.at(i - 1)!.from !== m.from) return msg;
											if (messages.at(i - 1)!.messageType !== m.messageType)
												return msg;
											return <></>;
										})();
										switch (m.messageType) {
											case MessageType.TEXT_MESSAGE_SERVER:
												return (

												);
											case MessageType.ERROR: {
												return (
													<div className={styles.error}>
														<img src={error} />
														<div className={styles.errorText}>{m.message}</div>
													</div>
												);
											}
											case MessageType.NUDGE_RESPONSE: {
												return (
													<div className={styles.nudge}>
														{messages.at(i - 1)?.messageType !==
															MessageType.NUDGE_RESPONSE && (
															<div className={styles.nudgeDivider} />
														)}
														<div>
															{m.from === liveState.id
																? "You have just sent a nudge."
																: `${user.username} just sent you a nudge.`}
														</div>
														<div className={styles.nudgeDivider} />
													</div>
												);
											}
											case MessageType.IMAGE_RESPONSE: {
												return (
													<div className={styles.imageContainer}>
														{potentialUsername}
														<img src={m.image} />
													</div>
												);
											}
										}
									})()} */}
								</div>
							))}
						</div>
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
						{/* {otherTyping && (
							<div className={styles.typing}>
								<img src={typing} />
								<div>
									<span style={{ fontWeight: "bold" }}>{user.username}</span> is
									typing...
								</div>
							</div>
						)} */}
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
