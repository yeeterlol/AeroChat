import styles from "@renderer/css/pages/Home.module.css";
import { getActivityText } from "@renderer/util";
import PfpBorder from "@renderer/components/PfpBorder";
import { APIUser, PresenceUpdateStatus } from "discord-api-types/v9";
import defaultPfp from "@renderer/assets/login/sample-pfp.png";
import { Friend, GuildPresence } from "../../../shared/types";
import { User } from "@renderer/classes/DiscordUtil";
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
	const user = new User(props.user);
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
				pfp={user.getPfp(32)}
				variant="small"
				stateInitial={props?.status?.status as unknown as PresenceUpdateStatus}
				guild={props.guild || props.groupchat}
			/>
			<div className={styles.contactInfo}>
				<div className={styles.contactUsername}>{user.username}</div>
				<div className={styles.contactStatus}>
					{getActivityText(props.status.activities)}
				</div>
			</div>
		</div>
	);
}
