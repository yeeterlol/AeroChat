import styles from "@renderer/css/pages/DisplayPicture.module.css";
import PfpBorder from "@renderer/components/PfpBorder";
import defaultPfp from "@renderer/assets/login/sample-pfp.png";
import { useEffect, useState } from "react";
import { DiscordUtil } from "@renderer/classes/DiscordUtil";

function DisplayPicture() {
	const [pfps, setPfps] = useState<string[]>();
	const [pfp, setPfp] = useState<number>();
	const [applying, setApplying] = useState<boolean>(false);
	useEffect(() => {
		const fetchPfps = async () => {
			const glob = import.meta.glob("@renderer/assets/pfps/**/*.(png|gif)", {
				eager: true,
			});
			const vals = Object.values(glob).map(
				(v) => (v as { default: string }).default,
			);
			const toDataURL = (url: string): Promise<string | ArrayBuffer | null> =>
				fetch(url)
					.then((response) => response.blob())
					.then(
						(blob) =>
							new Promise((resolve, reject) => {
								const reader = new FileReader();
								reader.onloadend = () => resolve(reader.result);
								reader.onerror = reject;
								reader.readAsDataURL(blob);
							}),
					);
			const promises = vals.map((v) => toDataURL(v));
			const res = await Promise.all(promises);
			setPfps(res as string[]);
		};
		fetchPfps();
	}, []);
	return (
		<div className={styles.window}>
			<div className={styles.info}>
				<h1>Select a display picture</h1>
				<p>Choose how you want to appear in Messenger:</p>
			</div>
			<div className={styles.side}>
				<div className={styles.pictures}>
					<b>Regular pictures</b>
					<div
						className={styles.picturesGrid}
						style={{
							opacity: applying ? 0.5 : 1,
							pointerEvents: applying ? "none" : "all",
						}}
					>
						{pfps?.map((p, i) => (
							<div
								onMouseDown={() => setPfp(i)}
								key={p}
								className={`${styles.pfp} ${pfp === i ? styles.selected : ""}`}
							>
								<img src={p} />
							</div>
						))}
					</div>
				</div>
				<div className={styles.preview}>
					<PfpBorder
						variant="large"
						pfp={pfp ? pfps?.[pfp] || defaultPfp : defaultPfp}
						guild
					/>
				</div>
			</div>
			<div className={styles.bottomContainer}>
				<div className={styles.divider} />
				<button
					disabled={applying}
					onClick={async () => {
						if (pfp) {
							setApplying(true);
							const res = await DiscordUtil.setProfilePicture(
								pfps?.[pfp] || "",
							);
							if ((res as any).code === 50035) {
								setApplying(false);
								return alert(
									"An error occurred while setting your profile picture. You may not have Nitro, or you may be setting it too frequently.",
								);
							}
							window.close();
						}
					}}
				>
					OK
				</button>
				<button onClick={() => window.close()}>Cancel</button>
			</div>
		</div>
	);
}

export default DisplayPicture;
