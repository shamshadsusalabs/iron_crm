import { Form, Input, Button, Select, DatePicker, TimePicker,  Space, Card, Divider, message, Modal, Table, Popconfirm, Tag, Upload } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { eventApi, type EventPayload, type EventDto } from '../_libs/event-api';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;

interface EventRow {
  key: string;
  name: string;
  type: 'one-time' | 'recurring';
  startAt: string;
  recurrence?: string | null;
  interval?: number | null;
  endDate?: string | null;
  audience: string[];
}

const EventCreator = () => {
  const [form] = Form.useForm();
  const [recurring, setRecurring] = useState(false);
  const [customRecurrence, setCustomRecurrence] = useState(false);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number }>({ page: 1, limit: 10, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventDto | null>(null);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setRecurring(false);
    setCustomRecurrence(false);
    setUploadedUrls([]);
    setIsModalOpen(true);
  };

  const openEdit = (ev: EventDto) => {
    setEditing(ev);
    setRecurring(ev.type === 'recurring');
    setCustomRecurrence(ev.recurrence === 'custom');
    form.setFieldsValue({
      name: ev.name,
      type: ev.type,
      startDate: moment(ev.startAt),
      startTime: moment(ev.startAt),
      recurrence: ev.recurrence || undefined,
      interval: ev.interval || undefined,
      endDate: ev.endDate ? moment(ev.endDate) : undefined,
      audience: ev.audience || [],
      template: ev.template || '',
    });
    setUploadedUrls((ev.attachments || []).map((a: any) => a.file).filter(Boolean));
    setIsModalOpen(true);
  };

  const loadEvents = async (page = 1, limit = pagination.limit) => {
    setLoading(true);
    try {
      const { events: items, pagination: pg } = await eventApi.list({ page, limit });
      setEvents(items);
      setPagination({ page: pg.page, limit: pg.limit, total: pg.total });
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents(1, pagination.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFinish = async (values: any) => {
    try {
      const startDate = values.startDate;
      const startTime = values.startTime;
      if (!startDate || !startTime) {
        return message.error('Please select start date and time');
      }

      const startAtIso = (startDate.clone().hour(startTime.hour()).minute(startTime.minute()).second(0).millisecond(0)).toISOString();

      const payload: EventPayload = {
        name: values.name,
        type: values.type,
        startAt: startAtIso,
        audience: values.audience || [],
        template: values.template || '',
        attachments: uploadedUrls.map((url) => ({ file: url })),
      };

      if (values.type === 'recurring') {
        payload.recurrence = values.recurrence;
        payload.interval = values.recurrence === 'custom' ? Number(values.interval || 0) || undefined : undefined;
        payload.endDate = values.endDate ? values.endDate.toISOString() : undefined;
      }

      if (editing) {
        await eventApi.update(editing._id, payload);
        message.success('Event updated');
      } else {
        await eventApi.create(payload);
        message.success('Event created');
      }
      setIsModalOpen(false);
      form.resetFields();
      setRecurring(false);
      setCustomRecurrence(false);
      setUploadedUrls([]);
      loadEvents(pagination.page);
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Failed to create event');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => (
        <Tag color={t === 'recurring' ? 'blue' : 'green'}>{t}</Tag>
      )
    },
    {
      title: 'Start',
      dataIndex: 'startAt',
      key: 'startAt',
      render: (v: string) => moment(v).format('YYYY-MM-DD HH:mm')
    },
    {
      title: 'Recurrence',
      dataIndex: 'recurrence',
      key: 'recurrence',
      render: (_: any, row: EventRow) => row.type === 'recurring' ? (row.recurrence === 'custom' ? `custom/${row.interval}d` : row.recurrence || '-') : '-'
    },
    {
      title: 'End Date',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (v?: string | null) => v ? moment(v).format('YYYY-MM-DD') : '-'
    },
    {
      title: 'Audience',
      dataIndex: 'audience',
      key: 'audience',
      render: (arr: string[]) => (arr && arr.length) ? arr.join(', ') : '-'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, row: EventRow) => (
        <Space>
          <Button type="link" onClick={() => openEdit(events.find(e => e._id === row.key)!)}>Edit</Button>
          <Popconfirm title="Delete this event?" onConfirm={async () => {
            try {
              await eventApi.remove(row.key)
              message.success('Event deleted')
              loadEvents(pagination.page)
            } catch (e: any) {
              message.error(e?.response?.data?.message || 'Delete failed')
            }
          }}>
            <Button type="link" danger>Delete</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const data: EventRow[] = useMemo(() => events.map(ev => ({
    key: ev._id,
    name: ev.name,
    type: ev.type,
    startAt: ev.startAt,
    recurrence: ev.recurrence ?? null,
    interval: ev.interval ?? null,
    endDate: ev.endDate ?? null,
    audience: ev.audience || [],
  })), [events]);

  return (
    <div className="p-6 bg-white rounded-xl shadow">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Events</h2>
        <div className="flex space-x-2">
          <Button type="primary" onClick={openCreate}>New Event</Button>
        </div>
      </div>

      <Table
        columns={columns as any}
        dataSource={data}
        bordered
        loading={loading}
        pagination={{
          position: ['bottomRight'],
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          onChange: (p, s) => loadEvents(p, s),
        }}
        className="rounded-lg overflow-hidden"
        rowClassName="hover:bg-gray-50"
      />

      <Modal
        title={editing ? 'Edit Event' : 'New Event'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        okText={editing ? 'Update' : 'Create'}
        destroyOnClose
        width={720}
      >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ type: 'one-time' }}
      >
        <Form.Item
          label="Event Name"
          name="name"
          rules={[{ required: true, message: 'Please input event name' }]}
        >
          <Input placeholder="e.g. Monthly Newsletter" size="large" />
        </Form.Item>

        <Form.Item
          label="Event Type"
          name="type"
        >
          <Select 
            size="large"
            onChange={val => setRecurring(val === 'recurring')}
          >
            <Option value="one-time">One-time Event</Option>
            <Option value="recurring">Recurring Event</Option>
          </Select>
        </Form.Item>

        <Form.Item label="Start Date & Time" required>
          <Space>
            <Form.Item name="startDate" noStyle rules={[{ required: true, message: 'Select date' }]}>
              <DatePicker size="large" />
            </Form.Item>
            <Form.Item name="startTime" noStyle rules={[{ required: true, message: 'Select time' }]}>
              <TimePicker size="large" format="HH:mm" />
            </Form.Item>
          </Space>
        </Form.Item>

        {recurring && (
          <>
            <Form.Item
              label="Recurrence Pattern"
              name="recurrence"
            >
              <Select 
                size="large"
                onChange={val => setCustomRecurrence(val === 'custom')}
              >
                <Option value="daily">Daily</Option>
                <Option value="weekly">Weekly</Option>
                <Option value="monthly">Monthly</Option>
                <Option value="custom">Custom Interval</Option>
              </Select>
            </Form.Item>

            {customRecurrence && (
              <Form.Item
                label="Custom Interval (days)"
                name="interval"
                rules={[{ required: true, message: 'Please input interval' }]}
              >
                <Input 
                  type="number" 
                  min="1" 
                  size="large"
                  placeholder="e.g. 3 for every 3 days" 
                />
              </Form.Item>
            )}

            <Form.Item
              label="End Date"
              name="endDate"
            >
              <DatePicker size="large" />
            </Form.Item>
          </>
        )}

        <Form.Item
          label="Target Audience"
          name="audience"
        >
          <Select 
            mode="multiple"
            size="large"
            placeholder="Select customer segments"
          >
            <Option value="hot">Hot Leads</Option>
            <Option value="cold">Cold Leads</Option>
            <Option value="followup">Follow-up Required</Option>
          </Select>
        </Form.Item>

        <Divider />

        <Form.Item
          label="Message Template"
          name="template"
        >
          <TextArea rows={6} placeholder="Enter your message content here..." />
        </Form.Item>

        <Form.Item label="Attachments">
          <Upload
            multiple
            customRequest={async (options) => {
              const { file, onSuccess, onError } = options as any
              try {
                const url = await eventApi.upload(file as File)
                setUploadedUrls(prev => [...prev, url])
                message.success('Uploaded')
                onSuccess && onSuccess({ url })
              } catch (err) {
                message.error('Upload failed')
                onError && onError(err)
              }
            }}
            onRemove={(file) => {
              const url = (file as any).response?.url || (file.url as string) || file.name
              setUploadedUrls(prev => prev.filter(u => u !== url))
            }}
            fileList={uploadedUrls.map((u, idx) => ({ uid: String(idx), name: u.split('/').pop() || `file-${idx+1}`, status: 'done' as const, url: u, response: { url: u } }))}
          >
            <Button icon={<PlusOutlined />}>Upload</Button>
          </Upload>
          {uploadedUrls.length > 0 && (
            <div className="text-xs text-gray-500 mt-2">{uploadedUrls.length} file(s) uploaded</div>
          )}
        </Form.Item>

        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            size="large"
            block
            className="bg-black hover:bg-gray-800 border-none h-12"
          >
            {editing ? 'Update Event' : 'Create Event'}
          </Button>
        </Form.Item>
      </Form>
      </Modal>
    </div>
  );
};

export default EventCreator;