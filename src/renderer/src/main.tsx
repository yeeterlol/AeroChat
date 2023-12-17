import ReactDOM from "react-dom/client";
import App from "./App";
import "@renderer/css/Global.css";
import Sentry from "@sentry/react";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<App />,
);
