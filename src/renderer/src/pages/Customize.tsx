import styles from "@renderer/css/pages/Customize.module.css";
import { useEffect, useState } from "react";

enum SendState {
	Unsent,
	Sending,
	Sent,
	Captcha,
}

function Customize() {
	const [scenes, setScenes] = useState<{ [key: string]: string }>({});
	useEffect(() => {
		const fetchScenes = async () => {
			const glob = import.meta.glob("@renderer/assets/scenes/*.png");
			const map: { [key: string]: string } = {};
			// sort by filename (key)
			const keys = Object.keys(glob).sort();
			for (const key of keys) {
				map[key] = ((await glob[key]()) as { default: string }).default;
			}
			setScenes(map);
		};
		fetchScenes();
	}, []);
	return (
		<div className={styles.window}>
			<div>
				<div className={styles.contents}>
					<p className={styles.disclaimer}>
						The people you chat with will see the scene and color scheme you
						choose.
					</p>
					<div>
						<h1>Select a scene</h1>
						<div className={styles.grid}>
							{Object.entries(scenes).map(([name, src]) => (
								<img
									className={styles.scene}
									src={src}
									alt={name}
									width="96"
									height="48"
								/>
							))}
						</div>
					</div>
				</div>
			</div>
			<div className={styles.bottomContainer}>
				<div className={styles.divider} />
				<button>OK</button>
				<button onClick={() => window.close()}>Close</button>
				<button>Apply</button>
			</div>
		</div>
	);
}

export default Customize;
