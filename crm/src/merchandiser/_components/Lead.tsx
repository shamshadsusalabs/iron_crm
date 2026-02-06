import { Table, Tag, Input, Button, Space, Badge, Dropdown, Modal, Form, Select, Popconfirm, message, Tooltip, DatePicker } from 'antd';
import { SearchOutlined, FilterOutlined, DownOutlined, CalendarOutlined, MailOutlined, EditOutlined, DeleteOutlined, MoreOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import type { ColumnType } from 'antd/es/table';
import TextArea from 'antd/es/input/TextArea';
import { leadApi, type LeadDto, type LeadPayload } from '../_libs/lead-api';
import ComposeEmail from '../../admin/_components/email/compose-email';
import { EmailProvider } from '../../admin/_components/email/gmail-layout';

interface LeadData {
  key: string;
  customer: string;
  email?: string;
  status: 'Hot' | 'Cold' | 'Follow-up';
  priority: 'High' | 'Medium' | 'Low';
  lastContact: string | null;
  nextAction: string | null;
  notes?: string;
  interestedProducts?: string[];
}

const LeadTable = () => {
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [search, setSearch] = useState<string>('');

  // Data state
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number }>({ page: 1, limit: 200, total: 0 });

  // Modal/Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeadDto | null>(null);
  const [form] = Form.useForm<LeadPayload & { dates?: [moment.Moment, moment.Moment] }>();

  // Bulk upload state
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ total: number; success: number; failed: number; errors: { row: number; error: string }[] } | null>(null)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(0) // reset file input

  // Email compose state
  const [composeOpen, setComposeOpen] = useState(false)
  const [composePrefill, setComposePrefill] = useState<{ to?: string; subject?: string; text?: string }>({})
  // Default sort by customer name in ascending order
  const [tableSorter, setTableSorter] = useState<{ field: string; order: 'ascend' | 'descend' }>({
    field: 'customer',
    order: 'ascend'
  })

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  // ----------------------
  // CSV Bulk Upload Logic
  // ----------------------
  const normalizeStatus = (v: string): LeadPayload['status'] | null => {
    const s = (v || '').trim().toLowerCase()
    if (s === 'hot') return 'Hot'
    if (s === 'cold') return 'Cold'
    if (s === 'follow-up' || s === 'followup' || s === 'follow up') return 'Follow-up'
    return null
  }

  const normalizePriority = (v: string): LeadPayload['priority'] | null => {
    const p = (v || '').trim().toLowerCase()
    if (p === 'high') return 'High'
    if (p === 'medium' || p === 'med') return 'Medium'
    if (p === 'low') return 'Low'
    return null
  }

  const parseDate = (v: string | undefined) => {
    if (!v) return undefined
    const t = v.trim()
    if (!t) return undefined
    const m = moment(t)
    return m.isValid() ? m.toISOString() : undefined
  }

  const parseCsv = (text: string) => {
    // Enhanced CSV parser to handle quoted values with commas
    const lines = text.split(/\r?\n/).filter(l => l.trim().length)
    if (lines.length === 0) return { headers: [] as string[], rows: [] as string[][] }

    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]

        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }

      result.push(current.trim())
      return result
    }

    const headerLine = lines[0]
    const headers = parseCSVLine(headerLine).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase())
    const rows = lines.slice(1).map(line => parseCSVLine(line).map(c => c.replace(/^"|"$/g, '').trim()))
    return { headers, rows }
  }

  const handleBulkFile = async (file: File) => {
    setBulkUploading(true)
    setBulkResult(null)
    try {
      const text = await file.text()
      const { headers, rows } = parseCsv(text)
      const required = ['customer', 'email', 'status', 'priority', 'lastcontact', 'nextaction', 'notes']
      const hasAll = required.every(h => headers.includes(h))
      if (!hasAll) {
        message.error('CSV headers must include: customer,email,status,priority,lastContact,nextAction,notes,interestedProducts')
        setBulkUploading(false)
        return
      }

      const hIndex: Record<string, number> = {}
      headers.forEach((h, i) => { hIndex[h] = i })

      let success = 0
      const errors: { row: number; error: string }[] = []

      // Process sequentially to keep it simple and avoid rate limits
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const customer = r[hIndex['customer']] || ''
        const email = r[hIndex['email']] || ''
        const statusRaw = r[hIndex['status']] || ''
        const priorityRaw = r[hIndex['priority']] || ''
        const lastContactRaw = r[hIndex['lastcontact']] || ''
        const nextActionRaw = r[hIndex['nextaction']] || ''
        const notes = r[hIndex['notes']] || ''
        const interestedProductsRaw = r[hIndex['interestedproducts']] || ''

        if (!customer) {
          errors.push({ row: i + 2, error: 'Customer is required' })
          continue
        }
        const status = normalizeStatus(statusRaw)
        if (!status) { errors.push({ row: i + 2, error: `Invalid status: ${statusRaw}` }); continue }
        const priority = normalizePriority(priorityRaw)
        if (!priority) { errors.push({ row: i + 2, error: `Invalid priority: ${priorityRaw}` }); continue }

        // Parse interested products - split by comma and clean up
        const interestedProducts = interestedProductsRaw
          ? interestedProductsRaw.split(',').map(p => p.trim()).filter(p => p.length > 0)
          : []

        const payload: LeadPayload = {
          customer,
          email,
          status,
          priority,
          notes,
          lastContact: parseDate(lastContactRaw) ?? undefined,
          nextAction: parseDate(nextActionRaw) ?? undefined,
          interestedProducts,
        }
        try {
          await leadApi.create(payload)
          success += 1
        } catch (e: any) {
          const msg = e?.response?.data?.message || e?.message || 'Create failed'
          errors.push({ row: i + 2, error: msg })
        }
      }

      const result = { total: rows.length, success, failed: rows.length - success, errors }
      setBulkResult(result)
      setBulkModalOpen(true)
      message.success(`Bulk upload completed: ${success}/${rows.length} created`)
      // reload list
      loadLeads(pagination.page, pagination.limit)
    } catch (e: any) {
      message.error(e?.message || 'Failed to process CSV')
    } finally {
      setBulkUploading(false)
      // reset file input to allow re-uploading same file if needed
      setFileInputKey(k => k + 1)
    }
  }

  const openEdit = (tableRow: LeadData) => {
    // Find the original lead data using the key (which is the _id)
    const originalLead = leads.find(l => l._id === tableRow.key);
    if (!originalLead) {
      message.error('Lead not found');
      return;
    }

    setEditing(originalLead);
    form.setFieldsValue({
      customer: originalLead.customer,
      email: originalLead.email || '',
      status: originalLead.status,
      priority: originalLead.priority,
      notes: originalLead.notes || '',
      dates: [originalLead.lastContact ? moment(originalLead.lastContact) : null, originalLead.nextAction ? moment(originalLead.nextAction) : null].filter(Boolean) as any,
      interestedProducts: (originalLead as any).interestedProducts || [],
    } as any);
    setIsModalOpen(true);
  };


  const loadLeads = async (page = 1, limit = pagination.limit) => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
        // Send sort parameters to the server
        sortBy: tableSorter.field,
        sortOrder: tableSorter.order === 'ascend' ? 'asc' : 'desc'
      };

      if (search) params.search = search;
      // map status keys ['hot','cold','followup'] -> labels with proper casing
      if (selectedStatus.length > 0) {
        const mapped = selectedStatus.map((s) =>
          s === 'followup'
            ? 'Follow-up'
            : s.toString().replace(/^./, (c: string) => c.toUpperCase())
        );
        params.status = mapped.join(',');
      }
      const { leads: items, pagination: pg } = await leadApi.list(params);
      setLeads(items);
      setPagination({ page: pg.page, limit: pg.limit, total: pg.total });
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads(1, pagination.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch for status filter changes and reload leads
  useEffect(() => {
    // Only trigger if component has loaded (not on initial mount)
    if (leads.length > 0 || selectedStatus.length > 0) {
      loadLeads(1, pagination.limit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus]);

  const statusMenu = {
    items: [
      { key: 'all', label: 'All' },
      { key: 'hot', label: 'Hot' },
      { key: 'cold', label: 'Cold' },
      { key: 'followup', label: 'Follow-up' },
    ],
    selectable: true,
    selectedKeys: selectedStatus as any,
    onClick: ({ key }: any) => {
      if (key === 'all') {
        setSelectedStatus([])
      } else {
        setSelectedStatus([key])
      }
      setFilterVisible(false)
    },
  } as const

  const columns: ColumnType<LeadData>[] = [
    {
      title: 'Customer',
      dataIndex: 'customer',
      key: 'customer',
      render: (text: string) => <span className="font-medium">{text}</span>,
      sorter: (a: LeadData, b: LeadData) => a.customer.localeCompare(b.customer),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => email ? <span className="text-blue-600">{email}</span> : '-',
      sorter: (a: LeadData, b: LeadData) => (a.email || '').localeCompare(b.email || ''),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: 'Hot' | 'Cold' | 'Follow-up') => (
        <Tag
          color={status === 'Hot' ? 'red' : status === 'Cold' ? 'blue' : 'orange'}
          className="font-semibold"
        >
          {status}
        </Tag>
      ),
      filters: [
        { text: 'Hot', value: 'Hot' },
        { text: 'Cold', value: 'Cold' },
        { text: 'Follow-up', value: 'Follow-up' },
      ],
      onFilter: (value: React.Key | boolean, record: LeadData) =>
        typeof value === 'string' ? record.status === value : false,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: 'High' | 'Medium' | 'Low') => (
        <Badge
          status={priority === 'High' ? 'error' : priority === 'Medium' ? 'warning' : 'success'}
          text={priority}
          className="font-medium"
        />
      ),
      sorter: (a: LeadData, b: LeadData) => a.priority.localeCompare(b.priority),
    },
    {
      title: 'Last Contact',
      dataIndex: 'lastContact',
      key: 'lastContact',
      render: (v: string | null) => (v ? moment(v).format('YYYY-MM-DD') : '-'),
      sorter: (a: LeadData, b: LeadData) => new Date(a.lastContact || '').getTime() - new Date(b.lastContact || '').getTime(),
    },
    {
      title: 'Next Action',
      dataIndex: 'nextAction',
      key: 'nextAction',
      render: (text: string) => {
        if (!text) return '-';

        const nextActionDate = moment(text);
        const today = moment().startOf('day');
        const isOverdue = nextActionDate.isBefore(today);

        return (
          <div className="flex items-center">
            <CalendarOutlined className={`mr-2 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`} />
            <span style={{ color: isOverdue ? '#ff4d4f' : 'inherit', fontWeight: isOverdue ? 'bold' : 'normal' }}>
              {nextActionDate.format('YYYY-MM-DD')}
            </span>
          </div>
        );
      },
    },
    {
      title: 'Interested Products',
      dataIndex: 'interestedProducts',
      key: 'interestedProducts',
      width: 260,
      responsive: ['md', 'lg', 'xl'],
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
      title: 'Actions',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_: any, r) => {
        const items = [
          { key: 'email', icon: <MailOutlined />, label: 'Email' },
          { key: 'edit', icon: <EditOutlined />, label: 'Edit' },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            danger: true,
            label: (
              <Popconfirm
                title="Delete this lead?"
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={async () => {
                  if (!r?.key) { message.error('Invalid record (no id)'); return }
                  try {
                    await leadApi.remove(r.key)
                    message.success('Lead deleted')
                    // Remove the lead from local state instead of reloading entire table
                    setLeads(prevLeads => prevLeads.filter(lead => lead._id !== r.key))
                    // Update pagination total count
                    setPagination(prev => ({ ...prev, total: prev.total - 1 }))
                  } catch (e: any) {
                    message.error(e?.response?.data?.message || 'Delete failed')
                  }
                }}
              >
                <span style={{ color: '#ff4d4f' }}>Delete</span>
              </Popconfirm>
            ),
          },
        ] as any

        const handleMenuClick = async ({ key }: { key: string }) => {
          if (key === 'delete') {
            // Popconfirm inside label will handle the action
            return
          }
          if (key === 'email') {
            const to = r.email || ''
            const subject = `Follow-up: ${r.customer} - ${r.status} Priority Lead`
            const text = `Dear ${r.customer},\n\nI hope this email finds you well. I'm following up regarding your inquiry.\n\nLead Details:\n- Status: ${r.status}\n- Priority: ${r.priority}\n- Notes: ${r.notes || 'No additional notes'}\n\nPlease let me know if you have any questions or if there's anything I can assist you with.\n\nBest regards,`
            setComposePrefill({ to, subject, text })
            setComposeOpen(true)
            return
          }
          if (key === 'edit') {
            openEdit(r)
          }
        }

        return (
          <Dropdown menu={{ items, onClick: handleMenuClick }} trigger={['click']} placement="bottomRight">
            <Button icon={<MoreOutlined />} />
          </Dropdown>
        )
      },
    },
  ];

  const tableData: LeadData[] = useMemo(() => {
    // Create a copy of leads to avoid mutating the original array
    return leads.map((l) => ({
      key: l._id,
      customer: l.customer,
      email: l.email,
      status: l.status,
      priority: l.priority,
      lastContact: l.lastContact ? l.lastContact : null,
      nextAction: l.nextAction ? l.nextAction : null,
      notes: l.notes,
      interestedProducts: (l as any).interestedProducts || [],
    }));
  }, [leads]);

  return (
    <div className="p-6 bg-white rounded-xl shadow">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Lead Deposition</h2>
        <div className="flex space-x-2">
          <Input
            placeholder="Search leads..."
            prefix={<SearchOutlined />}
            className="w-64 rounded-lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Dropdown
            menu={statusMenu as any}
            open={filterVisible}
            onOpenChange={setFilterVisible}
            trigger={['click']}
          >
            <Button>
              <FilterOutlined />
              Status: {selectedStatus.length > 0 ? (selectedStatus[0] === 'followup' ? 'Follow-up' : selectedStatus[0].charAt(0).toUpperCase() + selectedStatus[0].slice(1)) : 'All'} <DownOutlined />
            </Button>
          </Dropdown>
          <Button onClick={openCreate}>New Lead</Button>
          <Button loading={bulkUploading} onClick={() => document.getElementById('lead-csv-input')?.click()}>Bulk Upload CSV</Button>
          <input id="lead-csv-input" key={fileInputKey} type="file" accept=".csv" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleBulkFile(f)
          }} />
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={tableData}
        bordered
        loading={loading}
        rowKey="key"
        pagination={{
          position: ['bottomRight'],
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          showSizeChanger: true,
          pageSizeOptions: ['50', '100', '200', '500'],
          onChange: (p, s) => loadLeads(p, s),
        }}
        onChange={(pagination, filters, sorter) => {
          let newSorter = tableSorter;

          if (Array.isArray(sorter)) {
            // Handle multiple sorters if needed
            const primarySorter = sorter[0];
            newSorter = {
              field: primarySorter.field as string || 'customer',
              order: (primarySorter.order as 'ascend' | 'descend') || 'ascend'
            };
          } else if (sorter && sorter.column) {
            newSorter = {
              field: sorter.field as string || 'customer',
              order: (sorter.order as 'ascend' | 'descend') || 'ascend'
            };
          }

          setTableSorter(newSorter);
          // Reload with new sort parameters
          loadLeads(pagination.current, pagination.pageSize);
        }}
        className="rounded-lg overflow-hidden"
        rowClassName="hover:bg-gray-50"
        sortDirections={['ascend', 'descend', 'ascend']}
        showSorterTooltip={false}
      />

      <Modal
        title={editing ? 'Edit Lead' : 'New Lead'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        destroyOnClose
        onOk={() => {
          form.submit()
        }}
        okText={editing ? 'Update' : 'Create'}
      >
        <Form form={form} layout="vertical" onFinish={async (values) => {
          const payload: LeadPayload = {
            customer: values.customer,
            email: values.email || '',
            status: values.status,
            priority: values.priority,
            notes: values.notes || '',
            lastContact: values.dates?.[0] ? values.dates[0].toISOString() : undefined,
            nextAction: values.dates?.[1] ? values.dates[1].toISOString() : undefined,
            interestedProducts: values.interestedProducts || [],
          }
          try {
            if (editing) {
              const updatedLead = await leadApi.update(editing._id, payload)
              message.success('Lead updated')
              // Update the lead in local state without reloading
              setLeads(prevLeads =>
                prevLeads.map(lead =>
                  lead._id === editing._id
                    ? { ...updatedLead, ...payload, _id: editing._id, createdAt: lead.createdAt, updatedAt: new Date().toISOString() }
                    : lead
                )
              )
              setIsModalOpen(false)
            } else {
              await leadApi.create(payload)
              message.success('Lead created')
              // For new leads, reload but maintain current page
              loadLeads(pagination.page, pagination.limit)
              setIsModalOpen(false)
            }
          } catch (e: any) {
            message.error(e?.response?.data?.message || 'Save failed')
          }
        }}>
          <Form.Item label="Customer" name="customer" rules={[{ required: true, message: 'Customer is required' }]}>
            <Input placeholder="Enter customer name" />
          </Form.Item>
          <Form.Item label="Email" name="email" rules={[
            { type: 'email', message: 'Please enter a valid email' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value) return Promise.resolve();
                // Check if email already exists in the current list
                const emailExists = leads.some(lead => {
                  // If editing, exclude the current lead from check
                  if (editing && lead._id === editing._id) return false;
                  // Case insensitive check
                  return (lead.email || '').toLowerCase() === value.toLowerCase();
                });

                if (emailExists) {
                  return Promise.reject(new Error('This email already exists in your leads'));
                }
                return Promise.resolve();
              },
            }),
          ]}>
            <Input placeholder="Enter email address" />
          </Form.Item>
          <Form.Item label="Status" name="status" initialValue={'Follow-up'} rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Hot', value: 'Hot' },
                { label: 'Cold', value: 'Cold' },
                { label: 'Follow-up', value: 'Follow-up' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Priority" name="priority" initialValue={'Medium'} rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'High', value: 'High' },
                { label: 'Medium', value: 'Medium' },
                { label: 'Low', value: 'Low' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Last Contact / Next Action" name="dates">
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item label="Interested Products" name="interestedProducts">
            <Select mode="tags" placeholder="Type product names and press enter" />
          </Form.Item>
          <Form.Item label="Notes" name="notes">
            <TextArea rows={3} placeholder="Additional notes..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk result modal */}
      <Modal
        title="Bulk Upload Result"
        open={bulkModalOpen}
        onCancel={() => setBulkModalOpen(false)}
        footer={<Button onClick={() => setBulkModalOpen(false)}>Close</Button>}
      >
        {bulkResult ? (
          <div>
            <p><strong>Total rows:</strong> {bulkResult.total}</p>
            <p><strong>Success:</strong> {bulkResult.success}</p>
            <p><strong>Failed:</strong> {bulkResult.failed}</p>
            {bulkResult.errors.length > 0 && (
              <div className="mt-2 max-h-56 overflow-auto border rounded p-2 bg-gray-50">
                {bulkResult.errors.map((e, idx) => (
                  <div key={idx} className="text-red-600 text-sm">Row {e.row}: {e.error}</div>
                ))}
              </div>
            )}
            <div className="mt-3 text-xs text-gray-500">
              Expected CSV headers: customer,email,status,priority,lastContact,nextAction,notes,interestedProducts
              <br />
              Dates can be in YYYY-MM-DD or any format parsable by the app; invalid dates will be ignored.
              <br />
              InterestedProducts should be comma-separated values within the cell (e.g., "Product A, Product B").
            </div>
          </div>
        ) : (
          <p>Processing...</p>
        )}
      </Modal>

      {/* Email Compose Modal */}
      <EmailProvider>
        <ComposeEmail
          isOpen={composeOpen}
          onClose={() => setComposeOpen(false)}
          prefill={composePrefill}
        />
      </EmailProvider>
    </div>
  );
};

export default LeadTable;