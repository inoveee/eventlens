/**
 * @jest-environment jsdom
 *
 * @TheTechMargin 2026
 *
 * Регрессия: сентинел «подгрузить ещё» монтируется позже хука (на главной
 * его нет, пока не открыт режим «все фото»). Наблюдатель обязан создаться
 * в момент его маунта — иначе IntersectionObserver никогда не прикрепляется
 * и галерея навсегда остаётся на первой порции из 40 фото.
 */
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { createElement } from "react";
import { useProgressiveRender } from "./useProgressiveRender";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom не реализует IntersectionObserver — мок с ручным запуском колбэка.
let ioCallback: IntersectionObserverCallback | null = null;
let observedEl: Element | null = null;
let disconnectCount = 0;

class MockIntersectionObserver {
  root = null;
  rootMargin = "";
  thresholds = [];
  constructor(cb: IntersectionObserverCallback) {
    ioCallback = cb;
  }
  observe(el: Element) {
    observedEl = el;
  }
  unobserve() {}
  disconnect() {
    disconnectCount++;
  }
  takeRecords() {
    return [];
  }
}

function fireIntersection(isIntersecting: boolean) {
  const entry = {
    isIntersecting,
    target: observedEl,
    intersectionRatio: isIntersecting ? 1 : 0,
  } as unknown as IntersectionObserverEntry;
  ioCallback?.([entry], {} as IntersectionObserver);
}

function Harness(props: { showSentinel: boolean; total: number; resetKey?: string }) {
  const { visibleCount, sentinelRef } = useProgressiveRender(props.total, 40, props.resetKey ?? "");
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "count" }, String(visibleCount)),
    props.showSentinel && visibleCount < props.total
      ? createElement("div", { "data-testid": "sentinel", ref: sentinelRef })
      : null,
  );
}

describe("useProgressiveRender", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      MockIntersectionObserver;
    ioCallback = null;
    observedEl = null;
    disconnectCount = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (props: { showSentinel: boolean; total: number; resetKey?: string }) =>
    act(() => {
      root.render(createElement(Harness, props));
    });

  const count = () =>
    container.querySelector('[data-testid="count"]')?.textContent;

  it("прикрепляет наблюдатель, когда сентинел монтируется позже хука", () => {
    render({ showSentinel: false, total: 387 });
    expect(observedEl).toBeNull();

    render({ showSentinel: true, total: 387 });
    const sentinel = container.querySelector('[data-testid="sentinel"]');
    expect(sentinel).not.toBeNull();
    expect(observedEl).toBe(sentinel);
  });

  it("наращивает порцию при пересечении и останавливается на total", () => {
    render({ showSentinel: true, total: 100 });
    expect(count()).toBe("40");

    act(() => fireIntersection(true));
    expect(count()).toBe("80");

    act(() => fireIntersection(true));
    expect(count()).toBe("100");

    // Достигли total — сентинел размонтирован, наблюдатель отключён.
    expect(container.querySelector('[data-testid="sentinel"]')).toBeNull();
    expect(disconnectCount).toBeGreaterThan(0);
  });

  it("сбрасывает порцию при смене фильтра (resetKey)", () => {
    render({ showSentinel: true, total: 387, resetKey: "folderA" });
    act(() => fireIntersection(true));
    expect(count()).toBe("80");

    render({ showSentinel: true, total: 387, resetKey: "folderB" });
    expect(count()).toBe("40");
  });
});
