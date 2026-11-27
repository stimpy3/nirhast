import React from 'react';

// Line icons drawn as SVG (shapes based on Lucide, ISC licence) so they look the same on every
// phone, unlike emoji. Decorative by default: the text next to them says what they mean.
function Icon({ size = 20, children, strokeWidth = 2 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="icon"
    >
      {children}
    </svg>
  );
}

const make = (paths) => (props) => <Icon {...props}>{paths}</Icon>;

export const MicIcon = make(<><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" /></>);
export const MicOffIcon = make(<><path d="m2 2 20 20" /><path d="M18.89 13.23A7 7 0 0 0 19 12v-2" /><path d="M5 10v2a7 7 0 0 0 12 5" /><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12" /><path d="M12 19v3" /></>);
export const StopIcon = make(<><circle cx="12" cy="12" r="10" /><rect x="9" y="9" width="6" height="6" rx="1" /></>);
export const ClockIcon = make(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>);
export const ForwardIcon = make(<><path d="m13 19 9-7-9-7v14Z" /><path d="m2 19 9-7-9-7v14Z" /></>);
export const HomeIcon = make(<><path d="M12 2v2" /><path d="M5 10h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9Z" /><path d="M3 10h18" /><path d="M8 6c0-1 .5-2 2-2" /><path d="M14 4c1.5 0 2 1 2 2" /></>);
export const ChatIcon = make(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8" /><path d="M8 13h5" /></>);
export const StoreIcon = make(<><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /><path d="M2 7h20" /><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-2-1 2.7 2.7 0 0 1-2 1 2.7 2.7 0 0 1-2-1 2.7 2.7 0 0 1-2 1 2.7 2.7 0 0 1-2-1 2.7 2.7 0 0 1-2 1 2 2 0 0 1-2-2V7" /></>);
export const SlidersIcon = make(<><path d="M21 4h-7" /><path d="M10 4H3" /><path d="M21 12h-9" /><path d="M8 12H3" /><path d="M21 20h-5" /><path d="M12 20H3" /><path d="M14 2v4" /><path d="M8 10v4" /><path d="M16 18v4" /></>);
export const UtensilsIcon = make(<><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></>);
export const ArrowRightIcon = make(<><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>);
export const ChevronIcon = make(<path d="m18 15-6-6-6 6" />);
export const SendIcon = make(<><path d="m3 3 3 9-3 9 19-9Z" /><path d="M6 12h16" /></>);
export const CheckIcon = make(<path d="M20 6 9 17l-5-5" />);
export const XIcon = make(<path d="M18 6 6 18M6 6l12 12" />);
export const PlusIcon = make(<path d="M12 5v14M5 12h14" />);
export const CheckCircleIcon = make(<><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>);
export const DoubleCheckIcon = make(<><path d="M18 6 7 17l-5-5" /><path d="m22 10-7.5 7.5L13 16" /></>);
export const EarIcon = make(<><path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" /><path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" /></>);
export const InfoIcon = make(<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>);
export const ShieldIcon = make(<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />);
export const HistoryIcon = make(<><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></>);
export const UsersIcon = make(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>);
export const QuestionIcon = make(<><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></>);
export const MoreIcon = make(<><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>);
export const ArrowLeftIcon = make(<><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>);
