import { Notification } from "electron";

declare global {
	interface Window {
		electron: typeof Notification;
		api: unknown;
	}
}
