import styles from "@renderer/css/pages/Home.module.css";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ContextMenuItem } from "src/shared/types";
const { getCurrentWindow, BrowserWindow } = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");
const { ipcRenderer } = require("electron");

function parseInts(...args: (string | undefined | null)[]) {
	return args
		.map((a) => (a ? parseInt(a) : undefined))
		.filter(Boolean) as number[];
}

function ContextMenu() {
	const [params] = useSearchParams();
	const id = params.get("id");
	const x = parseInt(params.get("x") || "0");
	const y = parseInt(params.get("y") || "0");
	const items = JSON.parse(params.get("menu") || "[]") as (Omit<
		ContextMenuItem,
		"click"
	> & { id: string })[];
	const contextMenuContainerRef = useRef<HTMLDivElement>(null);
	const [ready, setReady] = useState(false);
	useEffect(() => {
		const win = getCurrentWindow();
		win.setIgnoreMouseEvents(false);
		if (!contextMenuContainerRef.current) {
			console.warn("contextMenuContainerRef is null");
			return;
		}
		const contextMenuContainer = contextMenuContainerRef.current!;
		const el = contextMenuContainer.cloneNode(true) as HTMLDivElement;
		el.style.visibility = "visible";
		el.style.position = "absolute";
		el.style.left = "0";
		el.style.top = "0";
		el.style.width = "fit-content";
		el.style.height = "fit-content";
		document.body.appendChild(el);
		const rect = el.children[0].getBoundingClientRect();
		el.remove();
		win.setPosition(x, y);
		win.setSize(rect.width + 8, rect.height);
		win.setIgnoreMouseEvents(false);
		win.show();
		setReady(true);
	}, [ready, x, y, id, items]);
	return (
		<div className={styles.contextMenuContainer} ref={contextMenuContainerRef}>
			<div className={styles.contextMenu}>
				{items?.map((item) => {
					return (
						<div
							onMouseUp={() => {
								ipcRenderer.send(`${id}-close`, item.id);
								const win = getCurrentWindow();
								win.setIgnoreMouseEvents(true, { forward: true });
								win.setOpacity(0);
							}}
							key={item.id}
							className={styles.contextMenuItem}
						>
							{item.icon ? (
								<div className={styles.contextMenuIconContainer}>
									<img src={item.icon} />
								</div>
							) : null}
							<div className={styles.contextMenuText}>{item.label}</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export default ContextMenu;
