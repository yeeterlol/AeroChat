import styles from "@renderer/css/pages/Home.module.css";
import { useState } from "react";

export default function Dropdown({
	color,
	header,
	children,
	info,
}: {
	color?: string;
	header: string;
	children: React.ReactNode;
	info?: string;
}) {
	const [open, setOpen] = useState(false);
	return (
		<div className={styles.dropdown}>
			<div className={styles.dropdownHeader} onClick={() => setOpen(!open)}>
				<div className={styles.dropdownArrow} data-toggled={open} />
				<h1 style={{ color }}>
					{header} <span className={styles.dropdownInfo}>{info}</span>
				</h1>
			</div>
			<div className={styles.dropdownContent} data-toggled={open}>
				{children}
			</div>
		</div>
	);
}
