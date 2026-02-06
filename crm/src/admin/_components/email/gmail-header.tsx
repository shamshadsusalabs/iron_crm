"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Menu, Search, HelpCircle, Settings, Grid } from "lucide-react"
import { useEmailContext } from "./gmail-layout"

interface GmailHeaderProps {
  toggleSidebar: () => void
}

export default function GmailHeader({ toggleSidebar }: GmailHeaderProps) {
  const { searchEmails, currentMailbox } = useEmailContext()
  const [searchQuery, setSearchQuery] = useState("")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchEmails(searchQuery)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    if (e.target.value === "") {
      // Clear search when input is empty
      searchEmails("")
    }
  }

  const getSearchPlaceholder = (): string => {
    switch (currentMailbox) {
      case "received":
        return "Search in inbox"
      case "sent":
        return "Search in sent"
      case "all":
        return "Search in all mail"
      default:
        return "Search mail"
    }
  }

  return (
    <header className="flex items-center justify-between p-3 border-b bg-white shadow-sm">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <img src="/placeholder.svg?height=24&width=92&text=Gmail" alt="Gmail Logo" className="h-6 w-auto" />
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
        <Input
          placeholder={getSearchPlaceholder()}
          value={searchQuery}
          onChange={handleSearchChange}
          className="pl-10 pr-4 py-2 rounded-full bg-gray-100 border-none focus:bg-white focus:ring-2 focus:ring-blue-200"
        />
      </form>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Support">
          <HelpCircle className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <Settings className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Google apps">
          <Grid className="h-5 w-5" />
        </Button>
        <Avatar className="h-8 w-8">
          <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User Avatar" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
