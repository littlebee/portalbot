import { webSocket, logMessage } from "./hubState";
import { IHubState } from "./hubState";

export function sendHubStateUpdate(data: Partial<IHubState>) {
    logMessage("sending state update", { data, webSocket });
    if (webSocket) {
        webSocket.send(
            JSON.stringify({
                type: "updateState",
                data,
            })
        );
    }
}
