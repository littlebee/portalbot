import { promisify } from "node:util";
import child_process from "node:child_process";

import { IHubState } from "../src/util/hubState";
import { mockState } from "./mockState";

const execAsync = promisify(child_process.exec);

export interface IHubMessage {
    type: string;
    data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export class CentralHubTestClient {
    private hubPort: number;
    private testName: string;
    private webSocket: WebSocket | null;
    private nextMessageWaiter: ((message: IHubMessage) => void) | null;

    constructor(testName: string) {
        this.testName = testName;
        const threadId = process.env.VITEST_POOL_ID;
        this.hubPort = 5150 + parseInt(threadId || "0");
        this.webSocket = null;
        this.nextMessageWaiter = null;
    }

    getHubPort() {
        return this.hubPort;
    }

    getEnvVars() {
        return [
            `BB_ENV=test`,
            `BB_FILE_APPEND=${this.testName}`,
            `BB_HUB_PORT=${this.hubPort}`,
        ].join(" ");
    }

    async startTestHub() {
        // start actual central_hub service
        const cmd = `cd .. && ${this.getEnvVars()} bb_start -s central_hub`;
        console.log(
            `startTestHub: starting central with command '${cmd}.  test thread: ${process.env.VITEST_POOL_ID}`
        );
        const { stdout, stderr } = await execAsync(cmd);
        console.log(`startTestHub: stdout: ${stdout}`);
        console.error(`startTestHub: stderr: ${stderr}`);
        return this.connectToHub();
    }

    async stopTestHub() {
        console.log("stopTestHub: stopping central_hub");
        const { stderr, stdout } = await execAsync(
            `cd .. && ${this.getEnvVars()} bb_stop -s central_hub`
        );
        console.log(`stopTestHub: stdout: ${stdout}`);
        if (stderr) console.log(`stopTestHub: stderr: ${stderr}`);
        if (this.webSocket) {
            this.webSocket.close();
        }
    }

    async sendMockState() {
        return this.sendHubStateUpdate(mockState);
    }

    async sendHubStateUpdate(data: IHubState) {
        if (!this.webSocket) {
            throw new Error("central_hub test client not connected");
        }
        this.webSocket.send(
            JSON.stringify({
                type: "updateState",
                data,
            })
        );
    }

    async waitForNextMessage() {
        return new Promise<IHubMessage>((resolve) => {
            // wait at most 5 seconds for the next message
            const interval = setTimeout(() => {
                throw new Error(
                    "central_hub test client timed out waiting for next message"
                );
            }, 5000);
            this.nextMessageWaiter = (nextMessage) => {
                clearTimeout(interval);
                resolve(nextMessage);
            };
        });
    }

    private handleHubMessage = (event: MessageEvent) => {
        let parsedMessage = null;
        try {
            parsedMessage = JSON.parse(event.data);
        } catch (e) {
            console.error(
                "error parsing message from central-hub",
                e,
                event.data
            );
            return;
        }

        console.log("centralHub test client got message: ", parsedMessage);
        // ignore state updates that are subsystem_stats
        if (
            !parsedMessage ||
            (parsedMessage.type === "stateUpdate" &&
                Object.keys(parsedMessage.data).includes("subsystem_stats"))
        ) {
            console.log(
                "centralHub test client ignoring subsystem_stats message"
            );
            return;
        }
        if (this.nextMessageWaiter) {
            console.log("centralHub test client alerting waiter");
            this.nextMessageWaiter(parsedMessage);
            this.nextMessageWaiter = null;
        }
    };

    private async connectToHub() {
        return new Promise((resolve) => {
            try {
                const hubUrl = `ws://localhost:${this.hubPort}/ws`;
                console.log(`connecting to central-hub at ${hubUrl}`);
                const ws = new WebSocket(hubUrl);
                ws.addEventListener("open", () => {
                    console.log(
                        "centralHub test client connected to central-hub"
                    );
                    ws.send(
                        JSON.stringify({
                            type: "identity",
                            data: "webapp_test_client",
                        })
                    );
                    this.webSocket = ws;
                    this.sendMockState();
                    ws.send(
                        JSON.stringify({ type: "subscribeState", data: "*" })
                    );
                    resolve(ws);
                });
                ws.addEventListener("error", (event) => {
                    console.error(
                        "centralHub test client got error from central-hub socket",
                        event
                    );
                });
                ws.addEventListener("close", (event) => {
                    console.log("centralHub test client socket closed", event);
                });
                ws.addEventListener("message", this.handleHubMessage);
            } catch (error) {
                console.error("connectToHub error:", error);
                throw error;
            }
        });
    }
}
