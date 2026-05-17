import { beforeEach, describe, expect, test } from "bun:test";
import { render, screen } from "../../../../test/utils";
import { useProvidersStore } from "../../models/useProvidersStore";
import { useSessionsStore } from "../../sessions/useSessionsStore";
import { ModelMenu } from "./ModelMenu";

function resetStores() {
  useProvidersStore.setState({
    providers: [],
    defaultModel: undefined,
    modelsByProvider: {},
    loadingProviders: false,
    loadingModelsByProvider: {},
    sessionSelection: {},
  });
  useSessionsStore.setState({
    sessions: [],
    activeSessionId: undefined,
  });
}

beforeEach(() => {
  resetStores();
});

describe("ModelMenu", () => {
  test("shows 'Select model' when no model is active", () => {
    render(<ModelMenu />);
    expect(screen.getByRole("button", { name: /Model: Select model/i })).toBeInTheDocument();
  });

  test("reflects the per-session model selection in the trigger label", () => {
    useSessionsStore.setState({
      sessions: [
        {
          id: "s1",
          projectId: "00000000-0000-0000-0000-000000000000",
          title: "Local",
          lastActivityAt: new Date().toISOString(),
          modelRef: { providerId: "anthropic", modelId: "claude-opus-4-7" },
        },
      ],
      activeSessionId: "s1",
    });
    useProvidersStore.setState({
      providers: [
        {
          id: "anthropic",
          name: "Anthropic",
          kind: "built-in",
          iconKey: "anthropic",
          authJsonKey: "anthropic",
          oauthSupported: true,
          authState: "authenticated",
        },
      ],
      modelsByProvider: {
        anthropic: [
          {
            providerId: "anthropic",
            id: "claude-opus-4-7",
            label: "Claude Opus 4.7",
            supportsThinking: true,
            modalities: ["text"],
          },
        ],
      },
    });
    render(<ModelMenu />);
    expect(screen.getByRole("button", { name: /Model: Claude Opus 4\.7/i })).toBeInTheDocument();
  });
});
