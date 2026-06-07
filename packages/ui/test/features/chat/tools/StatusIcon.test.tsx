import { describe, expect, test } from "bun:test";
import { StatusIcon } from "../../../../src/features/chat/tools/StatusIcon";
import { render, screen } from "../../../utils";

describe("StatusIcon", () => {
  test("running has a spinner with a tool-specific aria-label", () => {
    render(<StatusIcon status="running" toolName="bash" />);
    expect(screen.getByLabelText("bash is running")).toBeInTheDocument();
  });

  test("done shows a check with a completed aria-label", () => {
    render(<StatusIcon status="done" toolName="read" />);
    expect(screen.getByLabelText("read completed")).toBeInTheDocument();
  });

  test("error includes the error text in the aria-label", () => {
    render(<StatusIcon status="error" toolName="bash" errorText="exit 1" />);
    expect(screen.getByLabelText("bash failed: exit 1")).toBeInTheDocument();
  });

  test("cancelled has its own aria-label", () => {
    render(<StatusIcon status="cancelled" toolName="bash" />);
    expect(screen.getByLabelText("bash cancelled")).toBeInTheDocument();
  });

  test("pending falls back to a queued aria-label", () => {
    render(<StatusIcon status="pending" toolName="grep" />);
    expect(screen.getByLabelText("grep is queued")).toBeInTheDocument();
  });

  test("missing tool name defaults to 'Tool'", () => {
    render(<StatusIcon status="running" />);
    expect(screen.getByLabelText("Tool is running")).toBeInTheDocument();
  });
});
