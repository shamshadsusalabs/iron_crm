"use client"
import { FollowUpProvider, useFollowUpContext } from './hooks/use-follow-up'
import FollowUpDashboard from './follow-up-dashboard'
import FollowUpCampaigns from './follow-up-campaigns'
import FollowUpTemplates from './follow-up-templates'
import FollowUpContacts from './follow-up-contacts'
import FollowUpContactLists from './follow-up-contact-lists'
import CatalogItems from '../catalog/catalog-items'
import type { FollowUpSection } from './types/follow-up'

function FollowUpLayout() {
  const { currentSection, setCurrentSection } = useFollowUpContext()

  const handleSectionChange = (section: FollowUpSection) => {
    setCurrentSection(section)
  }

  const renderContent = () => {
    switch (currentSection) {
      case 'dashboard':
        return <FollowUpDashboard />
      case 'campaigns':
        return <FollowUpCampaigns />
      case 'templates':
        return <FollowUpTemplates />
      case 'contacts':
        return <FollowUpContacts />
      case 'contact-lists':
        return <FollowUpContactLists />
      case 'catalog-items':
        return <CatalogItems />
      default:
        return <FollowUpDashboard />
    }
  }

  return (
    <div className="space-y-6">
      {/* Section Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex space-x-4">
          <button
            onClick={() => handleSectionChange('dashboard')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentSection === 'dashboard'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => handleSectionChange('campaigns')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentSection === 'campaigns'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Campaigns
          </button>
          <button
            onClick={() => handleSectionChange('templates')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentSection === 'templates'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => handleSectionChange('contacts')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentSection === 'contacts'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Contacts
          </button>
          <button
            onClick={() => handleSectionChange('contact-lists')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentSection === 'contact-lists'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Contact Lists
          </button>
          <button
            onClick={() => handleSectionChange('catalog-items')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentSection === 'catalog-items'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Catalog Items
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {renderContent()}
      </div>
    </div>
  )
}

export default function FollowUpSystem() {
  return (
    <FollowUpProvider>
      <FollowUpLayout />
    </FollowUpProvider>
  )
} 