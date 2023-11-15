import { useRef, useState, useEffect } from "react";
import styles from "@renderer/css/components/PfpBorder.module.css";
import { PresenceUpdateStatus } from "discord-api-types/v9";
import defaultBorderStatic from "@renderer/assets/borders/default/active-static.png";
import defaultBorderAnimatedFrom from "@renderer/assets/borders/default/active-animated-from.png";
import defaultBorderAnimatedTo from "@renderer/assets/borders/default/active-animated-to.png";

function getStateFromPresence(presence: PresenceUpdateStatus) {
	switch (presence) {
		case PresenceUpdateStatus.DoNotDisturb:
			return "dnd";
		case PresenceUpdateStatus.Idle:
			return "idle";
		case PresenceUpdateStatus.Invisible || PresenceUpdateStatus.Offline:
			return "invisible";
		default:
			return "active";
	}
}

export default function PfpBorder({
	pfp,
	win,
	stateInitial = PresenceUpdateStatus.Online,
	variant = "default",
}: {
	pfp: string;
	win?: Window;
	stateInitial?: PresenceUpdateStatus;
	variant?: "default" | "small" | "large";
}) {
	let state = getStateFromPresence(stateInitial);
	const containerRef = useRef<HTMLDivElement>(null);
	const [src, setSrc] = useState(defaultBorderStatic);
	const [prevActivity, setPrevActivity] = useState("active");
	const [borderDummy1, setBorderDummy1] = useState(defaultBorderAnimatedFrom);
	const [borderDummy2, setBorderDummy2] = useState(defaultBorderAnimatedTo);

	const [borderRef, borderDummy1Ref, borderDummy2Ref] = [
		useRef<HTMLImageElement>(null),
		useRef<HTMLImageElement>(null),
		useRef<HTMLImageElement>(null),
	];

	useEffect(() => {
		state = getStateFromPresence(stateInitial);
		(async () => {
			setBorderDummy1(
				(
					await import(
						`../assets/borders/${variant}/${
							state || "active"
						}-animated-from.png`
					)
				).default,
			);
			setBorderDummy2(
				(
					await import(
						`../assets/borders/${variant}/${state || "active"}-animated-to.png`
					)
				).default,
			);
			setSrc(
				(
					await import(
						`../assets/borders/${variant}/${state || "active"}-static.png`
					)
				).default,
			);
		})();
		const [border, borderDummy1, borderDummy2] = [
			borderRef.current!,
			borderDummy1Ref.current!,
			borderDummy2Ref.current!,
		] as HTMLImageElement[];

		if (!containerRef.current) return;
		// eslint-disable-next-line react-hooks/exhaustive-deps
		if (state !== prevActivity) {
			setPrevActivity(state);
			(async () => {
				if (!containerRef.current) return;
				const sleep = (ms: number) =>
					new Promise((resolve) => setTimeout(resolve, ms));
				if (state === "invisible") {
					containerRef.current.style.opacity = "0.5";
					// setSrc(
					// 	await importDefault(
					// 		`../assets/borders/${variant}/invisible-static.png`,
					// 	),
					// );
					setSrc(
						(await import(`../assets/borders/${variant}/invisible-static.png`))
							.default,
					);
					return;
				} else {
					containerRef.current.style.opacity = "1";
					border.style.opacity = "0";
					borderDummy1.style.opacity = "1";
					borderDummy2.style.opacity = "0";
					if (prevActivity === "invisible") {
						// setBorderDummy1(
						// 	await importDefault(
						// 		`../assets/borders/${variant}/${
						// 			state || "active"
						// 		}-animated-from.png`,
						// 	),
						// );
						// setBorderDummy2(
						// 	await importDefault(
						// 		`../assets/borders/${variant}/${
						// 			state || "active"
						// 		}-animated-to.png`,
						// 	),
						// );
						setBorderDummy1(
							(
								await import(
									`../assets/borders/${variant}/${
										state || "active"
									}-animated-from.png`
								)
							).default,
						);
						setBorderDummy2(
							(
								await import(
									`../assets/borders/${variant}/${
										state || "active"
									}-animated-to.png`
								)
							).default,
						);
					} else {
						setBorderDummy1(
							(
								await import(
									`../assets/borders/${variant}/${
										prevActivity || "active"
									}-animated-from.png`
								)
							).default,
						);
					}
					await sleep(550);
					borderDummy1.animate(
						[
							{
								opacity: "1",
							},
							{
								opacity: "0",
							},
						],
						{
							easing: "linear",
							duration: 250,
						},
					);
					setTimeout(() => (borderDummy1.style.opacity = "0"), 250);
					borderDummy2.style.opacity = "1";
					// setBorderDummy2(
					// 	await importDefault(
					// 		`../assets/borders/${variant}/${state}-animated-to.png`,
					// 	),
					// );
					setBorderDummy2(
						(
							await import(
								`../assets/borders/${variant}/${state}-animated-to.png`
							)
						).default,
					);
					await sleep(730);
					borderDummy1.style.opacity = "0";
					borderDummy2.style.opacity = "0";
					border.style.opacity = "1";
					// setSrc(
					// 	await importDefault(
					// 		`../assets/borders/${variant}/${state}-static.png`,
					// 	),
					// );
					setSrc(
						(await import(`../assets/borders/${variant}/${state}-static.png`))
							.default,
					);
				}
			})();
		}
	}, [borderDummy1Ref, borderDummy2Ref, borderRef, prevActivity, win, state]);
	useEffect(() => {
		// preload images
		const cache = document.createElement("CACHE");
		cache.style.position = "absolute";
		cache.style.zIndex = "-1000";
		cache.style.opacity = "0";
		document.body.appendChild(cache);
		function preloadImage(url: string) {
			const img = new Image();
			img.src = url;
			img.style.position = "absolute";
			cache.appendChild(img);
		}
		["active", "dnd", "idle"].forEach(async (state) => {
			preloadImage(
				// await importDefault(`../assets/borders/${variant}/${state}-static.png`),
				(await import(`../assets/borders/${variant}/${state}-static.png`))
					.default,
			);
			preloadImage(
				// await importDefault(
				// 	`../assets/borders/${variant}/${state}-animated-from.png`,
				// ),
				(
					await import(
						`../assets/borders/${variant}/${state}-animated-from.png`
					)
				).default,
			);
			preloadImage(
				// await importDefault(
				// 	`../assets/borders/${variant}/${state}-animated-to.png`,
				// ),
				(await import(`../assets/borders/${variant}/${state}-animated-to.png`))
					.default,
			);
		});
		return () => {
			document.body.removeChild(cache);
		};
	}, [variant]);
	function getImageStyle(): React.CSSProperties {
		switch (variant) {
			case "default":
				return { width: 46, left: 19, top: 14 };
			case "small":
				return {
					width: 22,
					top: 11,
					left: 12,
				};
			case "large":
				return {
					width: 94,
					left: 25,
					top: 19,
				};
		}
	}
	return (
		<div
			data-state={stateInitial}
			ref={containerRef}
			className={styles.pfpBorder}
		>
			<img ref={borderRef} src={src.replace("/@fs", "")} id="border" />
			<img
				ref={borderDummy2Ref}
				src={borderDummy2.replace("/@fs", "")}
				id="borderDummy2"
				className={styles.borderDummy2}
			/>
			<img
				ref={borderDummy1Ref}
				src={borderDummy1.replace("/@fs", "")}
				id="borderDummy1"
				className={styles.borderDummy1}
			/>
			<img style={getImageStyle()} src={pfp} className={styles.pfp} />
		</div>
	);
}
