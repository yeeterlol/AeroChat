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

function calcWidth(text: string, offset: number = 1): number {
	const body = document.querySelector("body");
	const el = document.createElement("div");
	el.style.width = "fit-content";
	el.innerText = text;
	body?.appendChild(el);
	const width = el.offsetWidth;
	el.remove();
	return offset ? width + offset : width;
}

function ContextMenu() {
	const [params] = useSearchParams();
	const id = params.get("id");
	const x = parseInt(params.get("x") || "0");
	const y = parseInt(params.get("y") || "0");
	const offsetWidth = parseInt(params.get("offsetWidth") || "0");
	const items = JSON.parse(params.get("menu") || "[]") as (Omit<
		ContextMenuItem,
		"click"
	> & { id: string })[];
	const contextMenuContainerRef = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);
	useEffect(() => {
		const win = getCurrentWindow();
		win.setIgnoreMouseEvents(false);
		if (!contextMenuContainerRef.current) {
			console.warn("contextMenuContainerRef is null");
			return;
		}
		const el = document.getElementsByClassName(
			styles.contextMenuContainer,
		)[0] as HTMLDivElement;
		const rect = el.children[0].getBoundingClientRect();
		console.log(rect);
		win.setBounds({
			x,
			y,
			width: rect.width + 8,
			height: rect.height + 8,
		});
		win.setIgnoreMouseEvents(false);
		win.show();
	}, [x, y, id, items, offsetWidth, params]);
	useEffect(() => {
		// get the item with the highest label width
		const maxWidth = Math.max(
			...items.map((item) => calcWidth(item.label, 128)),
		);
		setWidth(maxWidth + offsetWidth);
	}, [items, offsetWidth, params]);
	return (
		<div
			onMouseUp={() => {
				ipcRenderer.send(`${id}-close`);
				const win = getCurrentWindow();
				win.setIgnoreMouseEvents(true, { forward: true });
				win.setOpacity(0);
			}}
			className={styles.contextMenuContainer}
			ref={contextMenuContainerRef}
		>
			<div
				className={styles.contextMenu}
				style={{
					width,
				}}
			>
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
