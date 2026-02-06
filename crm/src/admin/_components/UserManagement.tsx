import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Input, Button, Space, Popconfirm, Switch, Avatar, Modal, Form, message } from 'antd';
import { SearchOutlined, EditOutlined, DeleteOutlined, UserOutlined, PlusOutlined } from '@ant-design/icons';
// role is fixed to 'Merchandiser'; no type import needed
import { useUsers, type UserRow } from '@/admin/_components/hooks/useUsers';

type UserFormValues = {
  name: string;
  email: string;
  active: boolean;
  password?: string;
};

const UserManagement = () => {
  const { rows, loading, query, setQuery, fetchUsers, deleteUser, toggleActive, createUser, updateUser } = useUsers();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form] = Form.useForm<UserFormValues>();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // role selection removed; default is Merchandiser on backend

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = () => fetchUsers();

  const handleToggle = async (userId: string) => {
    const res = await toggleActive(userId);
    if (!res) message.error('Failed to update status');
  };

  // Permissions are managed in Access Control. Only active/inactive here.

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setAvatarFile(null);
    setAvatarError(null);
    setOpen(true);
  };

  const openEdit = (userId: string) => {
    const user = rows.find((u) => u.key === userId);
    if (!user) return;
    setEditing(user);
    form.setFieldsValue({
      name: user.user.name,
      email: user.user.email,
      active: user.active,
    } as any);
    setAvatarFile(null);
    setOpen(true);
  };

  const handleDelete = async (userId: string) => {
    const ok = await deleteUser(userId);
    if (ok) message.success('User deleted');
    else message.error('Failed to delete user');
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editing) {
        const res = await updateUser({ id: editing.key, name: values.name, active: values.active, avatarFile, password: values.password });
        if (res) message.success('User updated');
        else throw new Error('Update failed');
      } else {
        const res = await createUser({ name: values.name, email: values.email, active: values.active ?? true, avatarFile, password: values.password as string });
        if (res) message.success('User created');
        else throw new Error('Create failed');
      }
      setOpen(false);
      setEditing(null);
      form.resetFields();
      setAvatarFile(null);
      setAvatarError(null);
    } catch (err: any) {
      if (err?.errorFields) return; // form validation errors
      const apiMsg = err?.response?.data?.message;
      if (err?.response?.status === 409) {
        // Show the error on the email field instead of a toast
        form.setFields([
          { name: 'email', errors: [apiMsg || 'Email already exists. Please choose a different one.'] },
        ]);
        // Optionally scroll to the field for visibility
        try { form.scrollToField?.('email'); } catch {}
      } else {
        message.error(apiMsg || 'Operation failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const columns: any[] = [
    {
      title: 'Name',
      dataIndex: 'user',
      key: 'name',
      render: (_: any, record: any) => (
        <Space>
          <Avatar
            src={record.user.avatar}
            icon={<UserOutlined />}
            style={{ backgroundColor: '#f0f0f0', color: 'black' }}
          />
          <div style={{ fontWeight: 500 }}>{record.user.name}</div>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (_: any, record: any) => (
        <span style={{ fontSize: 12, color: '#555' }}>{record.user.email}</span>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={'blue'} style={{ fontWeight: 600 }}>{role || 'Merchandiser'}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      render: (_active: boolean, record: any) => (
        <Switch
          checked={record.active}
          checkedChildren="Active"
          unCheckedChildren="Inactive"
          onChange={() => handleToggle(record.key)}
          style={{ backgroundColor: record.active ? 'black' : undefined }}
        />
      ),
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (text: string) => <span style={{ color: '#555' }}>{text}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            style={{ color: 'black', borderColor: '#d9d9d9', borderRadius: '6px' }}
            onClick={() => openEdit(record.key)}
          >
            Edit
          </Button>
          <Popconfirm 
            title="Are you sure to delete this user?" 
            okText="Yes" 
            cancelText="No"
            okButtonProps={{ style: { background: 'black', borderColor: 'black' } }}
            onConfirm={() => handleDelete(record.key)}
          >
            <Button 
              danger 
              icon={<DeleteOutlined />} 
              style={{ borderRadius: '6px' }}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="User Management"
      styles={{ header: { fontSize: '18px', fontWeight: 'bold' } }}
      extra={
        <Space>
          <Input
            placeholder="Search users..."
            prefix={<SearchOutlined />}
            style={{ width: 250, borderRadius: '6px' }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onPressEnter={onSearch}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: 'black', borderColor: 'black', borderRadius: '6px' }}
            onClick={openAdd}
          >
            Add New User
          </Button>
          <Button onClick={onSearch}>Search</Button>
        </Space>
      }
      style={{ borderRadius: '10px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
    >
      <Table
        columns={columns}
        dataSource={rows}
        bordered
        loading={loading}
        pagination={{ pageSize: 10 }}
        style={{ borderRadius: '8px' }}
      />

      <Modal
        title={editing ? 'Edit User' : 'Add New User'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={onSubmit}
        confirmLoading={submitting}
        okButtonProps={{ style: { background: 'black' } }}
        cancelButtonProps={{ disabled: submitting }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter name' }]}> 
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: !editing, type: 'email', message: 'Valid email required' }]}> 
            <Input placeholder="user@example.com" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: !editing, min: 6, message: 'Min 6 characters' }]}> 
            <Input.Password placeholder={editing ? 'Leave blank to keep current password' : 'Enter password'} />
          </Form.Item>
          {/* Role field removed - backend defaults to Merchandiser */}
          <Form.Item
            label="Avatar"
            help={avatarError || 'Maximum file size: 5MB'}
            validateStatus={avatarError ? 'error' : undefined}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file && file.size > 5 * 1024 * 1024) {
                    const mb = (file.size / (1024 * 1024)).toFixed(2);
                    const msg = `File too large (${mb} MB). Maximum allowed size is 5MB.`;
                    message.error(msg);
                    setAvatarError('File too large. Maximum allowed size is 5MB.');
                    // Clear input and state
                    try { (e.target as HTMLInputElement).value = ''; } catch {}
                    setAvatarFile(null);
                    return;
                  }
                  setAvatarError(null);
                  setAvatarFile(file);
                }}
              />
              {avatarFile && !avatarError && (
                <span style={{ fontSize: 12, color: '#555' }}>
                  Selected: {avatarFile.name} ({(avatarFile.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              )}
            </div>
          </Form.Item>
          <Form.Item name="active" label="Active" initialValue={true} valuePropName="checked">
            <Switch />
          </Form.Item>
          {/* Permissions managed in Access Control screen */}
        </Form>
      </Modal>
    </Card>
  );
};

export default UserManagement;