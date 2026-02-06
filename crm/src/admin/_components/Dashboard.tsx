import { Card, Row, Col, Statistic, Table, Typography, Tag } from 'antd';
import { 
  ArrowUpOutlined, 
  ArrowDownOutlined,
  UserOutlined,
  ShoppingOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined
} from '@ant-design/icons';
// Removed email/followup/catalog specific icons from dashboard
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import React, { useEffect, useMemo, useState } from 'react';
import { dashboardService, type DashboardSummary, type DashboardTimeseries, type DashboardRecent } from '@/admin/_components/services/dashboardService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const { Title: AntTitle } = Typography;

const Dashboard = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [series, setSeries] = useState<DashboardTimeseries | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<DashboardRecent | null>(null);

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const palette = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
  ];

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [s, t, r] = await Promise.all([
          dashboardService.summary(),
          dashboardService.timeseries(),
          dashboardService.recent({ limit: 10 }),
        ]);
        setSummary(s);
        setSeries(t);
        setRecent(r);
      } catch (e) {
        // ignore for now
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const customersMonthlyChart = useMemo(() => {
    const labels = series?.customersMonthly.map(i => `${monthNames[i._id.m-1]} ${i._id.y}`) || [];
    const data = series?.customersMonthly.map(i => i.count) || [];
    return {
      labels,
      datasets: [{
        label: 'New Customers',
        data,
        backgroundColor: data.map((_, idx) => palette[idx % palette.length] + 'B3'), // 70% opacity
        borderColor: data.map((_, idx) => palette[idx % palette.length]),
        borderWidth: 1,
      }],
    };
  }, [series]);

  const topProductsChart = useMemo(() => {
    const labels = series?.topProducts.map(i => i._id || 'Unknown') || [];
    const data = series?.topProducts.map(i => i.count) || [];
    return {
      labels,
      datasets: [{
        label: 'Top Products',
        data,
        backgroundColor: data.map((_, idx) => palette[idx % palette.length] + 'B3'),
        borderColor: data.map((_, idx) => palette[idx % palette.length]),
        borderWidth: 1,
      }],
    };
  }, [series]);

  const topSourcesChart = useMemo(() => {
    const labels = series?.topSources.map(i => i._id || 'Unknown') || [];
    const data = series?.topSources.map(i => i.count) || [];
    return {
      labels,
      datasets: [{
        label: 'Top Sources',
        data,
        backgroundColor: data.map((_, idx) => palette[(idx+3) % palette.length] + 'B3'),
        borderColor: data.map((_, idx) => palette[(idx+3) % palette.length]),
        borderWidth: 1,
      }],
    };
  }, [series]);

  const enquiriesWeeklyChart = useMemo(() => {
    const labels = series?.enquiriesWeekly.map(i => `${i._id.y}-W${String(i._id.w).padStart(2,'0')}`) || [];
    const data = series?.enquiriesWeekly.map(i => i.count) || [];
    return {
      labels,
      datasets: [{
        label: 'Enquiries',
        data,
        borderColor: '#7b61ff',
        backgroundColor: '#7b61ff33',
        tension: 0.4,
      }],
    };
  }, [series]);

  const statusPie = useMemo(() => {
    const map = series?.enquiriesByStatus || [];
    const labels = map.map(i => i._id || 'Unknown');
    const data = map.map(i => i.count);
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map((_, idx) => palette[idx % palette.length] + 'B3'),
        borderColor: data.map((_, idx) => palette[idx % palette.length]),
        borderWidth: 1,
      }]
    };
  }, [series]);

  // New Charts: Ageing Buckets
  const ageingBucketsChart = useMemo(() => {
    const buckets = series?.ageingBuckets || [];
    // Map bucket ids (0,4,8,15 or '100000+') to labels
    const labelMap: Record<string, string> = {
      '0': '0-3d',
      '4': '4-7d',
      '8': '8-14d',
      '15': '15d+',
      '100000+': '15d+',
    };
    const orderedKeys = ['0','4','8','15'];
    const countsByKey: Record<string, number> = {};
    buckets.forEach(b => { countsByKey[String(b._id)] = b.count; });
    const labels = orderedKeys.map(k => labelMap[k]);
    const data = orderedKeys.map(k => countsByKey[k] || 0);
    return {
      labels,
      datasets: [{
        label: 'Open Enquiries by Age',
        data,
        backgroundColor: labels.map((_, idx) => palette[idx % palette.length] + 'B3'),
        borderColor: labels.map((_, idx) => palette[idx % palette.length]),
        borderWidth: 1,
      }],
    };
  }, [series]);

  // Conversion by Source/Product
  const conversionBySourceChart = useMemo(() => {
    const items = series?.conversionBySource || [];
    const labels = items.map(i => i._id || 'Unknown');
    const converted = items.map(i => i.converted || 0);
    const notConverted = items.map(i => Math.max(0, (i.total || 0) - (i.converted || 0)));
    return {
      labels,
      datasets: [
        {
          label: 'Converted',
          data: converted,
          backgroundColor: '#2ca02c66',
          borderColor: '#2ca02c',
          borderWidth: 1,
        },
        {
          label: 'Not Converted',
          data: notConverted,
          backgroundColor: '#d6272866',
          borderColor: '#d62728',
          borderWidth: 1,
        },
      ],
    };
  }, [series]);

  const conversionByProductChart = useMemo(() => {
    const items = series?.conversionByProduct || [];
    const labels = items.map(i => i._id || 'Unknown');
    const converted = items.map(i => i.converted || 0);
    const notConverted = items.map(i => Math.max(0, (i.total || 0) - (i.converted || 0)));
    return {
      labels,
      datasets: [
        {
          label: 'Converted',
          data: converted,
          backgroundColor: '#2ca02c66',
          borderColor: '#2ca02c',
          borderWidth: 1,
        },
        {
          label: 'Not Converted',
          data: notConverted,
          backgroundColor: '#d6272866',
          borderColor: '#d62728',
          borderWidth: 1,
        },
      ],
    };
  }, [series]);

  const teamPerformanceChart = useMemo(() => {
    const items = series?.teamPerformance || [];
    const labels = items.map(i => i._id || 'Unassigned');
    const total = items.map(i => i.total || 0);
    const closed = items.map(i => i.closed || 0);
    return {
      labels,
      datasets: [
        {
          label: 'Total',
          data: total,
          backgroundColor: '#1f77b466',
          borderColor: '#1f77b4',
          borderWidth: 1,
        },
        {
          label: 'Closed',
          data: closed,
          backgroundColor: '#17becf66',
          borderColor: '#17becf',
          borderWidth: 1,
        },
      ],
    };
  }, [series]);

  // Placeholder recent list: keep existing static section for now
  const recentEnqColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Name/Email', dataIndex: 'who', key: 'who' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (t: string) => <Tag color={t==='Closed'?'green':t==='In Progress'?'blue':t==='Responded'?'geekblue':'orange'}>{t}</Tag> },
    { title: 'Priority', dataIndex: 'priority', key: 'priority' },
    { title: 'Products', dataIndex: 'products', key: 'products' },
  ];
  const recentEnqData = (recent?.enquiries || []).map((e, idx) => ({
    key: String(idx+1),
    date: new Date(e.createdAt).toISOString().slice(0,10),
    who: e.name || e.email || e.phone || '—',
    status: e.status || 'New',
    priority: e.priority || '—',
    products: (e.products || []).join(', '),
  }));

  return (
    <div style={{ padding: '20px' }}>
      <AntTitle level={3} style={{ marginBottom: '24px' }}>Dashboard Overview</AntTitle>
      
      {/* Stats Cards Row */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Customers"
              value={summary?.customers.total ?? 0}
              valueStyle={{ color: '#000' }}
              prefix={<UserOutlined />}
              suffix={
                <span style={{ fontSize: '14px', color: '#52c41a' }}>
                  <ArrowUpOutlined /> {summary ? `${summary.customers.last30d}` : '0'} last 30d
                </span>
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Enquiries"
              value={summary?.enquiries.total ?? 0}
              valueStyle={{ color: '#000' }}
              prefix={<ShoppingOutlined />}
              suffix={
                <span style={{ fontSize: '14px', color: '#52c41a' }}>
                  <ArrowUpOutlined /> {summary ? `${summary.enquiries.thisWeek}` : '0'} this week
                </span>
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Overdue Open Enquiries"
              value={summary?.enquiries.overdueOpen ?? 0}
              valueStyle={{ color: '#000' }}
              prefix={<LineChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Conversion Rate"
              value={summary?.enquiries.conversionRate ?? 0}
              valueStyle={{ color: '#000' }}
              prefix={<BarChartOutlined />}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* Secondary KPI Row removed to keep CRM-focused */}

      {/* Charts Row */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={12}>
          <Card title="Customers per Month" extra={<BarChartOutlined />}>
            <Bar data={customersMonthlyChart} options={{ responsive: true }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Enquiries per Week" extra={<LineChartOutlined />}>
            <Line data={enquiriesWeeklyChart} options={{ responsive: true }} />
          </Card>
        </Col>
      </Row>

      {/* Second Charts Row */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={12}>
          <Card title="Enquiry Status" extra={<PieChartOutlined />}>
            <Pie data={statusPie} options={{ responsive: true }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Top Products" extra={<BarChartOutlined />}>
            <Bar data={topProductsChart} options={{ responsive: true }} />
          </Card>
        </Col>
      </Row>

      {/* Third Row */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={12}>
          <Card title="Top Sources" extra={<BarChartOutlined />}>
            <Bar data={topSourcesChart} options={{ responsive: true }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Recent Enquiries">
            <Table
              columns={recentEnqColumns}
              dataSource={recentEnqData}
              size="small"
              pagination={{ pageSize: 5 }}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* New CRM-focused Rows */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={12}>
          <Card title="Ageing Buckets (Open Enquiries)" extra={<BarChartOutlined />}>
            <Bar data={ageingBucketsChart} options={{ responsive: true }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Conversion by Source (90d)" extra={<BarChartOutlined />}>
            <Bar data={conversionBySourceChart} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
          </Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={12}>
          <Card title="Conversion by Product (90d)" extra={<BarChartOutlined />}>
            <Bar data={conversionByProductChart} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Team Performance" extra={<BarChartOutlined />}>
            <Bar data={teamPerformanceChart} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;