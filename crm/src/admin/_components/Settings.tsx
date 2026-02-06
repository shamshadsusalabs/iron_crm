import { useEffect, useState } from 'react'
import { Card, Form, Input, Button, message } from 'antd'
import { adminService } from './services/adminService'
import type { AdminProfile } from './services/adminService'

const Settings = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<AdminProfile | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const p = await adminService.getProfile()
        setProfile(p)
        form.setFieldsValue({ name: p.name, email: p.email })
      } catch (e: any) {
        message.error(e?.response?.data?.message || 'Failed to load profile')
      }
    }
    load()
  }, [form])

  const onSubmit = async (values: { name: string; email: string; currentPassword?: string; newPassword?: string; confirm?: string }) => {
    setLoading(true)
    try {
      // 1) Update name/email
      const { name, email, currentPassword, newPassword, confirm } = values
      const res = await adminService.updateProfile({ name, email })
      setProfile(res.admin)

      // 2) Change password if provided
      if (newPassword) {
        if (newPassword !== confirm) {
          message.warning('New password and confirm do not match')
        } else if (!currentPassword) {
          message.warning('Please enter current password')
        } else {
          await adminService.changePassword({ currentPassword, newPassword })
          message.success('Password changed')
          form.setFieldsValue({ currentPassword: undefined, newPassword: undefined, confirm: undefined })
        }
      }

      message.success('Profile updated')
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Admin Settings">
        <Form form={form} layout="vertical" onFinish={onSubmit} initialValues={{ name: profile?.name, email: profile?.email }}>
          <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Name is required' }]}> 
            <Input placeholder="Enter name" />
          </Form.Item>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}> 
            <Input placeholder="Enter email" />
          </Form.Item>
          <Form.Item label="Current Password (if changing password)" name="currentPassword"> 
            <Input.Password placeholder="Current password" />
          </Form.Item>
          <Form.Item label="New Password" name="newPassword" rules={[{ min: 6, message: 'At least 6 characters' }]}> 
            <Input.Password placeholder="New password" />
          </Form.Item>
          <Form.Item label="Confirm New Password" name="confirm"> 
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} style={{ background: 'black', borderColor: 'black' }}>
            Save Changes
          </Button>
        </Form>
      </Card>
    </div>
  )
}

export default Settings
