"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type SearchableMultiSelectOption = {
  value: string
  label: string
}

type SearchableMultiSelectProps = {
  values: string[]
  onChange: (values: string[]) => void
  options: SearchableMultiSelectOption[]
  placeholder: string
  searchPlaceholder?: string
  emptyLabel?: string
  disabled?: boolean
  id?: string
}

export function SearchableMultiSelect({
  values,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Type to search...",
  emptyLabel = "No results found.",
  disabled = false,
  id,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedLabels = React.useMemo(() => {
    if (!values.length) return ""
    const labelMap = new Map(options.map((option) => [option.value, option.label]))
    return values
      .map((value) => labelMap.get(value))
      .filter((label): label is string => Boolean(label))
      .join(", ")
  }, [options, values])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between px-3 font-normal"
        >
          <span className={cn("truncate text-left", !values.length && "text-muted-foreground")}>
            {values.length ? selectedLabels : placeholder}
          </span>
          <ChevronsUpDownIcon className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = values.includes(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      if (isSelected) {
                        onChange(values.filter((value) => value !== option.value))
                        return
                      }
                      onChange([...values, option.value])
                    }}
                  >
                    <CheckIcon
                      className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
