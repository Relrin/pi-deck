import type {
  CommandName,
  CommandRequest,
  CommandResponse,
} from "@pi-deck/core/protocol/commands.js";
import type { ThemeListing, ThemeSpec } from "@pi-deck/core/protocol/theme.js";
import type { WsClient } from "./ws-client.js";

export class ProtocolClient {
  constructor(private readonly ws: WsClient) {}

  call<C extends CommandName>(cmd: C, payload: CommandRequest<C>): Promise<CommandResponse<C>> {
    return this.ws.request(cmd, payload) as Promise<CommandResponse<C>>;
  }

  ping(): Promise<CommandResponse<"ping">> {
    return this.call("ping", {});
  }

  themes = {
    list: async (): Promise<{ activeName: string; themes: ThemeListing[] }> => {
      return this.call("theme.list", {});
    },
    get: async (name: string): Promise<ThemeSpec> => {
      const res = await this.call("theme.get", { name });
      return res.theme as ThemeSpec;
    },
    setActive: async (name: string): Promise<void> => {
      await this.call("theme.setActive", { name });
    },
  };
}
