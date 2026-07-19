import React, { useEffect } from 'react'
import useStore from './store/useStore'
import Sidebar from './components/Sidebar'
import AgentView from './views/AgentView'
import AuditView from './views/AuditView'
import TokenView from './views/TokenView'
import SettingsView from './views/SettingsView'

export default function App() {
  const { activeView, addAgent, updateAgentStatus, appendOutput } = useStore()

  useEffect(() => {
    // Listen to agent events from main process
    window.cpi.onAgentOutput((data) => {
      appendOutput(data.agentId, data.text)
    })
    window.cpi.onAgentStatus((data) => {
      if (data.status === 'running') {
        addAgent({ agentId: data.agentId, ...data.meta, status: 'running' })
      } else {
        updateAgentStatus(data.agentId, data.status, { tokenSummary: data.tokenSummary })
      }
    })
    return () => {
      window.cpi.offAgentOutput()
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
      </main>
    </div>
  )
}
