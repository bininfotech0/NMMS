import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders each member lifecycle status in title case", () => {
    render(<StatusBadge status="PAYMENT_COLLECTED" />);
    expect(screen.getByText("Payment Collected")).toBeInTheDocument();
  });

  it("renders every status this session introduced (PAYMENT_COLLECTED, SUSPENDED, DECEASED)", () => {
    for (const status of ["PAYMENT_COLLECTED", "SUSPENDED", "DECEASED"]) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(new RegExp(status[0], "i"))).toBeInTheDocument();
      unmount();
    }
  });

  it("doesn't crash on an unknown status — falls back to unstyled title case", () => {
    render(<StatusBadge status="SOME_FUTURE_STATUS" />);
    expect(screen.getByText("Some Future Status")).toBeInTheDocument();
  });
});
