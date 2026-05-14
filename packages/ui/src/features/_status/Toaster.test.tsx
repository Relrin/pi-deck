import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "../../../test/utils";
import { Toaster } from "./Toaster";
import { useToastStore } from "./useToastStore";

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe("Toaster", () => {
  test("renders nothing when no toasts", () => {
    render(<Toaster />);
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  test("renders a toast pushed into the store", () => {
    useToastStore.getState().push("something went wrong", "error");
    render(<Toaster />);
    expect(screen.getByText("something went wrong")).toBeInTheDocument();
  });

  test("clicking the X dismisses the toast", () => {
    useToastStore.getState().push("dismiss me", "info");
    render(<Toaster />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("dismiss me")).toBeNull();
  });

  test("caps the visible queue at MAX_TOASTS (5)", () => {
    const store = useToastStore.getState();
    for (let i = 0; i < 8; i++) store.push(`toast ${i}`, "info");
    render(<Toaster />);
    expect(screen.getAllByRole("button", { name: "Dismiss" }).length).toBe(5);
  });
});
