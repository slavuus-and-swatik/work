import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
      viewBox="0 0 48 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: 'loading-wave-drift 3s ease-in-out infinite', ...props.style }}
    >
      <path className="loading-wave-line wave-one" d="M2 12C7 2 12 2 17 12S27 22 32 12 42 2 46 12" />
      <path className="loading-wave-line wave-two" d="M2 12C7 22 12 22 17 12S27 2 32 12 42 22 46 12" />
    </svg>
  )
}

export { Spinner }
