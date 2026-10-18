"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DemoModal } from "./DemoModal";
import { AppearanceScreen, OverviewScreen, PanelFrame } from "./PanelScreens";

/* ------------------------------------------------------------------ */
/* Данные демо-макетов                                                  */
/* ------------------------------------------------------------------ */

const CONF = "/intro-demo/conf-";
const TEAM = "/intro-demo/team-";

/**
 * Реальный проект с платформы — «Фотки с ДР» (999 фотографий,
 * страница noveee.me/p/test-noveee). Снимки и селфи ниже — из него.
 */
const DR = "/intro-demo/dr-";
const DR_SELFIE = `${DR}selfie.webp`;
const drGallery = [
  { src: `${DR}1.webp`, match: true },
  { src: `${DR}2.webp`, match: false },
  { src: `${DR}3.webp`, match: true },
  { src: `${DR}4.webp`, match: false },
  { src: `${DR}5.webp`, match: true },
  { src: `${DR}6.webp`, match: false },
];

const confGallery = [
  { src: `${CONF}meetup.webp`, match: true },
  { src: `${CONF}panel1.webp`, match: false },
  { src: `${CONF}hall.webp`, match: true },
  { src: `${CONF}stage.webp`, match: false },
  { src: `${CONF}auditorium.webp`, match: true },
  { src: `${CONF}panel2.webp`, match: false },
  { src: `${CONF}venue.webp`, match: false },
  { src: `${CONF}group.webp`, match: true },
  { src: `${CONF}speaker.webp`, match: false },
];

const wallPhotos = [
  `${CONF}meetup.webp`, `${TEAM}golden.webp`, `${CONF}panel1.webp`, `${CONF}hall.webp`,
  `${TEAM}champagne.webp`, `${CONF}stage.webp`, `${TEAM}field.webp`, `${CONF}auditorium.webp`,
  `${TEAM}camera.webp`, `${CONF}panel2.webp`, `${CONF}venue.webp`, `${TEAM}sea.webp`,
  `${CONF}group.webp`, `${TEAM}glasses.webp`, `${CONF}speaker.webp`, `${TEAM}lake.webp`,
];

const SELFIE = `${TEAM}portrait.webp`;

/* ------------------------------------------------------------------ */
/* Утилиты                                                             */
/* ------------------------------------------------------------------ */

/** Появление блоков при прокрутке (с уважением к prefers-reduced-motion). */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".rv"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("rv-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("rv-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ------------------------------------------------------------------ */
/* Мелкие элементы                                                     */
/* ------------------------------------------------------------------ */

function MatchBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`pointer-events-none absolute left-1.5 top-1.5 z-10 rounded-full bg-[var(--el-primary)] font-semibold text-black shadow-lg ${
        small ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      Ваше фото
    </span>
  );
}

function BrowserFrame({
  url,
  children,
  className = "",
}: {
  url: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[18px] border border-white/10 bg-[#101014] shadow-[0_30px_80px_rgba(0,0,0,0.5)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 truncate rounded-full bg-white/[0.06] px-3 py-0.5 text-[10px] text-white/40">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}

function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative w-[218px] shrink-0 rounded-[30px] border border-white/15 bg-[#0c0c10] p-2 shadow-[0_30px_80px_rgba(0,0,0,0.55)] ${className}`}
    >
      <div className="absolute left-1/2 top-2.5 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-black/80" />
      <div className="overflow-hidden rounded-[23px] bg-[#141419]">{children}</div>
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--el-primary)]" />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Страница                                                            */
/* ------------------------------------------------------------------ */

/**
 * Маркетинговая страница noveee.me.
 *
 * На этапе интеграции (корневой маршрут `/`) сюда прокидывается `onLogin` —
 * он открывает существующий экран авторизации. В изолированном прототипе
 * `/intro` проп не задан, и «Войти» показывает поясняющий toast.
 */
export function IntroPrototype({ onLogin }: { onLogin?: () => void } = {}) {
  const [demoOpen, setDemoOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const revealRef = useReveal();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  const onLoginClick = useCallback(() => {
    if (onLogin) {
      onLogin();
      return;
    }
    // Изолированный прототип /intro: авторизация не подключена.
    showToast("На этапе интеграции кнопка откроет существующий вход noveee.me");
  }, [onLogin, showToast]);

  const openDemo = useCallback(() => setDemoOpen(true), []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      ref={revealRef}
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: "#0b0b0f", color: "#f4f4f5" }}
    >
      {/* Глобальные стили прототипа */}
      <style>{`
        .rv { opacity: 0; transform: translateY(26px); transition: opacity .7s cubic-bezier(.25,.1,.25,1), transform .7s cubic-bezier(.25,.1,.25,1); }
        .rv.rv-in { opacity: 1; transform: none; }
        .rv-d1 { transition-delay: .08s } .rv-d2 { transition-delay: .16s } .rv-d3 { transition-delay: .24s }
        @keyframes intro-marquee-l { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes intro-marquee-r { from { transform: translateX(-50%) } to { transform: translateX(0) } }
        .marquee-l { animation: intro-marquee-l 70s linear infinite; }
        .marquee-r { animation: intro-marquee-r 80s linear infinite; }
        @keyframes intro-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-9px) } }
        .float-slow { animation: intro-float 7s ease-in-out infinite; }
        @keyframes intro-scan { 0% { transform: translateY(-110%) } 100% { transform: translateY(560%) } }
        .scanline { animation: intro-scan 3.6s cubic-bezier(.4,0,.6,1) infinite; }
        .intro-mask { -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
        @media (prefers-reduced-motion: reduce) {
          .marquee-l, .marquee-r, .float-slow, .scanline { animation: none !important; }
          .rv { transition: none; }
        }
        #intro-top ::selection { background: color-mix(in srgb, var(--el-primary) 40%, transparent); }
      `}</style>

      {/* ============================ ХЕДЕР ============================ */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0b0b0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-4 px-5">
          <a href="/intro" className="flex shrink-0 items-center gap-2.5">
            <img src="/noveee-icon.png" alt="noveee.me" className="h-7 w-7" />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">noveee.me</span>
          </a>
          <nav className="ml-6 hidden items-center gap-6 text-[13px] text-white/55 md:flex">
            <button onClick={() => scrollTo("problem")} className="transition hover:text-white">Зачем это нужно</button>
            <button onClick={() => scrollTo("how")} className="transition hover:text-white">Как это работает</button>
            <button onClick={() => scrollTo("organizers")} className="transition hover:text-white">Организаторам</button>
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={openDemo}
              className="hidden rounded-full border border-white/15 px-4 py-2 text-[13px] font-medium text-white/80 transition hover:-translate-y-px hover:border-white/30 hover:text-white sm:block"
            >
              Записаться на демо
            </button>
            <button
              onClick={onLoginClick}
              className="rounded-full bg-[var(--el-primary)] px-4 py-2 text-[13px] font-semibold text-black transition hover:-translate-y-px active:scale-[0.97]"
            >
              Войти
            </button>
          </div>
        </div>
      </header>

      {/* ============================ ГЕРОЙ ============================ */}
      <section className="relative overflow-hidden">
        {/* Световые акценты */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 70% at 78% -10%, color-mix(in srgb, var(--el-primary) 16%, transparent) 0%, transparent 55%), radial-gradient(70% 60% at 8% 8%, color-mix(in srgb, var(--el-accent) 9%, transparent) 0%, transparent 50%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1160px] items-center gap-14 px-5 pb-24 pt-16 lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:pb-28 lg:pt-20">
          <div className="rv">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/60">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--el-primary)] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--el-primary)]" />
              </span>
              Фотосервис для мероприятий
            </div>
            <h1 className="max-w-[15ch] text-[clamp(2.6rem,6vw,4.4rem)] font-semibold leading-[1.03] tracking-[-0.035em]">
              Ваши фотографии{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(100deg, var(--el-primary), color-mix(in srgb, var(--el-accent) 80%, var(--el-primary)))",
                }}
              >
                найдут вас
              </span>
            </h1>
            <p className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-white/60">
              Загрузите селфи — и найдите свои снимки с мероприятия. Никакого
              ручного просмотра тысяч фотографий из общей папки.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <button
                onClick={openDemo}
                className="rounded-full bg-[var(--el-primary)] px-6 py-3.5 text-[15px] font-semibold text-black shadow-[0_12px_40px_color-mix(in_srgb,var(--el-primary)_35%,transparent)] transition hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Записаться на демо
              </button>
            </div>
            <p className="mt-5 text-[13px] text-white/35">
              Участникам — вход по ссылке мероприятия. Организаторам — демонстрация сервиса.
            </p>
          </div>

          {/* Макет интерфейса галереи */}
          <div className="rv rv-d2 relative">
            <BrowserFrame url="noveee.me/p/nove-tech" className="float-slow">
              {/* Шапка галереи */}
              <div className="relative h-[110px] overflow-hidden">
                <img src={`${CONF}cover.webp`} alt="" className="h-full w-full object-cover object-center opacity-80" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,10,14,0.1), rgba(10,10,14,0.92))" }} />
                <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-semibold tracking-[-0.02em]">NOVE TECH CONFERENCE</div>
                    <div className="mt-0.5 text-[11px] text-white/50">18 сентября 2026 · 1 248 фотографий</div>
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/70 backdrop-blur">Демо-проект</span>
                </div>
              </div>

              {/* Поиск по селфи */}
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-[var(--el-primary)]">
                  <img src={SELFIE} alt="Селфи участника" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[12.5px] font-medium">
                    Найдено 12 снимков с вами
                    <span className="text-[10px] text-white/35">· из 1 248</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-[var(--el-primary)] to-[var(--el-accent)]" />
                  </div>
                </div>
              </div>

              {/* Галерея с подсветкой совпадений */}
              <div className="relative grid grid-cols-3 gap-1.5 p-3">
                <div className="scanline pointer-events-none absolute inset-x-3 top-0 z-10 h-8 opacity-40" style={{ background: "linear-gradient(180deg, transparent, color-mix(in srgb, var(--el-primary) 45%, transparent), transparent)" }} />
                {confGallery.slice(0, 6).map((p, i) => (
                  <div key={i} className={`relative aspect-[4/3] overflow-hidden rounded-lg ${p.match ? "ring-2 ring-[var(--el-primary)]" : ""}`}>
                    <img src={p.src} alt="" className="h-full w-full object-cover" />
                    {p.match && <MatchBadge small />}
                  </div>
                ))}
              </div>
            </BrowserFrame>

            {/* Плавающая карточка селфи */}
            <div className="absolute -bottom-7 -left-3 w-[196px] rotate-[-3deg] rounded-2xl border border-white/10 bg-[#16161c] p-3.5 shadow-[0_24px_60px_rgba(0,0,0,0.55)] sm:-left-8">
              <div className="flex items-center gap-2.5">
                <img src={SELFIE} alt="" className="h-10 w-10 rounded-full object-cover" />
                <div>
                  <div className="text-[12px] font-semibold">Селфи загружено</div>
                  <div className="text-[10.5px] text-white/45">Совпадений найдено: 12</div>
                </div>
              </div>
              <div className="mt-2.5 flex gap-1">
                {[confGallery[0], confGallery[2], confGallery[4]].map((p, i) => (
                  <div key={i} className="h-9 flex-1 overflow-hidden rounded-md ring-1 ring-[var(--el-primary)]">
                    <img src={p.src} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ ПРОБЛЕМА ============================ */}
      <section id="problem" className="relative border-t border-white/[0.05] py-24 lg:py-32">
        <div className="mx-auto max-w-[1160px] px-5 text-center">
          <SectionEyebrow>Знакомая ситуация</SectionEyebrow>
          <h2 className="rv mx-auto max-w-[19ch] text-[clamp(2rem,4.6vw,3.3rem)] font-semibold leading-[1.08] tracking-[-0.03em]">
            1000 фотографий. Где-то среди них — ваши
          </h2>
          <p className="rv rv-d1 mx-auto mt-5 max-w-[54ch] text-[16px] leading-relaxed text-white/55">
            Фотограф отдаёт архив, организатор кидает ссылку на общую папку —
            и после мероприятия каждый участник листает сотни снимков в поисках
            себя. Хочется забрать свои лучшие кадры, а не вечер на пролистывание
            всей папки.
          </p>
        </div>

        {/* Стена фотографий */}
        <div className="intro-mask relative mt-14 select-none">
          <div className="pointer-events-none absolute inset-0 z-10" style={{ background: "radial-gradient(60% 90% at 50% 50%, rgba(11,11,15,0.55) 0%, rgba(11,11,15,0.1) 60%, transparent 100%)" }} />
          <div className="space-y-3 opacity-55">
            <div className="flex w-max marquee-l gap-3">
              {[...wallPhotos, ...wallPhotos].map((src, i) => (
                <div key={i} className="h-[118px] w-[158px] shrink-0 overflow-hidden rounded-xl">
                  <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
            <div className="flex w-max marquee-r gap-3">
              {[...wallPhotos.slice().reverse(), ...wallPhotos.slice().reverse()].map((src, i) => (
                <div key={i} className="h-[118px] w-[158px] shrink-0 overflow-hidden rounded-xl">
                  <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rv mx-auto -mt-[86px] w-fit max-w-[90%] rounded-2xl border border-white/10 bg-[#141419]/90 px-6 py-4 text-center shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur">
          <div className="text-[13px] text-white/50">В общей папке мероприятия</div>
          <div className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em]">
            1 248 фото · <span className="text-[var(--el-primary)]">12 из них — с вами</span>
          </div>
        </div>
      </section>

      {/* ============================ КАК ЭТО РАБОТАЕТ ============================ */}
      <section id="how" className="relative border-t border-white/[0.05] py-24 lg:py-32">
        <div className="mx-auto max-w-[1160px] px-5">
          <div className="rv max-w-[620px]">
            <SectionEyebrow>Решение</SectionEyebrow>
            <h2 className="text-[clamp(2rem,4.2vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em]">
              От архива мероприятия до ваших фотографий — четыре шага
            </h2>
            <p className="mt-5 text-[15.5px] leading-relaxed text-white/55">
              Показываем на реальном проекте с платформы — «Фотки с ДР»:
              999 фотографий на странице noveee.me/p/test-noveee.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {/* Шаг 1 */}
            <div className="rv rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--el-primary)] text-[12px] font-bold text-black">1</span>
                <span className="text-[14px] font-medium">Организатор подключает фотоархив</span>
              </div>
              <div className="mt-5 rounded-[14px] bg-[#f6f6f7] p-4 text-[#17171a] shadow-lg">
                <div className="flex items-center gap-3">
                  <img src={`${DR}1.webp`} alt="" className="h-11 w-11 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-semibold">Фотки с ДР</div>
                    <div className="text-[10.5px] text-[#63636d]">999 фото · загружено</div>
                  </div>
                  <span className="ml-auto rounded-full bg-[#e8f6ec] px-2 py-0.5 text-[9.5px] font-medium text-[#15803d]">Готово</span>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#f1f1f4] px-2.5 py-1.5">
                  <span className="truncate font-mono text-[9.5px] text-[#63636d]">noveee.me/p/test-noveee</span>
                  <span className="ml-auto shrink-0 text-[9.5px] font-medium text-[#17171a]">Копировать</span>
                </div>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-white/45">
                Создаётся страница мероприятия со ссылкой для участников.
              </p>
            </div>

            {/* Шаг 2 */}
            <div className="rv rv-d1 rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--el-primary)] text-[12px] font-bold text-black">2</span>
                <span className="text-[14px] font-medium">Участник загружает селфи</span>
              </div>
              <div className="mt-5 flex justify-center">
                <PhoneFrame>
                  <div className="relative aspect-[9/13]">
                    <img src={DR_SELFIE} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
                    <div className="absolute inset-x-0 bottom-0 p-3 text-center">
                      <div className="mx-auto mb-2 h-px w-10 bg-white/40" />
                      <div className="text-[10.5px] text-white/80">Сделайте селфи</div>
                      <div className="mx-auto mt-2.5 h-9 w-9 rounded-full border-[3px] border-white/90" />
                    </div>
                  </div>
                </PhoneFrame>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-white/45">
                Одно селфи — сервис использует его для поиска по архиву.
              </p>
            </div>

            {/* Шаг 3 */}
            <div className="rv rv-d2 rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--el-primary)] text-[12px] font-bold text-black">3</span>
                <span className="text-[14px] font-medium">Сервис находит ваши фото</span>
              </div>
              <div className="mt-5 rounded-[14px] border border-white/[0.07] bg-[#101014] p-3">
                <div className="flex items-center gap-2 pb-2.5 text-[11px] text-white/55">
                  <img src={DR_SELFIE} alt="" className="h-6 w-6 rounded-full object-cover" />
                  Найдено 12 снимков с вами
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {drGallery.map((p, i) => (
                    <div key={i} className={`relative aspect-square overflow-hidden rounded-md ${p.match ? "ring-2 ring-[var(--el-primary)]" : "opacity-45"}`}>
                      <img src={p.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-white/45">
                Совпадения подсвечиваются — не нужно листать весь архив.
              </p>
            </div>

            {/* Шаг 4 */}
            <div className="rv rv-d3 rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--el-primary)] text-[12px] font-bold text-black">4</span>
                <span className="text-[14px] font-medium">Выбираете и скачиваете</span>
              </div>
              <div className="mt-5 rounded-[14px] border border-white/[0.07] bg-[#101014] p-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {[drGallery[0], drGallery[2], drGallery[4]].map((p, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-md ring-2 ring-[var(--el-primary)]">
                      <img src={p.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--el-primary)] text-[9px] font-bold text-black">✓</span>
                    </div>
                  ))}
                </div>
                <button className="mt-3 w-full rounded-full bg-[var(--el-primary)] py-2 text-[11.5px] font-semibold text-black">
                  Скачать выбранные (ZIP)
                </button>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-white/45">
                Отмечаете нужные снимки и забираете их в один клик.
              </p>
            </div>
          </div>

          <p className="rv mt-8 text-[12.5px] text-white/30">
            * Снимки и цифры — из реального проекта «Фотки с ДР» на noveee.me:
            999 фотографий подключено к странице мероприятия.
          </p>
        </div>
      </section>

      {/* ============================ ОРГАНИЗАТОРАМ ============================ */}
      <section id="organizers" className="relative border-t border-white/[0.05] py-24 lg:py-28">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 60% at 85% 30%, color-mix(in srgb, var(--el-primary) 8%, transparent) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[1160px] px-5">
          <div className="rv max-w-[760px]">
            <SectionEyebrow>Организаторам</SectionEyebrow>
            <h2 className="max-w-[22ch] text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.03em]">
              Вы организуете мероприятие — мы помогаем участникам найти свои
              фотографии
            </h2>
            <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-white/55">
              Одна страница мероприятия вместо общих папок и пересылок: подключаете
              архив, участники ищут себя по селфи, страницу оформляете под свой бренд.
            </p>
          </div>

          <ul className="rv rv-d1 mt-7 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {[
              "Участникам не нужно вручную просматривать весь архив",
              "Поиск по селфи и подсветка совпадений вместо сотен пролистанных снимков",
              "Одна ссылка на страницу мероприятия — без пересылок файлов",
              "Название, обложка и фирменный цвет — страница как часть вашего бренда",
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-white/70">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--el-primary)]/15 text-[11px] text-[var(--el-primary)]">✓</span>
                {text}
              </li>
            ))}
          </ul>

          {/* Оба экрана панели — компактно, в две колонки */}
          <div className="rv rv-d2 mt-10 grid gap-5 lg:grid-cols-2">
            <div>
              <PanelFrame>
                <OverviewScreen />
              </PanelFrame>
              <p className="mt-3 text-center text-[12.5px] text-white/30">
                «Обзор»: подключение фото, оформление и публикация страницы
              </p>
            </div>
            <div>
              <PanelFrame>
                <AppearanceScreen />
              </PanelFrame>
              <p className="mt-3 text-center text-[12.5px] text-white/30">
                «Оформление»: фирменный цвет, логотип и предпросмотр страницы
              </p>
            </div>
          </div>

          <p className="rv mt-8 text-[12.5px] text-white/30">
            Мы не обещаем конкретные цифры вовлечённости или экономии времени —
            покажем сервис на демо, а вы решите, подходит ли он вашему мероприятию.
          </p>
        </div>
      </section>

      {/* ============================ ФИНАЛЬНЫЙ CTA ============================ */}
      <section className="relative border-t border-white/[0.05]">
        <div className="mx-auto max-w-[1160px] px-5 py-24 lg:py-32">
          <div
            className="rv relative overflow-hidden rounded-[28px] border border-white/[0.08] px-6 py-16 text-center sm:px-14"
            style={{
              background:
                "radial-gradient(90% 130% at 50% -20%, color-mix(in srgb, var(--el-primary) 22%, transparent) 0%, transparent 55%), radial-gradient(80% 120% at 50% 120%, color-mix(in srgb, var(--el-accent) 14%, transparent) 0%, transparent 55%), #101014",
            }}
          >
            <h2 className="mx-auto max-w-[24ch] text-[clamp(1.8rem,4vw,2.8rem)] font-semibold leading-[1.1] tracking-[-0.03em]">
              Посмотрите, как noveee.me будет работать на вашем мероприятии
            </h2>
            <p className="mx-auto mt-5 max-w-[52ch] text-[15.5px] leading-relaxed text-white/60">
              Покажем возможности сервиса и обсудим, как организовать удобный
              доступ к фотографиям для ваших участников.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={openDemo}
                className="rounded-full bg-[var(--el-primary)] px-7 py-3.5 text-[15px] font-semibold text-black shadow-[0_14px_50px_color-mix(in_srgb,var(--el-primary)_40%,transparent)] transition hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Записаться на демо
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ ПОДВАЛ ============================ */}
      <footer className="border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-2.5">
            <span className="rounded-full bg-white/[0.06] p-1.5">
              <img src="/noveee-logo.png" alt="noveee.me" className="h-5 w-auto" />
            </span>
          </div>
          <div className="text-[12px] text-white/30">
            Прототип маркетинговой страницы · демонстрационные материалы · 2026
          </div>
        </div>
      </footer>

      {/* Тост */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[90] w-fit max-w-[92%] -translate-x-1/2 rounded-full border border-white/10 bg-[#16161c]/95 px-5 py-3 text-[13px] text-white/80 shadow-[0_16px_50px_rgba(0,0,0,0.5)] backdrop-blur">
          {toast}
        </div>
      )}

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
