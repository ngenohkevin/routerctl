/**
 * The desktop rail folded to icons. The state lives on <html data-rail> so
 * CSS (the `rail-collapsed:` variant) lays the page out before React runs,
 * and in localStorage so each device keeps its own choice.
 */
const KEY = 'routerctl_rail';
const EVENT = 'routerctl:rail';

/** Inlined into <head>: applies a saved choice before the first paint, so the wide rail never flashes. */
export const RAIL_SCRIPT = `try{if(localStorage.getItem('${KEY}')==='collapsed')document.documentElement.dataset.rail='collapsed'}catch(e){}`;

export function isRailCollapsed() {
  return document.documentElement.dataset.rail === 'collapsed';
}

export function setRailCollapsed(collapsed: boolean) {
  const root = document.documentElement;
  if (collapsed) root.dataset.rail = 'collapsed';
  else delete root.dataset.rail;
  try {
    if (collapsed) localStorage.setItem(KEY, 'collapsed');
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked (private browsing): the choice holds until the page reloads.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeRail(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
