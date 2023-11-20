import styles from "@renderer/css/pages/Home.module.css";
import { joinClasses } from "@renderer/util";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
	ContextMenuItem,
	ContextMenuItemType,
	ContextMenuStyle,
} from "../../../shared/types";
const { getCurrentWindow, BrowserWindow } = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");
const { ipcRenderer } = require("electron");
import yabbcode from "ya-bbcode";

function configureUsernameBbCode(parser: yabbcode) {
	parser.clearTags();
	parser.registerTag("b", {
		open() {
			return `<b>`;
		},
		close() {
			return `</b>`;
		},
		type: "replace",
	});
}

const parser = new yabbcode({ sanitizeHtml: true });
configureUsernameBbCode(parser);

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
	const contextMenuContainerRef = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);
	const [items, setItems] = useState<
		(ContextMenuItem & {
			id: string;
		})[]
	>([...JSON.parse(params.get("menu") || "[]")]);
	const [x, y] = parseInts(params.get("x"), params.get("y"));
	const style = params.get("style") as ContextMenuStyle;
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
		// win.setBounds({
		// 	x,
		// 	y,
		// 	width: rect.width + 8,
		// 	height: rect.height + 8,
		// });
		const width = rect.width + 8;
		const height = rect.height + 12;
		win.setContentSize(width, height);
		win.setSize(width, height);
		win.setMinimumSize(width, height);
		win.setShape([
			{
				x: 0,
				y: 0,
				width: width,
				height: height,
			},
		]);
		win.setPosition(x, y);
		win.setIgnoreMouseEvents(false);
		win.show();
	}, [items, x, y, width, params]);
	useEffect(() => {
		const offsetWidth = parseInt(params.get("offsetWidth") || "0");
		// get the item with the highest label width
		const maxWidth = Math.max(
			...items.map((item) => {
				if (item.type !== ContextMenuItemType.Item) return 0;
				return calcWidth(item.label, 128);
			}),
		);
		setWidth(maxWidth + offsetWidth);
	}, [params, items, width, x, y]);
	useEffect(() => {
		setItems([...JSON.parse(params.get("menu") || "[]")]);
	}, [params, width, x, y]);
	return (
		<div
			onMouseUp={() => {
				const id = params.get("id");
				ipcRenderer.send(`${id}-close`);
				const win = getCurrentWindow();
				win.setIgnoreMouseEvents(true, { forward: true });
				win.setOpacity(0);
			}}
			className={joinClasses(styles.contextMenuContainer, styles[style])}
			ref={contextMenuContainerRef}
		>
			<div
				className={styles.contextMenu}
				style={{
					width,
				}}
			>
				<div className={styles.modernOutline} />
				{items?.map((item) => {
					switch (item.type) {
						case ContextMenuItemType.Item:
							return (
								<div
									onMouseUp={() => {
										const id = params.get("id");
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
									<div
										className={styles.contextMenuText}
										dangerouslySetInnerHTML={{
											__html: parser.parse(item.label),
										}}
									/>
								</div>
							);
						case ContextMenuItemType.Divider:
							return <div className={styles.contextMenuDivider} />;
					}
				})}
			</div>
		</div>
	);
}

export default ContextMenu;
