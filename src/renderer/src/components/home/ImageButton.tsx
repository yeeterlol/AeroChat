import { useState, useEffect } from "react";
import styles from "@renderer/css/pages/Home.module.css";

export default function ImageButton({
	onClick,
	className,
	type,
}: {
	onClick?: () => void;
	className?: string;
	type: string;
}) {
	const [img, setImg] = useState("");
	useEffect(() => {
		(async () => {
			const imgs = import.meta.glob("../../assets/home/icons/*.png", {
				eager: true,
			});
			console.log(imgs);
			const img = Object.entries(imgs).find(([key, val]) =>
				key
					.split(".")
					.slice(0, key.split(".").length - 1)
					.join(".")
					.endsWith(type),
			)?.[1] as { default: string };
			setImg(img.default);
		})();
	}, [type]);
	return (
		<div
			onClick={onClick}
			className={`${styles.imageButton} ${className || ""}`}
		>
			<img src={img} />
		</div>
	);
}
