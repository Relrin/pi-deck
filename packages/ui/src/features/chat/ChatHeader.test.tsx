import { beforeEach, describe, expect, test } from "bun:test";
import { render, screen } from "../../../test/utils";
import { useNavStore } from "../../lib/useNavStore";
import { ChatHeader } from "./ChatHeader";

const session = {
  id: "sess-1",
  projectId: "11111111-1111-4111-8111-111111111111",
  title: "Refactor chat header",
  lastActivityAt: "2026-05-20T10:00:00Z",
};

beforeEach(() => {
  useNavStore.setState({
    screen: "session",
    expandedProjectsOverview: {},
    expandedProjectsRail: {},
  });
});

describe("ChatHeader", () => {
  test("renders the session title", () => {
    render(<ChatHeader session={session} />);
    expect(screen.getByText("Refactor chat header")).toBeInTheDocument();
  });

  test("does not render archive / delete actions in the header", () => {
    // These live in the rail's right-click menu now; the chat header is title + meta only.
    render(<ChatHeader session={session} />);
    expect(screen.queryByLabelText("Delete session")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Archive session")).not.toBeInTheDocument();
  });
});
