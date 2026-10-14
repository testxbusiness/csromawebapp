# Goal 5 — Final regression audit evidence

Data audit: 14/10/2026
Scope: Athlete mobile menu/profile redesign, account/subject isolation, shared shell regression.

## Route and role matrix

| Area | Primary mobile navigation | Secondary navigation | Desktop guard | Result |
| --- | --- | --- | --- | --- |
| Athlete personale | Oggi `/dashboard`; Calendario `/athlete/calendar`; Campionato `/athlete/campionati`; Messaggi `/athlete/messages`; Profilo `/athlete/profile` | Amministrazione `/athlete/fees`, linked from Profile | `RoleSidebar` remains desktop-only; `LayoutShell` does not pass `onMenuOpen` and does not render the mobile drawer | PASS by code and Jest |
| Famiglia con subject | Permission-filtered family navigation, subject-aware | Amministrazione only when the relationship permits it | Family drawer and subject/team switchers preserved | PASS by code, family-navigation tests |
| Coach | Coach-specific five-item bottom navigation on mobile; coach drawer remains available | Coach profile/payments flows preserved | Coach sidebar preserved | PASS by code and Jest; no Athlete changes |
| Admin | Admin shell/sidebar | Admin groups unchanged | Admin guard and desktop workspace preserved | PASS by code; admin regression tests remain green |

## Viewport/theme matrix

Required viewports: 375×812, 390×844, 390×905, 768×1024, 1024×768, 1440×900.

| Surface | Light | Dark | Automated evidence | Runtime evidence |
| --- | --- | --- | --- | --- |
| Athlete navigation/Profile/Administration | covered by responsive CSS and component contracts | ThemeToggle and token usage covered by tests | Jest navigation/Profile suites; build | Authenticated smoke with system Chrome passed at all required dimensions; standard Playwright Chromium remains blocked by `SIGTRAP` |
| Family navigation | permission filtering covered | shared theme path unchanged | family-navigation and component tests | Authenticated browser unavailable |
| Coach/Admin/desktop isolation | shared shell branches preserved | shared theme path unchanged | full Jest suite and build | Existing authenticated smoke artifacts only; no new runtime claim |

The required Playwright specs are discoverable (`42` tests across `13` files). The repository-managed Chromium runtime could not start in this environment: it fails before test execution in `tests/e2e/global-setup.ts` with `SIGTRAP`, not in the application. A bounded authenticated smoke was therefore run with the installed system Chrome executable against the local development server.

## Navigation and deep-link checks

- Bottom navigation contains exactly five personal Athlete destinations and uses the canonical labels above.
- `/athlete/fees` maps active state to `Profilo` without adding a sixth item.
- Profile links to `/athlete/fees`; administrative summary links preserve `section=certificate`, `section=enrollment`, or `section=fees`.
- `AppHeader` keeps the logo link at `/dashboard`; detail pages use history-based back via `router.back()`.
- `RoleSidebar` still contains `Amministrazione` for desktop and non-personal shells only; it is not mounted in the Athlete-personal mobile drawer path.
- No duplicate administrative item is present in the personal bottom navigation.

Authenticated system-Chrome smoke evidence:

- 375×812, 390×844, 390×905, and 768×1024: one Athlete navigation with exactly `Oggi`, `Calendario`, `Campionato`, `Messaggi`, `Profilo`; burger count `0`; horizontal overflow `false`.
- 1024×768 and 1440×900: bottom navigation is not rendered; desktop shell remains active; burger count `0`; horizontal overflow `false`.
- `/athlete/fees?section=fees`: URL preserved, `#administration-fees` received focus, `Situazione economica` rendered, and `Profilo` had `aria-current="page"`.
- Browser history back from the deep link returned to `/athlete/profile`.
- Profile theme control was exercised at 390×844: `Attiva tema scuro` changed the root to `theme-dark` and the control label to `Attiva tema chiaro`.
- The authenticated local family account was not dual-role and did not expose `Area familiare`; family runtime switching could not be exercised with that fixture.

## Account/subject/cache checks

- Query keys remain account + subject scoped through `athleteKeys`; no redesign code changes query keys.
- Subject switching creates a new query context and existing tests verify that Subject A data is not shown while Subject B loads.
- Logout/account switching remains protected by `signOut()` plus `QuerySessionCacheBoundary`, which clears the QueryClient on the session/account boundary.
- Profile and Administration distinguish loading, cached/background refresh, offline, error, and 403 states in their component tests.
- The cache remains in memory; no persistence or Service Worker authenticated API cache was introduced.

## `silentRefresh()` audit

`LayoutShell` invokes `silentRefresh()` only when the pathname changes into Dashboard or a Profile route from another route, once per destination pathname. The function calls `supabase.auth.getSession()` and, for an authenticated user, `loadProfile(uid, false)`; it does not refetch Athlete Dashboard, Profile, Administration, Messages, or Calendar query data.

Decision: retained. The call is not redundant with TanStack Query because it refreshes the session/account/profile shell contract, not page server state. Removing it would risk stale account/role/header state after cross-route navigation. In the authenticated Chrome smoke, after login had warmed the existing profile cache, the cross-route Profile → Dashboard transition produced **0 additional `/api/me/profile` requests**; `loadProfile(uid, false)` returned through the existing in-memory/session cache path. If the profile shell is not already resolved, the same code can produce one `/api/me/profile` request. It does not create a page-data waterfall and does not replace cached page UI.

## Automated verification

- Targeted Jest: **5 suites / 41 tests passed** (`BottomNavigation`, `AppHeader`, `RoleSidebar`, `AthleteProfileManager`, `AthleteAdministrationManager`).
- Full Jest: **122 suites / 499 tests passed; 2 tests failed** in `src/app/api/coach/championships/mutations/route.test.ts`, receiving 500 instead of expected 403/400. This is outside the Goal 5 files and the Athlete redesign path.
- `./node_modules/.bin/tsc --noEmit`: **passed**.
- `npm run build`: **passed**.
- `git diff --check`: **passed**.
- `npx playwright test --list`: **42 tests discovered**.
- Authenticated repository Playwright smoke: **blocked before execution** by Chromium headless `SIGTRAP` in `tests/e2e/global-setup.ts`.
- Authenticated system-Chrome smoke: **passed** for Athlete route/nav/deep-link/viewport checks listed above.
- Authenticated system-Chrome theme smoke: **passed** for light → dark toggle and accessible label update.
- Family account smoke: **not executable for subject switching** because the configured local family account is not dual-role and exposes no `Area familiare` entry.
- Manual in-app browser check: local `/login` showed the intended offline fallback.
- No code or temporary debug logging was added by Goal 5. Existing auth diagnostic logging in `src/hooks/useAuth.ts` was not changed because it predates this goal and is outside scope.

## Open risks

- The repository-managed Chromium runner still requires an environment where it can launch; the equivalent Athlete smoke was completed with system Chrome.
- Delegated subject switching and permission combinations beyond the available fixtures remain covered by server/component tests rather than this runtime smoke.
- The two unrelated Coach mutation test failures remain open and should be handled in a Coach/API goal.
