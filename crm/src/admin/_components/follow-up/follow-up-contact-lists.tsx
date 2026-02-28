"use client"

import { useState, useMemo } from 'react'
import { Card, Row, Col, Table, Button, Typography, Modal, Form, Input, Select, Space, Tooltip, Popconfirm, Progress, Statistic } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  UserOutlined,
  UnorderedListOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import { useFollowUpContext } from './hooks/use-follow-up'
import { contactApi } from './libs/follow-up-api'
import type { ContactList, Contact } from './types/follow-up'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

// Separate component to handle the heavy logic for managing contacts
// This prevents the main component from lagging due to large contact lists when the modal is closed
const ManageContactsModalContent = ({
  list,
  onClose
}: {
  list: ContactList,
  onClose: () => void
}) => {
  const { contacts, addContactsToList, removeContactsFromList } = useFollowUpContext()

  const [allAvailableContacts, setAllAvailableContacts] = useState<Contact[]>([])
  const [loadingAllContacts, setLoadingAllContacts] = useState(false)
  const [displayLimit, setDisplayLimit] = useState(200)
  const [searchText, setSearchText] = useState('')
  const [productFilter, setProductFilter] = useState<string>('')
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [selectionLoading, setSelectionLoading] = useState(false)
  const [isSelectingAll, setIsSelectingAll] = useState(false)
  const [currentListLimit, setCurrentListLimit] = useState(50)

  // Fetch contacts on mount
  useState(() => {
    const fetchContacts = async () => {
      setLoadingAllContacts(true)
      try {
        // Fetch a large number of contacts to support "Select All"
        const { contacts } = await contactApi.getAll(1, 100000)
        setAllAvailableContacts(contacts)
      } catch (error) {
        console.error('Failed to load all contacts:', error)
      } finally {
        setLoadingAllContacts(false)
      }
    }
    fetchContacts()
  })

  // Use allAvailableContacts if loaded, otherwise fallback to context contacts (paginated)
  const sourceContacts = allAvailableContacts.length > 0 ? allAvailableContacts : contacts

  // Optimize filtering: Create a Set of existing IDs for O(1) lookup
  const existingContactIds = useMemo(() => {
    return new Set(list.contacts.map(c => c._id))
  }, [list])

  const filteredContacts = useMemo(() => {
    // First exclude contacts already in the list
    const available = sourceContacts.filter(contact => !existingContactIds.has(contact._id))

    // Then apply product and search text filters
    return available.filter(contact => {
      // Product Filter
      if (productFilter) {
        if (!contact.interestedProducts?.some(product =>
          product.toLowerCase().includes(productFilter.toLowerCase())
        )) {
          return false
        }
      }

      // Search Text Filter
      if (searchText) {
        const lowerSearch = searchText.toLowerCase()
        const emailMatch = contact.email?.toLowerCase().includes(lowerSearch)
        const fName = contact.firstName || ''
        const lName = contact.lastName || ''
        const nameMatch = (fName + ' ' + lName).toLowerCase().includes(lowerSearch)
        const productMatch = contact.interestedProducts?.some(p => p.toLowerCase().includes(lowerSearch))

        if (!emailMatch && !nameMatch && !productMatch) return false
      }

      return true
    })
  }, [sourceContacts, existingContactIds, productFilter, searchText])

  const handleSelectAll = () => {
    setIsSelectingAll(true)
    // Use setTimeout to allow the UI to render the loading state before the heavy state update freezes it momentarily
    setTimeout(() => {
      setSelectedContactIds(filteredContacts.map(c => c._id))
      setIsSelectingAll(false)
    }, 100)
  }

  const handlePopupScroll = (e: any) => {
    e.persist()
    const { target } = e
    if (target.scrollTop + target.offsetHeight === target.scrollHeight) {
      setDisplayLimit(prev => Math.min(prev + 200, filteredContacts.length))
    }
  }

  const handleAddContacts = async () => {
    if (selectedContactIds.length === 0) return
    setSelectionLoading(true)
    try {
      await addContactsToList(list._id, selectedContactIds)
      setSelectedContactIds([])
      setProductFilter('')
      setSearchText('')
      // Refresh the list data by reloading page or context 
      // (forcing a window reload is a quick fix for context not updating deeply nested lists)
      window.location.reload()
    } catch (error) {
      console.error('Failed to add contacts:', error)
      setSelectionLoading(false)
    }
  }

  const handleRemoveContactFromList = async (contactId: string) => {
    try {
      await removeContactsFromList(list._id, [contactId])
      // Ideally update local state or context here without reload, but for consistency:
      window.location.reload()
    } catch (error) {
      console.error('Failed to remove contact from list:', error)
    }
  }

  const handleLoadMoreCurrent = () => {
    setCurrentListLimit(prev => Math.min(prev + 50, list.contacts.length))
  }

  if (loadingAllContacts) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4">Loading contacts database...</div>
        <Progress type="circle" status="active" percent={99} format={() => <EyeOutlined />} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <Text strong>List: {list.name}</Text>
      </div>

      <div>
        <Text strong>Filter by Interested Product:</Text>
        <Input
          placeholder="Type product name to filter contacts..."
          value={productFilter}
          onChange={(e) => {
            setProductFilter(e.target.value)
            setDisplayLimit(200)
          }}
          style={{ marginTop: 8, marginBottom: 8 }}
          allowClear
        />
        <div className="text-xs text-gray-500 flex gap-1">
          <span>Showing {filteredContacts.length} available to add.</span>
          <span className="text-gray-400">(Total Database: {sourceContacts.length} | Already in List: {list.contacts.length})</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Text strong>Add Contacts to List:</Text>
          <Space>
            <Button
              size="small"
              onClick={handleSelectAll}
              disabled={filteredContacts.length === 0 || selectionLoading || isSelectingAll}
              loading={isSelectingAll}
            >
              Select All ({filteredContacts.length})
            </Button>
            <Button
              size="small"
              onClick={() => setSelectedContactIds([])}
              disabled={selectedContactIds.length === 0 || selectionLoading}
            >
              Clear Selection
            </Button>
          </Space>
        </div>
        <Select
          mode="multiple"
          placeholder="Select contacts to add"
          style={{ width: '100%', marginTop: 8 }}
          showSearch
          searchValue={searchText}
          onSearch={(val) => {
            setSearchText(val)
            setDisplayLimit(200)
          }}
          filterOption={false}
          onPopupScroll={handlePopupScroll}
          value={selectedContactIds}
          onChange={(newVal) => setSelectedContactIds(newVal)}
          autoClearSearchValue={false}
          disabled={selectionLoading || isSelectingAll}
          maxTagCount={10}
          maxTagPlaceholder={(omitted) => `+ ${omitted.length} more contacts...`}
        >
          {filteredContacts.slice(0, displayLimit).map(contact => (
            <Option key={contact._id} value={contact._id}>
              <div>
                <div>{contact.email} {contact.firstName && `(${contact.firstName} ${contact.lastName})`}</div>
                {contact.interestedProducts && contact.interestedProducts.length > 0 && (
                  <div className="text-xs text-blue-600">
                    Products: {contact.interestedProducts.join(', ')}
                  </div>
                )}
              </div>
            </Option>
          ))}
          {filteredContacts.length > displayLimit && (
            <Option disabled key="__loading__" value="__loading__">
              <div className="text-center text-xs text-gray-400">Scroll for more...</div>
            </Option>
          )}
        </Select>
        {selectedContactIds.length > 0 && (
          <Button
            type="primary"
            onClick={handleAddContacts}
            style={{ marginTop: 8 }}
            loading={selectionLoading}
          >
            Add {selectedContactIds.length} Contact{selectedContactIds.length > 1 ? 's' : ''} to List
          </Button>
        )}
      </div>

      <div>
        <Text strong>Current Contacts in List ({list.contacts.length}):</Text>
        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto pr-2">
          {list.contacts.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              No contacts in this list yet
            </div>
          ) : (
            <>
              {list.contacts.slice(0, currentListLimit).map(contact => (
                <div key={contact._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium">
                      {contact.firstName && contact.lastName
                        ? `${contact.firstName} ${contact.lastName}`
                        : contact.email
                      }
                    </div>
                    <div className="text-sm text-gray-500">{contact.email}</div>
                    {contact.company && (
                      <div className="text-xs text-gray-400">
                        Company: {contact.company}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      Interested Products: {contact.interestedProducts?.length ? contact.interestedProducts.join(', ') : 'None specified'}
                    </div>
                  </div>
                  <Popconfirm
                    title="Remove Contact"
                    description="Are you sure you want to remove this contact from the list?"
                    onConfirm={() => handleRemoveContactFromList(contact._id)}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Tooltip title="Remove from list">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<UserDeleteOutlined />}
                      />
                    </Tooltip>
                  </Popconfirm>
                </div>
              ))}

              {list.contacts.length > currentListLimit && (
                <div className="text-center py-2">
                  <Button size="small" onClick={handleLoadMoreCurrent}>
                    Load More Contacts ({list.contacts.length - currentListLimit} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FollowUpContactLists() {
  const {
    contactLists,
    contactListsLoading,
    createContactList,
    updateContactList,
    deleteContactList
  } = useFollowUpContext()

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [isManageContactsModalVisible, setIsManageContactsModalVisible] = useState(false)
  const [selectedList, setSelectedList] = useState<ContactList | null>(null)

  const [form] = Form.useForm()

  const columns = [
    {
      title: 'List Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ContactList) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-sm text-gray-500">{record?.description || 'No description'}</div>
        </div>
      ),
    },
    {
      title: 'Contacts',
      key: 'contacts',
      render: (record: ContactList) => (
        <div>
          <div className="font-medium">{record?.contacts.length} contacts</div>
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
      render: (record: ContactList) => (
        <Space>
          <Tooltip title="View Contacts">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewContacts(record)}
            />
          </Tooltip>

          <Tooltip title="Manage Contacts">
            <Button
              type="text"
              size="small"
              icon={<UserAddOutlined />}
              onClick={() => handleManageContacts(record)}
            />
          </Tooltip>

          <Tooltip title="Edit List">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditList(record)}
            />
          </Tooltip>

          <Popconfirm
            title="Delete Contact List"
            description="Are you sure you want to delete this contact list?"
            onConfirm={() => handleDeleteList(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete List">
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

  const handleCreateList = () => {
    setIsCreateModalVisible(true)
    form.resetFields()
  }

  const handleEditList = (list: ContactList) => {
    setSelectedList(list)
    form.setFieldsValue({
      name: list.name,
      description: list.description,
    })
    setIsEditModalVisible(true)
  }

  const handleDeleteList = async (listId: string) => {
    try {
      await deleteContactList(listId)
    } catch (error) {
      console.error('Failed to delete contact list:', error)
    }
  }

  const handleViewContacts = (list: ContactList) => {
    setSelectedList(list)
    setIsManageContactsModalVisible(true)
  }

  const handleManageContacts = (list: ContactList) => {
    setSelectedList(list)
    setIsManageContactsModalVisible(true)
  }

  const handleCreateSubmit = async (values: any) => {
    try {
      await createContactList({
        name: values.name,
        description: values.description,
        contacts: [],
        totalContacts: 0,
      })
      setIsCreateModalVisible(false)
      form.resetFields()
    } catch (error) {
      console.error('Failed to create contact list:', error)
    }
  }

  const handleEditSubmit = async (values: any) => {
    if (!selectedList) return

    try {
      await updateContactList(selectedList._id, {
        name: values.name,
        description: values.description,
      })
      setIsEditModalVisible(false)
      setSelectedList(null)
      form.resetFields()
    } catch (error) {
      console.error('Failed to update contact list:', error)
    }
  }

  const getListStats = () => {
    const totalContacts = contactLists.reduce((acc, list) => acc + (list?.contacts?.length || 0), 0)
    const stats = {
      total: contactLists.length,
      totalContacts: totalContacts,
      avgContactsPerList: contactLists.length > 0
        ? Math.round(totalContacts / contactLists.length)
        : 0,
    }
    return stats
  }

  const listStats = getListStats()

  const renderListForm = () => (
    <Form
      form={form}
      layout="vertical"
      onFinish={isCreateModalVisible ? handleCreateSubmit : handleEditSubmit}
    >
      <Form.Item
        name="name"
        label="List Name"
        rules={[{ required: true, message: 'Please enter list name' }]}
      >
        <Input placeholder="Enter list name" />
      </Form.Item>

      <Form.Item
        name="description"
        label="Description"
      >
        <TextArea
          rows={3}
          placeholder="Enter list description"
        />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">
            {isCreateModalVisible ? 'Create List' : 'Update List'}
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
          <Title level={2} className="mb-2">Contact Lists</Title>
          <Text type="secondary">Organize contacts into lists for targeted campaigns</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateList}
          size="large"
        >
          Create List
        </Button>
      </div>

      {/* List Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Total Lists"
              value={listStats.total}
              prefix={<UnorderedListOutlined className="text-blue-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Total Contacts"
              value={listStats.totalContacts}
              prefix={<UserOutlined className="text-green-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Avg Contacts/List"
              value={listStats.avgContactsPerList}
              prefix={<BarChartOutlined className="text-purple-500" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Contact Lists Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={contactLists}
          loading={contactListsLoading}
          rowKey="_id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} lists`,
          }}
        />
      </Card>

      {/* Create List Modal */}
      <Modal
        title="Create New Contact List"
        open={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        {renderListForm()}
      </Modal>

      {/* Edit List Modal */}
      <Modal
        title="Edit Contact List"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
        width={600}
      >
        {renderListForm()}
      </Modal>

      {/* Manage Contacts Modal */}
      <Modal
        title="Manage List Contacts"
        open={isManageContactsModalVisible}
        onCancel={() => {
          setIsManageContactsModalVisible(false)
          setSelectedList(null)
        }}
        footer={null}
        width={800}
      >
        {isManageContactsModalVisible && selectedList && (
          <ManageContactsModalContent
            list={selectedList}
            onClose={() => setIsManageContactsModalVisible(false)}
          />
        )}
      </Modal>
    </div>
  )
}