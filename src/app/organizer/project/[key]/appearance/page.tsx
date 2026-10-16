// @TheTechMargin 2026
// Оформление: фон верхней части страницы, акцентный цвет, логотип.
// Слева — настройки, справа — живой предпросмотр публичной страницы.

"use client";

import { useState } from "react";
import { useOrganizer } from "@/hooks/organizer/OrganizerContext";
import { SectionHeader, ConfirmDialog } from "@/app/organizer/components/ui";
import ColorControl from "@/app/organizer/components/ColorControl";
import ImageField from "@/app/organizer/components/ImageField";
import PagePreview from "@/app/organizer/components/PagePreview";
import {
  HERO_ACCEPTED_TYPES,
  HERO_IMAGE_MAX_BYTES,
  LOGO_ACCEPTED_TYPES,
  LOGO_MAX_BYTES,
  HeroMode,
  defaultEventSettings,
} from "@/lib/eventSettings";

const MODES: Array<{ key: HeroMode; label: string }> = [
  { key: "default", label: "Стандарт" },
  { key: "color", label: "Цвет" },
  { key: "gradient", label: "Градиент" },
  { key: "image", label: "Изображение" },
];

export default function AppearancePage() {
  const {
    draft,
    published,
    updateBranding,
    updateHero,
    resetBranding,
    unsavedChanges,
    unpublishedChanges,
    busy,
    notify,
    save,
    publish,
  } = useOrganizer();

  const [confirmReset, setConfirmReset] = useState(false);
  const hero = draft.branding.hero;
  const defaultHero = defaultEventSettings().branding.hero;

  const previewMode =
    published && !unsavedChanges && !unpublishedChanges ? "published" : "draft";

  const resetHero = () => {
    updateHero(defaultHero);
    notify("Фон верхней части возвращён к стандарту");
  };

  return (
    <div>
      <SectionHeader
        title="Оформление"
        description="Настройте внешний вид публичной страницы. Результат виден в предпросмотре сразу — публикация отдельным шагом."
        action={
          <>
            <button
              className="org-btn org-btn-secondary"
              onClick={() => void save()}
              disabled={busy || !unsavedChanges}
            >
              Сохранить
            </button>
            <button
              className="org-btn org-btn-primary"
              onClick={() => void publish()}
              disabled={busy}
            >
              Опубликовать
            </button>
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        {/* ── Настройки ── */}
        <div className="flex flex-col gap-4">
          {/* Верхняя часть страницы */}
          <div className="org-card p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--org-faint)]">
                Верхняя часть страницы
              </p>
              {hero.mode !== "default" && (
                <button className="org-btn org-btn-ghost text-[12.5px]" onClick={resetHero}>
                  Сбросить фон
                </button>
              )}
            </div>

            <div className="org-seg mt-3.5 flex-wrap" role="tablist" aria-label="Фон верхней части">
              {MODES.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  role="tab"
                  aria-selected={hero.mode === mode.key}
                  data-active={hero.mode === mode.key ? "true" : "false"}
                  onClick={() => updateHero({ mode: mode.key })}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {hero.mode === "default" && (
                <p className="org-hint">
                  Фирменный тёмный фон noveee.me со световыми акцентами в цветах
                  мероприятия. Ничего не меняется, пока вы не выберете другой режим.
                </p>
              )}

              {hero.mode === "color" && (
                <ColorControl
                  value={hero.color}
                  onChange={(hex) => updateHero({ color: hex })}
                  label="Цвет верхней части"
                  hint="Сплошной фон. Тон текста подбирается автоматически, чтобы заголовок оставался читаемым."
                  showButtonPreview={false}
                  showPresets
                />
              )}

              {hero.mode === "gradient" && (
                <div className="flex flex-col gap-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="org-label mb-1.5">Начало</span>
                      <ColorControl
                        value={hero.gradientFrom}
                        onChange={(hex) => updateHero({ gradientFrom: hex })}
                        label="Цвет начала градиента"
                        hint=""
                        showButtonPreview={false}
                      />
                    </div>
                    <div>
                      <span className="org-label mb-1.5">Конец</span>
                      <ColorControl
                        value={hero.gradientTo}
                        onChange={(hex) => updateHero({ gradientTo: hex })}
                        label="Цвет конца градиента"
                        hint=""
                        showButtonPreview={false}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="org-label">Направление</span>
                      <span className="text-[12.5px] font-medium text-[var(--org-dim)]">
                        {hero.gradientAngle}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={hero.gradientAngle}
                      onChange={(e) => updateHero({ gradientAngle: Number(e.target.value) })}
                      className="mt-2 w-full accent-[var(--org-text)]"
                      aria-label="Угол градиента"
                    />
                  </div>
                </div>
              )}

              {hero.mode === "image" && (
                <div className="flex flex-col gap-3.5">
                  <ImageField
                    variant="wide"
                    label="Фоновое изображение"
                    hint="Крупная картинка без мелких деталей — текст поверх неё читается лучше всего."
                    accept={HERO_ACCEPTED_TYPES}
                    maxBytes={HERO_IMAGE_MAX_BYTES}
                    value={hero.image}
                    emptyText="Загрузить фоновое изображение"
                    onChange={(image, luminance) =>
                      updateHero({ image, imageLuminance: luminance ?? null })
                    }
                  />
                  <div>
                    <span className="org-label mb-1.5">Показ фона</span>
                    <div className="org-seg" role="group" aria-label="Масштаб фона">
                      <button
                        type="button"
                        data-active={hero.imageFit === "cover" ? "true" : "false"}
                        onClick={() => updateHero({ imageFit: "cover" })}
                      >
                        Заполнять
                      </button>
                      <button
                        type="button"
                        data-active={hero.imageFit === "contain" ? "true" : "false"}
                        onClick={() => updateHero({ imageFit: "contain" })}
                      >
                        Вписать целиком
                      </button>
                    </div>
                    <p className="org-hint mt-1.5">
                      «Заполнять» — без пустых полей, «Вписать» — видна вся картинка.
                    </p>
                  </div>
                </div>
              )}

              {hero.mode !== "default" && (
                <div className="mt-4 border-t border-[var(--org-border)] pt-3.5">
                  <div className="flex items-center justify-between">
                    <span className="org-label">Затемнение фона</span>
                    <span className="text-[12.5px] font-medium text-[var(--org-dim)]">
                      {hero.overlay}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={90}
                    value={hero.overlay}
                    onChange={(e) => updateHero({ overlay: Number(e.target.value) })}
                    className="mt-2 w-full accent-[var(--org-text)]"
                    aria-label="Затемнение фона"
                  />
                  <p className="org-hint">
                    Увеличьте затемнение, если заголовок плохо читается на ярком фоне.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Акцентный цвет */}
          <div className="org-card p-5">
            <p className="mb-3.5 text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--org-faint)]">
              Акцентный цвет
            </p>
            <ColorControl
              value={draft.branding.accent}
              onChange={(hex) => updateBranding({ accent: hex })}
              showPresets
            />
          </div>

          {/* Логотип */}
          <div className="org-card p-5">
            <p className="mb-3.5 text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--org-faint)]">
              Логотип
            </p>
            <ImageField
              label="Логотип мероприятия или компании"
              hint="Отображается в левом верхнем углу страницы. Если логотипа нет — там название мероприятия."
              accept={LOGO_ACCEPTED_TYPES}
              maxBytes={LOGO_MAX_BYTES}
              value={draft.branding.logo}
              emptyText="Загрузить логотип"
              onChange={(logo) => updateBranding({ logo })}
            />
          </div>

          {/* Сброс */}
          <div className="org-card flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold tracking-[-0.01em]">
                Сбросить оформление
              </p>
              <p className="org-hint mt-0.5">
                Вернуть стандартный фон, цвет и убрать логотип — сразу на публичной
                странице.
              </p>
            </div>
            <button
              className="org-btn org-btn-danger"
              onClick={() => setConfirmReset(true)}
              disabled={busy}
            >
              Сбросить оформление
            </button>
          </div>
        </div>

        {/* ── Предпросмотр ── */}
        <div className="lg:sticky lg:top-[104px]">
          <PagePreview settings={draft} mode={previewMode} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Сбросить оформление?"
        description="Фон, акцентный цвет и логотип вернутся к стандартным значениям. Действие сразу применится к публичной странице."
        confirmLabel="Сбросить"
        busy={busy}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          void resetBranding().then(() => setConfirmReset(false));
        }}
      />
    </div>
  );
}
