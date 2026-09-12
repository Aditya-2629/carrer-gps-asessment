import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Plus,
  Trash,
  FloppyDisk,
  ArrowCounterClockwise,
  Eye,
  CheckCircle,
  WarningCircle,
  Sparkle,
  Code,
  ListBullets,
  PencilSimple,
  UploadSimple,
  FilePdf,
  FileDoc,
  FileText,
  MagnifyingGlass,
  ToggleLeft,
  ToggleRight,
  Lightning,
  X,
  FileCode,
  Cpu,
} from '@phosphor-icons/react'
import axios from 'axios'

// API base URL helper
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function KnowledgeBaseManager() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [activeTab, setActiveTab] = useState('rag_documents') // 'rag_documents' | 'sections' | 'markdown' | 'rag_test'
  
  // Baseline KB data states
  const [rawContent, setRawContent] = useState('')
  const [sections, setSections] = useState([])
  const [isDefault, setIsDefault] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // RAG Document states
  const [documents, setDocuments] = useState([])
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [selectedDocDetail, setSelectedDocDetail] = useState(null)
  const fileInputRef = useRef(null)

  // RAG Test Workbench states
  const [ragQuery, setRagQuery] = useState('')
  const [ragSearching, setRagSearching] = useState(false)
  const [ragResults, setRagResults] = useState(null)

  // Modals
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  // Status message state
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' })

  // Fetch Knowledge Base & RAG Documents on mount
  useEffect(() => {
    fetchKnowledgeBase()
    fetchRAGDocuments()
  }, [])

  const fetchKnowledgeBase = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/knowledge-base`)
      if (res.data && res.data.success) {
        setRawContent(res.data.content || '')
        setSections(res.data.sections || [])
        setIsDefault(res.data.isDefault)
        setHasUnsavedChanges(false)
      }
    } catch (err) {
      console.error('Failed to load Knowledge Base:', err)
      setStatusMessage({
        type: 'error',
        text: 'Failed to connect to backend server. Operating in offline preview mode.',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchRAGDocuments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/knowledge-base/documents`)
      if (res.data && res.data.success) {
        setDocuments(res.data.documents || [])
      }
    } catch (err) {
      console.error('Failed to fetch RAG documents:', err)
    }
  }

  // Handle uploading RAG Document (PDF, DOCX, TXT, MD)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['pdf', 'docx', 'doc', 'txt', 'md']
    const ext = file.name.split('.').pop().toLowerCase()
    if (!allowed.includes(ext)) {
      setStatusMessage({
        type: 'error',
        text: `Invalid file format .${ext}. Please upload PDF, DOCX, TXT, or MD documents.`,
      })
      return
    }

    setUploadingDoc(true)
    setStatusMessage({ type: '', text: '' })
    const formData = new FormData()
    formData.append('document', file)

    try {
      const res = await axios.post(`${API_BASE}/knowledge-base/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (res.status === 200) {
        setStatusMessage({
          type: 'success',
          text: res.data.message || `Uploaded and chunked document "${file.name}" successfully!`,
        })
        fetchRAGDocuments()
      }
    } catch (err) {
      console.error('Document upload error:', err)
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to process and ingest document into RAG engine.',
      })
    } finally {
      setUploadingDoc(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Toggle RAG document active state
  const handleToggleDoc = async (id) => {
    try {
      const res = await axios.patch(`${API_BASE}/knowledge-base/documents/${id}/toggle`)
      if (res.status === 200) {
        setDocuments((prev) =>
          prev.map((d) => (d._id === id ? { ...d, isActive: res.data.isActive } : d))
        )
      }
    } catch (err) {
      console.error('Failed to toggle document:', err)
    }
  }

  // Delete RAG document
  const handleDeleteDoc = async (id, title) => {
    if (!window.confirm(`Delete document "${title}" from RAG Knowledge Base?`)) return

    try {
      await axios.delete(`${API_BASE}/knowledge-base/documents/${id}`)
      setDocuments((prev) => prev.filter((d) => d._id !== id))
      setStatusMessage({ type: 'success', text: `Deleted "${title}" from RAG engine.` })
    } catch (err) {
      console.error('Failed to delete document:', err)
    }
  }

  // View full document raw text detail modal
  const handleViewDocDetail = async (id) => {
    try {
      const res = await axios.get(`${API_BASE}/knowledge-base/documents/${id}`)
      if (res.data && res.data.success) {
        setSelectedDocDetail(res.data.document)
      }
    } catch (err) {
      console.error('Failed to load document text detail:', err)
    }
  }

  // Run RAG Semantic Test Search Query
  const handleRunRAGTest = async (e) => {
    e.preventDefault()
    if (!ragQuery.trim()) return

    setRagSearching(true)
    setRagResults(null)
    try {
      const res = await axios.post(`${API_BASE}/knowledge-base/rag-test`, {
        queryText: ragQuery,
        topK: 4,
      })

      if (res.data && res.data.success) {
        setRagResults(res.data)
      }
    } catch (err) {
      console.error('RAG test failed:', err)
      setStatusMessage({ type: 'error', text: 'RAG search query test failed.' })
    } finally {
      setRagSearching(false)
    }
  }

  // Handle saving baseline Knowledge Base
  const handleSave = async () => {
    setSaving(true)
    setStatusMessage({ type: '', text: '' })
    try {
      let payloadContent = rawContent
      if (activeTab === 'sections') {
        payloadContent = `### CAREER GPS EXTERNAL KNOWLEDGE BASE (STRICT FACTS)\nUse the following facts to base your analysis and recommendations. Do not contradict this data.\n\n`
        sections.forEach((sec) => {
          if (sec.title) {
            payloadContent += `#### ${sec.title.toUpperCase()}\n`
            sec.points.forEach((pt) => {
              if (pt.trim()) {
                payloadContent += `- ${pt.trim()}\n`
              }
            })
            payloadContent += `\n`
          }
        })
      }

      const res = await axios.post(`${API_BASE}/knowledge-base`, {
        content: payloadContent,
        sections: sections,
        updatedBy: 'Admin (RAG Route)',
      })

      if (res.status === 200) {
        setRawContent(res.data.content)
        setSections(res.data.sections || sections)
        setIsDefault(res.data.isDefault)
        setHasUnsavedChanges(false)
        setStatusMessage({
          type: 'success',
          text: 'Baseline Knowledge Base saved successfully! AI reports will use these facts.',
        })
      }
    } catch (err) {
      console.error('Save failed:', err)
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save Knowledge Base.',
      })
    } finally {
      setSaving(false)
    }
  }

  // Handle reset baseline
  const handleReset = async () => {
    if (!window.confirm('Reset baseline Knowledge Base to default facts?')) return
    setResetting(true)
    try {
      const res = await axios.post(`${API_BASE}/knowledge-base/reset`)
      if (res.status === 200) {
        setRawContent(res.data.content)
        setSections(res.data.sections || [])
        setIsDefault(true)
        setHasUnsavedChanges(false)
        setStatusMessage({ type: 'success', text: 'Knowledge Base reset to default.' })
      }
    } catch (err) {
      console.error('Reset failed:', err)
    } finally {
      setResetting(false)
    }
  }

  // File type icon badge helper
  const renderFileIcon = (fileType) => {
    switch (fileType) {
      case 'pdf':
        return <FilePdf size={22} className="text-rose-400" />
      case 'docx':
      case 'doc':
        return <FileDoc size={22} className="text-sky-400" />
      case 'txt':
        return <FileText size={22} className="text-emerald-400" />
      case 'md':
        return <FileCode size={22} className="text-amber-400" />
      default:
        return <FileText size={22} className="text-slate-400" />
    }
  }

  // Format bytes
  const formatBytes = (bytes) => {
    if (!bytes) return '0 KB'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      {/* Ambient background glows */}
      <div className="fixed top-0 right-1/3 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-0 left-1/4 w-[600px] h-[600px] bg-teal-500/5 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Header Bar */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <Cpu size={32} weight="duotone" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight text-white">
                    AI Knowledge Base & RAG Engine
                  </h1>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Vector RAG Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload PDF, DOCX, TXT, and Markdown documents to build a dynamic vector knowledge retrieval system.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {hasUnsavedChanges ? (
                <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full animate-pulse">
                  <WarningCircle size={14} /> Unsaved Baseline
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  <CheckCircle size={14} /> Synced with AI Engine
                </span>
              )}
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 flex-wrap">
              <button
                onClick={() => setActiveTab('rag_documents')}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'rag_documents'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen size={16} /> RAG Documents ({documents.length})
              </button>

              <button
                onClick={() => setActiveTab('rag_test')}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'rag_test'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Lightning size={16} /> Vector Search Workbench
              </button>

              <button
                onClick={() => setActiveTab('sections')}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'sections'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListBullets size={16} /> Baseline Section Cards
              </button>

              <button
                onClick={() => setActiveTab('markdown')}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'markdown'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code size={16} /> Raw Markdown
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreviewModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
              >
                <Eye size={16} /> AI Prompt Preview
              </button>

              {(activeTab === 'sections' || activeTab === 'markdown') && (
                <>
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all disabled:opacity-50"
                  >
                    <ArrowCounterClockwise size={16} /> Reset Default
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <FloppyDisk size={16} weight="bold" /> Save Baseline
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status / Alert Banner */}
        <AnimatePresence>
          {statusMessage.text && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
                statusMessage.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.type === 'error' ? (
                  <WarningCircle size={18} />
                ) : (
                  <CheckCircle size={18} />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button
                onClick={() => setStatusMessage({ type: '', text: '' })}
                className="hover:underline opacity-80"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN CONTENT TAB VIEWS */}
        {activeTab === 'rag_documents' && (
          <div className="space-y-6">
            {/* RAG File Upload Hub Dropzone */}
            <div className="bg-slate-900/60 border border-dashed border-slate-700 hover:border-emerald-500/50 rounded-2xl p-6 transition-all text-center space-y-4 shadow-xl">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
                <UploadSimple size={30} weight="bold" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Upload Knowledge Base Documents
                </h3>
                <p className="text-xs text-slate-400">
                  Supported Formats: <span className="text-rose-400 font-medium">PDF (.pdf)</span>,{' '}
                  <span className="text-sky-400 font-medium">Word (.docx, .doc)</span>,{' '}
                  <span className="text-emerald-400 font-medium">Text (.txt)</span>,{' '}
                  <span className="text-amber-400 font-medium">Markdown (.md)</span>
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingDoc}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all transform active:scale-95 disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  <Plus size={16} weight="bold" />
                  {uploadingDoc ? 'Extracting & Ingesting Chunks...' : 'Select Document File'}
                </button>
              </div>
            </div>

            {/* RAG Documents Library Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <BookOpen size={18} className="text-emerald-400" />
                  Ingested Knowledge Base Documents ({documents.length})
                </h2>
                <span className="text-[11px] text-slate-400 font-mono">
                  Vector Chunks Active: {documents.reduce((acc, d) => acc + (d.isActive ? d.chunkCount : 0), 0)}
                </span>
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs space-y-1">
                  <FileText size={36} className="mx-auto text-slate-600 opacity-40" />
                  <p>No documents uploaded yet. Upload a PDF, DOCX, TXT, or MD file above.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {documents.map((doc) => (
                    <div
                      key={doc._id}
                      className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/20 px-2 rounded-xl transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                          {renderFileIcon(doc.fileType)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white hover:text-emerald-400 transition-colors cursor-pointer" onClick={() => handleViewDocDetail(doc._id)}>
                              {doc.title}
                            </h4>
                            <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {doc.fileType}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
                            <span>{doc.filename}</span>
                            <span>•</span>
                            <span>{formatBytes(doc.originalSize)}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-semibold">{doc.chunkCount} vector chunks</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-auto">
                        <button
                          onClick={() => handleToggleDoc(doc._id)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                            doc.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-500 border-slate-700'
                          }`}
                        >
                          {doc.isActive ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} />}
                          {doc.isActive ? 'Active in RAG' : 'Disabled'}
                        </button>

                        <button
                          onClick={() => handleViewDocDetail(doc._id)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                          title="View Extracted Text"
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          onClick={() => handleDeleteDoc(doc._id, doc.title)}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all"
                          title="Delete Document"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VECTOR SEARCH TEST WORKBENCH TAB */}
        {activeTab === 'rag_test' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Lightning size={20} className="text-amber-400" />
                  RAG Vector Semantic Search Workbench
                </h2>
                <p className="text-xs text-slate-400">
                  Type any candidate query, visa condition, or ATS scenario to test semantic vector retrieval against uploaded Knowledge Base documents.
                </p>
              </div>

              <form onSubmit={handleRunRAGTest} className="flex gap-3">
                <div className="relative flex-1">
                  <MagnifyingGlass size={18} className="absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                    placeholder="e.g. STEM OPT visa job authorization rules or ATS resume formatting standards..."
                    className="w-full bg-[#05080E] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={ragSearching || !ragQuery.trim()}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  {ragSearching ? 'Searching Vectors...' : 'Execute RAG Search'}
                </button>
              </form>

              {ragResults && (
                <div className="pt-4 border-t border-slate-800 space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Retrieved <strong className="text-emerald-400">{ragResults.resultCount}</strong> relevant chunks in{' '}
                      <strong className="text-emerald-400">{ragResults.durationMs}ms</strong>
                    </span>
                    <span className="font-mono text-[11px]">Hybrid Scoring: Vector (65%) + Keyword (35%)</span>
                  </div>

                  {ragResults.resultCount === 0 ? (
                    <div className="text-center py-8 text-slate-500 space-y-2">
                      <MagnifyingGlass size={32} className="mx-auto opacity-40" />
                      <p className="text-xs">No matching chunks found. Try different search terms or upload more documents.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {ragResults.retrievedChunks.map((chunk, idx) => (
                        <div
                          key={idx}
                          className="bg-[#05080E] border border-slate-800/80 rounded-xl p-4 space-y-3 hover:border-emerald-500/40 transition-all"
                        >
                          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                              <BookOpen size={14} /> {chunk.documentTitle} — Chunk #{chunk.chunkIndex + 1}
                            </span>
                            <div className="flex items-center gap-2">
                              {chunk.vectorScore !== undefined && (
                                <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-mono text-[10px]">
                                  Vector: {chunk.vectorScore}%
                                </span>
                              )}
                              {chunk.keywordScore !== undefined && (
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[10px]">
                                  Keyword: {chunk.keywordScore}%
                                </span>
                              )}
                              <span className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold ${
                                chunk.score >= 60 ? 'bg-emerald-500/15 text-emerald-400' :
                                chunk.score >= 30 ? 'bg-amber-500/15 text-amber-400' :
                                'bg-slate-700/50 text-slate-300'
                              }`}>
                                Hybrid: {chunk.score}%
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/40 p-3 rounded-lg border border-slate-800/40">
                            {chunk.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BASELINE SECTION CARDS TAB */}
        {activeTab === 'sections' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Baseline Facts Categories ({sections.length})
              </h2>
              <button
                onClick={() => {
                  setSections([...sections, { title: 'NEW CATEGORY', points: ['Fact rule...'] }])
                  setHasUnsavedChanges(true)
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg"
              >
                <Plus size={14} /> Add Category
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {sections.map((sec, sIdx) => (
                <div
                  key={sIdx}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => {
                        const copy = [...sections]
                        copy[sIdx].title = e.target.value
                        setSections(copy)
                        setHasUnsavedChanges(true)
                      }}
                      className="bg-transparent text-sm font-bold text-white border-b border-transparent focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const copy = [...sections]
                        copy.splice(sIdx, 1)
                        setSections(copy)
                        setHasUnsavedChanges(true)
                      }}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      <Trash size={16} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {sec.points.map((pt, pIdx) => (
                      <div key={pIdx} className="flex items-start gap-2 bg-slate-950/40 p-2 rounded-xl border border-slate-800">
                        <span className="text-emerald-400 font-bold">•</span>
                        <textarea
                          rows={2}
                          value={pt}
                          onChange={(e) => {
                            const copy = [...sections]
                            copy[sIdx].points[pIdx] = e.target.value
                            setSections(copy)
                            setHasUnsavedChanges(true)
                          }}
                          className="flex-1 bg-transparent text-xs text-slate-200 focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            const copy = [...sections]
                            copy[sIdx].points.splice(pIdx, 1)
                            setSections(copy)
                            setHasUnsavedChanges(true)
                          }}
                          className="text-slate-600 hover:text-rose-400"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      const copy = [...sections]
                      copy[sIdx].points.push('New fact directive...')
                      setSections(copy)
                      setHasUnsavedChanges(true)
                    }}
                    className="text-[11px] font-medium text-emerald-400 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Fact Point
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RAW MARKDOWN TAB */}
        {activeTab === 'markdown' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <textarea
              value={rawContent}
              onChange={(e) => {
                setRawContent(e.target.value)
                setHasUnsavedChanges(true)
              }}
              rows={22}
              className="w-full bg-[#05080E] font-mono text-xs text-emerald-300 leading-relaxed p-4 rounded-xl border border-slate-800 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* VIEW EXTRACTED DOCUMENT TEXT MODAL */}
      <AnimatePresence>
        {selectedDocDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl"
            >
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderFileIcon(selectedDocDetail.fileType)}
                  <h3 className="text-sm font-bold text-white">
                    Extracted Text: {selectedDocDetail.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDocDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto font-mono text-xs text-slate-300 space-y-3 bg-[#05080E] flex-1">
                <div className="text-[11px] text-emerald-400 font-sans">
                  Total Vector Chunks: <strong>{selectedDocDetail.chunkCount}</strong>
                </div>
                <pre className="whitespace-pre-wrap leading-relaxed text-slate-300">
                  {selectedDocDetail.rawText}
                </pre>
              </div>

              <div className="p-4 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setSelectedDocDetail(null)}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-500 text-slate-950 rounded-xl"
                >
                  Close View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI PROMPT PREVIEW MODAL */}
      <AnimatePresence>
        {showPreviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl"
            >
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkle size={20} className="text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Compiled Gemini RAG Prompt Format
                  </h3>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="text-slate-400 hover:text-white text-xs px-2.5 py-1 bg-slate-800 rounded-lg"
                >
                  Close
                </button>
              </div>

              <div className="p-5 overflow-y-auto font-mono text-xs text-slate-300 space-y-4 bg-[#05080E] flex-1">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[11px]">
                  <strong>System RAG Architecture:</strong> When candidate reports are generated, the baseline facts below AND the top semantically retrieved document chunks from your uploaded PDF/DOCX/TXT/MD files are combined and fed directly to Gemini 3.6 Flash model.
                </div>

                <pre className="whitespace-pre-wrap leading-relaxed text-slate-300">
{`### KNOWLEDGE BASE INSTRUCTIONS (HIGHEST PRIORITY):
${rawContent}

#### RETRIEVED RAG KNOWLEDGE BASE DOCUMENTS (DYNAMICALLY SEARCHED MATCHES):
[Document: U.S. Tech Visa Market Guide 2026.pdf | Relevance: 94%]
- Stem OPT candidates must explicitly state work authorization duration on resume header...

---
[User Assessment Data & Uploaded Candidate Resume JSON follow here]`
}
                </pre>
              </div>

              <div className="p-4 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-500 text-slate-950 rounded-xl"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
