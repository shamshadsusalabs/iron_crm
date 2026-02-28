"use client"

import { Card, Row, Col, Statistic, Table, Typography, Tag, Progress } from 'antd'
import {
  MailOutlined,
  UserOutlined,
  FileTextOutlined,
  RiseOutlined,
  FallOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined,
  DashboardOutlined
} from '@ant-design/icons'
import { Bar, Line, Pie } from 'react-chartjs-2'
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
} from 'chart.js'
import { useFollowUpContext } from './hooks/use-follow-up'

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
)

const { Title: AntTitle, Text } = Typography

export default function FollowUpDashboard() {
  const {
    campaigns,
    contacts,
    templates,
    contactLists,
    dashboardStats,
    campaignsLoading,
    contactsLoading,
    templatesLoading,
    contactListsLoading,
    dashboardStatsLoading
  } = useFollowUpContext()

  // Use dashboardStats for counts
  const stats = dashboardStats?.counts || {}

  // Calculate statistics (prefer server-side stats)
  const totalCampaigns = stats.campaigns?.total ?? campaigns.length
  const activeCampaigns = stats.campaigns?.active ?? campaigns.filter(c => c.status === "sending" || c.status === "scheduled").length
  const completedCampaigns = stats.campaigns?.completed ?? campaigns.filter(c => c.status === "sent" || c.status === "completed").length

  const totalContacts = stats.contacts?.total ?? contacts.length
  const activeContacts = stats.contacts?.active ?? contacts.filter(c => c.status === "active").length
  const unsubscribedContacts = stats.contacts?.unsubscribed ?? contacts.filter(c => c.status === "unsubscribed").length

  const totalTemplates = stats.templates?.total ?? templates.length
  const activeTemplates = stats.templates?.active ?? templates.filter(t => t.isActive).length

  const totalContactLists = stats.lists?.total ?? contactLists.length

  // Campaign performance data
  const campaignPerformanceData = {
    labels: ['Draft', 'Scheduled', 'Sending', 'Sent', 'Completed'],
    datasets: [
      {
        label: 'Campaigns',
        data: dashboardStats?.charts?.campaignsByStatus
          ? [
            dashboardStats.charts.campaignsByStatus.find((s: any) => s._id === 'draft')?.count || 0,
            dashboardStats.charts.campaignsByStatus.find((s: any) => s._id === 'scheduled')?.count || 0,
            dashboardStats.charts.campaignsByStatus.find((s: any) => s._id === 'sending')?.count || 0,
            dashboardStats.charts.campaignsByStatus.find((s: any) => s._id === 'sent')?.count || 0,
            dashboardStats.charts.campaignsByStatus.find((s: any) => s._id === 'completed')?.count || 0,
          ]
          : [
            campaigns.filter(c => c.status === "draft").length,
            campaigns.filter(c => c.status === "scheduled").length,
            campaigns.filter(c => c.status === "sending").length,
            campaigns.filter(c => c.status === "sent").length,
            campaigns.filter(c => c.status === "completed").length,
          ],
        backgroundColor: [
          'rgba(156, 163, 175, 0.7)',
          'rgba(59, 130, 246, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(34, 197, 94, 0.7)',
        ],
        borderColor: [
          'rgba(156, 163, 175, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(34, 197, 94, 1)',
        ],
        borderWidth: 1,
      },
    ],
  }

  // Contact growth data (simplify for now or use chart data if available)
  const contactGrowthData = {
    labels: dashboardStats?.charts?.contactGrowth?.map((d: any) => `${d._id.month}/${d._id.year}`) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'New Contacts',
        data: dashboardStats?.charts?.contactGrowth?.map((d: any) => d.count) || [12, 19, 15, 27, 22, 30],
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.4,
      },
    ],
  }

  // Template usage data
  const templateUsageData = {
    labels: ['Initial', 'Follow-up 1', 'Follow-up 2', 'Follow-up 3'],
    datasets: [
      {
        data: dashboardStats?.charts?.templatesByType
          ? [
            dashboardStats.charts.templatesByType.find((t: any) => t._id === 'initial')?.count || 0,
            dashboardStats.charts.templatesByType.find((t: any) => t._id === 'followup1')?.count || 0,
            dashboardStats.charts.templatesByType.find((t: any) => t._id === 'followup2')?.count || 0,
            dashboardStats.charts.templatesByType.find((t: any) => t._id === 'followup3')?.count || 0,
          ]
          : [
            templates.filter(t => t.type === "initial").length,
            templates.filter(t => t.type === "followup1").length,
            templates.filter(t => t.type === "followup2").length,
            templates.filter(t => t.type === "followup3").length,
          ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(239, 68, 68, 0.7)',
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 1,
      },
    ],
  }

  // Recent campaigns table data
  const recentCampaignsColumns = [
    {
      title: 'Campaign Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          draft: { color: 'default', text: 'Draft' },
          scheduled: { color: 'processing', text: 'Scheduled' },
          sending: { color: 'processing', text: 'Sending' },
          sent: { color: 'success', text: 'Sent' },
          completed: { color: 'success', text: 'Completed' },
        }
        const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: 'Contacts',
      dataIndex: 'totalContacts',
      key: 'totalContacts',
    },
    {
      title: 'Sent',
      dataIndex: 'sent',
      key: 'sent',
    },
    {
      title: 'Opened',
      dataIndex: 'opened',
      key: 'opened',
    },
    {
      title: 'Clicked',
      dataIndex: 'clicked',
      key: 'clicked',
    },
  ]

  const recentCampaignsData = campaigns.slice(0, 5).map(campaign => ({
    key: campaign._id,
    name: campaign.name,
    status: campaign.status,
    totalContacts: (campaign.contacts?.length || 0) + (campaign.contactLists?.length || 0),
    sent: campaign.stats?.totalSent || 0,
    opened: campaign.stats?.opened || 0,
    clicked: campaign.stats?.clicked || 0,
  }))

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sending':
      case 'scheduled':
        return <PlayCircleOutlined className="text-green-500" />
      case 'sent':
      case 'completed':
        return <CheckCircleOutlined className="text-blue-500" />
      case 'draft':
        return <ClockCircleOutlined className="text-gray-500" />
      default:
        return <ExclamationCircleOutlined className="text-red-500" />
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <AntTitle level={2} className="mb-2">Follow-up Dashboard</AntTitle>
          <Text type="secondary">Overview of your email campaigns and follow-up performance</Text>
        </div>
        <div className="flex items-center gap-2">
          <DashboardOutlined className="h-5 w-5 text-blue-500" />
          <span className="text-sm text-gray-500">Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Campaigns"
              value={totalCampaigns}
              prefix={<MailOutlined className="text-blue-500" />}
              loading={dashboardStatsLoading}
            />
            <div className="mt-2">
              <Text type="secondary">
                {activeCampaigns} active, {completedCampaigns} completed
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Contacts"
              value={totalContacts}
              prefix={<UserOutlined className="text-green-500" />}
              loading={dashboardStatsLoading}
            />
            <div className="mt-2">
              <Text type="secondary">
                {activeContacts} active, {unsubscribedContacts} unsubscribed
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Email Templates"
              value={totalTemplates}
              prefix={<FileTextOutlined className="text-purple-500" />}
              loading={dashboardStatsLoading}
            />
            <div className="mt-2">
              <Text type="secondary">
                {activeTemplates} active templates
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Contact Lists"
              value={totalContactLists}
              prefix={<BarChartOutlined className="text-orange-500" />}
              loading={dashboardStatsLoading}
            />
            <div className="mt-2">
              <Text type="secondary">
                Organized contact groups
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Campaign Performance" className="h-80">
            <Bar
              data={campaignPerformanceData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
              }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Contact Growth" className="h-80">
            <Line
              data={contactGrowthData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  },
                },
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Template Usage and Recent Campaigns */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="Template Usage" className="h-80">
            <Pie
              data={templateUsageData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                  },
                },
              }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card title="Recent Campaigns" className="h-80">
            <Table
              columns={recentCampaignsColumns}
              dataSource={recentCampaignsData}
              pagination={false}
              size="small"
              loading={campaignsLoading}
            />
          </Card>
        </Col>
      </Row>



    </div>
  )
} 