import { DiscordUtil } from "@renderer/classes/DiscordUtil";
import styles from "@renderer/css/pages/Customize.module.css";
import {
	Context,
	getColorFromScene,
	getSceneFromColor,
	joinClasses,
} from "@renderer/util";
import { useContext, useEffect, useState } from "react";

function Customize() {
	const { state } = useContext(Context);
	const [applying, setApplying] = useState<boolean>(false);
	const [selected, setSelected] = useState<number>(0);
	const [scenes, setScenes] = useState<{ [key: string]: string }>({});
	useEffect(() => {
		(async () => {
			const scene = await getSceneFromColor(
				state?.ready?.user?.accent_color?.toString(16) || "",
			);
			if (scene) {
				setSelected(Object.keys(scenes).indexOf(scene));
			}
		})();
	}, [scenes]);
	useEffect(() => {
		const fetchScenes = async () => {
			const glob = import.meta.glob("@renderer/assets/scenes/*.png");
			const map: { [key: string]: string } = {};
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
							{Object.entries(scenes).map(([name, src], i) => (
								<div
									onMouseDown={async () => {
										setSelected(i);
									}}
									className={joinClasses(
										styles.sceneContainer,
										selected === i ? styles.selected : "",
									)}
									key={name}
								>
									<img
										className={styles.scene}
										src={src}
										alt={name}
										width="96"
										height="48"
									/>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
			<div className={styles.bottomContainer}>
				<div className={styles.divider} />
				<button
					disabled={applying}
					onClick={async () => {
						const scenePath = Object.keys(scenes)[selected];
						const color = getColorFromScene(scenePath);
						if (
							color?.includes(
								state?.ready?.user?.accent_color?.toString(16) || "",
							)
						)
							return window.close();

						if (color) {
							setApplying(true);
							await DiscordUtil.setScene(color);
							setApplying(false);
						}
						window.close();
					}}
				>
					OK
				</button>
				<button disabled={applying} onClick={() => window.close()}>
					Close
				</button>
				<button
					disabled={applying}
					onClick={async () => {
						const scenePath = Object.keys(scenes)[selected];
						const color = getColorFromScene(scenePath);
						if (
							color?.includes(
								state?.ready?.user?.accent_color?.toString(16) || "",
							)
						)
							return;
						if (color) {
							setApplying(true);
							await DiscordUtil.setScene(color);
							setApplying(false);
						}
					}}
				>
					Apply
				</button>
			</div>
		</div>
	);
}

export default Customize;
