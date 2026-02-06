"use client"

import { Button } from "@/components/ui/button"
import { Pencil, Inbox, Send, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEmailContext } from "./gmail-layout"
import type { MailboxType } from "./hooks/use-emails"

interface GmailSidebarProps {
  isOpen: boolean
  onCompose: () => void
}

export default function GmailSidebar({ isOpen, onCompose }: GmailSidebarProps) {
  const { currentMailbox, switchMailbox, loading } = useEmailContext()

  const handleMailboxClick = async (mailbox: MailboxType) => {
    console.log(`Sidebar: Switching to ${mailbox}`)
    try {
      await switchMailbox(mailbox)
      console.log(`Successfully switched to ${mailbox}`)
    } catch (error) {
      console.error(`Error switching to ${mailbox}:`, error)
    }
  }

  const menuItems = [
    {
      id: "received" as MailboxType,
      label: "Inbox",
      icon: Inbox,
    },
    {
      id: "sent" as MailboxType,
      label: "Sent",
      icon: Send,
    },
    {
      id: "all" as MailboxType,
      label: "All Mail",
      icon: Mail,
    },
  ]

  return (
    <aside
      className={cn(
        "bg-white border-r p-3 transition-all duration-300 ease-in-out",
        isOpen ? "w-60 min-w-[240px]" : "w-0 overflow-hidden lg:w-16 lg:min-w-[64px]",
        "hidden md:block",
      )}
    >
      <div className={cn("mb-4", !isOpen && "lg:hidden")}>
        <Button
          className="w-full rounded-full shadow-md bg-[#fce8e6] text-[#ea4335] hover:bg-[#fce8e6]/90"
          onClick={onCompose}
        >
          <Pencil className="mr-2 h-5 w-5" />
          Compose
        </Button>
      </div>

      <nav className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = currentMailbox === item.id

          return (
            <Button
              key={item.id}
              variant="ghost"
              className={cn(
                "w-full justify-start rounded-r-full px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#e8f0fe] hover:text-[#1a73e8]"
                  : "hover:bg-gray-100 text-gray-700",
              )}
              onClick={() => handleMailboxClick(item.id)}
              disabled={loading}
            >
              <Icon className={cn("h-5 w-5", isOpen ? "mr-3" : "mr-0")} />
              <span className={cn(!isOpen && "lg:hidden")}>{item.label}</span>
              {isActive && <div className="ml-auto w-1 h-1 bg-[#1a73e8] rounded-full" />}
            </Button>
          )
        })}
      </nav>

      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === "development" && isOpen && (
        <div className="mt-4 p-2 text-xs text-gray-500 bg-gray-50 rounded">
          <div>Current: {currentMailbox}</div>
          {loading && <div>Loading...</div>}
        </div>
      )}
    </aside>
  )
}
