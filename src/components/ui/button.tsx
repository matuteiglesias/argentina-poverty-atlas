import type { ButtonHTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-slate-950 px-5 py-3 text-white hover:bg-slate-800",
        secondary:
          "border border-slate-300 bg-white/70 px-4 py-2 text-slate-900 hover:bg-white",
        ghost:
          "px-3 py-2 text-slate-700 hover:bg-white/70 hover:text-slate-950",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export function Button({ className, variant, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant }), className)} {...props} />
  )
}
