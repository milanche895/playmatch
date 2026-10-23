'use client';

import NextLink from 'next/link';
import {
  useRouter,
  usePathname,
  useParams as useNextParams,
  useSearchParams as useNextSearchParams,
} from 'next/navigation';
import { forwardRef, useCallback, useEffect, useRef, type MouseEvent } from 'react';
import { getPreviousHref, markNav, normalizeHref, syncNavStack } from './navHistory';

type NavigateOptions = {
  replace?: boolean;
  state?: { promptNotifications?: boolean; from?: string } | Record<string, unknown> | null;
};

export const Link = forwardRef<HTMLAnchorElement, any>(function Link(props, ref) {
  const { to, href, replace, prefetch, onClick, ...rest } = props;
  const pathname = usePathname() ?? '/';
  const searchParams = useNextSearchParams();
  const current = normalizeHref(
    searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname
  );
  const destination = (href || to || '/') as string;

  return (
    <NextLink
      ref={ref}
      href={destination}
      replace={replace}
      prefetch={prefetch}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        const target = normalizeHref(destination);
        if (target === current) return;
        markNav(replace ? 'replace' : 'push', destination);
      }}
      {...rest}
    />
  );
});

export const RouterLink = Link;

export function useNavigate() {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const searchParams = useNextSearchParams();
  const current = normalizeHref(
    searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname
  );

  return useCallback((to: string | number, opts?: NavigateOptions) => {
    if (typeof to === 'number') {
      if (to < 0) {
        markNav('back');
        router.back();
      }
      return;
    }

    const state = opts?.state as { promptNotifications?: boolean } | undefined;
    if (state?.promptNotifications && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('plejko:prompt-notifications', '1');
      } catch {
        // private mode
      }
    }

    const target = normalizeHref(to);
    if (target === current) return;

    markNav(opts?.replace ? 'replace' : 'push', to);
    if (opts?.replace) router.replace(to);
    else router.push(to);
  }, [router, current]);
}

/** Back inside the app. Without an in-app page to return to, opens `fallback`. */
export function useGoBack() {
  const navigate = useNavigate();

  return useCallback((fallback: string) => {
    if (getPreviousHref()) navigate(-1);
    else navigate(fallback);
  }, [navigate]);
}

/** Records client navigations, including Link clicks, into the in-app back stack. */
export function NavigationHistory() {
  const pathname = usePathname() ?? '/';
  const searchParams = useNextSearchParams();
  const href = normalizeHref(
    searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname
  );

  useEffect(() => {
    syncNavStack(href);
  }, [href]);

  return null;
}

export { getPreviousHref };

export function useLocation() {
  const pathname = usePathname() ?? '/';
  const searchParams = useNextSearchParams();
  const search = searchParams?.toString() ?? '';

  return {
    pathname,
    search: search ? `?${search}` : '',
    state: null as { from?: string; promptNotifications?: boolean } | null,
  };
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string>>() {
  return useNextParams() as T;
}

export function useSearchParams() {
  const params = useNextSearchParams();
  const fallbackRef = useRef<URLSearchParams>();
  if (!params) {
    if (!fallbackRef.current) fallbackRef.current = new URLSearchParams();
    return [fallbackRef.current] as const;
  }
  return [params] as const;
}

export { usePathname, useRouter };
