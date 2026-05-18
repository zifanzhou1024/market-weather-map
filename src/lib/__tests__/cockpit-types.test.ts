import { expect, test } from "vitest";
import type { CockpitFile } from "../types";
import sampleCockpit from "../../__fixtures__/cockpit/today.json";

test("cockpit fixture conforms to CockpitFile type", () => {
  const data = sampleCockpit as CockpitFile;
  expect(data.composite_scores).toHaveLength(3);
  expect(data.vital_signs[0]).toHaveProperty("primary_value");
  expect(data.regime.label).toBeTruthy();
});
