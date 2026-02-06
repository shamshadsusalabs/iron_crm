import { useEffect, useState } from 'react'
import { enquiryApi, type EnquiryDto, type EnquiryPayload } from '@/merchandiser/_libs/enquiry-api'

export default function MerchCustomerEnquiries() {
  const [items, setItems] = useState<EnquiryDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<EnquiryPayload>({ name: '' })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await enquiryApi.list({ page: 1, limit: 10 })
      setItems(data.items)
    } catch (e: any) {
      setError(e?.message || 'Failed to load enquiries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.name?.trim()) return
    setLoading(true)
    setError(null)
    try {
      await enquiryApi.create(form)
      setForm({ name: '' })
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to create enquiry')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Customer Enquiries</h1>

      <div className="bg-white p-4 rounded-lg shadow border space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input className="border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Products (comma separated)" value={(form.products || []).join(', ')} onChange={(e) => setForm({ ...form, products: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
          <button className="bg-black text-white rounded px-4" onClick={create} disabled={loading}>Add</button>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </div>

      <div className="bg-white rounded-lg shadow border">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={4}>Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="p-3" colSpan={4}>No enquiries</td></tr>
            ) : items.map((e) => (
              <tr key={e._id} className="border-t">
                <td className="p-3">{e.name}</td>
                <td className="p-3">{e.email || '-'}</td>
                <td className="p-3">{e.phone || '-'}</td>
                <td className="p-3">{new Date(e.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
