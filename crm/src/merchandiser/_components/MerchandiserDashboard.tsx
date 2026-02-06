import { Card, Row, Col, Statistic, Table, Typography, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { 
  ArrowUpOutlined, 
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  BarChartOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { Bar, Line } from 'react-chartjs-2';
import { merchDashboardApi } from '../_libs/dashboard-api';
import { leadApi } from '../_libs/lead-api';
import type { LeadDto } from '../_libs/lead-api';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const { Title: AntTitle } = Typography;

const MerchandiserDashboard = () => {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<null | {
    leads: { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> }
    events: { total: number; upcoming: number }
  }>(null)
  const [timeseries, setTimeseries] = useState<null | {
    leadsMonthly: { _id: { y: number; m: number }; count: number }[]
    eventsMonthly: { _id: { y: number; m: number }; count: number }[]
  }>(null)
  const [recentLeads, setRecentLeads] = useState<LeadDto[]>([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const [s, t, leadsRes] = await Promise.all([
          merchDashboardApi.summary(),
          merchDashboardApi.timeseries(),
          leadApi.list({ page: 1, limit: 5 }),
        ])

        if (!mounted) return
        setSummary(s)
        setTimeseries(t)
        setRecentLeads(leadsRes.leads)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  // Build last 12 months labels
  const monthLabels = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleString('default', { month: 'short' })
    const arr: string[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const x = new Date(now.getFullYear(), now.getMonth() - i, 1)
      arr.push(fmt(x))
    }
    return arr
  }, [])

  const leadsChartData = useMemo(() => {
    const counts = new Array(12).fill(0)
    if (timeseries) {
      const now = new Date()
      for (const row of timeseries.leadsMonthly) {
        const idx = (now.getFullYear() - row._id.y) * 12 + (now.getMonth() - (row._id.m - 1))
        if (idx >= 0 && idx < 12) counts[11 - idx] = row.count
      }
    }
    return {
      labels: monthLabels,
      datasets: [
        {
          label: 'Leads (Last 12 months)',
          data: counts,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          borderColor: 'rgba(0, 0, 0, 1)',
          borderWidth: 1,
        },
      ],
    }
  }, [timeseries, monthLabels])

  const eventsLineData = useMemo(() => {
    const counts = new Array(12).fill(0)
    if (timeseries) {
      const now = new Date()
      for (const row of timeseries.eventsMonthly) {
        const idx = (now.getFullYear() - row._id.y) * 12 + (now.getMonth() - (row._id.m - 1))
        if (idx >= 0 && idx < 12) counts[11 - idx] = row.count
      }
    }
    return {
      labels: monthLabels,
      datasets: [
        {
          label: 'Events Created',
          data: counts,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.4,
        },
      ],
    }
  }, [timeseries, monthLabels])

  // Recent Leads Table Data
  const leadsColumns = [
    {
      title: 'Customer',
      dataIndex: 'customer',
      key: 'customer',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => (
        <Tag color={text === 'Hot' ? 'red' : text === 'Follow-up' ? 'orange' : 'blue'}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
    },
    {
      title: 'Last Contact',
      dataIndex: 'lastContact',
      key: 'lastContact',
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString() : '-'),
    },
  ]

  return (
    <div style={{ padding: '20px' }}>
      <AntTitle level={3} style={{ marginBottom: '24px' }}>Merchandiser Dashboard</AntTitle>
      
      {/* Stats Cards Row */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Leads"
              value={summary?.leads.total || 0}
              valueStyle={{ color: '#000' }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Upcoming Events"
              value={summary?.events.upcoming || 0}
              valueStyle={{ color: '#000' }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={12}>
          <Card title="Monthly Leads" extra={<BarChartOutlined />}>
            <Bar data={leadsChartData} options={{ responsive: true }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Events (Monthly)" extra={<LineChartOutlined />}>
            <Line data={eventsLineData} options={{ responsive: true }} />
          </Card>
        </Col>
      </Row>

      {/* Recent Leads Table */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={24}>
          <Card title="Recent Leads">
            <Table
              columns={leadsColumns as any}
              dataSource={recentLeads.map(l => ({ ...l, key: l._id }))}
              size="small"
              loading={loading}
              pagination={{ pageSize: 5 }}
            />
          </Card>
        </Col>
      </Row>

    </div>
  );
};

export default MerchandiserDashboard;