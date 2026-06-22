import { describe, expect, test } from "bun:test";
import {
  PlanSnapshot,
  type PlanSnapshotRow,
} from "../../../../src/features/chat/messages/PlanSnapshot";
import { render, screen } from "../../../utils";

describe("PlanSnapshot", () => {
  test("renders nothing when there are no rows", () => {
    const { container } = render(<PlanSnapshot rows={[]} />);
    expect(container.querySelector(".pid-plan-snapshot")).toBeNull();
  });

  test("renders title, status dots, label, description, elapsed and summary", () => {
    const rows: PlanSnapshotRow[] = [
      { id: "s1", label: "EXPLORE", description: "read spec", status: "done", durationMs: 6000 },
      {
        id: "s2",
        label: "WRITE",
        description: "build it",
        status: "in-progress",
        startedAt: Date.now(),
      },
      { id: "s3", label: "TEST", description: "verify", status: "pending" },
    ];
    const { container } = render(<PlanSnapshot title="Do the thing" rows={rows} />);
    expect(screen.getByText("Do the thing")).toBeInTheDocument();
    expect(screen.getByText("EXPLORE")).toBeInTheDocument();
    expect(screen.getByText("read spec")).toBeInTheDocument();
    expect(screen.getByText("6.0s")).toBeInTheDocument();
    expect(container.querySelector(".pid-plan-snapshot-dot-done")).not.toBeNull();
    expect(container.querySelector(".pid-plan-snapshot-dot-active")).not.toBeNull();
    expect(container.querySelector(".pid-plan-snapshot-dot-pending")).not.toBeNull();
    expect(container.querySelector(".pid-plan-snapshot-summary")?.textContent).toBe("1 of 3 done");
  });

  test("windows long plans around the current step and reports hidden counts", () => {
    const rows: PlanSnapshotRow[] = Array.from({ length: 12 }, (_, i): PlanSnapshotRow => {
      if (i < 6) return { id: `s${i}`, description: `step ${i}`, status: "done", durationMs: 1000 };
      if (i === 6)
        return {
          id: `s${i}`,
          description: `step ${i}`,
          status: "in-progress",
          startedAt: Date.now(),
        };
      return { id: `s${i}`, description: `step ${i}`, status: "pending" };
    });
    const { container } = render(<PlanSnapshot rows={rows} />);
    // focus = index 6; window = indices 3..9 = 7 rows; 3 hidden before, 2 hidden after.
    expect(container.querySelectorAll(".pid-plan-snapshot-row").length).toBe(7);
    expect(container.querySelectorAll(".pid-plan-snapshot-more").length).toBe(2);
    expect(container.querySelector(".pid-plan-snapshot-summary")?.textContent).toBe("6 of 12 done");
  });

  test("labeled plans reserve a category column and keep 4 cells per row", () => {
    const rows: PlanSnapshotRow[] = [
      { id: "a", label: "EXPLORE", description: "x", status: "done", durationMs: 1000 },
      // No label and no time — still emits all four cells so columns stay aligned.
      { id: "b", description: "y", status: "pending" },
    ];
    const { container } = render(<PlanSnapshot rows={rows} />);
    expect(container.querySelector(".pid-plan-snapshot-steps")?.getAttribute("data-labeled")).toBe(
      "true",
    );
    const planRows = container.querySelectorAll(".pid-plan-snapshot-row");
    expect(planRows[0]?.children.length).toBe(4);
    expect(planRows[1]?.children.length).toBe(4);
  });

  test("unlabeled plans drop the category column (3 cells per row)", () => {
    const rows: PlanSnapshotRow[] = [
      { id: "a", description: "x", status: "done", durationMs: 1000 },
    ];
    const { container } = render(<PlanSnapshot rows={rows} />);
    expect(container.querySelector(".pid-plan-snapshot-steps")?.hasAttribute("data-labeled")).toBe(
      false,
    );
    expect(container.querySelectorAll(".pid-plan-snapshot-row")[0]?.children.length).toBe(3);
  });
});
