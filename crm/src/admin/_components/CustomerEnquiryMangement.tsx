import { useEffect, useState } from 'react';
import { Card, Table, Tag, Input, Button, Space, Badge, Drawer, Descriptions, message, Modal, Form, Select, Tooltip, Dropdown, Upload, Popconfirm } from 'antd';
import { SearchOutlined, MailOutlined, EyeOutlined, EditOutlined, DeleteOutlined, MoreOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table'
import { useEnquiries } from '@/admin/_components/hooks/useEnquiries'
import type { CustomerEnquiry } from '@/admin/_components/types/enquiry'
// Removed email compose feature
import ComposeEmail from '@/admin/_components/email/compose-email'
import { EmailProvider } from '@/admin/_components/email/gmail-layout'

const CustomerEnquiryManagement = () => {
  const {
    items, total, page, limit, loading,
    search, status, priority,
    setSearch, setPage, setLimit, setStatus, setPriority,
    fetch, update, remove,
  } = useEnquiries()

  const [viewOpen, setViewOpen] = useState(false)
  const [viewed, setViewed] = useState<CustomerEnquiry | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()
  
  const [editing, setEditing] = useState<CustomerEnquiry | null>(null)
  // Removed email compose state
  const [bulkUploading, setBulkUploading] = useState(false)
  // Local loading message key for AntD message API
  const [msgKey] = useState<string>('enquiry-bulk-upload')

  // Email compose state
  const [composeOpen, setComposeOpen] = useState(false)
  const [composePrefill, setComposePrefill] = useState<{ to?: string; subject?: string; text?: string }>({})

  useEffect(() => {
    fetch().catch(() => message.error('Failed to load enquiries'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search, status, priority])

  const columns: ColumnsType<CustomerEnquiry> = [
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 110,
      responsive: ['xs','sm','md','lg','xl'],
      render: (priority: string) => (
        <Tag 
          color={priority === 'High' ? 'red' : priority === 'Medium' ? 'orange' : 'blue'}
          style={{ fontWeight: 600 }}
        >
          {priority}
        </Tag>
      ),
    },
    {
      title: 'Customer Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 220,
      responsive: ['sm','md','lg','xl'],
      ellipsis: true,
      render: (text: string | undefined) => (
        <Tooltip title={text || '—'}>
          <span style={{ whiteSpace: 'nowrap' }}>{text || '—'}</span>
        </Tooltip>
      )
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
      responsive: ['xs','sm','md','lg','xl'],
      ellipsis: true,
      render: (text: string | undefined) => (
        <Tooltip title={text || '—'}>
          <span style={{ whiteSpace: 'nowrap' }}>{text || '—'}</span>
        </Tooltip>
      )
    },
    {
      title: 'Interested Products',
      dataIndex: 'products',
      key: 'products',
      width: 260,
      responsive: ['md','lg','xl'],
      render: (products: string[] = []) => {
        const toShow = products.slice(0, 2)
        const extra = products.length - toShow.length
        return (
          <div style={{ maxWidth: 240 }}>
            {toShow.map((product, index) => (
              <Tag key={index} style={{ marginBottom: 4 }}>{product}</Tag>
            ))}
            {extra > 0 && (
              <Tooltip title={products.join(', ')}>
                <Tag style={{ marginBottom: 4 }}>+{extra} more</Tag>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      responsive: ['xs','sm','md','lg','xl'],
      render: (status: string) => (
        <Badge 
          status={status === 'New' ? 'processing' : status === 'Responded' ? 'success' : 'default'} 
          text={status}
          style={{ fontWeight: 500 }}
        />
      ),
    },
    {
      title: 'Created By',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 180,
      responsive: ['md','lg','xl'],
      ellipsis: true,
      render: (c: any) => (
        <Tooltip title={c ? (c.name || c.email || c._id || String(c)) : '—'}>
          <span style={{ whiteSpace: 'nowrap' }}>{c ? (c.name || c.email || c._id || String(c)) : '—'}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, r) => {
        const items = [
          // Respond action removed per requirement
          { key: 'email', icon: <MailOutlined />, label: 'Email' },
          { key: 'view', icon: <EyeOutlined />, label: 'View' },
          { key: 'edit', icon: <EditOutlined />, label: 'Edit' },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            danger: true,
            label: (
              <Popconfirm
                title="Delete this enquiry?"
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={async ()=>{
                  console.log('[Enquiry] popconfirm onConfirm fired (menu)', { id: r?._id })
                  if (!r?._id) { message.error('Invalid record (no id)'); return }
                  try {
                    console.log('[Enquiry] calling remove() from Popconfirm (menu)', { id: r._id })
                    const ok = await remove(r._id)
                    console.log('[Enquiry] remove() returned', ok)
                    if (ok) message.success('Enquiry deleted')
                    else message.error('Delete failed')
                  } catch (e) {
                    console.error('[Enquiry] remove() error', e)
                    message.error('Delete failed')
                  }
                }}
              >
                <span style={{ color: '#ff4d4f' }}>Delete</span>
              </Popconfirm>
            ),
          },
        ] as any

        const handleMenuClick = async ({ key }: { key: string }) => {
          console.log('[Enquiry] action click', { key, id: r?._id, record: r })
          if (key === 'delete') {
            // Popconfirm inside label will handle the action
            return
          }
          if (key === 'email') {
            const to = r.email || ''
            const subject = r.name ? `Regarding your enquiry, ${r.name}` : 'Regarding your enquiry'
            const prods = Array.isArray(r.products) && r.products.length ? ` about ${r.products.join(', ')}` : ''
            const text = `Hi ${r.name || ''},\n\nThanks for your enquiry${prods}.\n\n— ${((r as any).createdBy && ((r as any).createdBy.name || (r as any).createdBy.email)) || 'Team'}`
            setComposePrefill({ to, subject, text })
            setComposeOpen(true)
            return
          }
          // Respond action removed
          if (key === 'view') {
            setViewed(r); setViewOpen(true)
          }
          if (key === 'edit') {
            setEditing(r)
            form.setFieldsValue({
              name: r.name,
              email: r.email,
              phone: r.phone,
              products: r.products,
              priority: r.priority,
              status: r.status,
              notes: r.notes,
              source: (r as any).source,
            })
            setCreateOpen(true)
          }
        }

        return (
          <Dropdown menu={{ items, onClick: handleMenuClick }} trigger={[ 'click' ]} placement="bottomRight">
            <Button icon={<MoreOutlined />} />
          </Dropdown>
        )
      },
    },
  ];

  return (
    <Card 
      title="Customer Enquiry Management" 
      headStyle={{ fontSize: '18px', fontWeight: 'bold' }}
      extra={
        <Space>
          <Input 
            placeholder="Search enquiries..." 
            prefix={<SearchOutlined />} 
            style={{ width: 300, borderRadius: '6px' }} 
            value={search}
            onChange={(e)=> setSearch(e.target.value)}
          />
          <Upload
            accept=".xlsx,.xls,.csv"
            showUploadList={false}
            beforeUpload={async (file) => {
              try {
                setBulkUploading(true)
                message.loading({ content: 'Uploading file...', key: msgKey, duration: 0 })
                const svc = (await import('@/admin/_components/services/enquiryService')).enquiryService
                const res = await svc.uploadExcel(file as File)
                await fetch()
                const inserted = (res as any)?.inserted ?? (res as any)?.result?.nUpserted ?? 0
                Modal.info({ title: 'Bulk upload summary', content: `Inserted: ${inserted}` })
                message.success({ content: 'Upload finished', key: msgKey })
              } catch (e) {
                console.error('[Enquiry Bulk Upload] upload failed', e)
                const status = (e as any)?.response?.status
                const data = (e as any)?.response?.data
                const msg = data?.message || `Failed to upload${status ? ` (HTTP ${status})` : ''}`
                message.error({ content: msg, key: msgKey })
              } finally {
                setBulkUploading(false)
              }
              return false // prevent auto upload
            }}
          >
            <Button loading={bulkUploading} icon={<UploadOutlined />}>Bulk Upload (Excel)</Button>
          </Upload>
          <Button type="primary" onClick={()=>{ setEditing(null); form.resetFields(); setCreateOpen(true) }} style={{ background:'black', borderColor:'black' }}>New Enquiry</Button>
        </Space>
      }
      style={{ borderRadius: '10px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
    >
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button 
            type="primary" 
            style={{ background: 'black', borderColor: 'black', borderRadius: '6px' }}
            onClick={()=>{ setPriority(undefined); setStatus(undefined); }}
          >
            All
          </Button>
          <Button style={{ borderRadius: '6px', borderColor: '#d9d9d9' }} onClick={()=> setPriority('High')}>High Priority</Button>
          <Button style={{ borderRadius: '6px', borderColor: '#d9d9d9' }} onClick={()=> setPriority('Medium')}>Medium Priority</Button>
          <Button style={{ borderRadius: '6px', borderColor: '#d9d9d9' }} onClick={()=> setPriority('Low')}>Low Priority</Button>
          <Button style={{ borderRadius: '6px', borderColor: '#d9d9d9' }} onClick={()=> setStatus('New')}>New</Button>
          <Button style={{ borderRadius: '6px', borderColor: '#d9d9d9' }} onClick={()=> setStatus('Responded')}>Responded</Button>
        </Space>
      </div>
      <Table 
        columns={columns as ColumnsType<any>} 
        dataSource={items} 
        bordered
        loading={loading}
        rowKey={(r)=> r._id}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          onChange: (p, l) => {
            if (l !== limit) {
              setLimit(l) // page size change resets to 1 in store
            } else {
              setPage(p) // only page number changed
            }
          },
        }}
        style={{ borderRadius: '8px' }}
        size="middle"
        scroll={{ x: 960 }}
      />

      <Modal
        title={editing ? 'Edit Enquiry' : 'New Enquiry'}
        open={createOpen}
        onCancel={()=> setCreateOpen(false)}
        onOk={async ()=>{
          try {
            const values = await form.validateFields()
            const payload = { 
              name: values.name,
              email: values.email,
              phone: values.phone,
              products: values.products || [],
              priority: values.priority,
              status: values.status || 'New',
              notes: values.notes,
              source: values.source,
            }
            if (editing) {
              const updated = await update(editing._id, payload)
              if (updated?._id) {
                message.success('Enquiry updated')
                setCreateOpen(false)
                form.resetFields()
                setEditing(null)
              } else {
                message.error('Update failed')
              }
            } else {
              const created = await (await import('@/admin/_components/services/enquiryService')).enquiryService.create(payload)
              if (created?._id) {
                message.success('Enquiry created')
                setCreateOpen(false)
                form.resetFields()
                await fetch()
              } else {
                message.error('Failed to create')
              }
            }
          } catch {}
        }}
        okButtonProps={{ style: { background: 'black', borderColor: 'black' } }}
      >
        <Form layout="vertical" form={form} initialValues={{ priority: 'Medium', status: 'New' }}>
          <Form.Item name="name" label="Customer Name" rules={[{ required: true }]}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="+1 234 ..." />
          </Form.Item>
          <Form.Item name="products" label="Interested Products">
            <Select mode="tags" placeholder="Type and press enter" />
          </Form.Item>
          <Form.Item name="priority" label="Priority" rules={[{ required: true }]}>
            <Select options={[{value:'High',label:'High'},{value:'Medium',label:'Medium'},{value:'Low',label:'Low'}]} />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select options={[{value:'New',label:'New'},{value:'In Progress',label:'In Progress'},{value:'Responded',label:'Responded'},{value:'Closed',label:'Closed'}]} />
          </Form.Item>
          <Form.Item name="source" label="Source">
            <Input placeholder="e.g., Website, WhatsApp, Referral" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="Enquiry Details" open={viewOpen} width={520} onClose={()=> setViewOpen(false)}>
        {viewed && (
          <Descriptions bordered column={1} size="middle" items={[
            { key: 'name', label: 'Name', children: viewed.name },
            { key: 'email', label: 'Email', children: viewed.email || '—' },
            { key: 'phone', label: 'Phone', children: viewed.phone || '—' },
            { key: 'products', label: 'Products', children: (viewed.products||[]).map(p=> <Tag key={p}>{p}</Tag>) },
            { key: 'priority', label: 'Priority', children: <Tag color={viewed.priority==='High'?'red':viewed.priority==='Medium'?'orange':'blue'}>{viewed.priority}</Tag> },
            { key: 'status', label: 'Status', children: viewed.status },
            { key: 'createdBy', label: 'Created By', children: (viewed as any).createdBy ? ((viewed as any).createdBy.name || (viewed as any).createdBy.email || (viewed as any).createdBy._id || String((viewed as any).createdBy)) : '—' },
            { key: 'notes', label: 'Notes', children: viewed.notes || '—' },
            { key: 'source', label: 'Source', children: viewed.source || '—' },
          ]} />
        )}
      </Drawer>

      {/* Email composer */}
      <EmailProvider>
        <ComposeEmail isOpen={composeOpen} onClose={() => setComposeOpen(false)} prefill={composePrefill} />
      </EmailProvider>
    </Card>
  );
};

export default CustomerEnquiryManagement;