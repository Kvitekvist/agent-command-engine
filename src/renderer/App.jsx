import React, { useEffect } from 'react'
import useStore from './store/useStore'
import Sidebar from './components/Sidebar'
import AgentView from './views/AgentView'
import AuditView from './views/AuditView'
import TokenView from './views/TokenView'
import SettingsView from './views/SettingsView'
import EditorView from './views/EditorView'

export default function App() {
  const { activeView, addAgent, updateAgentStatus } = useStore()

  useEffect(() => {
    window.cpi.onAgentStatus((data) => {
      if (data.status === 'running') {
        addAgent({ agentId: data.agentId, ...data.meta, status: 'running' })
      } else {
        updateAgentStatus(data.agentId, data.status, { tokenSummary: data.tokenSummary })
      }
    })
    return () => {
      window.cpi.offAgentStatus()
    }
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface text-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {activeView === 'agents'   && <AgentView />}
        {activeView === 'audit'    && <AuditView />}
        {activeView === 'tokens'   && <TokenView />}
        {activeView === 'settings' && <SettingsView />}
        {activeView === 'editor'   && <EditorView />}
      </main>
    </div>
  )
}
