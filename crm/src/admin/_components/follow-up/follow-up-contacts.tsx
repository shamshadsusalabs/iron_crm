"use client"

import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Button, Tag, Typography, Modal, Form, Input, Select, Space, Tooltip, Popconfirm, Upload, message, Statistic } from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,

  UploadOutlined,
  DownloadOutlined,
  UserOutlined,
  MailOutlined,

  ExclamationCircleOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import { useFollowUpContext } from './hooks/use-follow-up'
import type { Contact, CreateContactData } from './types/follow-up'

const { Title, Text } = Typography
const { Option } = Select

export default function FollowUpContacts() {
  const {
    contacts,
    contactsLoading,
    contactsPagination,
    createContact,
    updateContact,
    deleteContact,
    bulkCreateContacts,
    loadContacts,
    contactStats: serverStats
  } = useFollowUpContext()

  // Production ready - console logs removed

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [isBulkImportModalVisible, setIsBulkImportModalVisible] = useState(false)
  const [isBulkImporting, setIsBulkImporting] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [form] = Form.useForm()

  // Use server stats or fallback to defaults
  const contactStats = serverStats || {
    total: contactsPagination?.total || 0,
    active: 0,
    unsubscribed: 0,
    bounced: 0,
    complained: 0,
    withProducts: 0
  }

  // Re-fetch contacts from server when search query changes
  useEffect(() => {
    const handler = setTimeout(() => {
      loadContacts(1, contactsPagination?.limit || 200, searchQuery);
    }, 500); // 500ms debounce
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Contact table columns
  const columns = [
    {
      title: 'Contact',
      key: 'contact',
      render: (record: Contact) => (
        <div>
          <div className="font-medium">
            {record.firstName && record.lastName
              ? `${record.firstName} ${record.lastName}`
              : record.email
            }
          </div>
          <div className="text-sm text-gray-500">{record.email}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          active: { color: 'green', text: 'Active' },
          unsubscribed: { color: 'red', text: 'Unsubscribed' },
          bounced: { color: 'orange', text: 'Bounced' },
          complained: { color: 'red', text: 'Complained' },
        }
        const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
      render: (company: string) => company || '-',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => phone || '-',
    },
    {
      title: 'Interested Products',
      key: 'interestedProducts',
      render: (record: Contact) => (
        <div>
          {record.interestedProducts?.length ? (
            <div className="flex flex-wrap gap-1">
              {record.interestedProducts.slice(0, 2).map((product, index) => (
                <Tag key={index} color="blue">{product}</Tag>
              ))}
              {record.interestedProducts.length > 2 && (
                <Tag color="blue">+{record.interestedProducts.length - 2} more</Tag>
              )}
            </div>
          ) : (
            <Text type="secondary">None specified</Text>
          )}
        </div>
      ),
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
      render: (record: Contact) => (
        <Space>


          <Tooltip title="Edit Contact">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditContact(record)}
            />
          </Tooltip>

          <Popconfirm
            title="Delete Contact"
            description="Are you sure you want to delete this contact?"
            onConfirm={() => handleDeleteContact(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete Contact">
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

  const handleCreateContact = () => {
    setIsCreateModalVisible(true)
    form.resetFields()
  }

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact)
    form.setFieldsValue({
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      company: contact.company,
      interestedProducts: contact.interestedProducts,
    })
    setIsEditModalVisible(true)
  }

  const handleDeleteContact = async (contactId: string) => {
    try {
      await deleteContact(contactId)
      message.success('Contact deleted successfully! 🗑️')
    } catch (error: any) {
      // Failed to delete contact
      message.error(error?.response?.data?.message || 'Failed to delete contact. Please try again.')
    }
  }

  const handleViewContact = (contact: Contact) => {
    // TODO: Implement contact details view
  }

  const handleCreateSubmit = async (values: any) => {
    try {
      await createContact({
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        company: values.company,
        interestedProducts: values.interestedProducts || [],
      })
      message.success('Contact created successfully! 🎉')
      setIsCreateModalVisible(false)
      form.resetFields()
    } catch (error: any) {
      // Failed to create contact
      message.error(error?.response?.data?.message || 'Failed to create contact. Please try again.')
    }
  }

  const handleEditSubmit = async (values: any) => {
    if (!selectedContact) return

    try {
      await updateContact(selectedContact._id, {
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        company: values.company,
        interestedProducts: values.interestedProducts || [],
      })
      message.success('Contact updated successfully! ✅')
      setIsEditModalVisible(false)
      setSelectedContact(null)
      form.resetFields()
    } catch (error: any) {
      // Failed to update contact
      message.error(error?.response?.data?.message || 'Failed to update contact. Please try again.')
    }
  }

  const handleBulkImport = async (file: File) => {
    setIsBulkImporting(true)
    try {
      message.loading('Importing contacts...', 0)

      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      const contacts: CreateContactData[] = lines.slice(1).map(line => {
        // Parse CSV with proper field mapping: firstName,lastName,email,phone,company,address,status,interestedProducts,notes
        // Handle quoted fields properly
        const fields = []
        let current = ''
        let inQuotes = false

        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            fields.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        fields.push(current.trim()) // Add the last field

        const [firstName, lastName, email, phone, company, address, status, interestedProducts, notes] = fields

        return {
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          phone: phone || undefined,
          company: company || undefined,
          interestedProducts: interestedProducts ? interestedProducts.split(',').map(p => p.trim()) : [],
        }
      }).filter(contact => contact.email) // Filter out empty contacts

      await bulkCreateContacts(contacts)
      message.destroy() // Remove loading message
      message.success(`Successfully imported ${contacts.length} contacts! 🎉`)
      setIsBulkImportModalVisible(false)

      // Refresh the contacts table
      window.location.reload()
    } catch (error) {
      // Failed to import contacts
      message.destroy() // Remove loading message
      message.error('Failed to import contacts. Please try again.')
    } finally {
      setIsBulkImporting(false)
    }
  }

  const renderContactForm = () => (
    <Form
      form={form}
      layout="vertical"
      onFinish={isCreateModalVisible ? handleCreateSubmit : handleEditSubmit}
    >
      <Form.Item
        name="email"
        label="Email"
        rules={[
          { required: true, message: 'Please enter email address' },
          { type: 'email', message: 'Please enter a valid email address' }
        ]}
      >
        <Input placeholder="Enter email address" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="firstName"
            label="First Name"
          >
            <Input placeholder="Enter first name" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="lastName"
            label="Last Name"
          >
            <Input placeholder="Enter last name" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="phone"
            label="Phone"
          >
            <Input placeholder="Enter phone number" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="company"
            label="Company"
          >
            <Input placeholder="Enter company name" />
          </Form.Item>
        </Col>
      </Row>


      <Form.Item
        name="interestedProducts"
        label="Interested Products"
      >
        <Select
          mode="tags"
          placeholder="Add interested products"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">
            {isCreateModalVisible ? 'Create Contact' : 'Update Contact'}
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
          <Title level={2} className="mb-2">Contacts</Title>
          <Text type="secondary">Manage your contact database</Text>
        </div>
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search contacts..."
            prefix={<SearchOutlined />}
            allowClear
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 300 }}
          />
          <Space>
            <Button
              icon={<UploadOutlined />}
              onClick={() => setIsBulkImportModalVisible(true)}
            >
              Bulk Import
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateContact}
              size="large"
            >
              Add Contact
            </Button>
          </Space>
        </div>
      </div>

      {/* Contact Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Total Contacts"
              value={contactStats.total}
              prefix={<UserOutlined className="text-blue-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Active Contacts"
              value={contactStats.active}
              prefix={<UserOutlined className="text-green-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="With Products"
              value={contactStats.withProducts}
              prefix={<BarChartOutlined className="text-purple-500" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Contacts Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={contacts}
          loading={contactsLoading}
          rowKey="_id"
          pagination={{
            current: contactsPagination?.page || 1,
            pageSize: contactsPagination?.limit || 200,
            total: contactsPagination?.total || 0,
            onChange: (page, pageSize) => loadContacts(page, pageSize, searchQuery),
            showSizeChanger: true,
            pageSizeOptions: ['50', '100', '200', '500'],
          }}
        />
      </Card>

      {/* Create Contact Modal */}
      <Modal
        title="Add New Contact"
        open={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        {renderContactForm()}
      </Modal>

      {/* Edit Contact Modal */}
      <Modal
        title="Edit Contact"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
        width={600}
      >
        {renderContactForm()}
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        title="Bulk Import Contacts"
        open={isBulkImportModalVisible}
        onCancel={() => setIsBulkImportModalVisible(false)}
        footer={null}
        width={600}
      >
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <Text strong>CSV Format Required</Text>
            <div className="text-sm text-gray-600 mt-1">
              firstName, lastName, email, phone, company, address, status, interestedProducts, notes
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Example: John, Doe, john@example.com, +1234567890, Company Inc, "123 Street", Hot, "Product1, Product2", "Notes here"
            </div>
            <div className="text-xs text-orange-600 mt-2">
              • interestedProducts should be comma-separated within quotes<br />
              • Use exact column order as shown above
            </div>
          </div>

          <Upload
            accept=".csv"
            beforeUpload={(file) => {
              handleBulkImport(file)
              return false
            }}
            showUploadList={false}
            disabled={isBulkImporting}
          >
            <Button icon={<UploadOutlined />} block loading={isBulkImporting} disabled={isBulkImporting}>
              {isBulkImporting ? 'Importing...' : 'Choose CSV File'}
            </Button>
          </Upload>
        </div>
      </Modal>
    </div>
  )
} 