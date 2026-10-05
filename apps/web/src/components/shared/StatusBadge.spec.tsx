import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders member statuses in plain words", () => {
    render(<StatusBadge status="AWAITING_PAYMENT" />);
    expect(screen.getByText("Not paid yet")).toBeInTheDocument();
  });

  it("never shows a raw status code for known member statuses", () => {
    for (const [status, label] of [
      ["PAYMENT_COLLECTED", "Paid, form not finished"],
      ["SUSPENDED", "On hold"],
      ["DECEASED", "Deceased"],
    ]) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByText(status)).not.toBeInTheDocument();
      unmount();
    }
  });

  it("doesn't crash on an unknown status — falls back to unstyled title case", () => {
    render(<StatusBadge status="SOME_FUTURE_STATUS" />);
    expect(screen.getByText("Some Future Status")).toBeInTheDocument();
  });
});
