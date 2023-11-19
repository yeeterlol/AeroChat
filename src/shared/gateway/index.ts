import {
	GatewayDispatchEvents,
	GatewayDispatchPayload,
	GatewayOpcodes,
	GatewayReceivePayload,
	GatewaySendPayload,
} from "discord-api-types/v9";
import WebSocket from "ws";
const { ipcRenderer } = require("electron");

export type DispatchData<T extends GatewayDispatchEvents> =
	(GatewayDispatchPayload & {
		t: T;
	})["d"];

export type OpcodeSendData<T extends GatewayOpcodes> = (GatewaySendPayload & {
	op: T;
})["d"];

export type OpcodeReceiveData<T extends GatewayOpcodes> =
	(GatewayReceivePayload & {
		op: T;
	})["d"];

export function sendOp<T extends GatewayOpcodes>(
	opcode: T,
	payload: OpcodeSendData<T>,
	socket?: WebSocket,
): void {
	try {
		const data = {
			op: opcode,
			d: payload,
		};
		if (socket) socket.send(JSON.stringify(data));
		else ipcRenderer.send("send-op", JSON.stringify(data));
	} catch {
		console.log("failed to send op", opcode, payload);
	}
}
