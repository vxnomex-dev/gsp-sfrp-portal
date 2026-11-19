/** Cookie that remembers light / dark / system. Readable by the inline script so the page never flashes. */
export const THEME_COOKIE = "gsp_theme";

/** Runs before the page paints: applies the saved theme (default light) and follows the OS when set to "system". */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement;var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);var p=m?m[1]:'light';var q=window.matchMedia('(prefers-color-scheme: dark)');function a(){d.dataset.theme=(p==='dark'||(p==='system'&&q.matches))?'dark':'light'}d.dataset.themePref=p;a();q.addEventListener('change',function(){if(d.dataset.themePref==='system'){p='system';a()}});window.__gspSetTheme=function(t){p=t;d.dataset.themePref=t;a()}}catch(e){}})();`;
