import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { MessageSquareText, Mic } from 'lucide-react'
import { useAuth } from '../hooks/useAuthSession'
import TextMessagesPanel from '../components/TextMessagesPanel'
import VoiceMessagesPanel from '../components/VoiceMessagesPanel'
import './EncryptedMessagesPage.css'

const TAB_ICON = {
  teks: MessageSquareText,
  suara: Mic,
}

export default function EncryptedMessagesPage() {
  const { user, token, isLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const isAdmin = user?.role === 'admin'
  const tabs = isAdmin
    ? [
        { id: 'teks', label: 'Pesan Teks' },
        { id: 'suara', label: 'Pesan Suara' },
      ]
    : [{ id: 'teks', label: 'Pesan Teks' }]

  const requestedTab = searchParams.get('tab')
  const activeTab = tabs.some(tab => tab.id === requestedTab)
    ? requestedTab
    : 'teks'

  /* Samakan URL bila ?tab berisi nilai yang tidak dikenal / tidak diizinkan.
     Tunggu pemuatan sesi agar ?tab=suara tidak langsung ditimpa saat reload. */
  useEffect(() => {
    if (isLoading) return

    if (requestedTab !== null && requestedTab !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true })
    }
  }, [isLoading, requestedTab, activeTab, setSearchParams])

  function selectTab(tabId) {
    setSearchParams({ tab: tabId }, { replace: true })
  }

  function handleTabKeyDown(event) {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab)
    let nextIndex = null

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1
    }

    if (nextIndex === null) return

    event.preventDefault()
    selectTab(tabs[nextIndex].id)
    document.getElementById(`tab-${tabs[nextIndex].id}`)?.focus()
  }

  if (isLoading) {
    return (
      <div className="dash-shell">
        <main className="encrypted-page">
          <p className="encrypted-loading">Memuat sesi…</p>
        </main>
      </div>
    )
  }

  if (!token) return <Navigate to="/masuk" replace />

  return (
    <div className="dash-shell">
      <main className="encrypted-page">
        <header className="encrypted-heading">
          <h1>Pesan Terenkripsi</h1>
          <p>
            {isAdmin
              ? 'Kirim pesan teks terenkripsi, atau rekam dan terima pesan suara antaradministrator.'
              : 'Kirim dan simpan pesan menggunakan enkripsi authenticated encryption.'}
          </p>
        </header>

        <div
          className="encrypted-tabs"
          role="tablist"
          aria-label="Jenis pesan terenkripsi"
          onKeyDown={handleTabKeyDown}
        >
          {tabs.map(tab => {
            const Icon = TAB_ICON[tab.id]
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                type="button"
                role="tab"
                className="encrypted-tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectTab(tab.id)}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div
          id="panel-teks"
          role="tabpanel"
          aria-labelledby="tab-teks"
          hidden={activeTab !== 'teks'}
        >
          <TextMessagesPanel />
        </div>

        {isAdmin && (
          <div
            id="panel-suara"
            role="tabpanel"
            aria-labelledby="tab-suara"
            hidden={activeTab !== 'suara'}
          >
            <VoiceMessagesPanel />
          </div>
        )}
      </main>
    </div>
  )
}
