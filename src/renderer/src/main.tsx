import ReactDOM from "react-dom/client";
import App from "./App";
import "@renderer/css/Global.css";
import { initializeImageMap } from "./util";
const Store = window.require(
	"electron-store",
) as typeof import("electron-store");
const store = new Store();

(async () => {
	if (!store.get("imageMap")) {
		const map = await initializeImageMap();
		store.set("imageMap", map);
	} else {
		initializeImageMap().then((map) => store.set("imageMap", map));
	}

	ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
		<App />,
	);
})();
