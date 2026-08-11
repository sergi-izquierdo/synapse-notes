"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  LayoutDashboard,
  FilePlus,
  Sun,
  Moon,
  LogOut,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { signOut } from "@/actions/auth"
import { useLanguage } from "@/components/language-provider"

export function CommandPalette() {
  const { t } = useLanguage()
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const { setTheme, theme } = useTheme()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen} showCloseButton={false}>
      <CommandInput placeholder={t.commandPalette.placeholder} />
      <CommandList>
        <CommandEmpty>{t.commandPalette.noResults}</CommandEmpty>

        <CommandGroup heading={t.commandPalette.groupNavigation}>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/"))}
          >
            <LayoutDashboard className="mr-2" />
            <span>{t.commandPalette.goToDashboard}</span>
            <CommandShortcut>G D</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading={t.commandPalette.groupActions}>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                const textarea = document.querySelector<HTMLTextAreaElement>(
                  'textarea[placeholder*="note"], textarea[placeholder*="Note"], textarea'
                )
                if (textarea) {
                  textarea.focus()
                }
              })
            }
          >
            <FilePlus className="mr-2" />
            <span>{t.commandPalette.createNewNote}</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() =>
                setTheme(theme === "dark" ? "light" : "dark")
              )
            }
          >
            {theme === "dark" ? (
              <Sun className="mr-2" />
            ) : (
              <Moon className="mr-2" />
            )}
            <span>{t.commandPalette.toggleTheme}</span>
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading={t.commandPalette.groupAccount}>
          <CommandItem onSelect={() => runCommand(() => signOut())}>
            <LogOut className="mr-2" />
            <span>{t.commandPalette.signOut}</span>
            <CommandShortcut>Q</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
