interface CEToastProps {
  msg: string;
  ok: boolean;
  details?: string;
  center?: boolean;
}

export function CEToast({ msg, ok, details, center }: CEToastProps) {
  const position = center
    ? "fixed top-6 left-1/2 -translate-x-1/2 z-[60]"
    : "fixed top-6 right-6 z-50";

  if (ok) {
    return (
      <div role="alert" className={`${position} max-w-sm`}>
        <div className="bg-green-900/90 border-l-4 border-green-500 text-green-100 px-4 py-3 rounded-lg flex items-start gap-2.5 shadow-xl transition duration-300 ease-in-out hover:bg-green-800/90 hover:scale-105 transform">
          <svg className="h-5 w-5 shrink-0 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-xs font-semibold">{msg}</p>
            {details && <p className="text-xs opacity-75 mt-0.5">{details}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className={`${position} max-w-sm`}>
      <div className="bg-red-900/90 border-l-4 border-red-500 text-red-100 px-4 py-3 rounded-lg flex items-start gap-2.5 shadow-xl transition duration-300 ease-in-out hover:bg-red-800/90 hover:scale-105 transform">
        <svg className="h-5 w-5 shrink-0 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        <div>
          <p className="text-xs font-semibold">{msg}</p>
          {details && <p className="text-xs opacity-75 mt-0.5">{details}</p>}
        </div>
      </div>
    </div>
  );
}
