import { createElement, useLayoutEffect, useRef } from "react";
import type { Decorator, Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";
import ThemeProvider from "@/lib/components/ThemeProvider";
import { THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

interface MockResponseConfig {
  status?: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
}

interface MockFetchRoute {
  method?: string;
  path: string | RegExp;
  response:
    | MockResponseConfig
    | ((url: string, init?: RequestInit) => MockResponseConfig | Promise<MockResponseConfig>);
}

function applyStoryTheme(theme: ThemePreference): void {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function matchesRoute(route: MockFetchRoute, url: string, method: string): boolean {
  const expectedMethod = route.method?.toUpperCase();
  if (expectedMethod && expectedMethod !== method) return false;

  if (typeof route.path === "string") {
    return url.includes(route.path);
  }

  return route.path.test(url);
}

function createFetchMock(routes: MockFetchRoute[], originalFetch: typeof fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl =
      typeof input === "string" || input instanceof URL ? input.toString() : input.url;
    const requestMethod = (
      init?.method ??
      (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    for (const route of routes) {
      if (!matchesRoute(route, requestUrl, requestMethod)) continue;

      const resolved =
        typeof route.response === "function"
          ? await route.response(requestUrl, init)
          : route.response;
      const headers = new Headers({
        "Content-Type": resolved.json !== undefined ? "application/json" : "text/plain",
        ...(resolved.headers ?? {}),
      });

      return new Response(
        resolved.json !== undefined ? JSON.stringify(resolved.json) : (resolved.text ?? ""),
        {
          status: resolved.status ?? 200,
          headers,
        }
      );
    }

    return originalFetch(input, init);
  }) as typeof fetch;
}

function AppShellDecorator({
  Story,
  theme,
  routes,
}: {
  Story: Parameters<Decorator>[0];
  theme: ThemePreference;
  routes: MockFetchRoute[];
}) {
  const originalFetchRef = useRef<typeof fetch | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    applyStoryTheme(theme);
    if (!originalFetchRef.current) {
      originalFetchRef.current = window.fetch.bind(window);
    }
    window.fetch = routes.length
      ? createFetchMock(routes, originalFetchRef.current)
      : originalFetchRef.current;

    return () => {
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
      }
    };
  }, [theme, routes]);

  return createElement(
    ThemeProvider,
    { key: theme },
    createElement(
      "div",
      { className: "min-h-screen bg-background px-4 py-6 text-foreground sm:px-6" },
      createElement(Story)
    )
  );
}

const withAppShell: Decorator = (Story, context) => {
  const theme = (context.globals.theme as ThemePreference | undefined) ?? "light";
  const routes = (context.parameters.mockFetch as MockFetchRoute[] | undefined) ?? [];

  return createElement(AppShellDecorator, { Story, theme, routes });
};

const preview: Preview = {
  decorators: [withAppShell],
  globalTypes: {
    theme: {
      description: "Global theme for component previews",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  parameters: {
    layout: "padded",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
  },
};

export default preview;
