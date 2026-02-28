"use client"

import { useEffect, useState } from 'react'
import { catalogApi } from './libs/catalog-api'
import type { CatalogItem, CatalogCategory } from './types/catalog'

export default function CatalogItems() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([]) // Categories state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pagination State
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<{ total: number; pages: number; page: number; limit: number } | null>(null)

  // Search State
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 500)
    return () => clearTimeout(handler)
  }, [search])

  // Create Form State
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{
    title: string;
    description: string;
    categoryName: string; // Changed to categoryName for input
    price?: string;
    image?: File;
    imagePreview?: string;
    pdf?: File;
    pdfName?: string
  }>({ title: '', description: '', categoryName: '' })

  const [uploadError, setUploadError] = useState<string | null>(null)
  const [formUploadType, setFormUploadType] = useState<'image' | 'pdf'>('image')

  // Edit Form State
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    categoryName: string; // Changed to categoryName
    price?: string;
    status: 'pending' | 'active' | 'archived';
    image?: File;
    imagePreview?: string;
    pdf?: File;
    pdfName?: string
  }>({ title: '', description: '', categoryName: '', status: 'active' })

  const [editUploadType, setEditUploadType] = useState<'image' | 'pdf'>('image')

  // Load Categories once
  useEffect(() => {
    let mounted = true
    async function loadCategories() {
      try {
        const cats = await catalogApi.getCategories()
        if (mounted) setCategories(cats)
      } catch (e: any) {
        console.error('Failed to load categories', e)
      }
    }
    loadCategories()
    return () => { mounted = false }
  }, [])

  // Load Items on page change
  useEffect(() => {
    let mounted = true
    async function loadItems() {
      try {
        setLoading(true)
        const res = await catalogApi.getItems({ page, limit: 200, search: debouncedSearch })

        if (!mounted) return
        setItems(res.items)
        setPagination(res.pagination)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Failed to load catalog data')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadItems()
    return () => {
      mounted = false
    }
  }, [page, debouncedSearch])

  // Helper to find or create category ID from name
  const getCategoryIdFromName = async (name: string): Promise<string | null> => {
    if (!name || !name.trim()) return null
    const trimmedName = name.trim()

    // Check if exists locally
    const existing = categories.find(c => c.name.toLowerCase() === trimmedName.toLowerCase())
    if (existing) return existing._id

    // If not, create new
    try {
      const newCat = await catalogApi.createCategory({ name: trimmedName })
      setCategories(prev => [...prev, newCat]) // Update local state
      return newCat._id
    } catch (e) {
      console.error('Failed to create category on the fly', e)
      return null
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Catalog Items</h2>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">{pagination?.total || items.length} items</div>
          <button
            onClick={() => setOpen(true)}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            Add Item
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search items by title or category..."
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}

      {/* Edit Item Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg my-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Edit Catalog Item</h3>
              <button onClick={() => setEditOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            {uploadError && <div className="mb-2 text-sm text-red-600">{uploadError}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Title<span className="text-red-500">*</span></label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Product title"
                />
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Product description..."
                  rows={3}
                />
              </div>

              {/* Category Field - INPUT now */}
              <div>
                <label className="block text-sm font-medium mb-1">Category (Type to Create)</label>
                <input
                  type="text"
                  value={editForm.categoryName}
                  onChange={(e) => setEditForm((f) => ({ ...f, categoryName: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Iron Rods"
                  list="category-suggestions" // HTML5 DataList for autocomplete suggestions
                />
                <datalist id="category-suggestions">
                  {categories.map(cat => (
                    <option key={cat._id} value={cat.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Price</label>
                <input
                  type="number"
                  value={editForm.price || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 999"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as 'pending' | 'active' | 'archived' }))}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="pending">pending</option>
                    <option value="active">active</option>
                    <option value="archived">archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Upload Type</label>
                  <div className="flex gap-3 text-sm">
                    <label className="inline-flex items-center gap-1"><input type="radio" name="edit-upload-type" checked={editUploadType === 'image'} onChange={() => { setEditUploadType('image'); setEditForm((f) => ({ ...f, pdf: undefined, pdfName: undefined })) }} /> Image</label>
                    <label className="inline-flex items-center gap-1"><input type="radio" name="edit-upload-type" checked={editUploadType === 'pdf'} onChange={() => { setEditUploadType('pdf'); setEditForm((f) => ({ ...f, image: undefined, imagePreview: undefined })) }} /> PDF</label>
                  </div>
                </div>
              </div>
              {editUploadType === 'image' ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Replace Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setEditForm((f) => ({ ...f, image: file, imagePreview: URL.createObjectURL(file), pdf: undefined, pdfName: undefined }))
                      }
                    }}
                    className="block w-full text-sm text-gray-700"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Attach PDF (max 10MB)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          setUploadError('PDF size must be <= 10MB')
                          return
                        }
                        setEditForm((f) => ({ ...f, pdf: file, pdfName: file.name, image: undefined, imagePreview: undefined }))
                      }
                    }}
                    className="block w-full text-sm text-gray-700"
                  />
                  {editForm.pdfName && (
                    <div className="mt-1 text-xs text-gray-600">{editForm.pdfName}</div>
                  )}
                </div>
              )}
              {(editForm.imagePreview) && (
                <img src={editForm.imagePreview} className="mt-2 h-24 w-24 rounded object-cover" />
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditOpen(false)}
                className="px-3 py-2 rounded-lg border text-sm"
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setUploadError(null)
                  if (!editing) return
                  if (!editForm.title.trim()) {
                    setUploadError('Title is required')
                    return
                  }
                  try {
                    setEditSaving(true)
                    let imagePayload: { publicId?: string; url: string; width?: number; height?: number; format?: string } | undefined
                    let filePayload: any | undefined
                    if (editForm.image) {
                      imagePayload = await catalogApi.uploadImage(editForm.image)
                    }
                    if (editForm.pdf) {
                      filePayload = await catalogApi.uploadFile(editForm.pdf)
                    }

                    // Resolve Category Name to ID
                    const categoryId = await getCategoryIdFromName(editForm.categoryName)
                    const categoryIds = categoryId ? [categoryId] : []

                    const updated = await catalogApi.updateItem(editing._id!, {
                      title: editForm.title.trim(),
                      description: editForm.description,
                      categoryIds, // Updated with ID
                      price: editForm.price ? Number(editForm.price) : undefined,
                      status: editForm.status,
                      ...(imagePayload ? { images: [imagePayload] } : {}),
                      ...(filePayload ? { files: [filePayload] } : {}),
                    })
                    setItems((prev) => prev.map((p) => (p._id === updated._id ? updated : p)))
                    setEditOpen(false)
                    setEditing(null)
                  } catch (e: any) {
                    setUploadError(e?.message || 'Failed to update item')
                  } finally {
                    setEditSaving(false)
                  }
                }}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60"
                disabled={editSaving}
              >
                {editSaving ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2">Image</th>
                <th className="p-2">Title</th>
                <th className="p-2">Category</th>
                <th className="p-2">Price</th>
                <th className="p-2">Status</th>
                <th className="p-2">Updated</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it._id} className="border-t">
                  <td className="p-2">
                    {it.images?.[0]?.url ? (
                      <img src={it.images[0].url} alt={it.title} className="h-10 w-10 object-cover rounded" />
                    ) : (
                      <div className="h-10 w-10 bg-gray-100 rounded" />)
                    }
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{it.title}</div>
                    {it.description && <div className="text-xs text-gray-500 truncate max-w-[150px]">{it.description}</div>}
                  </td>
                  <td className="p-2">
                    {it.categoryIds && it.categoryIds.length > 0 ? (
                      it.categoryIds.map(id => {
                        const cat = categories.find(c => c._id === id)
                        return cat ? <span key={id} className="inline-block bg-gray-100 px-2 py-0.5 rounded text-xs mr-1">{cat.name}</span> : null
                      })
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-2">{it.price ? `₹${it.price}` : '-'}</td>
                  <td className="p-2">
                    {it.status === 'pending' ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-yellow-50 text-yellow-700">pending</span>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs ${it.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {it.status}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-gray-500">{new Date(it.updatedAt).toLocaleString()}</td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditing(it)
                          // Find name from ID for input display
                          const catId = it.categoryIds?.[0]
                          const catName = categories.find(c => c._id === catId)?.name || ''

                          setEditForm({
                            title: it.title || '',
                            description: it.description || '',
                            categoryName: catName, // populate name for input
                            price: typeof it.price === 'number' ? String(it.price) : '',
                            status: (it.status as 'pending' | 'active' | 'archived') || 'active',
                            imagePreview: it.images?.[0]?.url,
                          })
                          setEditUploadType((it.files && it.files.length > 0) ? 'pdf' : 'image')
                          setEditOpen(true)
                        }}
                        className="px-2 py-1 rounded border text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Delete this item?')) return
                          try {
                            await catalogApi.deleteItem(it._id!)
                            setItems((prev) => prev.filter((p) => p._id !== it._id))
                          } catch (e: any) {
                            alert(e?.message || 'Failed to delete item')
                          }
                        }}
                        className="px-2 py-1 rounded border text-xs text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">
                    {debouncedSearch ? 'No matching items found' : 'No items found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-sm"
          >
            Previous
          </button>
          <span className="text-sm">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-sm"
          >
            Next
          </button>
        </div>
      )}

      {/* Create Item Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg my-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Add Catalog Item</h3>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            {uploadError && <div className="mb-2 text-sm text-red-600">{uploadError}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Title<span className="text-red-500">*</span></label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Product title"
                />
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Product description..."
                  rows={3}
                />
              </div>

              {/* Category Field - INPUT w/ DataList */}
              <div>
                <label className="block text-sm font-medium mb-1">Category (Type to Create)</label>
                <input
                  type="text"
                  value={form.categoryName}
                  onChange={(e) => setForm((f) => ({ ...f, categoryName: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Iron Rods"
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  {categories.map(cat => (
                    <option key={cat._id} value={cat.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Price</label>
                <input
                  type="number"
                  value={form.price || ''}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 999"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Upload Type</label>
                <div className="flex gap-3 text-sm mb-2">
                  <label className="inline-flex items-center gap-1"><input type="radio" name="create-upload-type" checked={formUploadType === 'image'} onChange={() => { setFormUploadType('image'); setForm((f) => ({ ...f, pdf: undefined, pdfName: undefined })) }} /> Image</label>
                  <label className="inline-flex items-center gap-1"><input type="radio" name="create-upload-type" checked={formUploadType === 'pdf'} onChange={() => { setFormUploadType('pdf'); setForm((f) => ({ ...f, image: undefined, imagePreview: undefined })) }} /> PDF</label>
                </div>
                {formUploadType === 'image' ? (
                  <div>
                    <label className="block text-sm font-medium mb-1">Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setForm((f) => ({ ...f, image: file, imagePreview: URL.createObjectURL(file), pdf: undefined, pdfName: undefined }))
                        }
                      }}
                      className="block w-full text-sm text-gray-700"
                    />
                    {form.imagePreview && (
                      <img src={form.imagePreview} className="mt-2 h-24 w-24 rounded object-cover" />
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-1">Attach PDF (max 10MB)</label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          if (file.size > 10 * 1024 * 1024) {
                            setUploadError('PDF size must be <= 10MB')
                            return
                          }
                          setForm((f) => ({ ...f, pdf: file, pdfName: file.name, image: undefined, imagePreview: undefined }))
                        }
                      }}
                      className="block w-full text-sm text-gray-700"
                    />
                    {form.pdfName && (
                      <div className="mt-1 text-xs text-gray-600">{form.pdfName}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-lg border text-sm"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setUploadError(null)
                  if (!form.title.trim()) {
                    setUploadError('Title is required')
                    return
                  }
                  try {
                    setSaving(true)
                    let imagePayload: { publicId?: string; url: string; width?: number; height?: number; format?: string } | undefined
                    let filePayload: any | undefined
                    if (form.image) {
                      imagePayload = await catalogApi.uploadImage(form.image)
                    }
                    if (form.pdf) {
                      filePayload = await catalogApi.uploadFile(form.pdf)
                    }

                    // Resolve Category Name to ID
                    const categoryId = await getCategoryIdFromName(form.categoryName)
                    const categoryIds = categoryId ? [categoryId] : []

                    const created = await catalogApi.createItem({
                      title: form.title.trim(),
                      description: form.description,
                      categoryIds, // Updated with ID
                      price: form.price ? Number(form.price) : undefined,
                      images: imagePayload ? [imagePayload] : [],
                      ...(filePayload ? { files: [filePayload] } : {}),
                      status: 'active',
                    })
                    // refresh list - prepend new item
                    setItems((prev) => [created, ...prev])
                    setOpen(false)
                    setForm({ title: '', description: '', categoryName: '' })
                  } catch (e: any) {
                    setUploadError(e?.message || 'Failed to create item')
                  } finally {
                    setSaving(false)
                  }
                }}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
