"use client"

import { useFollowUpContext } from './hooks/use-follow-up'
import type { FollowUpSection } from './types/follow-up'
import { 
  BarChart3, 
  Mail, 
  Users, 
  FileText, 
  List,
  Boxes,
  Plus,
  Play,
  CheckCircle,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FollowUpSidebarProps {
  isOpen: boolean
  currentSection: FollowUpSection
  onSectionChange: (section: FollowUpSection) => void
}

export default function FollowUpSidebar({ 
  isOpen, 
  currentSection, 
  onSectionChange 
}: FollowUpSidebarProps) {
  const { 
    campaigns, 
    contacts, 
    templates, 
    contactLists,
    campaignsLoading,
    contactsLoading,
    templatesLoading,
    contactListsLoading
  } = useFollowUpContext()

  const menuItems = [
    {
      id: "dashboard" as FollowUpSection,
      label: "Dashboard",
      icon: BarChart3,
      description: "Overview & Analytics"
    },
    {
      id: "campaigns" as FollowUpSection,
      label: "Campaigns",
      icon: Mail,
      description: "Email Campaigns",
      count: campaigns?.length || 0,
      loading: campaignsLoading
    },
    {
      id: "templates" as FollowUpSection,
      label: "Templates",
      icon: FileText,
      description: "Email Templates",
      count: templates?.length || 0,
      loading: templatesLoading
    },
    {
      id: "contacts" as FollowUpSection,
      label: "Contacts",
      icon: Users,
      description: "Contact Management",
      count: contacts?.length || 0,
      loading: contactsLoading
    },
    {
      id: "contact-lists" as FollowUpSection,
      label: "Contact Lists",
      icon: List,
      description: "Contact Lists",
      count: contactLists?.length || 0,
      loading: contactListsLoading
    },
    {
      id: 'catalog-items' as FollowUpSection,
      label: 'Catalog Items',
      icon: Boxes,
      description: 'Product catalog items'
    }
  ]

  const getStatusIcon = (section: FollowUpSection) => {
    switch (section) {
      case "campaigns":
        const activeCampaigns = (campaigns || []).filter(c => c.status === "sending" || c.status === "scheduled")
        const completedCampaigns = (campaigns || []).filter(c => c.status === "sent" || c.status === "completed")
        
        if (activeCampaigns.length > 0) return <Play className="h-3 w-3 text-green-500" />
        if (completedCampaigns.length > 0) return <CheckCircle className="h-3 w-3 text-blue-500" />
        return <Clock className="h-3 w-3 text-gray-400" />
      
      case "templates":
        const activeTemplates = (templates || []).filter(t => t.isActive === true)
        if (activeTemplates.length > 0) return <CheckCircle className="h-3 w-3 text-green-500" />
        return <FileText className="h-3 w-3 text-gray-400" />
      
      case "contacts":
        const activeContacts = (contacts || []).filter(c => c.status === "active")
        if (activeContacts.length > 0) return <CheckCircle className="h-3 w-3 text-green-500" />
        return <Users className="h-3 w-3 text-gray-400" />
      
      case "contact-lists":
        const listsWithContacts = (contactLists || []).filter(cl => (cl?.totalContacts || 0) > 0)
        if (listsWithContacts.length > 0) return <CheckCircle className="h-3 w-3 text-green-500" />
        return <List className="h-3 w-3 text-gray-400" />
      
      default:
        return null
    }
  }

  if (!isOpen) {
    return (
      <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4">
        <button
          onClick={() => onSectionChange('dashboard')}
          className={cn(
            "p-2 rounded-lg mb-2 transition-colors",
            currentSection === 'dashboard' 
              ? "bg-blue-100 text-blue-600" 
              : "text-gray-600 hover:bg-gray-100"
          )}
        >
          <BarChart3 className="h-5 w-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Follow-up System</h2>
        <p className="text-sm text-gray-500">Email automation & campaigns</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = currentSection === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left",
                isActive 
                  ? "bg-blue-50 text-blue-700 border border-blue-200" 
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <div className="flex items-center space-x-3">
                <Icon className="h-5 w-5" />
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {getStatusIcon(item.id)}
                {item.count !== undefined && (
                  <div className="flex items-center space-x-1">
                    {item.loading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        {item.count}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </nav>

      {/* Quick Actions */}
      <div className="p-4 border-t border-gray-200">
        <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>New Campaign</span>
        </button>
        
        <div className="mt-3 space-y-1">
          <a href="#" className="block text-xs text-gray-500 hover:text-gray-700">
            Quick Start Guide
          </a>
          <a href="#" className="block text-xs text-gray-500 hover:text-gray-700">
            Import Contacts
          </a>
          <a href="#" className="block text-xs text-gray-500 hover:text-gray-700">
            Template Gallery
          </a>
        </div>
      </div>
    </div>
  )
} 