import styles from "@renderer/css/components/Notification.module.css";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
const { getCurrentWindow } = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");

function Notification() {
	// get url params title and img
	const [params] = useSearchParams();
	const notificationContainerRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const steps = 10;
		const initialOpacity = 0;
		const finalOpacity = 1;

		let opacity = initialOpacity;

		const opacityStep = (finalOpacity - initialOpacity) / steps;

		const window = getCurrentWindow();
		const [x, y] = window.getPosition();
		const offset = 100;
		window.setPosition(x, y + offset);
		const timeToEnter = 1000;
		const timeToWait = 5000;
		const timeToLeave = 1000;
		const stepTime = timeToEnter / steps;
		const interval = setInterval(() => {
			const [x, y] = window.getPosition();
			const step = (offset / steps) * -1;
			window.setPosition(x, y + step);
			opacity += opacityStep;
			notificationContainerRef.current!.style.opacity = opacity.toString();
		}, stepTime);
		setTimeout(() => {
			clearInterval(interval);
		}, timeToEnter);
		setTimeout(() => {
			setInterval(() => {
				const [x, y] = window.getPosition();
				const step = offset / steps;
				window.setPosition(x, y + step);
				opacity -= opacityStep;
				notificationContainerRef.current!.style.opacity = opacity.toString();
			}, stepTime);
			setTimeout(() => {
				window.close();
			}, timeToLeave);
		}, timeToWait);
		return () => window.close(); // well we can't exactly clean up here can we??
	}, []);
	return (
		<div
			className={styles.notificationContainer}
			ref={notificationContainerRef}
			style={{
				opacity: 0,
			}}
		>
			<div className={styles.notification}>
				<div className={styles.pseudoTitlebar}>
					<img
						className={styles.notificationIcon}
						// src={`${import.meta.env.BASE_URL}icons/window/msn.png`}
						src={params.get("img") || ""}
					/>
					<div className={styles.notificationTitle}>Windows Live Messenger</div>
					<div className={styles.notificationClose} />
				</div>
				<div className={styles.notificationContentContainer}>
					<div className={styles.notificationContent}>
						{params.get("title")}
					</div>
				</div>
			</div>
		</div>
	);
}

export default Notification;
