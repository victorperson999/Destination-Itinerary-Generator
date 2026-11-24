export function BrandLogo({
  size = 18,
  className = "text-sidebar-primary",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.45}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <circle cx="6" cy="17.5" r="2.1" />
      <circle cx="18" cy="6.5" r="2.1" fill="currentColor" fillOpacity="0.22" />
      <path d="M7.6 15.9C9.4 14.1 9.5 11.4 12 12C14.5 12.6 14.6 9.9 16.4 8.1" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}
