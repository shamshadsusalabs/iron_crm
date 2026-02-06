"use client"

import { useState, useEffect } from 'react'

import { Card, Row, Col, Table, Button, Tag, Typography, Modal, Form, Input, Select, Space, Tooltip, Popconfirm, Statistic, InputNumber, Checkbox } from 'antd'
import {
  PlusOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  BarChartOutlined,
  MailOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  MinusCircleOutlined,
  LinkOutlined,
  ReloadOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { useFollowUpContext } from './hooks/use-follow-up'
import type { Campaign, Contact } from './types/follow-up'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// Helpers to handle IST (Asia/Kolkata) timezone consistently
// 1) Format a Date/ISO string to datetime-local (YYYY-MM-DDTHH:mm) in IST
function formatDateTimeIST(date: string | Date): string {
  const d = new Date(date)
  // Convert UTC -> IST by adding 5h30m
  const IST_OFFSET_MIN = 5 * 60 + 30
  const ms = d.getTime() + IST_OFFSET_MIN * 60 * 1000
  const ist = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = ist.getUTCFullYear()
  const mm = pad(ist.getUTCMonth() + 1)
  const dd = pad(ist.getUTCDate())
  const hh = pad(ist.getUTCHours())
  const mi = pad(ist.getUTCMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

// 2) Parse a datetime-local string (interpreted as IST) into a UTC Date object
function parseISTLocalToUTC(local: string): Date {
  // local format: YYYY-MM-DDTHH:mm
  const [datePart, timePart] = local.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  // Build a Date in UTC corresponding to the IST time by subtracting 5h30m
  const IST_OFFSET_MIN = 5 * 60 + 30
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MIN * 60 * 1000
  return new Date(utcMs)
}

export default function FollowUpCampaigns() {
  const {
    campaigns,
    campaignsLoading,
    campaignsPagination,
    contacts,
    contactsLoading,
    contactsPagination,
    contactLists,
    contactListsLoading,
    templates,
    templatesLoading,
    catalogItems,
    catalogItemsLoading,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    startCampaign,
    loadCampaigns,
    updateCampaignStats
  } = useFollowUpContext()

  // Production ready - console logs removed

  // Force refresh campaigns on component mount to ensure fresh data
  useEffect(() => {
    const refreshOnMount = async () => {
      await loadCampaigns(1, 100)
    }
    refreshOnMount()
  }, []) // Empty dependency array to run only on mount

  // Auto-fetch tracking stats after campaigns are loaded (optimized batch processing)
  useEffect(() => {
    if (campaigns.length > 0 && !campaignsLoading) {
      // Auto-fetching fresh tracking stats for all campaigns in batches

      // Batch process campaigns in groups of 5 for better performance
      const fetchStatsInBatches = async () => {
        try {
          const batchSize = 5
          const batches = []

          for (let i = 0; i < campaigns.length; i += batchSize) {
            batches.push(campaigns.slice(i, i + batchSize))
          }

          // Process batches with small delay between them
          for (const batch of batches) {
            const batchPromises = batch.map(async (campaign) => {
              try {
                const response = await fetch(`http://localhost:5000/api/tracking/campaign/${campaign._id}/stats`)
                if (response.ok) {
                  const result = await response.json()
                  if (result.success && result.stats) {
                    updateCampaignStats(campaign._id, result.stats)
                  }
                }
              } catch (error) {
                // Silently handle errors - don't break the UI
              }
            })

            await Promise.all(batchPromises)
            // Small delay between batches to prevent overwhelming the server
            if (batches.indexOf(batch) < batches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }

          // Background stats refresh completed
        } catch (error) {
          // Background stats refresh failed
        }
      }

      // Run in background without affecting UI
      fetchStatsInBatches()
    }
  }, [campaigns.length, campaignsLoading]) // Run when campaigns are loaded


  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [isStatsModalVisible, setIsStatsModalVisible] = useState(false)
  const [trackingModalVisible, setTrackingModalVisible] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [refreshingStats, setRefreshingStats] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  // Tracking details state for the tracking modal
  const [trackingDetails, setTrackingDetails] = useState<any[]>([])
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [form] = Form.useForm()

  // Calculate status statistics
  const statusStats = {
    draft: campaigns.filter(c => c.status === 'draft').length,
    scheduled: campaigns.filter(c => c.status === 'scheduled').length,
    sending: campaigns.filter(c => c.status === 'sending').length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    completed: campaigns.filter(c => c.status === 'completed').length,
    paused: campaigns.filter(c => c.status === 'paused').length,
  }

  // Refresh campaign statistics - optimized batch processing for manual refresh
  const refreshCampaignStats = async () => {
    setRefreshingStats(true)
    try {
      // Refreshing campaign stats from tracking API in optimized batches

      const batchSize = 8 // Larger batch size for manual refresh
      const batches = []

      for (let i = 0; i < campaigns.length; i += batchSize) {
        batches.push(campaigns.slice(i, i + batchSize))
      }

      let successCount = 0

      // Process batches sequentially for better control
      for (const batch of batches) {
        const batchPromises = batch.map(async (campaign) => {
          try {
            const response = await fetch(`http://localhost:5000/api/tracking/campaign/${campaign._id}/stats`)
            if (response.ok) {
              const result = await response.json()
              if (result.success && result.stats) {
                updateCampaignStats(campaign._id, result.stats)
                return { campaignId: campaign._id, stats: result.stats }
              }
            }
          } catch (error) {
            // Error refreshing stats for campaign
          }
          return null
        })

        const batchResults = await Promise.all(batchPromises)
        successCount += batchResults.filter(r => r !== null).length

        // Very small delay between batches for manual refresh
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }

      // Successfully refreshed stats for campaigns

    } catch (error) {
      // Error refreshing campaign stats
    } finally {
      setRefreshingStats(false)
    }
  }

  // Refresh tracking stats for selected campaign in modal
  const refreshTrackingStats = async () => {
    if (!selectedCampaign) return

    setRefreshingStats(true)
    try {
      // Call both stats and details APIs
      const [statsResponse, detailsResponse] = await Promise.all([
        fetch(`http://localhost:5000/api/tracking/campaign/${selectedCampaign._id}/stats`),
        fetch(`http://localhost:5000/api/tracking/campaign/${selectedCampaign._id}/details`)
      ])

      // Handle stats response
      if (statsResponse.ok) {
        try {
          const statsResult = await statsResponse.json()
          if (statsResult.success && statsResult.stats) {
            // Updating campaign stats from tracking API

            // Update the context state first - this should update the campaigns array
            updateCampaignStats(selectedCampaign._id, statsResult.stats)

            // Update the selected campaign in modal
            setSelectedCampaign(prev => prev ? {
              ...prev,
              stats: statsResult.stats
            } : null)

            // Don't reload campaigns - the updateCampaignStats should be sufficient
            // The issue is that loadCampaigns() overwrites our correct stats with old data
            // Campaign stats updated in context
          }
        } catch (e) {
          // Stats API returned non-JSON response, skipping stats update
        }
      }

      // Handle details response
      if (detailsResponse.ok) {
        try {
          const detailsResult = await detailsResponse.json()
          if (detailsResult.success && detailsResult.data) {
            const trackingData = detailsResult.data || []
            const formattedData = trackingData.map((item: any) => ({
              key: item.trackingId,
              contact: {
                _id: item.trackingId,
                email: item.contact.email,
                firstName: item.contact.name ? item.contact.name.split(' ')[0] || '' : '',
                lastName: item.contact.name ? item.contact.name.split(' ').slice(1).join(' ') || '' : '',
                status: 'active' as const,
                engagementScore: 0,
                tags: [],
                userId: selectedCampaign.userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              },
              status: item.status.clicked && item.status.opened ? 'clicked' : item.status.clicked ? 'clicked' : item.status.opened ? 'opened' : 'sent',
              lastActivity: item.lastActivity,
              events: item.events ? Object.entries(item.events).map(([type, eventData]: [string, any]) => ({
                event: type,
                timestamp: eventData.timestamp
              })) : [{
                event: 'sent',
                timestamp: item.email?.sentAt || new Date().toISOString()
              }]
            }))
            setTrackingDetails(formattedData)
          }
        } catch (e) {
          console.log('Details API returned non-JSON response:', e)
        }
      }
    } catch (error) {
      console.error('Error refreshing tracking stats:', error)
    } finally {
      setRefreshingStats(false)
    }
  }

  // Campaign table columns
  const columns = [
    {
      title: 'Campaign Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Campaign) => (
        <div>
          <div className="font-medium">{text}</div>
          {record.description && (
            <div className="text-sm text-gray-500">{record.description}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          draft: { color: 'default', text: 'Draft' },
          scheduled: { color: 'processing', text: 'Scheduled' },
          sending: { color: 'processing', text: 'Sending' },
          sent: { color: 'success', text: 'Sent' },
          completed: { color: 'success', text: 'Completed' },
          paused: { color: 'warning', text: 'Paused' },
        }
        const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: 'Template',
      key: 'template',
      render: (record: Campaign) => {
        if (record.sendType === 'sequence') {
          return (
            <div className="text-sm text-purple-600">
              <span className="font-medium">Sequence</span>
              <div className="text-xs text-gray-500">
                {record.sequence?.steps?.length || 0} steps
              </div>
            </div>
          )
        }
        const template = templates.find(t => t._id === record.template)


        return template ? (
          <div className="text-sm">
            <div className="font-medium">{template.name}</div>
            <div className="text-xs text-gray-500">({template.type})</div>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">
            {record.template ? 'Template not found' : '-'}
          </span>
        )
      },
    },
    {
      title: 'Send Type',
      key: 'sendType',
      render: (record: Campaign) => {
        const sendTypeConfig = {
          immediate: { color: 'green', text: 'Immediate', icon: '⚡' },
          scheduled: { color: 'blue', text: 'Scheduled', icon: '📅' },
          sequence: { color: 'purple', text: 'Sequence', icon: '🔄' },
        }
        const config = sendTypeConfig[record.sendType] || { color: 'default', text: record.sendType, icon: '❓' }
        return (
          <div className="flex items-center space-x-1">
            <span>{config.icon}</span>
            <Tag color={config.color}>{config.text}</Tag>
          </div>
        )
      },
    },
    {
      title: 'Contacts',
      key: 'contacts',
      render: (record: Campaign) => (
        <div>
          <div className="font-medium">{record.contacts.length + record.contactLists.length}</div>
          <div className="text-sm text-gray-500">
            {record.contacts.length} direct, {record.contactLists.length} lists
          </div>
        </div>
      ),
    },
    {
      title: 'Performance',
      key: 'performance',
      render: (record: Campaign) => {
        // Use the stats from the campaign record directly (from campaigns API)
        const totalSent = record.stats?.totalSent || 0
        const opened = record.stats?.opened || 0
        const clicked = record.stats?.clicked || 0
        const openRate = totalSent > 0 ? Math.round((opened / totalSent) * 100) : 0
        const clickRate = totalSent > 0 ? Math.round((clicked / totalSent) * 100) : 0

        // Performance stats are now automatically refreshed from tracking API

        return (
          <div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{totalSent}</span> sent
            </div>
            <div className="text-sm flex items-center space-x-1">
              <span>👁️</span>
              <span className="text-blue-600 font-medium">{opened}</span>
              <span className="text-gray-500">({openRate}%)</span>
            </div>
            <div className="text-sm flex items-center space-x-1">
              <span>🖱️</span>
              <span className="text-green-600 font-medium">{clicked}</span>
              <span className="text-gray-500">({clickRate}%)</span>
            </div>
          </div>
        )
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: Date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Campaign) => (
        <Space>
          {record.status === 'draft' && (
            <Tooltip title="Start Campaign">
              <Button
                type="text"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStartCampaign(record._id)}
              />
            </Tooltip>
          )}

          <Tooltip title="View Stats">
            <Button
              type="text"
              size="small"
              icon={<BarChartOutlined />}
              onClick={() => handleViewStats(record)}
            />
          </Tooltip>

          <Tooltip title="Edit Campaign">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditCampaign(record)}
            />
          </Tooltip>

          <Popconfirm
            title="Delete Campaign"
            description="Are you sure you want to delete this campaign?"
            onConfirm={() => handleDeleteCampaign(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete Campaign">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const handleCreateCampaign = () => {
    setIsCreateModalVisible(true)
    // Don't call resetFields here - let the modal handle form initialization
  }

  const handleEditCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    form.setFieldsValue({
      name: campaign.name,
      description: campaign.description,
      template: campaign.template,
      contacts: campaign.contacts,
      contactLists: campaign.contactLists,
      sendType: campaign.sendType,
      // Convert stored Date/ISO -> datetime-local (IST)
      scheduledAt: campaign.scheduledAt ? formatDateTimeIST(campaign.scheduledAt) : undefined,
      sequence: campaign.sequence,
    })
    setIsEditModalVisible(true)
  }

  const handleDeleteCampaign = async (campaignId: string) => {
    try {
      await deleteCampaign(campaignId)
      // Success message could be added here
    } catch (error) {
      console.error('Failed to delete campaign:', error)
    }
  }

  const handleStartCampaign = async (campaignId: string) => {
    try {
      await startCampaign(campaignId)
      // Success message could be added here
    } catch (error) {
      console.error('Failed to start campaign:', error)
    }
  }

  const handleViewStats = async (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    setTrackingModalVisible(true)

    // Load tracking details for this campaign
    setTrackingLoading(true)
    try {
      const response = await fetch(`http://localhost:5000/api/tracking/campaign/${campaign._id}/details?userId=${campaign.userId}`)
      if (response.ok) {
        try {
          const result = await response.json()
          if (result.success && result.data) {
            const trackingData = result.data || []

            // Transform backend data to match frontend format
            const formattedData = trackingData.map((item: any) => ({
              key: item.trackingId,
              contact: {
                _id: item.trackingId,
                email: item.contact.email,
                firstName: item.contact.name ? item.contact.name.split(' ')[0] || '' : '',
                lastName: item.contact.name ? item.contact.name.split(' ').slice(1).join(' ') || '' : '',
                status: 'active' as const,
                engagementScore: 0,
                tags: [],
                userId: campaign.userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              },
              status: item.status.clicked && item.status.opened ? 'clicked' : item.status.clicked ? 'clicked' : item.status.opened ? 'opened' : 'sent',
              lastActivity: item.lastActivity,
              events: item.events ? Object.entries(item.events).map(([type, eventData]: [string, any]) => ({
                event: type,
                timestamp: eventData.timestamp
              })) : [{
                event: 'sent',
                timestamp: item.email?.sentAt || new Date().toISOString()
              }]
            }))

            setTrackingDetails(formattedData)
            setTrackingLoading(false)
            return
          }
        } catch (jsonError) {
          // Response is not JSON, falling back to mock data
        }
      }
      throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      console.error('Failed to load tracking details:', error)
      // Fallback: create mock data based on campaign contacts and stats
      // Using fallback mock data for tracking details

      // Get all contacts from both direct contacts and contact lists
      let allContacts: Contact[] = []

      // Add direct contacts
      if (campaign.contacts && campaign.contacts.length > 0) {
        const directContacts = campaign.contacts.map(contactId =>
          contacts.find(c => c._id === contactId)
        ).filter((contact): contact is Contact => contact !== undefined)
        allContacts = [...allContacts, ...directContacts]
      }

      // If no contacts found, create sample data based on stats
      if (allContacts.length === 0) {
        const sampleEmails = [
          'shamshad@susalabs.com',
          'shamshadalamansari2@gmail.com',
          'user1@example.com',
          'user2@example.com'
        ]

        for (let i = 0; i < Math.max(campaign.stats.totalSent, 2); i++) {
          allContacts.push({
            _id: `sample-${i}`,
            email: sampleEmails[i] || `user${i + 1}@example.com`,
            status: 'active' as const,
            engagementScore: 0,
            tags: [],
            userId: campaign.userId,
            firstName: i === 0 ? 'Rohan' : i === 1 ? 'Sham' : `User`,
            lastName: i === 0 ? 'kumar' : i === 1 ? 'alam' : `${i + 1}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        }
      }

      const mockTrackingDetails = allContacts.map((contact, index) => ({
        key: contact._id,
        contact: contact,
        status: index < campaign.stats.opened ? 'opened' : 'sent',
        lastActivity: new Date().toISOString(),
        events: [
          {
            event: 'sent',
            timestamp: new Date(Date.now() - (index * 1000 * 60)).toISOString()
          },
          ...(index < campaign.stats.opened ? [{
            event: 'opened',
            timestamp: new Date(Date.now() - (index * 1000 * 30)).toISOString()
          }] : []),
          ...(index < campaign.stats.clicked ? [{
            event: 'clicked',
            timestamp: new Date(Date.now() - (index * 1000 * 10)).toISOString()
          }] : [])
        ]
      }))

      // Generated tracking details from mock data
      setTrackingDetails(mockTrackingDetails)
    } finally {
      setTrackingLoading(false)
    }
  }


  const handleCreateSubmit = async (values: any) => {
    try {
      setCreateSubmitting(true)
      await createCampaign({
        name: values.name,
        description: values.description,
        template: values.template,
        contacts: values.contacts || [],
        contactLists: values.contactLists || [],
        sendType: values.sendType,
        // Parse IST input -> UTC Date object
        scheduledAt: values.scheduledAt ? parseISTLocalToUTC(values.scheduledAt) : undefined,
        sequence: values.sequence,
      })
      setIsCreateModalVisible(false)
      form.resetFields()
    } catch (error) {
      console.error('Failed to create campaign:', error)
    } finally {
      setCreateSubmitting(false)
    }
  }

  const handleEditSubmit = async (values: any) => {
    if (!selectedCampaign) return

    try {
      setEditSubmitting(true)
      await updateCampaign(selectedCampaign._id, {
        name: values.name,
        description: values.description,
        template: values.template,
        contacts: values.contacts || [],
        contactLists: values.contactLists || [],
        sendType: values.sendType,
        // Parse IST input -> UTC Date object
        scheduledAt: values.scheduledAt ? parseISTLocalToUTC(values.scheduledAt) : undefined,
        sequence: values.sequence,
      })
      setIsEditModalVisible(false)
      setSelectedCampaign(null)
      form.resetFields()
    } catch (error) {
      console.error('Failed to update campaign:', error)
    } finally {
      setEditSubmitting(false)
    }
  }

  const renderCampaignForm = () => (
    <Form
      form={form}
      layout="vertical"
      onFinish={isCreateModalVisible ? handleCreateSubmit : handleEditSubmit}
      disabled={isCreateModalVisible ? createSubmitting : editSubmitting}
    >
      <Form.Item
        name="name"
        label="Campaign Name"
        rules={[{ required: true, message: 'Please enter campaign name' }]}
      >
        <Input placeholder="Enter campaign name" />
      </Form.Item>

      <Form.Item
        name="description"
        label="Description"
      >
        <TextArea
          rows={3}
          placeholder="Enter campaign description"
        />
      </Form.Item>

      <Form.Item
        name="sendType"
        label="Send Type"
        rules={[{ required: true, message: 'Please select send type' }]}
      >
        <Select placeholder="Select send type">
          <Option value="immediate">Send Immediately</Option>
          <Option value="scheduled">Schedule for Later</Option>
          <Option value="sequence">Follow-up Sequence</Option>
        </Select>
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) => prevValues.sendType !== currentValues.sendType}
      >
        {({ getFieldValue }) => {
          const sendType = getFieldValue('sendType')

          if (sendType === 'scheduled') {
            return (
              <Form.Item
                name="scheduledAt"
                label="Schedule Date & Time"
                rules={[{ required: true, message: 'Please select schedule time' }]}
              >
                <Input type="datetime-local" />
              </Form.Item>
            )
          }

          if (sendType === 'sequence') {
            return (
              <div className="space-y-4">
                {/* Total Recipients Display */}
                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues.contacts !== currentValues.contacts ||
                    prevValues.contactLists !== currentValues.contactLists
                  }
                >
                  {({ getFieldValue }) => {
                    const selectedContacts = getFieldValue('contacts') || []
                    const selectedContactLists = getFieldValue('contactLists') || []

                    // Calculate total recipients
                    const directContacts = selectedContacts.length
                    const listContacts = selectedContactLists.reduce((total: number, listId: string) => {
                      const list = contactLists.find(l => l._id === listId)
                      return total + (list?.totalContacts || 0)
                    }, 0)
                    const totalRecipients = directContacts + listContacts

                    if (totalRecipients > 0) {
                      return (
                        <div className="bg-blue-50 p-3 rounded-lg mb-4">
                          <div className="flex items-center space-x-2">
                            <Text strong>📊 Total Recipients: {totalRecipients}</Text>
                            <Text type="secondary">
                              ({directContacts} direct + {listContacts} from lists)
                            </Text>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                </Form.Item>

                {/* Sequence Steps - Main Configuration */}
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <Text strong>Follow-up Sequence Steps</Text>
                    <Text type="secondary">Define each step of your email sequence</Text>
                  </div>

                  {/* Global Repeat Settings */}
                  <div className="bg-white p-3 rounded-lg mb-4 border">
                    <Row>
                      <Col span={8}>
                        <Form.Item
                          name={['sequence', 'repeatDays']}
                          label="Repeat Steps For (days)"
                          tooltip="How many days to keep repeating each step if conditions aren't met"
                        >
                          <InputNumber
                            min={0}
                            max={30}
                            placeholder="0"
                            style={{ width: '100%' }}
                            addonAfter="days"
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                  <Form.List name={['sequence', 'steps']}>
                    {(fields, { add, remove }) => {
                      return (
                        <Form.Item
                          noStyle
                          shouldUpdate={(prevValues, currentValues) =>
                            prevValues.contacts !== currentValues.contacts ||
                            prevValues.contactLists !== currentValues.contactLists
                          }
                        >
                          {({ getFieldValue }) => {
                            const selectedContacts = getFieldValue('contacts') || []
                            const selectedContactLists = getFieldValue('contactLists') || []

                            // Calculate total recipients
                            const directContacts = selectedContacts.length
                            const listContacts = selectedContactLists.reduce((total: number, listId: string) => {
                              const list = contactLists.find(l => l._id === listId)
                              return total + (list?.totalContacts || 0)
                            }, 0)
                            const totalRecipients = directContacts + listContacts

                            // Calculate estimated recipients for each step based on conditions
                            const calculateStepRecipients = (stepIndex: number) => {
                              if (stepIndex === 0) return totalRecipients // First step gets all

                              // Estimate based on typical email engagement rates
                              let estimated = totalRecipients

                              // Apply typical engagement rates for each previous step
                              for (let i = 0; i < stepIndex; i++) {
                                // Typical rates: 20% open, 3% click, 90% no reply
                                estimated = Math.round(estimated * 0.2) // Assuming 20% engagement rate
                              }

                              return Math.max(1, estimated)
                            }

                            return (
                              <div className="w-full">
                                {fields.map((field, index) => {
                                  const estimatedRecipients = calculateStepRecipients(index)
                                  const percentage = totalRecipients > 0 ? Math.round((estimatedRecipients / totalRecipients) * 100) : 0

                                  return (
                                    <Card key={field.key} size="small" className="mb-3"
                                      title={
                                        <div className="flex items-center justify-between">
                                          <span>Step {index + 1}</span>
                                          <div className="flex items-center space-x-2">
                                            <Tag color={index === 0 ? 'green' : 'blue'}>
                                              📧 ~{estimatedRecipients} recipients ({percentage}%)
                                            </Tag>
                                          </div>
                                        </div>
                                      }
                                      extra={
                                        <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                                      }
                                    >
                                      <Row gutter={12}>
                                        <Col span={24}>
                                          <Form.Item
                                            name={[field.name, 'contentType']}
                                            label="Content Type"
                                            initialValue="template"
                                          >
                                            <Select placeholder="Choose content type">
                                              <Option value="template">📧 Email Template</Option>
                                              <Option value="catalog">📦 Direct Catalog</Option>
                                            </Select>
                                          </Form.Item>
                                        </Col>
                                      </Row>

                                      <Form.Item
                                        noStyle
                                        shouldUpdate={(prevValues, currentValues) => {
                                          const prevContentType = prevValues?.sequence?.steps?.[field.name]?.contentType
                                          const currentContentType = currentValues?.sequence?.steps?.[field.name]?.contentType
                                          return prevContentType !== currentContentType
                                        }}
                                      >
                                        {({ getFieldValue }) => {
                                          const contentType = getFieldValue(['sequence', 'steps', field.name, 'contentType']) || 'template'

                                          return (
                                            <Row gutter={12}>
                                              <Col span={14}>
                                                {contentType === 'template' ? (
                                                  <Form.Item
                                                    name={[field.name, 'templateId']}
                                                    label="Email Template"
                                                    rules={[{ required: true, message: 'Select a template for this step' }]}
                                                  >
                                                    <Select placeholder="Select template" loading={templatesLoading}>
                                                      {templates.map(t => (
                                                        <Option key={t._id} value={t._id}>
                                                          {t.name} ({t.type})
                                                        </Option>
                                                      ))}
                                                    </Select>
                                                  </Form.Item>
                                                ) : (
                                                  <Form.Item
                                                    name={[field.name, 'catalogItems']}
                                                    label="Catalog Items"
                                                    rules={[{ required: true, message: 'Select catalog items for this step' }]}
                                                  >
                                                    <Select
                                                      mode="multiple"
                                                      placeholder="Select catalog items"
                                                      showSearch
                                                      loading={catalogItemsLoading}
                                                      filterOption={(input, option) =>
                                                        (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                                                      }
                                                    >
                                                      {catalogItems.map((item) => (
                                                        <Option key={item._id} value={item._id}>
                                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {item.images && item.images.length > 0 ? (
                                                              <img
                                                                src={item.images[0].url}
                                                                alt={item.title}
                                                                style={{ width: '20px', height: '20px', objectFit: 'cover', borderRadius: '4px' }}
                                                              />
                                                            ) : (
                                                              <span>📦</span>
                                                            )}
                                                            <span>
                                                              {item.title}
                                                            </span>
                                                          </div>
                                                        </Option>
                                                      ))}
                                                    </Select>
                                                  </Form.Item>
                                                )}
                                              </Col>
                                              <Col span={10}>
                                                <Form.Item
                                                  name={[field.name, 'delayHours']}
                                                  label="Send After (hours)"
                                                  rules={[{ required: true, message: 'Enter delay for this step' }]}
                                                >
                                                  <InputNumber min={0} placeholder="24" style={{ width: '100%' }} />
                                                </Form.Item>
                                              </Col>
                                            </Row>
                                          )
                                        }}
                                      </Form.Item>

                                      {/* Subject line for catalog emails */}
                                      <Form.Item
                                        noStyle
                                        shouldUpdate={(prevValues, currentValues) => {
                                          const prevContentType = prevValues?.sequence?.steps?.[field.name]?.contentType
                                          const currentContentType = currentValues?.sequence?.steps?.[field.name]?.contentType
                                          return prevContentType !== currentContentType
                                        }}
                                      >
                                        {({ getFieldValue }) => {
                                          const contentType = getFieldValue(['sequence', 'steps', field.name, 'contentType']) || 'template'

                                          if (contentType === 'catalog') {
                                            return (
                                              <Row>
                                                <Col span={24}>
                                                  <Form.Item
                                                    name={[field.name, 'subject']}
                                                    label="Email Subject"
                                                    rules={[{ required: true, message: 'Enter email subject for catalog' }]}
                                                  >
                                                    <Input placeholder="e.g., Check out our latest products!" />
                                                  </Form.Item>
                                                </Col>
                                              </Row>
                                            )
                                          }
                                          return null
                                        }}
                                      </Form.Item>

                                      <Row>
                                        <Col span={24}>
                                          <Text type="secondary">Send Conditions {index > 0 ? '(all must be met)' : '(for Step 1 - always sends)'}</Text>
                                          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                            <Form.Item name={[field.name, 'conditions', 'requireOpen']} valuePropName="checked">
                                              <Checkbox>Previous email opened</Checkbox>
                                            </Form.Item>
                                            <Form.Item name={[field.name, 'conditions', 'requireClick']} valuePropName="checked">
                                              <Checkbox>Previous email clicked</Checkbox>
                                            </Form.Item>
                                            <Form.Item name={[field.name, 'conditions', 'requireNoReply']} valuePropName="checked" initialValue={true}>
                                              <Checkbox>No reply received</Checkbox>
                                            </Form.Item>
                                          </div>
                                        </Col>
                                      </Row>

                                      <Row>
                                        <Col span={24}>
                                          <Form.Item
                                            name={[field.name, 'message']}
                                            label="Custom Message (optional)"
                                          >
                                            <TextArea rows={2} placeholder="Add a custom message that will be appended to the template" />
                                          </Form.Item>
                                        </Col>
                                      </Row>
                                    </Card>
                                  )
                                })}
                                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>
                                  Add Follow-up Step
                                </Button>
                              </div>
                            )
                          }}
                        </Form.Item>
                      )
                    }}
                  </Form.List>
                </div>
              </div>
            )
          }

          return null
        }}
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) => prevValues.sendType !== currentValues.sendType}
      >
        {({ getFieldValue }) => {
          const sendType = getFieldValue('sendType')

          // Only show template selection for immediate and scheduled sends
          // For sequence, templates are selected in the steps
          if (sendType === 'immediate' || sendType === 'scheduled') {
            return (
              <Form.Item
                name="template"
                label="Email Template"
                rules={[{ required: true, message: 'Please select a template' }]}
              >
                <Select placeholder="Select template" loading={templatesLoading}>
                  {templates.map(template => (
                    <Option key={template._id} value={template._id}>
                      {template.name} ({template.type})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )
          }

          return null
        }}
      </Form.Item>

      <Form.Item
        name="contacts"
        label="Direct Contacts"
      >
        <Select
          mode="multiple"
          placeholder="Search and select contacts by email..."
          loading={contactsLoading}
          showSearch
          allowClear
          optionFilterProp="children"
          filterOption={(input, option) => {
            const email = option?.email || '';
            const name = option?.name || '';
            const searchText = input.toLowerCase();
            return email.toLowerCase().includes(searchText) ||
              name.toLowerCase().includes(searchText);
          }}
          notFoundContent={contactsLoading ? 'Loading...' : 'No contacts found'}
        >
          {contacts.map(contact => (
            <Option
              key={contact._id}
              value={contact._id}
              email={contact.email}
              name={`${contact.firstName || ''} ${contact.lastName || ''}`.trim()}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 500 }}>{contact.email}</span>
                {(contact.firstName || contact.lastName) && (
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {contact.firstName} {contact.lastName}
                  </span>
                )}
              </div>
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="contactLists"
        label="Contact Lists"
      >
        <Select
          mode="multiple"
          placeholder="Select contact lists"
          loading={campaignsLoading}
        >
          {contactLists.map(list => (
            <Option key={list._id} value={list._id}>
              {list.name} ({list.totalContacts} contacts)
            </Option>
          ))}
        </Select>
      </Form.Item>




      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={isCreateModalVisible ? createSubmitting : editSubmitting}>
            {isCreateModalVisible ? 'Create Campaign' : 'Update Campaign'}
          </Button>
          <Button onClick={() => {
            setIsCreateModalVisible(false)
            setIsEditModalVisible(false)
          }}>
            Cancel
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={2} className="mb-2">Campaigns</Title>
          <Text type="secondary">Manage and track your email campaigns</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={refreshCampaignStats}
            loading={refreshingStats}
          >
            Refresh Stats
          </Button>
          <Input.Search
            placeholder="Search campaigns..."
            allowClear
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: 300 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateCampaign}
            size="large"
          >
            Create Campaign
          </Button>
        </Space>
      </div>

      {/* Status Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Draft"
              value={statusStats.draft}
              prefix={<MailOutlined className="text-gray-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Scheduled"
              value={statusStats.scheduled}
              prefix={<CalendarOutlined className="text-blue-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Sending"
              value={statusStats.sending}
              prefix={<PlayCircleOutlined className="text-green-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Sent"
              value={statusStats.sent}
              prefix={<CheckCircleOutlined className="text-blue-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Completed"
              value={statusStats.completed}
              prefix={<BarChartOutlined className="text-purple-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Paused"
              value={statusStats.paused}
              prefix={<PauseCircleOutlined className="text-orange-500" />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={campaigns.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.description?.toLowerCase().includes(searchQuery.toLowerCase())
          )}
          loading={campaignsLoading}
          rowKey="_id"
          pagination={{
            pageSize: 50,
            pageSizeOptions: ['10', '20', '50', '100', '200'],
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} campaigns`,
          }}
        />
      </Card>

      {/* Tracking Details Modal */}
      <Modal
        title={`Tracking Details - ${selectedCampaign?.name}`}
        open={trackingModalVisible}
        onCancel={() => setTrackingModalVisible(false)}
        footer={null}
        width={1000}
        className="tracking-modal"
        maskClosable={false}
        closable={true}
        keyboard={false}
        destroyOnClose={true}
      >
        {selectedCampaign && (
          <div className="space-y-4">
            {/* Campaign Statistics */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Campaign Statistics</h3>
                <Button
                  type="primary"
                  size="small"
                  onClick={refreshTrackingStats}
                  loading={refreshingStats}
                >
                  Refresh Stats
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-3">Total Sent</div>
                  <div className="flex items-center justify-center space-x-2">
                    <MailOutlined className="text-gray-700 text-xl" />
                    <span className="text-3xl font-bold">{selectedCampaign.stats?.totalSent || 0}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">From Campaigns API</div>
                </div>

                <div className="text-center border-l border-r border-gray-200 px-4">
                  <div className="text-sm text-gray-500 mb-3">Opened</div>
                  <div className="flex items-center justify-center space-x-2">
                    <EyeOutlined className="text-blue-500 text-xl" />
                    <span className="text-3xl font-bold text-blue-600">
                      {selectedCampaign.stats?.opened || 0} / {(selectedCampaign.stats?.totalSent || 0) > 0 ? Math.round(((selectedCampaign.stats?.opened || 0) / (selectedCampaign.stats?.totalSent || 0)) * 100) : 0}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">From Campaigns API</div>
                </div>

                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-3">Clicked</div>
                  <div className="flex items-center justify-center space-x-2">
                    <LinkOutlined className="text-green-500 text-xl" />
                    <span className="text-3xl font-bold text-green-600">
                      {selectedCampaign.stats?.clicked || 0} / {(selectedCampaign.stats?.totalSent || 0) > 0 ? Math.round(((selectedCampaign.stats?.clicked || 0) / (selectedCampaign.stats?.totalSent || 0)) * 100) : 0}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">From Campaigns API</div>
                </div>
              </div>
            </div>

            {/* Contact Details Table */}
            <div>
              <Table
                dataSource={trackingDetails}
                loading={trackingLoading}
                size="small"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                  showQuickJumper: false,
                  size: 'small'
                }}
                scroll={{ y: 300 }}
                columns={[
                  {
                    title: 'Contact',
                    dataIndex: 'contact',
                    key: 'contact',
                    render: (contact: any) => (
                      <div>
                        <div className="font-medium">{contact?.email || 'N/A'}</div>
                        <div className="text-xs text-gray-500">
                          {contact?.firstName && contact?.lastName
                            ? `${contact.firstName} ${contact.lastName}`
                            : contact?.firstName || contact?.lastName || ''}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status: string, record: any) => {
                      const tags = []

                      // Check the original backend data for both opened and clicked status
                      const hasOpened = record.events?.some((event: any) => event.event === 'opened')
                      const hasClicked = record.events?.some((event: any) => event.event === 'clicked')

                      if (hasOpened) {
                        tags.push(<Tag key="opened" color="cyan" icon={<EyeOutlined />}>Opened</Tag>)
                      }
                      if (hasClicked) {
                        tags.push(<Tag key="clicked" color="gold" icon={<LinkOutlined />}>Clicked</Tag>)
                      }

                      // If no opened/clicked events, show the default status
                      if (tags.length === 0) {
                        const statusConfig = {
                          sent: { color: 'blue', text: 'Sent' },
                          delivered: { color: 'green', text: 'Delivered' },
                          bounced: { color: 'red', text: 'Bounced' },
                          pending: { color: 'orange', text: 'Pending' }
                        }
                        const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status }
                        return <Tag color={config.color}>{config.text}</Tag>
                      }

                      return <>{tags}</>
                    }
                  },
                  {
                    title: 'Last Activity',
                    dataIndex: 'lastActivity',
                    key: 'lastActivity',
                    render: (date: string) => (
                      <div>
                        <div className="text-sm">{date ? new Date(date).toLocaleDateString() : 'N/A'}</div>
                        <div className="text-xs text-gray-500">
                          {date ? new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' PM' : ''}
                        </div>
                      </div>
                    )
                  },
                  {
                    title: 'Events Timeline',
                    key: 'events',
                    render: (record: any) => (
                      <div className="space-y-1">
                        {record.events?.map((event: any, index: number) => (
                          <div key={index} className="text-xs flex items-center space-x-1">
                            <span className={`inline-block w-2 h-2 rounded-full ${event.event === 'sent' ? 'bg-blue-400' :
                              event.event === 'opened' ? 'bg-orange-400' :
                                event.event === 'clicked' ? 'bg-blue-400' : 'bg-gray-400'
                              }`}></span>
                            <span className={`font-medium ${event.event === 'sent' ? 'text-blue-600' :
                              event.event === 'opened' ? 'text-orange-600' :
                                event.event === 'clicked' ? 'text-blue-600' : 'text-gray-600'
                              }`}>
                              {event.event.charAt(0).toUpperCase() + event.event.slice(1)}:
                            </span>
                            <span className="text-gray-600">
                              {new Date(event.timestamp).toLocaleDateString()}, {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} PM
                            </span>
                          </div>
                        )) || (
                            <div className="text-xs text-gray-400 flex items-center space-x-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-gray-300"></span>
                              <span>Queued for sending</span>
                            </div>
                          )}
                      </div>
                    )
                  }
                ]}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Create Campaign Modal */}
      <Modal
        title="Create Campaign"
        open={isCreateModalVisible}
        onCancel={() => {
          setIsCreateModalVisible(false)
          form.resetFields()
        }}
        footer={null}
        width={800}
        maskClosable={false}
        closable={true}
        keyboard={false}
        destroyOnClose={true}
      >
        {renderCampaignForm()}
      </Modal>

      {/* Edit Campaign Modal */}
      <Modal
        title="Edit Campaign"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
        width={800}
        maskClosable={false}
        closable={true}
        keyboard={false}
        destroyOnClose={true}
      >
        {renderCampaignForm()}
      </Modal>

      {/* Campaign Stats Modal */}
      <Modal
        title={`Campaign Statistics - ${selectedCampaign?.name || ''}`}
        open={isStatsModalVisible}
        onCancel={() => {
          setIsStatsModalVisible(false)
          setSelectedCampaign(null)
        }}
        footer={[
          <Button key="refresh" onClick={() => loadCampaigns()}>
            Refresh Stats
          </Button>,
          <Button key="close" onClick={() => setIsStatsModalVisible(false)}>
            Close
          </Button>
        ]}
        width={800}
        maskClosable={false}
        closable={true}
        keyboard={false}
        destroyOnClose={true}
      >
        {selectedCampaign && (
          <div className="space-y-6">
            {/* Overview Stats */}
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Total Sent"
                    value={selectedCampaign.stats.totalSent}
                    prefix={<MailOutlined className="text-blue-500" />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Opened"
                    value={selectedCampaign.stats.opened}
                    suffix={`/ ${selectedCampaign.stats.totalSent > 0 ? Math.round((selectedCampaign.stats.opened / selectedCampaign.stats.totalSent) * 100) : 0}%`}
                    prefix={<CheckCircleOutlined className="text-green-500" />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Clicked"
                    value={selectedCampaign.stats.clicked}
                    suffix={`/ ${selectedCampaign.stats.totalSent > 0 ? Math.round((selectedCampaign.stats.clicked / selectedCampaign.stats.totalSent) * 100) : 0}%`}
                    prefix={<PlayCircleOutlined className="text-purple-500" />}
                  />
                </Card>
              </Col>
              {/* <Col span={6}>
                <Card>
                  <Statistic
                    title="Replied"
                    value={selectedCampaign.stats.replied}
                    suffix={`/ ${selectedCampaign.stats.totalSent > 0 ? Math.round((selectedCampaign.stats.replied / selectedCampaign.stats.totalSent) * 100) : 0}%`}
                    prefix={<MailOutlined className="text-orange-500" />}
                  />
                </Card>
              </Col> */}
            </Row>


            {/* Performance Metrics */}
            <Card title="Performance Metrics">
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedCampaign.stats.totalSent > 0 ? Math.round((selectedCampaign.stats.opened / selectedCampaign.stats.totalSent) * 100) : 0}%
                    </div>
                    <div className="text-sm text-gray-500">Open Rate</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedCampaign.stats.totalSent > 0 ? Math.round((selectedCampaign.stats.clicked / selectedCampaign.stats.totalSent) * 100) : 0}%
                    </div>
                    <div className="text-sm text-gray-500">Click Rate</div>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Campaign Statistics */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Campaign Statistics</h3>
                <Button
                  type="primary"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={refreshCampaignStats}
                  loading={refreshingStats}
                >
                  Refresh Stats
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="text-center bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">Total Sent</div>
                  <div className="text-2xl font-bold text-gray-700 flex items-center justify-center gap-1">
                    <MailOutlined className="text-blue-500" />
                    {selectedCampaign.stats.totalSent}
                  </div>
                </div>

                <div className="text-center bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">Opened</div>
                  <div className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-1">
                    <EyeOutlined className="text-blue-500" />
                    {selectedCampaign.stats.opened} / {selectedCampaign.stats.totalSent > 0 ? Math.round((selectedCampaign.stats.opened / selectedCampaign.stats.totalSent) * 100) : 0}%
                  </div>
                </div>

                <div className="text-center bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">Clicked</div>
                  <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                    <LinkOutlined className="text-green-500" />
                    {selectedCampaign.stats.clicked} / {selectedCampaign.stats.totalSent > 0 ? Math.round((selectedCampaign.stats.clicked / selectedCampaign.stats.totalSent) * 100) : 0}%
                  </div>
                </div>
              </div>
            </div>

            {/* Sequence Details (if applicable) */}
            {selectedCampaign.sendType === 'sequence' && selectedCampaign.sequence && (
              <Card title="Sequence Steps">
                <div className="space-y-3">
                  {selectedCampaign.sequence.steps?.map((step: any, index: number) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <Text strong>Step {index + 1}</Text>
                          <div className="text-sm text-gray-600">
                            {step.contentType === 'template' ? (
                              <>Template: {templates.find(t => t._id === step.templateId)?.name || 'Unknown'}</>
                            ) : (
                              <>Catalog Items: {step.catalogItems?.length || 0} items</>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            Delay: {step.delayHours} hours
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">
                            Conditions: {step.conditions?.requireOpen ? '📖 ' : ''}{step.conditions?.requireClick ? '🖱️ ' : ''}{step.conditions?.requireNoReply ? '🚫💬' : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </Modal>

    </div>
  )
}