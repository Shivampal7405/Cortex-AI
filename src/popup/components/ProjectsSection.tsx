/**
 * ProjectsSection.tsx
 * Project profiles UI in the memory tab.
 * Add, edit, delete project profiles.
 * Profiles are injected alongside facts as context.
 */

import React, { useEffect, useState } from 'react'
import type { ProjectProfile } from '../../memory/memory.types'
import { getAllProjects, saveProject, deleteProject } from '../../memory/memory.store'

function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function ProjectsSection(): React.ReactElement {
  const [projects,   setProjects]   = useState<ProjectProfile[]>([])
  const [showForm,   setShowForm]   = useState(false)
  const [formName,   setFormName]   = useState('')
  const [formDesc,   setFormDesc]   = useState('')
  const [formStack,  setFormStack]  = useState('')
  const [formStatus, setFormStatus] = useState('')
  const [formNotes,  setFormNotes]  = useState('')

  // Popup has direct chrome.storage.local access — no need to route
  // pure storage ops through the background service worker
  const loadProjects = () => {
    getAllProjects().then(setProjects).catch(() => {})
  }

  useEffect(() => { loadProjects() }, [])

  const handleSave = async () => {
    if (!formName.trim()) return

    const project: ProjectProfile = {
      id:          generateId(),
      name:        formName.trim(),
      description: formDesc.trim(),
      stack:       formStack.split(',').map(s => s.trim()).filter(Boolean),
      status:      formStatus.trim(),
      goals:       [],
      notes:       formNotes.trim(),
      created_at:  Date.now(),
      updated_at:  Date.now(),
    }

    await saveProject(project)
    loadProjects()
    setShowForm(false)
    setFormName(''); setFormDesc(''); setFormStack('')
    setFormStatus(''); setFormNotes('')
  }

  const handleDelete = async (id: string) => {
    await deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  const inputStyle: React.CSSProperties = {
    fontSize: '12px', padding: '4px 8px', borderRadius: '4px',
    border: '1px solid rgba(124,58,237,0.2)', backgroundColor: 'rgba(124,58,237,0.04)',
    color: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Projects
        </span>
        <button
          onClick={() => setShowForm(s => !s)}
          className="text-xs px-2 py-0.5 rounded border text-purple-600 border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20"
        >
          + Add
        </button>
      </div>

      {showForm && (
        <div className="mb-3 p-2.5 rounded-lg border border-purple-300/30 flex flex-col gap-2">
          {([
            [formName,   setFormName,   'Project name *'],
            [formDesc,   setFormDesc,   'Description'],
            [formStack,  setFormStack,  'Stack (comma-separated)'],
            [formStatus, setFormStatus, 'Status'],
            [formNotes,  setFormNotes,  'Notes'],
          ] as [string, React.Dispatch<React.SetStateAction<string>>, string][]).map(
            ([val, set, ph]) => (
              <input
                key={ph}
                value={val}
                onChange={e => set(e.target.value)}
                placeholder={ph}
                style={inputStyle}
              />
            )
          )}
          <button
            onClick={handleSave}
            className="py-1 rounded text-white text-xs font-semibold"
            style={{ backgroundColor: '#7C3AED' }}
          >
            Save project
          </button>
        </div>
      )}

      {projects.map(project => (
        <div
          key={project.id}
          className="mb-2 p-2.5 rounded-lg border border-purple-300/30 text-sm"
        >
          <div className="flex justify-between items-start mb-1">
            <span className="font-semibold">{project.name}</span>
            <button
              onClick={() => handleDelete(project.id)}
              className="text-red-400 hover:text-red-600 text-xs ml-2"
            >
              🗑
            </button>
          </div>
          {project.description && (
            <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">
              {project.description}
            </div>
          )}
          {project.stack.length > 0 && (
            <div className="text-gray-400 text-xs">{project.stack.join(' · ')}</div>
          )}
          {project.status && (
            <div className="text-green-600 dark:text-green-500 text-xs mt-1">
              {project.status}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
