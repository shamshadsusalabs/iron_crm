import { Card, Tabs, DatePicker, Button, Table,  Space, message } from 'antd';
import { BarChartOutlined, LineChartOutlined, PieChartOutlined, TableOutlined } from '@ant-design/icons';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { reportingService, type ReportingSummary } from '@/admin/_components/services/reportingService';

ChartJS.register(...registerables);

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const Reporting = () => {
  const [data, setData] = useState<ReportingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<[any, any] | null>(null);

  const fetchData = useCallback(async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const res = await reportingService.summary({ start, end });
      setData(res);
      if (start || end) {
        // Auto-download CSV on explicit Generate
        const csv = buildCsvContent(res, start, end);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().slice(0,10);
        link.download = `report_${dateStr}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        message.success('Report generated & downloaded');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to fetch report';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRangeChange = (vals: any) => {
    setRange(vals);
  };

  const onGenerate = () => {
    if (!range || !range[0] || !range[1]) {
      message.warning('पहले date range चुनें');
      return;
    }
    const start = range?.[0]?.startOf?.('day')?.toDate?.()?.toISOString?.();
    const end = range?.[1]?.endOf?.('day')?.toDate?.()?.toISOString?.();
    // Debug
    // eslint-disable-next-line no-console
    console.log('Generating report with range:', { start, end });
    fetchData(start, end);
  };

  // Export CSV
  const arrayToCsv = (rows: Array<Record<string, any>>, headers?: string[]) => {
    if (!rows?.length) return '';
    const cols = headers && headers.length ? headers : Object.keys(rows[0] || {});
    const escape = (val: any) => {
      if (val === null || val === undefined) return '';
      const s = String(val).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [cols.join(',')];
    for (const row of rows) {
      lines.push(cols.map(c => escape(row[c])).join(','));
    }
    return lines.join('\n');
  };

  const buildCsvContent = (d?: ReportingSummary | null, startStr?: string, endStr?: string) => {
    const dataset = d ?? data;
    const parts: string[] = [];
    const title = 'Reporting Export';
    const start = startStr || range?.[0]?.startOf?.('day')?.toISOString?.();
    const end = endStr || range?.[1]?.endOf?.('day')?.toISOString?.();
    parts.push(`# ${title}`);
    if (start || end) parts.push(`# Range: ${start || ''} to ${end || ''}`);

    // Enquiries Daily
    parts.push('\nEnquiries Daily');
    const enquiriesRows = (dataset?.enquiriesDaily || []).map(i => ({ date: i._id.d, count: i.count }));
    parts.push(arrayToCsv(enquiriesRows, ['date','count']) || 'date,count');

    // Customers Daily
    parts.push('\nCustomers Daily');
    const customerRows = (dataset?.customerDaily || []).map(i => ({ date: i._id.d, count: i.count }));
    parts.push(arrayToCsv(customerRows, ['date','count']) || 'date,count');

    // Lead Status (distribution)
    parts.push('\nLead Status');
    const leadRows = (dataset?.leadStatus || []).map(i => ({ status: i._id || 'Unknown', count: i.count }));
    parts.push(arrayToCsv(leadRows, ['status','count']) || 'status,count');

    // Activities
    parts.push('\nRecent Activities');
    const actRows = (dataset?.activities || []).map(a => ({ date: a.date, activity: a.activity, user: a.user, details: a.details }));
    parts.push(arrayToCsv(actRows, ['date','activity','user','details']) || 'date,activity,user,details');

    return parts.join('\n');
  };

  // Charts
  const salesData = useMemo(() => {
    const labels = (data?.enquiriesDaily || []).map(i => i._id.d);
    const values = (data?.enquiriesDaily || []).map(i => i.count);
    return {
      labels,
      datasets: [{
        label: 'Enquiries per day',
        data: values,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderColor: 'rgba(0, 0, 0, 1)',
        borderWidth: 1,
      }],
    };
  }, [data]);

  const customerData = useMemo(() => {
    const labels = (data?.customerDaily || []).map(i => i._id.d);
    const values = (data?.customerDaily || []).map(i => i.count);
    return {
      labels,
      datasets: [{
        label: 'New Customers per day',
        data: values,
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4,
      }],
    };
  }, [data]);

  const leadData = useMemo(() => {
    const labels = (data?.leadStatus || []).map(i => i._id || 'Unknown');
    const values = (data?.leadStatus || []).map(i => i.count);
    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)'
        ],
        borderWidth: 1,
      }],
    };
  }, [data]);

  // Recent Activities Data
  const activitiesColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: 'Activity',
      dataIndex: 'activity',
      key: 'activity',
    },
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
    },
  ];

  const activitiesData = (data?.activities || []).map((a, idx) => ({
    key: String(idx+1),
    date: new Date(a.date).toISOString().slice(0,10),
    activity: a.activity,
    user: a.user,
    details: a.details,
  }));

  return (
    <Card
      title="Reporting Dashboard"
      extra={
        <Space wrap size={[8, 8]}>
          <RangePicker onChange={onRangeChange} allowClear />
          <Button 
            type="primary" 
            style={{ background: 'black', borderColor: 'black' }}
            loading={loading}
            onClick={onGenerate}
            disabled={loading}
          >
            Generate Report
          </Button>
        </Space>
      }
    >
      <Tabs defaultActiveKey="1">
        <TabPane
          tab={
            <span>
              <BarChartOutlined />
              Enquiries (Daily)
            </span>
          }
          key="1"
        >
          <Bar data={salesData} options={{ responsive: true }} />
        </TabPane>

        <TabPane
          tab={
            <span>
              <LineChartOutlined />
              Customers (Daily)
            </span>
          }
          key="2"
        >
          <Line data={customerData} options={{ responsive: true }} />
        </TabPane>

        <TabPane
          tab={
            <span>
              <PieChartOutlined />
              Lead Conversion
            </span>
          }
          key="3"
        >
          <Pie data={leadData} options={{ responsive: true }} />
        </TabPane>

        <TabPane
          tab={
            <span>
              <TableOutlined />
              Recent Activities
            </span>
          }
          key="4"
        >
          <Table 
            columns={activitiesColumns} 
            dataSource={activitiesData} 
            size="small"
            pagination={{ pageSize: 5 }}
            loading={loading}
          />
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default Reporting;