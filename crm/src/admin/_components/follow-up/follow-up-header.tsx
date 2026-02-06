"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Menu, 
  Search, 
  HelpCircle, 
  Settings, 
  Bell,
  User,
  LogOut,
  Mail
} from "lucide-react"
import { useFollowUpContext } from "./hooks/use-follow-up"
import type { FollowUpSection } from "./types/follow-up"

interface FollowUpHeaderProps {
  toggleSidebar: () => void
  currentSection: FollowUpSection
}

export default function FollowUpHeader({ toggleSidebar, currentSection }: FollowUpHeaderProps) {
  const { campaigns, contacts, templates, contactLists } = useFollowUpContext()
  const [searchQuery, setSearchQuery] = useState("")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement search functionality
    console.log("Searching for:", searchQuery)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    if (e.target.value === "") {
      // Clear search when input is empty
      console.log("Clearing search")
    }
  }

  const getSearchPlaceholder = (): string => {
    switch (currentSection) {
      case "campaigns":
        return "Search campaigns..."
      case "contacts":
        return "Search contacts..."
      case "templates":
        return "Search templates..."
      case "contact-lists":
        return "Search contact lists..."
      case "dashboard":
        return "Search everything..."
      default:
        return "Search..."
    }
  }

  const getSectionTitle = (): string => {
    switch (currentSection) {
      case "dashboard":
        return "Follow-up Dashboard"
      case "campaigns":
        return `Campaigns (${campaigns.length})`
      case "contacts":
        return `Contacts (${contacts.length})`
      case "templates":
        return `Templates (${templates.length})`
      case "contact-lists":
        return `Contact Lists (${contactLists.length})`
      default:
        return "Follow-up System"
    }
  }

  const getSectionDescription = (): string => {
    switch (currentSection) {
      case "dashboard":
        return "Overview of your email campaigns and follow-up performance"
      case "campaigns":
        return "Manage and track your email campaigns"
      case "contacts":
        return "Manage your contact database"
      case "templates":
        return "Create and manage email templates"
      case "contact-lists":
        return "Organize contacts into lists"
      default:
        return "Email follow-up system"
    }
  }

  return (
    <header className="flex items-center justify-between p-4 border-b bg-white shadow-sm">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <Menu className="h-5 w-5" />
        </Button>
        
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{getSectionTitle()}</h1>
          <p className="text-sm text-gray-500">{getSectionDescription()}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder={getSearchPlaceholder()}
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-10 w-80"
          />
        </form>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Help">
            <HelpCircle className="h-5 w-5" />
          </Button>
          
          <Button variant="ghost" size="icon" aria-label="Settings">
            <Settings className="h-5 w-5" />
          </Button>
          
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>
          
          <Button variant="ghost" size="icon" aria-label="Messages">
            <Mail className="h-5 w-5" />
          </Button>
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">Admin User</div>
            <div className="text-xs text-gray-500">admin@example.com</div>
          </div>
          
          <Avatar className="h-8 w-8">
            <AvatarImage src="/avatars/admin.jpg" alt="Admin" />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          
          <Button variant="ghost" size="icon" aria-label="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
} 