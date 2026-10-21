export function BrandMark({ className = "size-9" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex ${className} items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground`}
    >
      R
    </span>
  );
}
