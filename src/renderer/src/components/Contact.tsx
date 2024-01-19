import styles from "@renderer/css/pages/Home.module.css";
import { getActivityText } from "@renderer/util";
import PfpBorder from "@renderer/components/PfpBorder";
import { APIUser, PresenceUpdateStatus } from "discord-api-types/v9";
import defaultPfp from "@renderer/assets/login/sample-pfp.png";
import { Friend, GuildPresence } from "../../../shared/types";
import Username from "./Username";
const remote = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");
const Store = remote.require(
	"electron-store",
) as typeof import("electron-store");

export default function Contact(
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
	const bio = ((props.user as any)?.bio as string) || "";
	const zwsps = bio.match(/^[\u200B]+/)?.[0] || [];
	const effect = zwsps.length;
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
					<Username
						effect={effect}
						color="black"
						fontSize={12}
						username={props.user.global_name || props.user.username}
					/>
				</div>
				<div className={styles.contactStatus}>
					{getActivityText(props.status.activities)}
				</div>
			</div>
		</div>
	);
}
