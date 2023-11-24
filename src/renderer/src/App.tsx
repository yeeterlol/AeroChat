import { Routes, Route, HashRouter } from "react-router-dom";
import Login from "@renderer/pages/Login";
import Home from "@renderer/pages/Home";
import { Context } from "@renderer/util";
import { useEffect, useState } from "react";
import { State, Status } from "../../shared/types/index";
import {
	addDispatchListener,
	createWindow,
	getState,
	removeGatewayListener,
	setGatewayState,
} from "./util/ipc";
import {
	GatewayDispatchEvents,
	PresenceUpdateStatus,
} from "discord-api-types/v9";
import Notification from "./pages/Notification";
const { ipcRenderer }: { ipcRenderer: any } = window.require("electron");
import defaultPfp from "@renderer/assets/login/sample-pfp.png";
import ContextMenu from "./pages/ContextMenu";
import { DispatchEventsCustom } from "../../shared/gateway";
import Message from "./pages/Message";
import { DiscordUtil } from "./classes/DiscordUtil";
const remote = window.require(
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
		DiscordUtil.updateState(reactState);
	}, [reactState]);
	useEffect(() => {
		const ids = [
			addDispatchListener(GatewayDispatchEvents.PresenceUpdate, (d) => {
				const mutState = { ...reactState };
				if (!mutState?.ready?.merged_presences?.friends) return;
				let friend = mutState.ready.merged_presences.friends.find(
					(f) => (f.user?.id || f.user_id) === d.user.id,
				);
				if (!friend) return;
				mutState.ready.merged_presences.friends =
					mutState.ready.merged_presences.friends.filter(
						(f) => (f.user_id || f.user?.id) !== d.user.id,
					);
				const finalFriend = {
					status: d.status || friend.status,
					activities: d.activities || friend.activities,
					client_status: d.client_status || friend.client_status,
					user_id: d.user.id,
				};
				if (
					finalFriend.status !== PresenceUpdateStatus.Offline &&
					friend?.status === Status.Offline
				) {
					const a = reactState?.ready?.relationships?.map((r) =>
						reactState.ready.users.find((u) => u.id === r.id),
					);
					const user = a?.find((u) => u?.id === d.user.id);
					const primary = remote.screen.getPrimaryDisplay();
					// use work area size to get bottom right
					const { width, height, monX, monY } = {
						...primary.workAreaSize,
						monX: primary.bounds.x,
						monY: primary.bounds.y,
					};
					const { x, y } = {
						x: width - 200 - 28 + monX,
						y: height - 115 - 28 + monY,
					};
					createWindow({
						customProps: {
							url: `/notification?title=${encodeURIComponent(
								`${user?.global_name || user?.username} has just signed in.`,
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
				mutState.ready.merged_presences.friends.push(finalFriend as any);
				setReactState(mutState);
			}),
			addDispatchListener(DispatchEventsCustom.RelationshipRemove, (d) => {
				console.log(d);
			}),
		];
		return () => {
			ids.forEach((id) => removeGatewayListener(id));
		};
	}, [reactState]);
	useEffect(() => {
		(async () => {
			const window = remote.getCurrentWindow();
			const activeIcon = remote.nativeImage.createFromPath(
				__dirname + "/public/native/active.ico",
			);
			console.log(__dirname + "/public/native/active.ico");
			console.log(activeIcon.toPNG());
			window.setIcon(activeIcon);
			console.log("done");
		})();
	}, [reactState]);
	return (
		<Context.Provider value={{ state: reactState, setState }}>
			<HashRouter>
				<Routes>
					<Route path="/" element={<Login />} />
					<Route path="/home" element={<Home />} />
					<Route path="/notification" element={<Notification />} />
					<Route path="/context-menu" element={<ContextMenu />} />
					<Route path="/message" element={<Message />} />
				</Routes>
			</HashRouter>
		</Context.Provider>
	);
}

export default App;
