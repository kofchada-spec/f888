import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { haptics } from "@/utils/haptics"

const magicButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-95 overflow-hidden relative",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-glow-primary hover:shadow-[0_8px_30px_hsla(142,76%,36%,0.4)] hover:scale-[1.02]",
        secondary:
          "bg-gradient-to-br from-secondary to-secondary-glow text-secondary-foreground shadow-glow-secondary hover:shadow-[0_8px_30px_hsla(217,91%,60%,0.4)] hover:scale-[1.02]",
        success:
          "bg-gradient-to-br from-green-500 to-green-400 text-white shadow-[0_4px_20px_hsla(142,76%,50%,0.3)] hover:shadow-[0_8px_30px_hsla(142,76%,50%,0.4)] hover:scale-[1.02]",
        ghost:
          "hover:bg-accent hover:text-accent-foreground hover:scale-[1.02]",
        outline:
          "border-2 border-primary bg-background hover:bg-primary/5 hover:scale-[1.02]",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 px-4 py-2 text-xs",
        lg: "h-14 px-8 py-4 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface MagicButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof magicButtonVariants> {
  asChild?: boolean
  withRipple?: boolean
  hapticFeedback?: 'light' | 'medium' | 'heavy' | 'success'
}

const MagicButton = React.forwardRef<HTMLButtonElement, MagicButtonProps>(
  ({ className, variant, size, asChild = false, withRipple = true, hapticFeedback = 'medium', onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const [ripples, setRipples] = React.useState<Array<{ x: number; y: number; id: number }>>([])

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      // Haptic feedback
      if (hapticFeedback) {
        await haptics[hapticFeedback]()
      }

      // Ripple effect
      if (withRipple && !asChild) {
        const button = e.currentTarget
        const rect = button.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const id = Date.now()
        
        setRipples(prev => [...prev, { x, y, id }])
        setTimeout(() => {
          setRipples(prev => prev.filter(ripple => ripple.id !== id))
        }, 600)
      }

      onClick?.(e)
    }

    return (
      <Comp
        className={cn(magicButtonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      >
        {withRipple && ripples.map(ripple => (
          <span
            key={ripple.id}
            className="absolute rounded-full bg-white/30 animate-ping"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: '20px',
              height: '20px',
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
        {props.children}
      </Comp>
    )
  }
)
MagicButton.displayName = "MagicButton"

export { MagicButton, magicButtonVariants }
