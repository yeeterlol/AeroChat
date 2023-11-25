import PfpBorder from "@renderer/components/PfpBorder";
import styles from "@renderer/css/pages/ContactCard.module.css";
import { Context, apiReq, getActivityText } from "@renderer/util";
import { APIDMChannel, APIUser, ChannelType } from "discord-api-types/v9";
import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Friend, GuildPresence } from "../../../shared/types";
import { createWindow } from "@renderer/util/ipc";
const remote = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");
import speen from "@renderer/assets/login/speen.png";
import defaultPfp from "@renderer/assets/login/sample-pfp.png";

export interface Profile {
	user: APIUser;
	connected_accounts: any[];
	premium_since: null;
	premium_type: null;
	premium_guild_since: Date;
	profile_themes_experiment_bucket: number;
	user_profile: UserProfile;
	badges: Badge[];
	guild_badges: any[];
	mutual_guilds: MutualGuild[];
	legacy_username: string;
}

export interface Badge {
	id: string;
	description: string;
	icon: string;
	link?: string;
}

export interface MutualGuild {
	id: string;
	nick: null;
}

export interface UserProfile {
	bio: string;
	accent_color: null;
	pronouns: string;
}

function ContactCard() {
	const [params] = useSearchParams();
	const { state } = useContext(Context);
	const user = JSON.parse(params.get("user")!) as APIUser;
	const x = parseInt(params.get("x") || "0");
	const y = parseInt(params.get("y") || "0");
	const [profile, setProfile] = useState<Partial<Profile> & { user: APIUser }>({
		user,
	} as any);
	const [status, setStatus] = useState<GuildPresence | Friend>();
	useEffect(() => {
		if (!state) return;
		if (user.id === state.ready.user.id)
			return setStatus(
				state.ready.sessions.find((s) => s.active) ||
					(state.ready.sessions[0] as any),
			);
		setStatus(
			(state?.ready?.merged_presences?.friends?.find(
				(m) => m.user_id === user.id,
			) as any) ||
				state?.ready?.merged_presences.guilds
					.flat()
					.find((p) => p.user_id === user.id),
		);
	}, [state]);
	useEffect(() => {
		console.log(status);
	}, [status]);
	useEffect(() => {
		const win = remote.getCurrentWindow();
		win.hide();
		win.show();
		win.setOpacity(1);
	}, []);
	useEffect(() => {
		if (x !== 0 && y !== 0) {
			window.moveTo(x, y);
		}
		(async () => {
			const res = await fetch(
				`https://discord.com/api/v9/users/${user.id}/profile`,
				{
					headers: {
						authorization: state?.token,
					},
				},
			);
			const json = await res.json();
			setProfile(json);
		})();
	}, [params]);
	return (
		<div className={styles.contactCard}>
			<div className={styles.closeButton} onClick={() => window.close()} />
			<div className={styles.userInfo}>
				<PfpBorder
					pfp={
						profile.user.avatar
							? `https://cdn.discordapp.com/avatars/${profile.user.id}/${profile.user.avatar}.webp?size=80`
							: defaultPfp
					}
					stateInitial={status?.status || ("offline" as any)}
				/>
				<div className={styles.usernamePronouns}>
					<div className={styles.username}>
						{profile.user.global_name || profile.user.username}{" "}
						{profile.user_profile?.pronouns && (
							<span className={styles.pronouns}>
								({profile.user_profile.pronouns})
							</span>
						)}
					</div>
					<div className={styles.status}>
						{getActivityText(status?.activities)}
					</div>
				</div>
			</div>
			<div className={styles.divider} />
			<div className={styles.main}>
				{profile.connected_accounts ? (
					<div>
						<div className={styles.header}>Contact information</div>
						<div className={styles.bio}>{profile.user_profile?.bio}</div>
					</div>
				) : (
					<div className={styles.speenContainer}>
						<img src={speen} className={styles.speen} />
					</div>
				)}
			</div>
			<div className={styles.footer}>
				<a
					className={styles.link}
					href="#"
					onClick={async (e) => {
						e.preventDefault();
						e.stopPropagation();
						function openMessageWindow(id: string) {
							createWindow({
								customProps: {
									url: `/message?channelId=${id}`,
								},
								width: 550,
								height: 400,
								minWidth: 366,
								minHeight: 248,
								icon: remote.nativeImage.createFromPath(
									"resources/icon-chat.ico",
								),
							});
							window.close();
						}
						const data = profile.user;
						const dmChannels = state?.ready?.private_channels?.filter(
							(c) => c.type === ChannelType.DM,
						) as (APIDMChannel & {
							recipient_ids: string[];
						})[];
						const channel = dmChannels.find(
							(c) =>
								c.recipient_ids?.length === 1 && c.recipient_ids[0] === data.id,
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
					}}
				>
					Open chat
				</a>
			</div>
		</div>
	);
}

export default ContactCard;
