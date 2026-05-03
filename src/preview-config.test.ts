import { describe, expect, it } from "vitest";
import packageJson from "../package.json";

describe("preview configuration", () => {
  it("serves the GitHub Pages build from the repository base path", () => {
    expect(packageJson.scripts.preview).toContain("--base /market-weather-map/");
  });
});
