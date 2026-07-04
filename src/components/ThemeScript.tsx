/**
 * Inline boot for theme + `html lang`. Keep as the first child of `<body>` in root layout
 * (do not wrap in a manual `<head>` — that can break App Router document merge / hydration).
 */
export function ThemeBootScript() {
  const boot = `(function(){try{var k='tutorcrm-theme',t=localStorage.getItem(k),r=document.documentElement.classList;if(t==='dark')r.add('dark');else if(t==='light')r.remove('dark');else if(window.matchMedia('(prefers-color-scheme: dark)').matches)r.add('dark');else r.remove('dark');}catch(e){}try{var m=document.cookie.match(/(?:^|; )tutorcrm-locale=([^;]*)/),v=m&&m[1]?decodeURIComponent(m[1]):'';if(v==='ru'||v==='uz'||v==='en')document.documentElement.lang=v;}catch(e){}})();`;
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: boot }}
    />
  );
}
