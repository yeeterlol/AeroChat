import { Routes, Route, HashRouter } from "react-router-dom";
import Login from "@renderer/pages/Login";
import Home from "@renderer/pages/Home";
import { Context } from "@renderer/util";
import { useEffect, useState } from "react";
import { State } from "../../shared/types/index";
import {
	addDispatchListener,
	createWindow,
	getState,
	removeGatewayListener,
	setGatewayState,
} from "./util/ipc";
import { GatewayDispatchEvents } from "discord-api-types/v9";
import Notification from "./pages/Notification";
const { ipcRenderer }: { ipcRenderer: any } = window.require("electron");
import defaultPfp from "@renderer/assets/login/sample-pfp.png";
import ContextMenu from "./pages/ContextMenu";
const { screen } = window.require(
	"@electron/remote",
) as typeof import("@electron/remote");

function App(): JSX.Element {
	// on ctrl + shift + i
	useEffect(() => {
		function keyDown(e: KeyboardEvent) {
			if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i")) {
				ipcRenderer.send("open-dev-tools");
			}
		}
		function mouseDown() {
			ipcRenderer.send("close-ctx", window.location.hash);
		}
		window.addEventListener("keydown", keyDown);
		window.addEventListener("mousedown", mouseDown);
		return () => {
			window.removeEventListener("keydown", keyDown);
			window.removeEventListener("mousedown", mouseDown);
		};
	}, []);
	const initialState = getState();
	const [reactState, setReactState] = useState<State>(initialState as State);
	function setState(newState: State) {
		setGatewayState(newState);
		setReactState(newState);
	}
	useEffect(() => {
		ipcRenderer.on("set-state", (_, state) => {
			setReactState(state);
		});
		return () => {
			ipcRenderer.removeAllListeners("set-state");
		};
	}, []);
	useEffect(() => {
		const id = addDispatchListener(
			GatewayDispatchEvents.PresenceUpdate,
			(d) => {
				const friendsUser = reactState?.ready?.merged_presences?.friends?.find(
					(f) => f.user_id === d.user.id,
				);
				const a = reactState?.ready?.relationships?.map((r) =>
					reactState.ready.users.find((u) => u.id === r.id),
				);
				const user = a?.find((u) => u?.id === d.user.id);
				let mutState = { ...reactState };
				if (friendsUser) {
					// if we've come online?
					if (friendsUser?.status === "offline" && d.status !== "offline") {
						const primary = screen.getPrimaryDisplay();
						// use work area size to get bottom right
						const { width, height, monX, monY } = {
							...primary.workAreaSize,
							monX: primary.bounds.x,
							monY: primary.bounds.y,
						};
						const { x, y } = {
							x: width - 200 - 28 + monX,
							y: height - 115 + monY,
						};
						createWindow({
							customProps: {
								url: `/notification?title=${encodeURIComponent(
									`${user?.globalName || user?.username} is online!`,
								)}&img=${encodeURIComponent(
									user?.avatar
										? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
										: defaultPfp,
								)}`,
								alwaysOnTopValue: "status",
							},
							x,
							y,
							width: 200,
							height: 115,
							frame: false,
							resizable: false,
							transparent: true,
							focusable: false,
							backgroundColor: undefined,
						});
					}
					mutState.ready.merged_presences.friends =
						mutState.ready.merged_presences.friends.filter(
							(f) => f.user_id !== d.user.id,
						);
					mutState.ready.merged_presences.friends.push({
						activities: d.activities as any,
						client_status: d.client_status as any,
						status: d.status as any,
						user_id: d.user.id,
					});
				} else {
					const guildMember =
						reactState?.ready?.merged_presences?.guilds
							?.flatMap((g) => g)
							?.find((u) => u.user_id === d.user.id) ||
						reactState?.ready?.merged_presences?.friends?.find(
							(u) => u.user_id === d.user.id,
						);
					const user = mutState?.ready?.relationships?.find(
						(r) => r.id === d.user.id,
					)?.user;
					if (guildMember?.status === "offline" && d.status !== "offline") {
						const cursor = screen.getCursorScreenPoint();
						const primary = screen.getDisplayNearestPoint(cursor);
						// use work area size to get bottom right
						const { width, height } = primary.workAreaSize;
						const { x, y } = {
							x: width - 200 - 28,
							y: height - 115,
						};
						createWindow({
							customProps: {
								url: `/notification?title=${encodeURIComponent(
									`${(user as any)?.global_name || user?.username} is online!`,
								)}&img=${encodeURIComponent(
									user?.avatar
										? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
										: defaultPfp,
								)}`,
								alwaysOnTopValue: "status",
							},
							x,
							y,
							width: 200,
							height: 115,
							frame: false,
							resizable: false,
							transparent: true,
							focusable: false,
						});
					}
				}
				setState(mutState);
			},
		);
		return () => {
			removeGatewayListener(id);
		};
	}, [reactState]);
	return (
		<Context.Provider value={{ state: reactState, setState }}>
			<HashRouter>
				<Routes>
					<Route path="/" element={<Login />} />
					<Route path="/home" element={<Home />} />
					<Route path="/notification" element={<Notification />} />
					<Route path="/context-menu" element={<ContextMenu />} />
				</Routes>
			</HashRouter>
		</Context.Provider>
	);
}

export default App;
