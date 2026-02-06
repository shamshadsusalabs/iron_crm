import { Card, Table, Tag, Button, Space, Modal, Form, Input, Select, Switch, Avatar, message } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, MailOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useUsers } from '@/admin/_components/hooks/useUsers';

const { Option } = Select;

const AccessControl = () => {
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Users state from store
  const {
    rows,
    loading,
    fetchUsers,
    grantLeadAccess,
    revokeLeadAccess,
    grantCustomerProfiling,
    revokeCustomerProfiling,
    grantCustomerEnquiry,
    revokeCustomerEnquiry,
    grantEmailAccess,
    revokeEmailAccess,
    grantFollowUpAccess,
    revokeFollowUpAccess,
  } = useUsers();
  // Local search state (decoupled from global store)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchUsers().catch(() => message.error('Users fetch failed'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns = [
    {
      title: 'Name',
      dataIndex: 'user',
      key: 'name',
      render: (_: any, record: any) => (
        <Space>
          <Avatar src={record.user?.avatar} icon={!record.user?.avatar ? <UserOutlined /> : undefined} />
          <div style={{ fontWeight: 600 }}>{record.user?.name}</div>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (_: any, record: any) => (
        <span style={{ color: '#555' }}>{record.user?.email}</span>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (text: string) => <strong>{text}</strong>,
    },
    
    {
      title: 'Lead Access',
      dataIndex: 'isLeadAccess',
      key: 'isLeadAccess',
      render: (_: any, record: any) => (
        <Switch
          checked={!!record.isLeadAccess}
          checkedChildren="Enabled"
          unCheckedChildren="Disabled"
          onChange={async (checked) => {
            if (checked) {
              const res = await grantLeadAccess(record.key)
              if (res) message.success('Lead access enabled')
              else message.error('Failed to enable lead access')
            } else {
              const res = await revokeLeadAccess(record.key)
              if (res) message.success('Lead access disabled')
              else message.error('Failed to disable lead access')
            }
          }}
          style={{ backgroundColor: record.isLeadAccess ? 'black' : undefined }}
        />
      ),
    },
    {
      title: 'Customer Profiling',
      dataIndex: 'isCustomerProfiling',
      key: 'isCustomerProfiling',
      render: (_: any, record: any) => (
        <Switch
          checked={!!record.isCustomerProfiling}
          checkedChildren="Enabled"
          unCheckedChildren="Disabled"
          onChange={async (checked) => {
            if (checked) {
              const res = await grantCustomerProfiling(record.key)
              if (res) message.success('Customer profiling enabled')
              else message.error('Failed to enable customer profiling')
            } else {
              const res = await revokeCustomerProfiling(record.key)
              if (res) message.success('Customer profiling disabled')
              else message.error('Failed to disable customer profiling')
            }
          }}
          style={{ backgroundColor: record.isCustomerProfiling ? 'black' : undefined }}
        />
      ),
    },
    {
      title: 'Customer Enquiry',
      dataIndex: 'isCustomerEnquiry',
      key: 'isCustomerEnquiry',
      render: (_: any, record: any) => (
        <Switch
          checked={!!record.isCustomerEnquiry}
          checkedChildren="Enabled"
          unCheckedChildren="Disabled"
          onChange={async (checked) => {
            if (checked) {
              const res = await grantCustomerEnquiry(record.key)
              if (res) message.success('Customer enquiry enabled')
              else message.error('Failed to enable customer enquiry')
            } else {
              const res = await revokeCustomerEnquiry(record.key)
              if (res) message.success('Customer enquiry disabled')
              else message.error('Failed to disable customer enquiry')
            }
          }}
          style={{ backgroundColor: record.isCustomerEnquiry ? 'black' : undefined }}
        />
      ),
    },
    {
      title: 'Email Access',
      dataIndex: 'isEmailAccess',
      key: 'isEmailAccess',
      render: (_: any, record: any) => (
        <Switch
          checked={!!record.isEmailAccess}
          checkedChildren="Enabled"
          unCheckedChildren="Disabled"
          onChange={async (checked) => {
            if (checked) {
              const res = await grantEmailAccess(record.key)
              if (res) message.success('Email access enabled')
              else message.error('Failed to enable email access')
            } else {
              const res = await revokeEmailAccess(record.key)
              if (res) message.success('Email access disabled')
              else message.error('Failed to disable email access')
            }
          }}
          style={{ backgroundColor: record.isEmailAccess ? 'black' : undefined }}
        />
      ),
    },
    {
      title: 'Follow-Up Access',
      dataIndex: 'isFollowUpAccess',
      key: 'isFollowUpAccess',
      render: (_: any, record: any) => (
        <Switch
          checked={!!record.isFollowUpAccess}
          checkedChildren="Enabled"
          unCheckedChildren="Disabled"
          onChange={async (checked) => {
            if (checked) {
              const res = await grantFollowUpAccess(record.key)
              if (res) message.success('Follow-up access enabled')
              else message.error('Failed to enable follow-up access')
            } else {
              const res = await revokeFollowUpAccess(record.key)
              if (res) message.success('Follow-up access disabled')
              else message.error('Failed to disable follow-up access')
            }
          }}
          style={{ backgroundColor: record.isFollowUpAccess ? 'black' : undefined }}
        />
      ),
    },
  ] as any

  // Client-side filtered rows (name/email/role)
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r: any) => {
      return (
        r.user?.name?.toLowerCase().includes(q) ||
        r.user?.email?.toLowerCase().includes(q) ||
        String(r.role || '').toLowerCase().includes(q)
      )
    })
  }, [rows, search])

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    form.validateFields().then(values => {
      console.log('Received values:', values);
      setIsModalVisible(false);
      form.resetFields();
    });
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  return (
    <Card
      title="Access Control Management"
      extra={
        <Space>
          <Input 
            placeholder="Search users..." 
            prefix={<SearchOutlined />} 
            style={{ width: 200 }} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {/* Optional future: Add Role Modal retained */}
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={filteredRows}
        loading={loading}
        rowKey={(r) => r.key}
        bordered
        pagination={{ pageSize: 10 }}
      />

      {/* Modal kept for future role creation if needed */}
    </Card>
  );
};

export default AccessControl;