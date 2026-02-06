import { Card, Upload, Button, Table, Tag, Input, Space, message, Form, Select, Row, Col } from 'antd';
import { UploadOutlined, SearchOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';

const { Option } = Select;

const TemplateUpload = () => {
  const [form] = Form.useForm();

  // File upload props
  const uploadProps = {
    beforeUpload: (file: File) => {
      const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const isDoc = file.type === 'application/msword';
      const isPdf = file.type === 'application/pdf';
      
      if (!isDocx && !isDoc && !isPdf) {
        message.error('You can only upload Word or PDF files!');
        return Upload.LIST_IGNORE;
      }
      return false; // Prevent automatic upload
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChange: (info: any) => {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} file uploaded successfully`);
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} file upload failed.`);
      }
    },
    maxCount: 1,
    accept: '.doc,.docx,.pdf',
  };

  // Sample template data
  const templateData = [
    {
      key: '1',
      name: 'Product Inquiry Response',
      type: 'Email',
      category: 'Product Info',
      uploadedBy: 'Admin User',
      date: '2023-06-10',
      status: 'Active',
    },
    {
      key: '2',
      name: 'Order Confirmation',
      type: 'Email',
      category: 'Order',
      uploadedBy: 'Admin User',
      date: '2023-06-05',
      status: 'Active',
    },
    {
      key: '3',
      name: 'Payment Reminder',
      type: 'SMS',
      category: 'Payment',
      uploadedBy: 'Admin User',
      date: '2023-05-28',
      status: 'Inactive',
    },
  ];

  const columns = [
    {
      title: 'Template Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => <Tag color={text === 'Email' ? 'blue' : 'green'}>{text}</Tag>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: 'Uploaded By',
      dataIndex: 'uploadedBy',
      key: 'uploadedBy',
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => (
        <Tag color={text === 'Active' ? 'green' : 'red'}>{text}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space>
          <Button icon={<EditOutlined />} style={{ color: 'black' }}>Edit</Button>
          <Button danger icon={<DeleteOutlined />}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <Card 
      title="Template Management"
      headStyle={{ fontWeight: 'bold' }}
      extra={
        <Input 
          placeholder="Search templates..." 
          prefix={<SearchOutlined />} 
          style={{ width: 250 }} 
        />
      }
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginBottom: 24 }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="templateName"
              label="Template Name"
              rules={[{ required: true, message: 'Please input template name!' }]}
            >
              <Input placeholder="Enter template name" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="templateType"
              label="Template Type"
              rules={[{ required: true, message: 'Please select template type!' }]}
            >
              <Select placeholder="Select type">
                <Option value="Email">Email</Option>
                <Option value="SMS">SMS</Option>
                <Option value="Letter">Letter</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="category"
              label="Category"
              rules={[{ required: true, message: 'Please select category!' }]}
            >
              <Select placeholder="Select category">
                <Option value="Product Info">Product Info</Option>
                <Option value="Order">Order</Option>
                <Option value="Payment">Payment</Option>
                <Option value="Follow-up">Follow-up</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        
        <Form.Item
          name="templateFile"
          label="Template File"
          rules={[{ required: true, message: 'Please upload template file!' }]}
        >
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />} style={{ background: 'black', color: 'white' }}>
              Select Template File
            </Button>
          </Upload>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" style={{ background: 'black' }}>
            Upload Template
          </Button>
        </Form.Item>
      </Form>

      <Table 
        columns={columns} 
        dataSource={templateData} 
        bordered
        pagination={{ pageSize: 5 }}
      />
    </Card>
  );
};

export default TemplateUpload;