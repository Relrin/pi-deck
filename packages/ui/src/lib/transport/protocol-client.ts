import type {
  CommandName,
  CommandRequest,
  CommandResponse,
} from "@pi-deck/core/protocol/commands.js";
import type { WsClient } from "./ws-client.js";

export class ProtocolClient {
  constructor(private readonly ws: WsClient) {}

  call<C extends CommandName>(cmd: C, payload: CommandRequest<C>): Promise<CommandResponse<C>> {
    return this.ws.request(cmd, payload) as Promise<CommandResponse<C>>;
  }

  ping(): Promise<CommandResponse<"ping">> {
    return this.call("ping", {});
  }
}
