const { ipcRenderer } = require("electron");
import {
	APIUser,
	GatewayDispatchEvents,
	GatewayOpcodes,
	GatewayReceivePayload,
} from "discord-api-types/v9";
import {
	DispatchData,
	DispatchEventsCustom,
	OpcodeReceiveData,
} from "../../../../shared/gateway";
import {
	ContextMenuItem,
	ContextMenuItemType,
	ContextMenuStyle,
	PopupWindowProps,
	State,
} from "../../../../shared/types";
import { v4 } from "uuid";

export function startGateway(token: string) {
	ipcRenderer.send("start-gateway", token);
}

export function getState(): State {
	return ipcRenderer.sendSync("get-state");
}

export function setGatewayState(newState: State) {
	ipcRenderer.send("set-state", newState);
}

// const eventListeners: {
//     cb: (data: any) => void;
//     opcode: GatewayReceiveOpcode;
//     id: string;
// }[] = [];

export function addGatewayListener<T extends GatewayOpcodes>(
	opcode: T,
	cb: (data: OpcodeReceiveData<T>) => void,
): string {
	const id = v4();
	ipcRenderer.send("add-gateway-listener", id);
	ipcRenderer.on(`${id}-data`, (_: any, dataStr: string) => {
		const data = JSON.parse(dataStr);
		if (data.op === opcode) cb(data.d);
	});
	ipcRenderer.on(`${id}-remove`, (_: any) => {
		ipcRenderer.removeAllListeners(`${id}-data`);
		ipcRenderer.removeAllListeners(`${id}-remove`);
	});
	return id;
}

export function addDispatchListener<
	T extends GatewayDispatchEvents | DispatchEventsCustom,
>(event: T, cb: (data: DispatchData<T>) => void): string {
	const id = v4();
	ipcRenderer.send("add-gateway-listener", id);
	ipcRenderer.on(`${id}-data`, (_: any, dataStr: string) => {
		const data: GatewayReceivePayload = JSON.parse(dataStr);
		if (data.op === GatewayOpcodes.Dispatch && data.t == event)
			cb(data.d as any);
	});
	ipcRenderer.on(`${id}-remove`, (_: any) => {
		ipcRenderer.removeAllListeners(`${id}-data`);
		ipcRenderer.removeAllListeners(`${id}-remove`);
	});
	return id;
}

export function createWindow(props: PopupWindowProps) {
	ipcRenderer.send("create-window", props);
}

export function removeGatewayListener(id: string): void {
	ipcRenderer.send("remove-gateway-listener", id);
	ipcRenderer.removeAllListeners(`${id}-data`);
	ipcRenderer.removeAllListeners(`${id}-remove`);
}

export function closeGateway() {
	ipcRenderer.send("close-gateway");
}

export async function contextMenu(
	items: ContextMenuItem[],
	x?: number,
	y?: number,
	offsetWidth?: number,
	style?: ContextMenuStyle,
	// vertical: "top" | "bottom" = "top",
	// horizontal: "left" | "right" = "left")
) {
	const id = v4();
	const idItems = items.map((i) => ({ ...i, id: v4() }));
	ipcRenderer.send(
		"context-menu",
		id,
		idItems.map((i) =>
			i.type === ContextMenuItemType.Item ? { ...i, click: undefined } : i,
		),
		x,
		y,
		offsetWidth,
		style,
	);
	return new Promise<void>((resolve) => {
		ipcRenderer.once(`${id}-close`, (_, id: string) => {
			const item = idItems.find((i) => i.id === id);
			if (!item) return;
			if (item.type === ContextMenuItemType.Item) {
				item.click?.();
			}
			resolve();
		});
	});
}

export function contactCard(user: APIUser, x?: number, y?: number) {
	ipcRenderer.send("contact-card", user, x, y);
}

export function joinVoiceChannel(guildId: string, channelId: string) {
	ipcRenderer.send("join-voice", guildId, channelId);
}
