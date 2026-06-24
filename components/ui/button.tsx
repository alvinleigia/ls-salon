import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import {
  ArrowLeft,
  Ban,
  Check,
  Copy,
  Eye,
  Filter,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const derivePlainTextChildren = (children: React.ReactNode): string | null => {
  let result = ""
  let hasNonPrimitive = false
  React.Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      result += String(child)
      return
    }
    if (child === null || child === undefined || typeof child === "boolean") {
      return
    }
    if (React.isValidElement(child) && child.type === React.Fragment) {
      const fragmentChildren = (child.props as { children?: React.ReactNode }).children
      const nested = derivePlainTextChildren(fragmentChildren)
      if (nested === null) {
        hasNonPrimitive = true
        return
      }
      result += nested
      return
    }
    hasNonPrimitive = true
  })
  if (hasNonPrimitive) return null
  return result.trim()
}

const iconForLabel = (label: string) => {
  const value = label.toLowerCase()
  if (value.startsWith("add") || value.startsWith("new") || value.startsWith("create")) return <Plus className="h-4 w-4" />
  if (value.startsWith("save") || value.startsWith("update")) return <Save className="h-4 w-4" />
  if (value.startsWith("edit")) return <Pencil className="h-4 w-4" />
  if (value.startsWith("delete") || value.startsWith("remove")) return <Trash2 className="h-4 w-4" />
  if (value.startsWith("cancel") || value.startsWith("close")) return <X className="h-4 w-4" />
  if (value.startsWith("back")) return <ArrowLeft className="h-4 w-4" />
  if (value.startsWith("search")) return <Search className="h-4 w-4" />
  if (value.startsWith("filter")) return <Filter className="h-4 w-4" />
  if (value.startsWith("apply") || value.startsWith("confirm") || value.startsWith("mark")) return <Check className="h-4 w-4" />
  if (value.startsWith("send") || value.startsWith("submit") || value.startsWith("invite")) return <Send className="h-4 w-4" />
  if (value.startsWith("email")) return <Mail className="h-4 w-4" />
  if (value.startsWith("copy")) return <Copy className="h-4 w-4" />
  if (value.startsWith("reset")) return <RotateCcw className="h-4 w-4" />
  if (value.startsWith("revoke")) return <Ban className="h-4 w-4" />
  if (value.startsWith("view")) return <Eye className="h-4 w-4" />
  return null
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  loadingText,
  autoIcon = true,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    loadingText?: string
    autoIcon?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  const plainText = derivePlainTextChildren(children)
  const autoIconNode = autoIcon && plainText ? iconForLabel(plainText) : null

  if (asChild) {
    return (
      <Comp
        data-slot="button"
        data-variant={variant}
        data-size={size}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Comp>
    )
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {!loading ? autoIconNode : null}
      {loading && loadingText ? loadingText : children}
    </Comp>
  )
}

export { Button, buttonVariants }

