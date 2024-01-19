import { DiscordUtil } from "@renderer/classes/DiscordUtil";
import styles from "@renderer/css/pages/Customize.module.css";
import {
	Context,
	Effect,
	getColorFromScene,
	getSceneFromColor,
	joinClasses,
} from "@renderer/util";
import { useContext, useEffect, useState } from "react";
import Dropdown from "@renderer/components/Dropdown";
const remote = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");

function Customize() {
	const { state } = useContext(Context);
	const [applying, setApplying] = useState<boolean>(false);
	const [selected, setSelected] = useState<string>("");
	const [scenes, setScenes] = useState<{
		[key: string]: { images: { [key: string]: string } };
	}>({});
	useEffect(() => {
		(async () => {
			const scene = await getSceneFromColor(
				state?.user?.properties.accent_color?.toString(16) || "",
			);
			if (scene) {
				const color = getColorFromScene(scene);
				color && setSelected(color);
			}
		})();
	}, [scenes]);
	useEffect(() => {
		const fetchScenes = async () => {
			const glob = import.meta.glob("@renderer/assets/scenes/**/*.png", {
				eager: true,
			});
			const map: { [key: string]: string } = {};
			const keys = Object.keys(glob).sort();
			for (const key of keys) {
				map[key] = ((await glob[key]) as { default: string }).default;
			}
			// get the name of the scene from the folder its in (ie .split("/").at(-2))
			const scenes = Object.keys(map).reduce(
				(acc, key) => {
					const folder = key.split("/").at(-2);
					if (!folder) return acc;
					if (!acc[folder]) acc[folder] = { title: folder, images: {} };
					acc[folder].images[key] = map[key];
					return acc;
				},
				{} as {
					[key: string]: { title: string; images: { [key: string]: string } };
				},
			);
			setScenes(scenes);
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
					</div>
				</div>
				<div className={styles.scenesContainer}>
					{Object.entries(scenes).map(([header, img], n) => (
						<Dropdown header={header} key={n}>
							<div className={styles.grid}>
								{Object.entries(img.images).map(([key, value], i) => (
									<div
										onMouseDown={async () => {
											setSelected(value);
											console.log(value);
										}}
										className={joinClasses(
											styles.sceneContainer,
											selected === value ? styles.selected : "",
										)}
										key={key}
									>
										<img
											className={styles.scene}
											src={value}
											alt={key}
											width="96"
											height="48"
										/>
									</div>
								))}
							</div>
						</Dropdown>
					))}
				</div>
				<div
					style={{
						display: "flex",
						position: "absolute",
						bottom: 48,
						left: 4,
						gap: 8,
						alignItems: "center",
					}}
				>
					<div>select username effect (will auto apply, dont spam!!)</div>
					<select
						onChange={(e) => {
							const zwsp = "​"; // there is a zero width space here
							const effect = Effect[e.target.value as keyof typeof Effect];
							const zwsps = zwsp.repeat(effect);
							let bio = (state?.user?.properties as any)?.bio as string;
							console.log(state.user);
							if (!bio) bio = "";
							// remove all zwsp
							bio = bio.replaceAll(zwsp, "");
							// push zwsps to beginning of bio
							bio = zwsps + bio;
							// set bio
							DiscordUtil.patchProfile({ bio });
						}}
						name="effect"
						id="effect"
					>
						{Object.values(Effect)
							.filter((e) => !Number.isSafeInteger(e))
							.map((effect, i) => (
								<option key={i} value={effect}>
									{effect}
								</option>
							))}
					</select>
				</div>
			</div>
			<div className={styles.bottomContainer}>
				<div className={styles.divider} />
				<button
					disabled={applying}
					onClick={async () => {
						const color = getColorFromScene(selected);
						if (
							color?.includes(
								state?.user?.properties.accent_color?.toString(16) || "",
							)
						)
							return window.close();

						if (color) {
							setApplying(true);
							await DiscordUtil.setScene(color);
							setApplying(false);
						}
						remote.dialog.showMessageBoxSync({
							title: "Success",
							message:
								"Your settings have been applied. You may need to restart the app.",
							type: "info",
						});
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
						console.log(selected);
						const color = getColorFromScene(selected) || "#e9f1f5";
						setApplying(true);

						if (
							!color?.includes(
								state?.user?.properties.accent_color?.toString(16) || "",
							) &&
							color
						) {
							await DiscordUtil.setScene(color);
						}
						// if (pfp) {
						// 	const res = await DiscordUtil.setProfilePicture(
						// 		pfps?.[pfp] || "",
						// 	);
						// 	if ((res as any).code === 50035) {
						// 		alert(
						// 			"An error occurred while setting your profile picture. You may not have Nitro, or you may be setting it too frequently.",
						// 		);
						// 	}
						// }
						setApplying(false);
						remote.dialog.showMessageBoxSync({
							title: "Success",
							message:
								"Your settings have been applied. You may need to restart the app.",
							type: "info",
						});
					}}
				>
					Apply
				</button>
			</div>
		</div>
	);
}

export default Customize;
