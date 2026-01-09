import { useState, useEffect, useRef } from 'react'
import { MessageSquare, UploadCloud, Download, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import Toast from '../common/Toast'
import * as XLSX from 'xlsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

interface CannedResponse {
  $id: string
  shortcut: string
  category?: string
  content: string
  $createdAt?: string
  createdAt?: string
}

interface CannedResponsesModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * CannedResponsesModal - Modal for managing canned responses
 * Similar structure to GlobalSettingsModal
 */
export default function CannedResponsesModal({ isOpen, onClose }: CannedResponsesModalProps) {
  const { token } = useAuth()
  const [responses, setResponses] = useState<CannedResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(null)
  const [formData, setFormData] = useState({
    shortcut: '',
    category: '',
    content: ''
  })
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch responses when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchResponses()
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (showModal) {
          setShowModal(false)
          setFormData({ shortcut: '', category: '', content: '' })
          setEditingResponse(null)
        } else {
          onClose()
        }
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, showModal, onClose])

  const fetchResponses = async () => {
    try {
      setLoading(true)
      const authToken = token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
      const response = await fetch(`${API_BASE}/api/canned-responses`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch canned responses')
      }

      const data = await response.json()
      setResponses(data.responses || data.items || [])
    } catch (err: any) {
      console.error('Error fetching canned responses:', err)
      setToast({ message: err?.message || 'Failed to load canned responses', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleAddNew = () => {
    setEditingResponse(null)
    setFormData({ shortcut: '', category: '', content: '' })
    setShowModal(true)
  }

  const handleEdit = (response: CannedResponse) => {
    setEditingResponse(response)
    setFormData({
      shortcut: response.shortcut,
      category: response.category || '',
      content: response.content
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this canned response?')) {
      return
    }

    try {
      const authToken = token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
      const response = await fetch(`${API_BASE}/api/canned-responses/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete canned response')
      }

      setToast({ message: 'Canned response deleted successfully', type: 'success' })
      await fetchResponses()
    } catch (err: any) {
      console.error('Error deleting canned response:', err)
      setToast({ message: err?.message || 'Failed to delete canned response', type: 'error' })
    }
  }

  const handleShortcutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/\s+/g, '')
    setFormData({ ...formData, shortcut: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.shortcut.trim()) {
      setToast({ message: 'Shortcut is required', type: 'error' })
      return
    }

    setSaving(true)
    try {
      const authToken = token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
      const url = editingResponse
        ? `${API_BASE}/api/canned-responses/${editingResponse.$id}`
        : `${API_BASE}/api/canned-responses`

      const method = editingResponse ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shortcut: formData.shortcut.trim(),
          category: formData.category.trim() || undefined,
          content: formData.content.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to save canned response'
        
        // Handle duplicate shortcut error
        if (errorMessage.toLowerCase().includes('duplicate') || errorMessage.toLowerCase().includes('already exists')) {
          setToast({ message: 'Shortcut already exists', type: 'error' })
        } else {
          throw new Error(errorMessage)
        }
        return
      }

      setToast({
        message: editingResponse ? 'Canned response updated successfully' : 'Canned response created successfully',
        type: 'success'
      })
      setShowModal(false)
      setFormData({ shortcut: '', category: '', content: '' })
      setEditingResponse(null)
      await fetchResponses()
    } catch (err: any) {
      console.error('Error saving canned response:', err)
      setToast({ message: err?.message || 'Failed to save canned response', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const truncateContent = (content: string, maxLength: number = 50) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  const handleImportExcel = () => {
    fileInputRef.current?.click()
  }

  const handleDownloadSample = () => {
    // Sample data with 3 diverse examples
    const sampleData = [
      {
        shortcut: 'greet',
        content: 'Hello! How can I assist you today?',
        category: 'General'
      },
      {
        shortcut: 'reset_password',
        content: 'Go to Settings > Security to reset your password. Click "Forgot Password" and follow the instructions sent to your email.',
        category: 'Technical'
      },
      {
        shortcut: 'bye',
        content: 'Thank you for contacting support! Have a great day!',
        category: 'Closing'
      }
    ]

    // Create a new workbook
    const workbook = XLSX.utils.book_new()
    
    // Convert JSON to worksheet
    const worksheet = XLSX.utils.json_to_sheet(sampleData)
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Canned Responses')
    
    // Download the file
    XLSX.writeFile(workbook, 'canned_responses_template.xlsx')
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setToast({ message: 'Processing Excel file...', type: 'success' })

    try {
      // Read Excel file
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<{
        shortcut?: string
        content?: string
        category?: string
      }>

      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        throw new Error('Excel file is empty or invalid format')
      }

      let addedCount = 0
      let skippedCount = 0
      const errors: string[] = []

      const authToken = token || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')

      // Process each row
      for (const row of jsonData) {
        try {
          // Validate required fields
          if (!row.shortcut || !row.content) {
            skippedCount++
            errors.push(`Row skipped: missing shortcut or content`)
            continue
          }

          // Sanitize shortcut: lowercase and remove spaces
          const sanitizedShortcut = row.shortcut.toString().toLowerCase().replace(/\s+/g, '')

          if (!sanitizedShortcut) {
            skippedCount++
            errors.push(`Row skipped: shortcut is empty after sanitization`)
            continue
          }

          // Create document via API
          try {
            const response = await fetch(`${API_BASE}/api/canned-responses`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                shortcut: sanitizedShortcut,
                category: row.category?.toString().trim() || undefined,
                content: row.content.toString().trim()
              })
            })

            if (response.ok) {
              addedCount++
            } else {
              const errorData = await response.json().catch(() => ({}))
              const errorMsg = errorData.error || `HTTP ${response.status}`
              
              // Check for duplicate shortcut (409 or error message contains duplicate/already exists)
              if (response.status === 409 || 
                  errorMsg.toLowerCase().includes('duplicate') || 
                  errorMsg.toLowerCase().includes('already exists')) {
                skippedCount++
              } else {
                errors.push(`Failed to import "${sanitizedShortcut}": ${errorMsg}`)
              }
            }
          } catch (createErr: any) {
            errors.push(`Error creating "${sanitizedShortcut}": ${createErr.message}`)
          }
        } catch (rowErr: any) {
          errors.push(`Row error: ${rowErr.message}`)
        }
      }

      // Refresh the list
      await fetchResponses()

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Show completion toast
      const successMsg = `Import complete: ${addedCount} added, ${skippedCount} duplicates skipped.`
      if (errors.length > 0) {
        console.warn('Import errors:', errors)
        setToast({ 
          message: `${successMsg} ${errors.length} errors occurred (check console)`, 
          type: 'error' 
        })
      } else {
        setToast({ message: successMsg, type: 'success' })
      }
    } catch (err: any) {
      console.error('Error importing Excel:', err)
      setToast({ 
        message: err?.message || 'Failed to import Excel file. Please check the format.', 
        type: 'error' 
      })
    } finally {
      setImporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-[10001]">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      <div 
        className="fixed inset-0 z-[10000] overflow-y-auto" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop - below profile menu, no blur (profile menu backdrop already provides blur) */}
        <div className="fixed inset-0 bg-black/50 z-[10000]" />

        {/* Modal Container - above profile menu */}
        <div className="flex items-center justify-center min-h-screen p-4 relative z-[10002]">
          <div
            ref={modalRef}
            className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Canned Responses</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Manage quick response templates</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddNew}
                  className="px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                  disabled={importing}
                >
                  Add New
                </button>
                <div className="relative">
                  <button
                    onClick={handleImportExcel}
                    disabled={importing}
                    className="px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    title="Import canned responses from Excel file"
                  >
                    <UploadCloud className="w-4 h-4" />
                    {importing ? 'Importing...' : 'Import Excel'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Close"
                  disabled={importing}
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400 dark:hover:text-gray-200" />
                </button>
              </div>
            </div>

            {/* User Guidance */}
            <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Excel Import Format:</strong> Columns must be: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">shortcut</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">content</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">category</code> (category is optional)
                </p>
                <button
                  onClick={handleDownloadSample}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer font-medium flex items-center gap-1 ml-4 whitespace-nowrap"
                  title="Download Excel template with sample data"
                >
                  <Download className="w-4 h-4" />
                  Download Sample Template
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-300">Loading canned responses...</span>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Shortcut
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Content Preview
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {responses.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                            No canned responses found. Click "Add New" to create one.
                          </td>
                        </tr>
                      ) : (
                        responses.map((response) => (
                          <tr key={response.$id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                /{response.shortcut}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {response.category ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                  {response.category}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600 dark:text-gray-300">
                                {truncateContent(response.content)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => handleEdit(response)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-4"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(response.$id)}
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10002]">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              {editingResponse ? 'Edit Canned Response' : 'Add New Canned Response'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Shortcut *
                  </label>
                  <div className="flex items-center">
                    <span className="text-gray-500 dark:text-gray-400 mr-2">/</span>
                    <input
                      type="text"
                      value={formData.shortcut}
                      onChange={handleShortcutChange}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      placeholder="greet"
                      required
                      disabled={saving}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Lowercase letters only, no spaces
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="e.g., Greeting, FAQ, Troubleshooting"
                    disabled={saving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Content *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => {
                      if (e.target.value.length <= 5000) {
                        setFormData({ ...formData, content: e.target.value })
                      }
                    }}
                    rows={5}
                    maxLength={5000}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="Enter the response content..."
                    required
                    disabled={saving}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formData.content.length} / 5000 characters
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setFormData({ shortcut: '', category: '', content: '' })
                    setEditingResponse(null)
                  }}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : editingResponse ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
