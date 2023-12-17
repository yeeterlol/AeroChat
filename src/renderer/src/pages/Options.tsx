import { keyMap } from "@renderer/App";
import styles from "@renderer/css/pages/Options.module.css";
import { useEffect } from "react";
const Store = window.require(
	"electron-store",
) as typeof import("electron-store");

const store = new Store();

export default function Options() {
	return (
		<div className={styles.container}>
			<h1>Debug</h1>
			<button
				onClick={(e) => {
					store.delete("seenNotifications");
				}}
			>
				Clear notification cache
			</button>
			<h1>Keyboard</h1>
			<div>
				Try pressing some keys on your keyboard; these should all light up.
			</div>
			<div className={styles.kbdContainer}>
				{Object.entries(keyMap).map(([key, value]) => (
					<kbd data-key={key}>{value}</kbd>
				))}
			</div>
		</div>
	);
}
