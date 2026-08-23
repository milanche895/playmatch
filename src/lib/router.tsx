'use client';

import NextLink from 'next/link';
import {
  useRouter,
  usePathname,
  useParams as useNextParams,
  useSearchParams as useNextSearchParams,
} from 'next/navigation';
import { forwardRef } from 'react';

type NavigateOptions = {
  replace?: boolean;
  state?: { promptNotifications?: boolean; from?: string } | Record<string, unknown> | null;
};

export const Link = forwardRef<HTMLAnchorElement, any>(function Link(props, ref) {
  const { to, href, replace, prefetch, ...rest } = props;
  return (
    <NextLink
      ref={ref}
      href={(href || to || '/') as string}
      replace={replace}
      prefetch={prefetch}
      {...rest}
    />
  );
});

export const RouterLink = Link;

export function useNavigate() {
  const router = useRouter();

  return (to: string | number, opts?: NavigateOptions) => {
    if (typeof to === 'number') {
      if (to < 0) router.back();
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

    if (opts?.replace) router.replace(to);
    else router.push(to);
  };
}

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
  return [params ?? new URLSearchParams()] as const;
}

export { usePathname, useRouter };
