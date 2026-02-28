"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type {
  Campaign,
  Contact,
  ContactList,
  Template,
  FollowUp,
  CreateCampaignData,
  CreateContactData,
  CreateTemplateData,
  CreateContactListData,
  FollowUpSection,
  PaginationInfo
} from '../types/follow-up'
import {
  campaignApi,
  contactApi,
  contactListApi,
  templateApi,
  followUpApi,
  catalogApi,
  analyticsApi
} from '../libs/follow-up-api'

interface FollowUpContextType {
  // State
  campaigns: Campaign[]
  contacts: Contact[]
  contactStats: any // Enhanced stats
  dashboardStats: any
  contactLists: ContactList[]
  templates: Template[]
  followUps: FollowUp[]
  catalogItems: any[]
  currentSection: FollowUpSection

  // Loading states
  campaignsLoading: boolean
  dashboardStatsLoading: boolean
  contactsLoading: boolean
  contactListsLoading: boolean
  templatesLoading: boolean
  followUpsLoading: boolean
  catalogItemsLoading: boolean

  // Pagination
  campaignsPagination: PaginationInfo | null
  contactsPagination: PaginationInfo | null
  contactListsPagination: PaginationInfo | null
  templatesPagination: PaginationInfo | null
  followUpsPagination: PaginationInfo | null
  catalogItemsPagination: PaginationInfo | null

  // Actions
  setCurrentSection: (section: FollowUpSection) => void

  // Campaign actions
  createCampaign: (data: CreateCampaignData) => Promise<Campaign>
  updateCampaign: (id: string, data: Partial<CreateCampaignData>) => Promise<Campaign>
  deleteCampaign: (id: string) => Promise<void>
  startCampaign: (id: string) => Promise<Campaign>
  restartCampaign: (id: string, options?: { resetStats?: boolean; autoStart?: boolean }) => Promise<Campaign>
  loadCampaigns: (page?: number, limit?: number) => Promise<void>
  updateCampaignStats: (campaignId: string, stats: any) => void

  // Contact actions
  createContact: (data: CreateContactData) => Promise<Contact>
  updateContact: (id: string, data: Partial<CreateContactData>) => Promise<Contact>
  deleteContact: (id: string) => Promise<void>
  bulkCreateContacts: (contacts: CreateContactData[]) => Promise<Contact[]>
  loadContacts: (page?: number, limit?: number, search?: string) => Promise<void>
  loadContactStats: () => Promise<void>

  // Contact List actions
  createContactList: (data: CreateContactListData) => Promise<ContactList>
  updateContactList: (id: string, data: Partial<CreateContactListData>) => Promise<ContactList>
  deleteContactList: (id: string) => Promise<void>
  addContactsToList: (listId: string, contactIds: string[]) => Promise<void>
  removeContactsFromList: (listId: string, contactIds: string[]) => Promise<void>
  loadContactLists: (page?: number, limit?: number) => Promise<void>

  // Template actions
  createTemplate: (data: CreateTemplateData) => Promise<Template>
  updateTemplate: (id: string, data: Partial<CreateTemplateData>) => Promise<Template>
  deleteTemplate: (id: string) => Promise<void>
  approveTemplate: (id: string) => Promise<Template>
  loadTemplates: (page?: number, limit?: number) => Promise<void>

  // Catalog actions
  loadCatalogItems: (page?: number, limit?: number) => Promise<void>
  loadDashboardStats: () => Promise<void>

  // Follow-up actions
  loadFollowUps: (page?: number, limit?: number) => Promise<void>
  loadFollowUpsByCampaign: (campaignId: string) => Promise<FollowUp[]>
}

const FollowUpContext = createContext<FollowUpContextType | undefined>(undefined)

export const useFollowUpContext = () => {
  const context = useContext(FollowUpContext)
  if (!context) {
    throw new Error('useFollowUpContext must be used within a FollowUpProvider')
  }
  return context
}

interface FollowUpProviderProps {
  children: ReactNode
}

export const FollowUpProvider = ({ children }: FollowUpProviderProps) => {
  // State
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactStats, setContactStats] = useState<any>(null)
  const [dashboardStats, setDashboardStats] = useState<any>(null)
  const [contactLists, setContactLists] = useState<ContactList[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [catalogItems, setCatalogItems] = useState<any[]>([])
  const [currentSection, setCurrentSection] = useState<FollowUpSection>('dashboard')

  // Loading states
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [dashboardStatsLoading, setDashboardStatsLoading] = useState(false)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactListsLoading, setContactListsLoading] = useState(false)
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [followUpsLoading, setFollowUpsLoading] = useState(false)
  const [catalogItemsLoading, setCatalogItemsLoading] = useState(false)

  // Pagination
  const [campaignsPagination, setCampaignsPagination] = useState<PaginationInfo | null>(null)
  const [contactsPagination, setContactsPagination] = useState<PaginationInfo | null>(null)
  const [contactListsPagination, setContactListsPagination] = useState<PaginationInfo | null>(null)
  const [templatesPagination, setTemplatesPagination] = useState<PaginationInfo | null>(null)
  const [followUpsPagination, setFollowUpsPagination] = useState<PaginationInfo | null>(null)
  const [catalogItemsPagination, setCatalogItemsPagination] = useState<PaginationInfo | null>(null)

  // Campaign actions
  const createCampaign = useCallback(async (data: CreateCampaignData): Promise<Campaign> => {
    const campaign = await campaignApi.create(data)
    setCampaigns(prev => [campaign, ...prev])
    return campaign
  }, [])

  const updateCampaign = useCallback(async (id: string, data: Partial<CreateCampaignData>): Promise<Campaign> => {
    const campaign = await campaignApi.update(id, data)
    setCampaigns(prev => prev.map(c => c._id === id ? campaign : c))
    return campaign
  }, [])

  const deleteCampaign = useCallback(async (id: string): Promise<void> => {
    await campaignApi.delete(id)
    setCampaigns(prev => prev.filter(c => c._id !== id))
  }, [])

  const startCampaign = useCallback(async (id: string): Promise<Campaign> => {
    const campaign = await campaignApi.start(id)
    setCampaigns(prev => prev.map(c => c._id === id ? campaign : c))
    return campaign
  }, [])

  const restartCampaign = useCallback(async (id: string, options?: { resetStats?: boolean; autoStart?: boolean }): Promise<Campaign> => {
    const campaign = await campaignApi.restart(id, options)
    setCampaigns(prev => prev.map(c => c._id === id ? campaign : c))
    return campaign
  }, [])

  const loadCampaigns = useCallback(async (page = 1, limit = 100): Promise<void> => {
    setCampaignsLoading(true)
    try {
      const { campaigns: newCampaigns, pagination } = await campaignApi.getAll(page, limit)
      setCampaigns(newCampaigns)
      setCampaignsPagination(pagination)
    } catch (error) {
      console.error('Failed to load campaigns:', error)
    } finally {
      setCampaignsLoading(false)
    }
  }, [])

  const updateCampaignStats = useCallback((campaignId: string, stats: any): void => {
    setCampaigns(prev => prev.map(campaign =>
      campaign._id === campaignId
        ? { ...campaign, stats }
        : campaign
    ))
  }, [])

  // Contact actions
  const createContact = useCallback(async (data: CreateContactData): Promise<Contact> => {
    const contact = await contactApi.create(data)
    setContacts(prev => [contact, ...prev])
    return contact
  }, [])

  const updateContact = useCallback(async (id: string, data: Partial<CreateContactData>): Promise<Contact> => {
    const contact = await contactApi.update(id, data)
    setContacts(prev => prev.map(c => c._id === id ? contact : c))
    return contact
  }, [])

  const deleteContact = useCallback(async (id: string): Promise<void> => {
    await contactApi.delete(id)
    setContacts(prev => prev.filter(c => c._id !== id))
  }, [])

  const bulkCreateContacts = useCallback(async (contactsData: CreateContactData[]): Promise<Contact[]> => {
    const newContacts = await contactApi.bulkCreate(contactsData)
    // Ensure newContacts is an array
    const contactsArray = Array.isArray(newContacts) ? newContacts : [newContacts]
    setContacts(prev => [...contactsArray, ...prev])
    return contactsArray
  }, [])

  const loadContacts = useCallback(async (page = 1, limit = 200, search = ""): Promise<void> => {
    setContactsLoading(true)
    try {
      const { contacts: newContacts, pagination } = await contactApi.getAll(page, limit, search)
      setContacts(newContacts)
      setContactsPagination(pagination)
    } catch (error) {
      console.error('Failed to load contacts:', error)
    } finally {
      setContactsLoading(false)
    }
  }, [])

  const loadContactStats = useCallback(async (): Promise<void> => {
    try {
      const stats = await contactApi.getStats()
      setContactStats(stats)
    } catch (error) {
      console.error('Failed to load contact stats:', error)
    }
  }, [])

  // Contact List actions
  const createContactList = useCallback(async (data: CreateContactListData): Promise<ContactList> => {
    const contactList = await contactListApi.create(data)
    setContactLists(prev => [contactList, ...prev])
    return contactList
  }, [])

  const updateContactList = useCallback(async (id: string, data: Partial<CreateContactListData>): Promise<ContactList> => {
    const contactList = await contactListApi.update(id, data)
    setContactLists(prev => prev.map(cl => cl._id === id ? contactList : cl))
    return contactList
  }, [])

  const deleteContactList = useCallback(async (id: string): Promise<void> => {
    await contactListApi.delete(id)
    setContactLists(prev => prev.filter(cl => cl._id !== id))
  }, [])

  const loadContactLists = useCallback(async (page = 1, limit = 10): Promise<void> => {
    setContactListsLoading(true)
    try {
      const { contactLists: newContactLists, pagination } = await contactListApi.getAll(page, limit)
      setContactLists(newContactLists)
      setContactListsPagination(pagination)
    } catch (error) {
      console.error('Failed to load contact lists:', error)
    } finally {
      setContactListsLoading(false)
    }
  }, [])

  const addContactsToList = useCallback(async (listId: string, contactIds: string[]): Promise<void> => {
    await contactListApi.addContacts(listId, contactIds)
    // Reload the list to reflect changes
    await loadContactLists()
  }, [loadContactLists])

  const removeContactsFromList = useCallback(async (listId: string, contactIds: string[]): Promise<void> => {
    await contactListApi.removeContacts(listId, contactIds)
    // Reload the list to reflect changes
    await loadContactLists()
  }, [loadContactLists])

  // Template actions
  const createTemplate = useCallback(async (data: CreateTemplateData): Promise<Template> => {
    const template = await templateApi.create(data)
    setTemplates(prev => [template, ...prev])
    return template
  }, [])

  const updateTemplate = useCallback(async (id: string, data: Partial<CreateTemplateData>): Promise<Template> => {
    const template = await templateApi.update(id, data)
    setTemplates(prev => prev.map(t => t._id === id ? template : t))
    return template
  }, [])

  const approveTemplate = useCallback(async (id: string): Promise<Template> => {
    const template = await templateApi.approve(id)
    setTemplates(prev => prev.map(t => t._id === id ? template : t))
    return template
  }, [])

  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    await templateApi.delete(id)
    setTemplates(prev => prev.filter(t => t._id !== id))
  }, [])

  const loadTemplates = useCallback(async (page = 1, limit = 100): Promise<void> => {
    setTemplatesLoading(true)
    try {
      // Load all templates including active ones
      const { templates: newTemplates, pagination } = await templateApi.getAll(page, limit, "", "", true, false)
      setTemplates(newTemplates)
      setTemplatesPagination(pagination)
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  // Catalog actions
  const loadCatalogItems = useCallback(async (page = 1, limit = 100): Promise<void> => {
    setCatalogItemsLoading(true)
    try {
      const { items, pagination } = await catalogApi.getAll(page, limit)
      setCatalogItems(items)
      setCatalogItemsPagination(pagination)
    } catch (error) {
      console.error('Failed to load catalog items:', error)
    } finally {
      setCatalogItemsLoading(false)
    }
  }, [])

  // Follow-up actions
  const loadFollowUps = useCallback(async (page = 1, limit = 10): Promise<void> => {
    setFollowUpsLoading(true)
    try {
      const { followUps: newFollowUps, pagination } = await followUpApi.getAll(page, limit)
      setFollowUps(newFollowUps)
      setFollowUpsPagination(pagination)
    } catch (error) {
      console.error('Failed to load follow-ups:', error)
    } finally {
      setFollowUpsLoading(false)
    }
  }, [])

  const loadFollowUpsByCampaign = useCallback(async (campaignId: string): Promise<FollowUp[]> => {
    try {
      const { followUps } = await followUpApi.getAll(1, 100, "", campaignId)
      return followUps
    } catch (error) {
      console.error('Failed to load follow-ups by campaign:', error)
      return []
    }
  }, [])

  const loadDashboardStats = useCallback(async (): Promise<void> => {
    setDashboardStatsLoading(true)
    try {
      const stats = await analyticsApi.getDashboardStats()
      setDashboardStats(stats)
    } catch (error) {
      console.error('Failed to load dashboard stats:', error)
    } finally {
      setDashboardStatsLoading(false)
    }
  }, [])

  // Load initial data based on current section
  useEffect(() => {
    switch (currentSection) {
      case 'dashboard':
        loadCampaigns()
        loadContacts()
        loadContactStats()
        loadTemplates()
        loadContactLists()
        loadCatalogItems()
        loadDashboardStats()
        break
      case 'campaigns':
        loadCampaigns()
        loadTemplates() // Load templates for campaign template display
        loadCatalogItems() // Load catalog items for sequence steps
        break
      case 'contacts':
        loadContacts()
        loadContactStats()
        break
      case 'templates':
        loadTemplates()
        break
      case 'contact-lists':
        loadContactLists()
        break
    }
  }, [currentSection, loadCampaigns, loadContacts, loadTemplates, loadContactLists, loadCatalogItems])

  const value: FollowUpContextType = {
    // State
    campaigns,
    contacts,
    contactStats,
    dashboardStats,
    contactLists,
    templates,
    followUps,
    catalogItems,
    currentSection,

    // Loading states
    campaignsLoading,
    dashboardStatsLoading,
    contactsLoading,
    contactListsLoading,
    templatesLoading,
    followUpsLoading,
    catalogItemsLoading,

    // Pagination
    campaignsPagination,
    contactsPagination,
    contactListsPagination,
    templatesPagination,
    followUpsPagination,
    catalogItemsPagination,

    // Actions
    setCurrentSection,

    // Campaign actions
    createCampaign,
    updateCampaign,
    deleteCampaign,
    startCampaign,
    restartCampaign,
    loadCampaigns,
    updateCampaignStats,

    // Contact actions
    createContact,
    updateContact,
    deleteContact,
    bulkCreateContacts,
    loadContacts,
    loadContactStats,

    // Contact List actions
    createContactList,
    updateContactList,
    deleteContactList,
    addContactsToList,
    removeContactsFromList,
    loadContactLists,

    // Template actions
    createTemplate,
    updateTemplate,
    deleteTemplate,
    approveTemplate,
    loadTemplates,

    // Catalog actions
    loadCatalogItems,
    loadDashboardStats,

    // Follow-up actions
    loadFollowUps,
    loadFollowUpsByCampaign,
  }

  return (
    <FollowUpContext.Provider value={value}>
      {children}
    </FollowUpContext.Provider>
  )
} 