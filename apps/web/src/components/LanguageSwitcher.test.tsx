import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider, useT } from "../lib/i18n/context";
import { LanguageSwitcher } from "./LanguageSwitcher";

function Sample() {
  const { t } = useT();
  return <p>{t("landing.continue", { n: 4 })}</p>;
}

describe("LanguageSwitcher", () => {
  it("re-renders translated text when the language changes, and remembers the choice", () => {
    render(
      <I18nProvider>
        <LanguageSwitcher />
        <Sample />
      </I18nProvider>,
    );
    expect(screen.getByText("Continue your draft (4/11)")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "de" } });
    expect(screen.getByText("Draft fortsetzen (4/11)")).toBeTruthy();
    expect(document.documentElement.lang).toBe("de");
    expect(localStorage.getItem("futbol_lang")).toBe("de");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "fr" } });
    expect(screen.getByText("Reprendre votre draft (4/11)")).toBeTruthy();
  });

  it("reads as English with no provider", () => {
    render(<Sample />);
    expect(screen.getByText("Continue your draft (4/11)")).toBeTruthy();
  });
});
