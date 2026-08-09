import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VaultDial } from "@/components/charts/VaultDial";

describe("VaultDial", () => {
  it("renders the rounded percentage", () => {
    render(<VaultDial percent={42.6} />);
    expect(screen.getByText("43%")).toBeInTheDocument();
  });

  it("clamps values above 100", () => {
    render(<VaultDial percent={150} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("clamps negative values to zero", () => {
    render(<VaultDial percent={-10} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders an optional label and sublabel", () => {
    render(<VaultDial percent={50} label="Storage used" sublabel="5 GB of 15 GB" />);
    expect(screen.getByText("Storage used")).toBeInTheDocument();
    expect(screen.getByText("5 GB of 15 GB")).toBeInTheDocument();
  });
});
