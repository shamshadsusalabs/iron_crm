"use client"

import { useEffect, useState } from 'react'
import { catalogApi } from './libs/catalog-api'
import type { CatalogCategory } from './types/catalog'

export default function CatalogCategories() {
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal State
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<CatalogCategory | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        const cats = await catalogApi.getCategories()
        if (!mounted) return
        setCategories(cats)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Failed to load categories')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const handleEdit = (cat: CatalogCategory) => {
    setEditing(cat)
    setForm({ name: cat.name, description: cat.description || '' })
    setOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return
    try {
      await catalogApi.deleteCategory(id)
      setCategories(prev => prev.filter(c => c._id !== id))
    } catch (e: any) {
      alert(e?.message || 'Failed to delete category')
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const updated = await catalogApi.updateCategory(editing._id, form)
        setCategories(prev => prev.map(c => c._id === updated._id ? updated : c)) // API returns category object
      } else {
        const created = await catalogApi.createCategory(form)
        setCategories(prev => [...prev, created]) // API returns data directly (checked wrapper) - wait, let's verify wrapper
        // createCategory returns data.data which IS the category object. So this is correct.
      }
      setOpen(false)
      setForm({ name: '', description: '' })
      setEditing(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Catalog Categories</h2>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">{categories.length} categories</div>
          <button
            onClick={() => { setEditing(null); setForm({ name: '', description: '' }); setOpen(true); }}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            Add Category
          </button>
        </div>
      </div>

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2">Name</th>
                <th className="p-2">Description</th>
                <th className="p-2">Updated</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat._id} className="border-t">
                  <td className="p-2 font-medium">{cat.name}</td>
                  <td className="p-2 text-gray-700">{cat.description || '-'}</td>
                  <td className="p-2 text-gray-500">{new Date(cat.updatedAt).toLocaleString()}</td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(cat)}
                        className="px-2 py-1 rounded border text-xs hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(cat._id)}
                        className="px-2 py-1 rounded border text-xs text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">No categories found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{editing ? 'Edit Category' : 'Add Category'}</h3>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Category Name"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Optional description..."
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
                disabled={saving || !form.name.trim()}
              >
                {saving ? 'Saving...' : (editing ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
