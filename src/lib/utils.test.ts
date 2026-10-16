// @TheTechMargin 2026
import { splitFirstSentence, timeAgo } from "./utils";

describe("splitFirstSentence", () => {
  it("splits at the first sentence boundary", () => {
    expect(splitFirstSentence("Вся съёмка с мероприятия. И ваши кадры в ней")).toEqual({
      first: "Вся съёмка с мероприятия.",
      rest: "И ваши кадры в ней",
    });
  });

  it("keeps the whole string when there is no boundary", () => {
    expect(splitFirstSentence("Одна фраза без точки")).toEqual({
      first: "Одна фраза без точки",
      rest: "",
    });
  });

  it("handles other sentence terminators and extra whitespace", () => {
    expect(splitFirstSentence("  Найдите себя!  Просто загрузите селфи?  ")).toEqual({
      first: "Найдите себя!",
      rest: "Просто загрузите селфи?",
    });
  });

  it("returns empty strings for empty input", () => {
    expect(splitFirstSentence("")).toEqual({ first: "", rest: "" });
  });
});

describe("timeAgo", () => {
  it("returns Russian relative time labels", () => {
    const now = Date.now();
    const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

    expect(timeAgo(iso(10 * 1000))).toBe("только что");
    expect(timeAgo(iso(5 * 60 * 1000))).toBe("5 мин. назад");
    expect(timeAgo(iso(3 * 60 * 60 * 1000))).toBe("3 ч. назад");
    expect(timeAgo(iso(2 * 24 * 60 * 60 * 1000))).toBe("2 дн. назад");
    expect(timeAgo("")).toBe("");
  });
});
