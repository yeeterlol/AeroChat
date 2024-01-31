import { joinClasses } from "@renderer/util";
import { useState, useEffect } from "react";
import sanitizeHtml from "sanitize-html";
import semver from "semver";
import { HomeNotification } from "../../../../shared/types";
const Store = window.require(
	"electron-store",
) as typeof import("electron-store");
const remote = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");
import styles from "@renderer/css/pages/Home.module.css";

const store = new Store();

export default function Notification({
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
