import styles from "@renderer/css/components/CommandLink.module.css";

export default function CommandLink(props: {
	title: string;
	description?: string;
	onClick?: () => void;
}) {
	return (
		<div className={styles.commandLink} onClick={props.onClick}>
			<div className={styles.commandLinkIcon} />
			<div className={styles.commandLinkText}>
				<h1 className={styles.commandLinkTitle}>{props.title}</h1>
				<div className={styles.commandLinkDescription}>{props.description}</div>
			</div>
		</div>
	);
}
