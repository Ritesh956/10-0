import { describe, expect, it } from "vitest";
import { clubDisplayName, worldClubLabel } from "./clubNames";

describe("clubDisplayName", () => {
  it("turns legal names into everyday ones", () => {
    const cases: [string, string][] = [
      ["1. Fußballclub Heidenheim 1846", "Heidenheim"],
      ["Associazione Sportiva Roma", "Roma"],
      ["Società Sportiva Lazio S.p.A.", "Lazio"],
      ["Hellas Verona S.p.A.", "Hellas Verona"],
      ["Bologna Football Club 1909", "Bologna"],
      ["Liverpool FC", "Liverpool"],
      ["FC Barcelona", "Barcelona"],
      ["SSC Napoli", "Napoli"],
      ["1.FC Union Berlin", "Union Berlin"],
      ["1.FSV Mainz 05", "Mainz"],
      ["Udinese Calcio", "Udinese"],
      ["Parma Calcio 1913", "Parma"],
      ["AFC Bournemouth", "Bournemouth"],
      ["Montpellier HSC", "Montpellier"],
      ["Le Havre AC", "Le Havre"],
      ["Real Valladolid CF", "Real Valladolid"],
    ];
    for (const [legal, everyday] of cases) expect(clubDisplayName(legal)).toBe(everyday);
  });

  it("leaves names that are already everyday names alone", () => {
    for (const name of ["AC Milan", "Manchester United", "Real Madrid", "Eintracht Frankfurt", "RB Leipzig", "Hellas Verona"]) {
      expect(clubDisplayName(name)).toBe(name);
    }
  });

  it("never renames the user's own club", () => {
    expect(worldClubLabel({ name: "My XI FC", managedByUserId: "u1" }, "x")).toBe("My XI FC");
    expect(worldClubLabel({ name: "Arsenal FC", managedByUserId: null }, "x")).toBe("Arsenal");
    expect(worldClubLabel(undefined, "fallback")).toBe("fallback");
  });
});

import { surname } from "./positionColors";

describe("surname", () => {
  it("keeps name particles with the surname", () => {
    expect(surname("Virgil van Dijk")).toBe("van Dijk");
    expect(surname("Kevin De Bruyne")).toBe("De Bruyne");
    expect(surname("Wilfried Zaha")).toBe("Zaha");
    expect(surname("Rodri")).toBe("Rodri");
  });
});
