import { cn } from "@/lib/utils";

/** Official QI mark (supplied SVG, 114×114) inlined as paths — same mark as Service Desk, so the family reads as one. */
export function QiMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 114 114" aria-hidden className={cn("shrink-0", className)}>
      <path d="M0 0 C6.20234421 6.07176855 8.96235414 13.85421989 9.4375 22.4375 C9.08255777 30.80822087 5.73735795 38.22830225 0.015625 44.2734375 C-3.32521634 47.13516593 -7.03593004 49.13032528 -11 51 C-3.21323332 54.53454617 4.61736325 56.405608 13 58 C12.10908928 62.33390943 10.64159091 64.3446733 7 67 C-2.81999217 67.48295043 -14.4100578 62.49354872 -22.5625 57.1875 C-27.50144967 54.21847491 -32.58115145 54.44252259 -38.21875 54.22265625 C-48.6824284 53.6065099 -58.73411635 50.53943605 -66.10546875 42.78515625 C-73.36425639 33.79024621 -74.05780957 25.22330413 -73 14 C-71.42820369 6.78764352 -66.82691571 1.36780261 -61 -3 C-42.70055496 -13.31470865 -16.92200905 -12.8887841 0 0 Z M-52.37109375 6.0625 C-57.07802473 11.66115171 -57.56532897 17.82537837 -57.33984375 24.96875 C-56.6961766 30.70996503 -55.26680823 35.67531581 -51.1640625 39.8828125 C-43.46684549 45.98750185 -35.60283256 46.89144979 -26 46 C-19.6092028 44.53999572 -15.24382133 42.00025289 -11.15625 36.87890625 C-6.95452432 30.05110202 -7.24610979 22.73729426 -8 15 C-9.55736063 9.38625819 -11.96566274 5.30770354 -16.8125 2 C-28.71932283 -4.3338926 -42.53476918 -3.47575412 -52.37109375 6.0625 Z " fill="#283A6A" transform="translate(77,38)" />
      <path d="M0 0 C11.22 0 22.44 0 34 0 C34 19.47 34 38.94 34 59 C28.39 59 22.78 59 17 59 C17 41.51 17 24.02 17 6 C11.39 6 5.78 6 0 6 C0 4.02 0 2.04 0 0 Z " fill="#283A6A" transform="translate(76,29)" />
      <path d="M0 0 C5.61 0 11.22 0 17 0 C17 3.63 17 7.26 17 11 C11.39 11 5.78 11 0 11 C0 7.37 0 3.74 0 0 Z " fill="#EB2A31" transform="translate(93,13)" />
    </svg>
  );
}

export function Logo({ className, size = 24, wordmark = true, plate }: { className?: string; size?: number; wordmark?: boolean; plate?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 leading-none", className)}>
      {plate ? <span className="inline-flex items-center justify-center rounded-md bg-white p-1"><QiMark size={size} /></span> : <QiMark size={size} />}
      {wordmark && <span className="text-[14px] font-medium tracking-[-0.01em] text-ink">Timesheets</span>}
    </span>
  );
}
