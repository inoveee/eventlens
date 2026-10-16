// @TheTechMargin 2026
"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--el-bg)] px-4">
          <div className="text-center rounded-3xl border border-[var(--el-red-33)] bg-[var(--el-surface)] p-8 shadow-[0_16px_48px_rgba(0,0,0,0.2)]">
            <h2 className="text-sm font-semibold text-[var(--el-red)]">
              Что-то пошло не так
            </h2>
            <p className="mt-2 text-sm text-[var(--el-text-dim)]">
              Не удалось загрузить галерею
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="mt-5 border border-[var(--el-primary-33)] px-7 py-2.5 text-sm font-medium text-[var(--el-t-primary-99)] hover:border-[var(--el-primary)] hover:text-[var(--el-t-primary)] transition-all"
            >
              Обновить
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
