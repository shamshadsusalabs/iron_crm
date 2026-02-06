"use client"

import { useEffect, useState } from 'react'

import { Card, Row, Col, Table, Button, Tag, Typography, Modal, Form, Input, Select, Switch, Space, Tooltip, Popconfirm, Tabs, Statistic } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CopyOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useFollowUpContext } from './hooks/use-follow-up'
import { catalogApi } from '../catalog/libs/catalog-api'
import type { CatalogItem } from '../catalog/types/catalog'

import type { Template } from './types/follow-up'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input
const { TabPane } = Tabs

export default function FollowUpTemplates() {

  const {
    templates,
    templatesLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    approveTemplate,
  } = useFollowUpContext()

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [form] = Form.useForm()
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(false)
  // Inline catalog add removed: only selecting existing items is allowed now

  // Filter templates based on search
  const filteredTemplates = templates.filter((template) => {
    if (!searchText.trim()) return true
    const search = searchText.toLowerCase()
    return (
      template.name.toLowerCase().includes(search) ||
      template.subject.toLowerCase().includes(search)
    )
  })

  // Calculate template statistics
  const templateStats = {
    total: templates.length,
    active: templates.filter(t => t.isActive).length,
    initial: templates.filter(t => t.type === 'initial').length,
    followup1: templates.filter(t => t.type === 'followup1').length,
    followup2: templates.filter(t => t.type === 'followup2').length,
    followup3: templates.filter(t => t.type === 'followup3').length,
  }

  // Template table columns
  const columns = [
    {
      title: 'Template Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Template) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-sm text-gray-500">{record.subject}</div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeConfig = {
          initial: { color: 'blue', text: 'Initial' },
          followup1: { color: 'green', text: 'Follow-up 1' },
          followup2: { color: 'orange', text: 'Follow-up 2' },
          followup3: { color: 'red', text: 'Follow-up 3' },
        }
        const config = (typeConfig as any)[type] || { color: 'default', text: type }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (_: boolean, record: Template) => {
        if (record.isActive) return <Tag color="green">Active</Tag>
        // Pending if not active and not approved yet
        if (!record.isActive && !record.approvedAt) return <Tag color="gold">Pending approval</Tag>
        return <Tag color="red">Inactive</Tag>
      },
    },
    {
      title: 'Variables',
      key: 'variables',
      render: (record: Template) => (
        <div>
          {record.variables.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {record.variables.slice(0, 3).map((variable, index) => (
                <Tag key={index}>{variable}</Tag>
              ))}
              {record.variables.length > 3 && (
                <Tag>+{record.variables.length - 3} more</Tag>
              )}
            </div>
          ) : (
            <Text type="secondary">No variables</Text>
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
      render: (record: Template) => (
        <Space>


          <Tooltip title="Duplicate Template">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleDuplicateTemplate(record)}
            />
          </Tooltip>

          <Tooltip title="Edit Template">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditTemplate(record)}
            />
          </Tooltip>

          {!record.isActive && (
            <Tooltip title="Approve Template">
              <Button
                type="text"
                size="small"
                icon={<CheckCircleOutlined style={{ color: '#16a34a' }} />}
                onClick={async () => {
                  try {
                    await approveTemplate(record._id)
                  } catch (e) {
                    console.error('Approve failed', e)
                  }
                }}
              />
            </Tooltip>
          )}

          <Popconfirm
            title="Delete Template"
            description="Are you sure you want to delete this template?"
            onConfirm={() => handleDeleteTemplate(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete Template">
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

  const handleCreateTemplate = () => {
    setIsCreateModalVisible(true)
    form.resetFields()
  }

  const handleEditTemplate = (template: Template) => {
    setSelectedTemplate(template)
    form.setFieldsValue({
      name: template.name,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      type: template.type,
      isActive: template.isActive,
      variables: template.variables,
      selectedCatalogItemIds: template.selectedCatalogItemIds || [],
      catalogLayout: template.catalogLayout || 'grid2',
      showPrices: !!template.showPrices,
    })
    setIsEditModalVisible(true)
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteTemplate(templateId)
      // Success message could be added here
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
  }

  const handlePreviewTemplate = (template: Template) => {
    // TODO: Implement template preview modal
    console.log('Preview template:', template)
  }

  const handleDuplicateTemplate = (template: Template) => {
    // TODO: Implement template duplication
    console.log('Duplicate template:', template)
  }

  const handleCreateSubmit = async (values: any) => {
    try {
      await createTemplate({
        name: values.name,
        subject: values.subject,
        htmlContent: values.htmlContent,
        textContent: values.textContent,
        type: values.type,
        variables: values.variables || [],
        selectedCatalogItemIds: values.selectedCatalogItemIds || [],
        catalogLayout: values.catalogLayout || 'grid2',
        showPrices: !!values.showPrices,
      })
      setIsCreateModalVisible(false)
      form.resetFields()
    } catch (error) {
      console.error('Failed to create template:', error)
    }
  }

  const handleEditSubmit = async (values: any) => {
    if (!selectedTemplate) return

    try {
      await updateTemplate(selectedTemplate._id, {
        name: values.name,
        subject: values.subject,
        htmlContent: values.htmlContent,
        textContent: values.textContent,
        type: values.type,
        isActive: values.isActive,
        variables: values.variables || [],
        selectedCatalogItemIds: values.selectedCatalogItemIds || [],
        catalogLayout: values.catalogLayout || 'grid2',
        showPrices: !!values.showPrices,
      })
      setIsEditModalVisible(false)
      setSelectedTemplate(null)
      form.resetFields()
    } catch (error) {
      console.error('Failed to update template:', error)
    }
  }

  // Load catalog items when modals open or search changes
  useEffect(() => {
    const loadCatalogItems = async () => {
      try {
        setCatalogLoading(true)
        const res = await catalogApi.getItems({
          page: 1,
          limit: 50, // Limit results for performance
          status: 'active',
          search: catalogSearch
        })

        setCatalogItems(prev => {
          // If searching, replace list but keep selected items if they are not in the new results
          // This is tricky so for now we just show results. 
          // Ideally: Merge search results with already selected items so they don't disappear from UI
          if (!selectedTemplate?.selectedCatalogItemIds) return res.items

          // Simplified: Just use search results. 
          // Note: If a selected item is not in search results, AntD Select might show ID.
          // To fix this proper, we'd need to load selected items separately on mount.
          return res.items
        })
      } catch (e) {
        console.error('Failed to load catalog items', e)
      } finally {
        setCatalogLoading(false)
      }
    }
    if (isCreateModalVisible || isEditModalVisible) {
      // Debounce could be added here
      const timeoutId = setTimeout(() => {
        loadCatalogItems()
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [isCreateModalVisible, isEditModalVisible, catalogSearch, selectedTemplate])

  const renderTemplateForm = () => (
    <Form
      form={form}
      layout="vertical"
      onFinish={isCreateModalVisible ? handleCreateSubmit : handleEditSubmit}
    >
      <Form.Item
        name="name"
        label="Template Name"
        rules={[{ required: true, message: 'Please enter template name' }]}
      >
        <Input placeholder="Enter template name" />
      </Form.Item>

      <Form.Item
        name="subject"
        label="Email Subject"
        rules={[{ required: true, message: 'Please enter email subject' }]}
      >
        <Input placeholder="Enter email subject" />
      </Form.Item>

      <Form.Item
        name="type"
        label="Template Type"
        rules={[{ required: true, message: 'Please select template type' }]}
      >
        <Select placeholder="Select template type">
          <Option value="initial">Initial Email</Option>
          <Option value="followup1">Follow-up 1</Option>
          <Option value="followup2">Follow-up 2</Option>
          <Option value="followup3">Follow-up 3</Option>
        </Select>
      </Form.Item>

      {!isCreateModalVisible && (
        <Form.Item
          name="isActive"
          label="Active Status"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      )}

      <Form.Item
        name="variables"
        label="Template Variables"
      >
        <Select
          mode="tags"
          placeholder="Add variables (e.g., {{name}}, {{company}})"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Tabs
        defaultActiveKey="html"
        items={[
          {
            key: 'html',
            label: 'HTML Content',
            children: (
              <>
                <Form.Item
                  name="htmlContent"
                  label="HTML Content"
                  rules={[
                    {
                      validator: (_: any, value: string) => {
                        const text = form.getFieldValue('textContent') as string
                        if ((value && value.trim()) || (text && text.trim())) {
                          return Promise.resolve()
                        }
                        return Promise.reject(new Error('Provide HTML or Text content'))
                      },
                    },
                  ]}
                >
                  <TextArea
                    rows={10}
                    placeholder="Enter HTML content for the email template"
                  />
                </Form.Item>

                <Typography.Paragraph type="secondary">
                  You can insert the placeholder {'{{CATALOG_BLOCK}}'} in your HTML to place the catalog where you want. If omitted, the catalog will be appended below.
                </Typography.Paragraph>
              </>
            ),
          },
          {
            key: 'text',
            label: 'Text Content',
            children: (
              <Form.Item
                name="textContent"
                label="Text Content"
                rules={[
                  {
                    validator: (_: any, value: string) => {
                      const html = form.getFieldValue('htmlContent') as string
                      if ((value && value.trim()) || (html && html.trim())) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('Provide HTML or Text content'))
                    },
                  },
                ]}
              >
                <TextArea
                  rows={10}
                  placeholder="Enter plain text content for the email template"
                />
              </Form.Item>
            ),
          },
          {
            key: 'catalog',
            label: 'Catalog',
            children: (
              // ...
              <>
                <label className="ant-form-item-required mb-1 block">Catalog Items</label>
                <Form.Item name="selectedCatalogItemIds">
                  <Select
                    mode="multiple"
                    placeholder="Search and select catalog items..."
                    optionFilterProp="label"
                    maxTagCount={8}
                    showSearch
                    filterOption={false}
                    onSearch={(val) => setCatalogSearch(val)}
                    loading={catalogLoading}
                    notFoundContent={catalogLoading ? <span>Loading...</span> : null}
                  >
                    {catalogItems.map((item) => (
                      <Option key={item._id} value={item._id} label={item.title}>
                        <div className="flex items-center gap-2">
                          {item.images?.[0]?.url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.images[0].url} alt={item.title} style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} />
                          )}
                          <span>{item.title}</span>
                          {item.price && <span className="text-gray-400 text-xs ml-auto">₹{item.price}</span>}
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="catalogLayout" label="Layout" initialValue="grid2">
                  <Select>
                    <Option value="grid2">Grid - 2 columns</Option>
                    <Option value="grid3">Grid - 3 columns</Option>
                    <Option value="list">List</Option>
                  </Select>
                </Form.Item>
                <Form.Item name="showPrices" label="Show Prices" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </>
            ),
          },
        ]}
      />

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">
            {isCreateModalVisible ? 'Create Template' : 'Update Template'}
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
          <Title level={2} className="mb-2">Email Templates</Title>
          <Text type="secondary">Create and manage email templates for your campaigns</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreateTemplate}
          size="large"
        >
          Create Template
        </Button>
      </div>

      {/* Template Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Total Templates"
              value={templateStats.total}
              prefix={<FileTextOutlined className="text-blue-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Active Templates"
              value={templateStats.active}
              prefix={<CheckCircleOutlined className="text-green-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Initial Templates"
              value={templateStats.initial}
              prefix={<FileTextOutlined className="text-blue-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Follow-up 1"
              value={templateStats.followup1}
              prefix={<FileTextOutlined className="text-green-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Follow-up 2"
              value={templateStats.followup2}
              prefix={<FileTextOutlined className="text-orange-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Follow-up 3"
              value={templateStats.followup3}
              prefix={<FileTextOutlined className="text-red-500" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Templates Table */}
      <Card>
        {/* Search Bar */}
        <div className="mb-4">
          <Input
            placeholder="Search templates by name or subject..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            size="large"
            style={{ maxWidth: 400 }}
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredTemplates}
          loading={templatesLoading}
          rowKey="_id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} templates`,
          }}
        />
      </Card>

      {/* Create Template Modal */}
      <Modal
        title="Create New Template"
        open={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        footer={null}
        width={800}
      >
        {renderTemplateForm()}
      </Modal>

      {/* Edit Template Modal */}
      <Modal
        title="Edit Template"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
        width={800}
      >
        {renderTemplateForm()}
      </Modal>
    </div>
  )
} 