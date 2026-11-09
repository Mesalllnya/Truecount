import { useState, useEffect, useCallback } from 'react'

const API = 'http://localhost:8000'

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

/* ── Modal Manajemen Kandidat / Paslon (Admin) ───────────── */
export function CandidatesModal({ election, onClose, onRefreshElection }) {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  // Form tambah kandidat
  const [name, setName]         = useState('')
  const [vision, setVision]     = useState('')
  const [mission, setMission]   = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Form edit kandidat
  const [editingCandidate, setEditingCandidate] = useState(null)
  const [editName, setEditName] = useState('')
  const [editVision, setEditVision] = useState('')
  const [editMission, setEditMission] = useState('')
  const [editPhotoFile, setEditPhotoFile] = useState(null)
  const [updating, setUpdating] = useState(false)

  const token = localStorage.getItem('tc_token')

  const loadCandidates = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/elections/${election.id}/candidates`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await readJson(res)
      if (!res.ok) { setError(data.error || 'Gagal memuat kandidat.'); return }
      setCandidates(data.candidates ?? [])
    } catch (err) {
      setError(err?.message || 'Gagal memuat kandidat.')
    } finally {
      setLoading(false)
    }
  }, [election.id, token])

  useEffect(() => { loadCandidates() }, [loadCandidates])

  async function handleAddCandidate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('vision', vision.trim())
      formData.append('mission', mission.trim())
      if (photoFile) {
        formData.append('photo', photoFile)
      }

      const res = await fetch(`${API}/elections/${election.id}/candidates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await readJson(res)
      if (!res.ok) { setError(data.error || 'Gagal menambahkan kandidat.'); return }

      setName('')
      setVision('')
      setMission('')
      setPhotoFile(null)
      loadCandidates()
      onRefreshElection()
    } catch (err) {
      setError(err?.message || 'Gagal menambahkan kandidat.')
    } finally {
      setSubmitting(false)
    }
  }

  // Membuka form edit kandidat
  function startEditCandidate(candidate) {
    setEditingCandidate(candidate)
    setEditName(candidate.name ?? '')
    setEditVision(candidate.vision ?? '')
    setEditMission(candidate.mission ?? '')
    setEditPhotoFile(null)
    setError('')
  }

// Membatalkan edit kandidat
  function cancelEditCandidate() {
    setEditingCandidate(null)
    setEditName('')
    setEditVision('')
    setEditMission('')
    setEditPhotoFile(null)
}

// Menyimpan perubahan kandidat
async function handleUpdateCandidate(e) {
  e.preventDefault()

  if (!editingCandidate) return

  if (!editName.trim()) {
    setError('Nama kandidat tidak boleh kosong.')
    return
  }

  setUpdating(true)
  setError('')

  try {
    const candidateId = editingCandidate.id

    // Update informasi kandidat
    const updateResponse = await fetch(
      `${API}/elections/${election.id}/candidates/${candidateId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName.trim(),
          vision: editVision.trim(),
          mission: editMission.trim(),
        }),
      }
    )

    const updateData = await readJson(updateResponse)

    if (!updateResponse.ok) {
      throw new Error(
        updateData.error || 'Gagal memperbarui kandidat.'
      )
    }

    // Upload foto baru jika dipilih
    if (editPhotoFile) {
      const formData = new FormData()
      formData.append('photo', editPhotoFile)

      const photoResponse = await fetch(
        `${API}/elections/${election.id}/candidates/${candidateId}/photo`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      )

      const photoData = await readJson(photoResponse)

      if (!photoResponse.ok) {
        throw new Error(
          photoData.error || 'Gagal mengganti foto kandidat.'
        )
      }
    }

    cancelEditCandidate()
    await loadCandidates()
    onRefreshElection()

  } catch (err) {
    setError(err?.message || 'Gagal memperbarui kandidat.')
  } finally {
    setUpdating(false)
  }
  }

  async function handleDeleteCandidate(cid, cname) {
    if (!window.confirm(`Hapus paslon "${cname}"?`)) return
    try {
      const res = await fetch(`${API}/elections/${election.id}/candidates/${cid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await readJson(res)
      if (!res.ok) { alert(data.error || 'Gagal menghapus kandidat.'); return }
      loadCandidates()
      onRefreshElection()
    } catch (err) {
      alert(err?.message || 'Gagal menghapus kandidat.')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Pasangan Calon: {election.title}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        <div className="modal-body">
          {error && <p className="invite-error" role="alert">{error}</p>}

          {/* Info jika pemilihan sudah dimulai / aktif atau selesai */}
          {election.status !== 'draft' ? (
            <div style={{
              background: '#fef9c3',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              padding: '0.85rem 1.1rem',
              color: '#854d0e',
              fontSize: '0.85rem',
              lineHeight: 1.5,
            }}>
              🔒 <strong>Pasangan Calon Terkunci:</strong> Pemilihan ini sudah dimulai (status:{' '}
              <strong>{election.status === 'active' ? 'Aktif / Berlangsung' : 'Selesai'}</strong>). Demi integritas dan keamanan pemilihan, tidak ada yang dapat menambah, mengubah, atau menghapus pasangan calon.
            </div>
          ) : (
            /* Form tambah kandidat hanya saat draft */
            <form onSubmit={handleAddCandidate} style={{ background: 'var(--cream)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>+ Tambah Pasangan Calon</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Nama Paslon *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Raka Pratama & Siti Nurhaliza"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Visi (singkat)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Transparansi & Inovasi Kampus"
                    value={vision}
                    onChange={e => setVision(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Foto Paslon (JPEG/PNG, maks 2MB)</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => setPhotoFile(e.target.files[0] || null)}
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Misi</label>
                  <textarea
                    rows={2}
                    placeholder="Poin-poin misi paslon..."
                    value={mission}
                    onChange={e => setMission(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="create-submit"
                  disabled={submitting}
                  style={{ fontSize: '0.82rem', padding: '0.45rem 1.1rem' }}
                >
                  {submitting ? 'Menyimpan…' : 'Simpan Paslon'}
                </button>
              </div>
            </form>
          )}

          {/* List kandidat */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Daftar Paslon Terdaftar ({candidates.length})
            </h3>
            {loading ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Memuat paslon…</p>
            ) : candidates.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Belum ada pasangan calon untuk pemilihan ini.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {candidates.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: 'var(--white)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', width: '20px' }}>
                          #{i + 1}
                        </span>

                        {c.photo_path ? (
                          <img
                            src={`${API}${c.photo_path}`}
                            alt={c.name}
                            style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border)' }}
                          />
                        ) : (
                          <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#f0f0ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                            👤
                          </div>
                        )}

                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.name}</div>
                          {c.vision && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{c.vision}</div>
                          )}
                          {c.mission && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Misi: {c.mission}</div>
                          )}
                        </div>
                      </div>

                      {election.status === 'draft' && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="create-submit"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                            onClick={() => startEditCandidate(c)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="revoke-btn"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                            onClick={() => handleDeleteCandidate(c.id, c.name)}
                            title="Hapus paslon"
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>

                    {editingCandidate?.id === c.id && (
                      <form
                        onSubmit={handleUpdateCandidate}
                        style={{ background: 'var(--cream)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)' }}
                      >
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                          Edit Pasangan Calon
                        </h4>

                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                          <div>
                            <label>Nama Paslon *</label>
                            <input
                              type="text"
                              required
                              maxLength={150}
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                            />
                          </div>

                          <div>
                            <label>Visi</label>
                            <input
                              type="text"
                              value={editVision}
                              onChange={e => setEditVision(e.target.value)}
                              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                            />
                          </div>

                          <div>
                            <label>Misi</label>
                            <textarea
                              rows={3}
                              value={editMission}
                              onChange={e => setEditMission(e.target.value)}
                              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: 'inherit' }}
                            />
                          </div>

                          <div>
                            <label>Ganti Foto</label>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={e => setEditPhotoFile(e.target.files?.[0] || null)}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                          <button
                            type="button"
                            className="revoke-btn"
                            disabled={updating}
                            onClick={cancelEditCandidate}
                          >
                            Batal
                          </button>

                          <button
                            type="submit"
                            className="create-submit"
                            disabled={updating}
                          >
                            {updating ? 'Menyimpan...' : 'Simpan Perubahan'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Modal Kelola Peserta Pemilih (Admin) ─────────────────── */
export function VotersModal({ election, onClose, onRefreshElection }) {
  const [electionVoters, setElectionVoters] = useState([])
  const [allVoterUsers, setAllVoterUsers]   = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [addingId, setAddingId]             = useState('')
  const [adding, setAdding]                 = useState(false)
  const [removingId, setRemovingId]         = useState(null)

  const token = localStorage.getItem('tc_token')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // 1. Ambil voter terdaftar di election ini
      const res1 = await fetch(`${API}/elections/${election.id}/voters`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data1 = await readJson(res1)
      if (!res1.ok) throw new Error(data1.error || 'Gagal memuat peserta.')
      setElectionVoters(data1.voters ?? [])

      // 2. Ambil semua voter aktif di sistem
      const res2 = await fetch(`${API}/users/voters`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data2 = await readJson(res2)
      if (res2.ok) {
        setAllVoterUsers(data2.users ?? [])
      }
    } catch (err) {
      setError(err?.message || 'Gagal memuat data.')
    } finally {
      setLoading(false)
    }
  }, [election.id, token])

  useEffect(() => { loadData() }, [loadData])

  // User yang belum terdaftar di election ini
  const enrolledUserIds = new Set(electionVoters.map(v => v.user_id))
  const availableUsers  = allVoterUsers.filter(u => !enrolledUserIds.has(u.id))

  async function handleAddVoter(e) {
    e.preventDefault()
    if (!addingId) return
    setAdding(true)
    setError('')
    try {
      const res = await fetch(`${API}/elections/${election.id}/voters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: Number(addingId) }),
      })
      const data = await readJson(res)
      if (!res.ok) { setError(data.error || 'Gagal mendaftarkan pemilih.'); return }
      setAddingId('')
      loadData()
      onRefreshElection()
    } catch (err) {
      setError(err?.message || 'Gagal mendaftarkan pemilih.')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemoveVoter(userId, username) {
    if (!window.confirm(`Keluarkan ${username} dari pemilihan ini?`)) return
    setRemovingId(userId)
    try {
      const res = await fetch(`${API}/elections/${election.id}/voters/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await readJson(res)
      if (!res.ok) { alert(data.error || 'Gagal mengeluarkan pemilih.'); return }
      loadData()
      onRefreshElection()
    } catch (err) {
      alert(err?.message || 'Gagal mengeluarkan pemilih.')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Peserta Pemilih: {election.title}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        <div className="modal-body">
          {error && <p className="invite-error" role="alert">{error}</p>}

          {/* Form pilih akun untuk ditambahkan ke pemilihan */}
          {election.status !== 'closed' && (
            <form onSubmit={handleAddVoter} style={{ background: 'var(--cream)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                Tentukan Siapa yang Bisa Mengikuti Pemilihan Ini
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                Pilih dari daftar akun pemilih yang telah terdaftar di TrueCount untuk diikutsertakan ke pemilihan ini.
              </p>

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <select
                  value={addingId}
                  onChange={e => setAddingId(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                >
                  <option value="">-- Pilih Akun Pemilih --</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.email})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="create-submit"
                  disabled={!addingId || adding}
                  style={{ fontSize: '0.82rem', padding: '0.5rem 1.1rem', whiteSpace: 'nowrap' }}
                >
                  {adding ? 'Menambahkan…' : '+ Beri Akses'}
                </button>
              </div>
            </form>
          )}

          {/* Daftar pemilih yang sudah diikutsertakan */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Daftar Pemilih yang Berhak Ikut ({electionVoters.length})
            </h3>
            {loading ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Memuat pemilih…</p>
            ) : electionVoters.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Belum ada akun pemilih yang ditentukan untuk pemilihan ini.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {electionVoters.map((v) => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.9rem', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{v.username}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginLeft: '0.6rem' }}>{v.email}</span>
                      {v.has_voted ? (
                        <span style={{ marginLeft: '0.6rem', fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#e9f4ec', color: '#2a7a3b', fontWeight: 700 }}>
                          ✓ Sudah Memilih
                        </span>
                      ) : (
                        <span style={{ marginLeft: '0.6rem', fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#fef2f2', color: '#b91c1c', fontWeight: 600 }}>
                          Belum Memilih
                        </span>
                      )}
                    </div>

                    {!v.has_voted && election.status !== 'closed' && (
                      <button
                        className="revoke-btn"
                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                        disabled={removingId === v.user_id}
                        onClick={() => handleRemoveVoter(v.user_id, v.username)}
                        title="Keluarkan dari pemilihan"
                      >
                        {removingId === v.user_id ? '…' : 'Hapus Akses'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
