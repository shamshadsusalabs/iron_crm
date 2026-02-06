import { useEffect, useState } from 'react'
import merchAxios from '@/lib/merchAxios'

export type MerchEmailSettings = {
  enabled?: boolean
  user?: string
  fromName?: string
  imapHost?: string
  imapPort?: number
  smtpHost?: string
  smtpPort?: number
}

type Props = {
  open: boolean
  onClose: () => void
}

export default function MerchEmailSettingsModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState<MerchEmailSettings & { password?: string }>({
    enabled: true,
    user: '',
    fromName: '',
    imapHost: '',
    imapPort: 993,
    smtpHost: '',
    smtpPort: 465,
    password: '',
  })

  useEffect(() => {
    if (!open) return
    setError(null)
    setSuccess(null)
    setLoading(true)
    merchAxios
      .get('/email-settings')
      .then(({ data }) => {
        const s = (data?.data || {}) as MerchEmailSettings
        setForm((prev) => ({
          ...prev,
          enabled: s.enabled ?? true,
          user: s.user || '',
          fromName: s.fromName || '',
          imapHost: s.imapHost || '',
          imapPort: s.imapPort || 993,
          smtpHost: s.smtpHost || '',
          smtpPort: s.smtpPort || 465,
          password: '',
        }))
      })
      .catch((e) => setError(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false))
  }, [open])

  const update = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const onSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const payload: any = { ...form }
      if (!payload.password) delete payload.password
      await merchAxios.put('/email-settings', payload)
      setSuccess('Settings saved')
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message)
    } finally {
      setSaving(false)
    }
  }

  const onTest = async () => {
    setTesting(true)
    setError(null)
    setSuccess(null)
    try {
      const payload: any = { ...form }
      if (!payload.password) delete payload.password
      const { data } = await merchAxios.post('/email-settings/test', payload)
      setSuccess(data?.message || 'SMTP verified')
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.response?.data?.message || e.message)
    } finally {
      setTesting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-40" onClick={onClose}></div>
      <div className="relative z-10 w-full max-w-xl rounded-lg bg-white shadow-xl border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Email Settings (Merchandiser)</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {loading && <div className="text-sm text-gray-500">Loading...</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {success && <div className="text-sm text-green-600">{success}</div>}

          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex items-center space-x-2 text-sm">
              <input type="checkbox" checked={!!form.enabled} onChange={(e) => update('enabled', e.target.checked)} />
              <span>Enable per-user email</span>
            </label>
            <div>
              <div className="text-xs text-gray-600 mb-1">Email User</div>
              <input className="w-full border rounded p-2 text-sm" value={form.user || ''} onChange={(e) => update('user', e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">From Name</div>
              <input className="w-full border rounded p-2 text-sm" value={form.fromName || ''} onChange={(e) => update('fromName', e.target.value)} placeholder="Your Name" />
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">SMTP Host</div>
              <input className="w-full border rounded p-2 text-sm" value={form.smtpHost || ''} onChange={(e) => update('smtpHost', e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">SMTP Port</div>
              <input type="number" className="w-full border rounded p-2 text-sm" value={form.smtpPort || 465} onChange={(e) => update('smtpPort', Number(e.target.value))} />
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">IMAP Host</div>
              <input className="w-full border rounded p-2 text-sm" value={form.imapHost || ''} onChange={(e) => update('imapHost', e.target.value)} placeholder="imap.gmail.com" />
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">IMAP Port</div>
              <input type="number" className="w-full border rounded p-2 text-sm" value={form.imapPort || 993} onChange={(e) => update('imapPort', Number(e.target.value))} />
            </div>
            <div className="col-span-2">
              <div className="text-xs text-gray-600 mb-1">App Password (not shown)</div>
              <input type="password" className="w-full border rounded p-2 text-sm" value={form.password || ''} onChange={(e) => update('password', e.target.value)} placeholder="Enter new app password to update" />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-between">
          <button onClick={onTest} disabled={testing} className="px-4 py-2 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm disabled:opacity-50">
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <div>
            <button onClick={onClose} className="mr-2 px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm">Close</button>
            <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
