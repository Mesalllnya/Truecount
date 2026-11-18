import { useState, useEffect, useCallback, useMemo } from 'react'

const API = 'http://localhost:8000'

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}


export function CandidatePhoto({ candidate, electionId, token, style, fallbackSize = '1.2rem' }) {
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    // Foto lama masih menggunakan public path
    if (!candidate.photo_file_id) {
      setPhotoUrl(
        candidate.photo_path ? `${API}${candidate.photo_path}` : ''
      );

      return () => {
        cancelled = true;
      };
    }

    // Foto terenkripsi diambil melalui endpoint dekripsi
    setPhotoUrl('');

    const authToken = token || localStorage.getItem('tc_token');
    fetch(
      `${API}/elections/${electionId}/candidates/${candidate.id}/photo`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    )
      .then(response => {
        if (!response.ok) {
          throw new Error('Gagal mengambil foto kandidat.');
        }

        return response.blob();
      })
      .then(blob => {
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      })
      .catch(error => {
        if (!cancelled) {
          console.error(
            `[Candidate Photo ${candidate.id}]`,
            error
          );
        }
      });

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    candidate.id,
    candidate.photo_file_id,
    candidate.photo_path,
    electionId,
    token,
  ]);

  const defaultStyle = {
    width: '42px',
    height: '42px',
    borderRadius: '8px',
    objectFit: 'cover',
    border: '1px solid var(--border)',
    flexShrink: 0,
    ...style,
  };

  if (!photoUrl) {
    return (
      <div style={{
        ...defaultStyle,
        background: '#f0f0ec',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9ca3af',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={candidate.name}
      style={defaultStyle}
      onError={(e) => {
        e.target.style.display = 'none';
        if (e.target.parentElement) {
          e.target.parentElement.innerHTML = `<div style="width:100%;height:100%;background:#f0f0ec;display:flex;align-items:center;justify-content:center;color:#9ca3af;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;
        }
      }}
    />
  );
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
  const [photoPreview, setPhotoPreview] = useState(null)
  const [fileInputKey, setFileInputKey] = useState(Date.now())
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
  setError('')

  if (!name.trim()) {
    setError('Nama paslon wajib diisi. Mohon lengkapi bagian nama paslon.')
    return
  }
  if (!vision.trim()) {
    setError('Visi paslon wajib diisi. Mohon lengkapi bagian visi paslon.')
    return
  }
  if (!mission.trim()) {
    setError('Misi paslon wajib diisi. Mohon lengkapi bagian misi paslon.')
    return
  }
  if (!photoFile) {
    setError('Foto paslon wajib diunggah. Mohon pilih foto paslon (maksimal 2MB).')
    return
  }
  if (photoFile.size > 2 * 1024 * 1024) {
    setError(`Ukuran foto paslon terlalu besar (${(photoFile.size / (1024 * 1024)).toFixed(2)} MB). Maksimal ukuran foto adalah 2 MB. Silakan input ulang gambar paslon yang lebih kecil.`)
    return
  }

  setSubmitting(true)

  try {
    // 1. Buat kandidat terlebih dahulu
    const res = await fetch(
      `${API}/elections/${election.id}/candidates`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          vision: vision.trim(),
          mission: mission.trim(),
        }),
      }
    )

    const data = await readJson(res)

    if (!res.ok) {
      throw new Error(
        data.error || 'Gagal menambahkan kandidat.'
      )
    }

    const candidateId = data.candidate?.id

    if (!candidateId) {
      throw new Error(
        'Kandidat berhasil dibuat, tetapi ID kandidat tidak ditemukan.'
      )
    }

    // 2. Upload foto melalui pipeline enkripsi + steganografi jika ada
    let photoUploadError = null
    if (photoFile) {
      try {
        const formData = new FormData()
        formData.append('photo', photoFile)

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
          photoUploadError = photoData.error || 'Upload foto gagal diproses oleh server.'
        }
      } catch (uploadErr) {
        photoUploadError = uploadErr.message || 'Gagal menghubungi server untuk upload foto.'
      }
    }

    // 3. Selalu reset form input ke nol setelah paslon dibuat
    setName('')
    setVision('')
    setMission('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setFileInputKey(Date.now())

    await loadCandidates()
    onRefreshElection()

    if (photoUploadError) {
      setError(`Kandidat berhasil ditambahkan, namun foto gagal disimpan: ${photoUploadError}`)
    }

  } catch (err) {
    setError(
      err?.message || 'Gagal menambahkan kandidat.'
    )

    await loadCandidates()
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
  setError('')

  if (!editName.trim()) {
    setError('Nama paslon tidak boleh kosong. Mohon isi nama paslon.')
    return
  }
  if (!editVision.trim()) {
    setError('Visi paslon tidak boleh kosong. Mohon isi visi paslon.')
    return
  }
  if (!editMission.trim()) {
    setError('Misi paslon tidak boleh kosong. Mohon isi misi paslon.')
    return
  }

  // Cek apakah paslon sudah punya foto sebelumnya atau memilih foto baru
  const hasExistingPhoto = Boolean(editingCandidate.photo_file_id || editingCandidate.photo_path)
  if (!hasExistingPhoto && !editPhotoFile) {
    setError('Foto paslon wajib diunggah. Silakan pilih foto paslon (maks 2MB).')
    return
  }

  // Jika mengunggah foto baru, validasi ukuran < 2MB
  if (editPhotoFile && editPhotoFile.size > 2 * 1024 * 1024) {
    setError(`Ukuran foto baru terlalu besar (${(editPhotoFile.size / (1024 * 1024)).toFixed(2)} MB). Maksimal 2 MB. Silakan pilih/input ulang gambar yang lebih kecil.`)
    return
  }

  setUpdating(true)

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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', marginRight: '0.4rem', verticalAlign: 'middle' }}>
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg><strong>Pasangan Calon Terkunci:</strong> Pemilihan ini sudah dimulai (status:{' '}
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
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Visi (singkat) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Transparansi & Inovasi Kampus"
                    value={vision}
                    onChange={e => setVision(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Foto Paslon (JPEG/PNG, maks 2MB) *</label>
                  <input
                    key={fileInputKey}
                    type="file"
                    required
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => {
                      const file = e.target.files[0] || null
                      if (file && file.size > 2 * 1024 * 1024) {
                        setError(`Ukuran foto paslon terlalu besar (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maksimal ukuran foto adalah 2 MB. Silakan pilih gambar lain.`)
                        e.target.value = ''
                        setPhotoFile(null)
                        setPhotoPreview(null)
                        return
                      }
                      setError('')
                      setPhotoFile(file)
                      if (file) {
                        setPhotoPreview(URL.createObjectURL(file))
                      } else {
                        setPhotoPreview(null)
                      }
                    }}
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  />
                  {photoPreview && (
                    <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <img
                        src={photoPreview}
                        alt="Pratinjau"
                        style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border)' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Pratinjau foto sebelum dienkripsi</span>
                    </div>
                  )}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Misi *</label>
                  <textarea
                    rows={2}
                    required
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

                        <CandidatePhoto
                          candidate={c}
                          electionId={election.id}
                          token={token}
                        />

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
                            <label>Visi *</label>
                            <input
                              type="text"
                              required
                              value={editVision}
                              onChange={e => setEditVision(e.target.value)}
                              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                            />
                          </div>

                          <div>
                            <label>Misi *</label>
                            <textarea
                              rows={3}
                              required
                              value={editMission}
                              onChange={e => setEditMission(e.target.value)}
                              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: 'inherit' }}
                            />
                          </div>

                          <div>
                            <label>
                              Foto Paslon {editingCandidate.photo_file_id || editingCandidate.photo_path ? '(Pilih jika ingin mengganti)' : '* (Wajib diunggah)'}
                            </label>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={e => {
                                const file = e.target.files?.[0] || null
                                if (file && file.size > 2 * 1024 * 1024) {
                                  setError(`Ukuran foto paslon terlalu besar (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maksimal 2 MB. Silakan pilih gambar yang lebih kecil.`)
                                  e.target.value = ''
                                  setEditPhotoFile(null)
                                  return
                                }
                                setError('')
                                setEditPhotoFile(file)
                              }}
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
  const [successMsg, setSuccessMsg]         = useState('')
  
  // Selection state untuk multi-select (Checkbox)
  const [selectedAvailableIds, setSelectedAvailableIds] = useState(new Set())
  const [selectedEnrolledIds, setSelectedEnrolledIds]   = useState(new Set())

  // Search filter
  const [searchAvailable, setSearchAvailable] = useState('')
  const [searchEnrolled, setSearchEnrolled]   = useState('')

  const [processingAdd, setProcessingAdd]       = useState(false)
  const [processingRemove, setProcessingRemove] = useState(false)
  const [removingId, setRemovingId]             = useState(null)

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
  const enrolledUserIds = useMemo(() => new Set(electionVoters.map(v => v.user_id)), [electionVoters])
  
  const availableUsers = useMemo(() => {
    return allVoterUsers
      .filter(u => !enrolledUserIds.has(u.id))
      .filter(u => {
        if (!searchAvailable.trim()) return true
        const q = searchAvailable.toLowerCase()
        return u.username.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q))
      })
  }, [allVoterUsers, enrolledUserIds, searchAvailable])

  const displayedEnrolledVoters = useMemo(() => {
    return electionVoters.filter(v => {
      if (!searchEnrolled.trim()) return true
      const q = searchEnrolled.toLowerCase()
      return v.username.toLowerCase().includes(q) || (v.email && v.email.toLowerCase().includes(q))
    })
  }, [electionVoters, searchEnrolled])

  // Checkbox helpers untuk Available Users
  function toggleAvailable(id) {
    setSelectedAvailableIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllAvailable() {
    if (selectedAvailableIds.size === availableUsers.length && availableUsers.length > 0) {
      setSelectedAvailableIds(new Set())
    } else {
      setSelectedAvailableIds(new Set(availableUsers.map(u => u.id)))
    }
  }

  // Checkbox helpers untuk Enrolled Voters
  function toggleEnrolled(userId, hasVoted) {
    if (hasVoted) return // yang sudah vote tidak bisa dipilih untuk dihapus
    setSelectedEnrolledIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const removableVoters = displayedEnrolledVoters.filter(v => !v.has_voted)
  function toggleSelectAllEnrolled() {
    if (selectedEnrolledIds.size === removableVoters.length && removableVoters.length > 0) {
      setSelectedEnrolledIds(new Set())
    } else {
      setSelectedEnrolledIds(new Set(removableVoters.map(v => v.user_id)))
    }
  }

  // ── Tambah Banyak Pemilih Sekaligus (Batch / Checkbox) ──
  async function handleBatchAddVoters() {
    if (selectedAvailableIds.size === 0) return
    setProcessingAdd(true)
    setError('')
    setSuccessMsg('')
    try {
      const userIds = Array.from(selectedAvailableIds)
      const res = await fetch(`${API}/elections/${election.id}/voters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_ids: userIds }),
      })
      const data = await readJson(res)
      if (!res.ok) throw new Error(data.error || 'Gagal mendaftarkan pemilih.')
      
      setSuccessMsg(`Berhasil mendaftarkan ${data.registered ?? userIds.length} pemilih ke pemilihan!`)
      setSelectedAvailableIds(new Set())
      await loadData()
      onRefreshElection()
    } catch (err) {
      setError(err?.message || 'Gagal mendaftarkan pemilih.')
    } finally {
      setProcessingAdd(false)
    }
  }

  // ── Hapus Banyak Pemilih Sekaligus (Batch / Checkbox) ──
  async function handleBatchRemoveVoters() {
    if (selectedEnrolledIds.size === 0) return
    const count = selectedEnrolledIds.size
    if (!window.confirm(`Keluarkan ${count} akun pemilih terpilih dari pemilihan ini?`)) return

    setProcessingRemove(true)
    setError('')
    setSuccessMsg('')
    try {
      const userIds = Array.from(selectedEnrolledIds)
      const res = await fetch(`${API}/elections/${election.id}/voters`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_ids: userIds }),
      })
      const data = await readJson(res)
      if (!res.ok) throw new Error(data.error || 'Gagal mengeluarkan pemilih terpilih.')

      setSuccessMsg(`Berhasil mengeluarkan ${data.deleted ?? count} pemilih dari pemilihan.`)
      setSelectedEnrolledIds(new Set())
      await loadData()
      onRefreshElection()
    } catch (err) {
      setError(err?.message || 'Gagal mengeluarkan pemilih terpilih.')
    } finally {
      setProcessingRemove(false)
    }
  }

  // Single remove
  async function handleRemoveVoter(userId, username) {
    if (!window.confirm(`Keluarkan ${username} dari pemilihan ini?`)) return
    setRemovingId(userId)
    setError('')
    setSuccessMsg('')
    try {
      const res = await fetch(`${API}/elections/${election.id}/voters/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await readJson(res)
      if (!res.ok) throw new Error(data.error || 'Gagal mengeluarkan pemilih.')
      
      setSuccessMsg(`Pemilih ${username} berhasil dikeluarkan.`)
      setSelectedEnrolledIds(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
      await loadData()
      onRefreshElection()
    } catch (err) {
      setError(err?.message || 'Gagal mengeluarkan pemilih.')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '820px', width: '95%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Peserta Pemilih: {election.title}</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              Pilih akun secara massal dengan checkbox untuk memberi atau menghapus hak suara.
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && <p className="invite-error" role="alert" style={{ margin: 0 }}>{error}</p>}
          {successMsg && (
            <p style={{ margin: 0, padding: '0.6rem 0.9rem', background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: '8px', color: '#2a7a3b', fontSize: '0.85rem', fontWeight: 600 }}>
              {successMsg}
            </p>
          )}

          {/* ── BAGIAN 1: PILIH AKUN PEMILIH UNTUK DITAMBAHKAN (CHECKBOX BATCH) ── */}
          {election.status !== 'closed' && (
            <div style={{ background: 'var(--cream)', padding: '1.1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                  Tambah Hak Suara Akun Pemilih ({availableUsers.length} Tersedia)
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Cari username / email…"
                    value={searchAvailable}
                    onChange={e => setSearchAvailable(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', width: '180px' }}
                  />
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={toggleSelectAllAvailable}
                    disabled={availableUsers.length === 0}
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                  >
                    {selectedAvailableIds.size === availableUsers.length && availableUsers.length > 0
                      ? 'Batal Pilih Semua'
                      : 'Pilih Semua'}
                  </button>
                  <button
                    type="button"
                    className="create-submit"
                    disabled={selectedAvailableIds.size === 0 || processingAdd}
                    onClick={handleBatchAddVoters}
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.9rem' }}
                  >
                    {processingAdd ? 'Memproses…' : `+ Beri Akses (${selectedAvailableIds.size})`}
                  </button>
                </div>
              </div>

              {availableUsers.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.5rem 0 0 0' }}>
                  {allVoterUsers.length === 0
                    ? 'Belum ada akun pemilih terdaftar di sistem. Buat undangan terlebih dahulu.'
                    : 'Semua akun pemilih di sistem sudah dimasukkan ke pemilihan ini.'}
                </p>
              ) : (
                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  background: 'var(--white)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                  gap: '0.45rem'
                }}>
                  {availableUsers.map(u => {
                    const isChecked = selectedAvailableIds.has(u.id)
                    return (
                      <label
                        key={u.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.55rem',
                          padding: '0.5rem 0.65rem',
                          borderRadius: '6px',
                          background: isChecked ? '#eff6ff' : 'var(--cream)',
                          border: `1px solid ${isChecked ? '#3468b0' : 'var(--border)'}`,
                          cursor: 'pointer',
                          userSelect: 'none',
                          fontSize: '0.82rem',
                          transition: 'all 120ms ease-in-out'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleAvailable(u.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ fontWeight: 600, color: 'var(--black)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {u.username}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {u.email || 'Tanpa email'}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── BAGIAN 2: DAFTAR PEMILIH TERDAFTAR (DENGAN CHECKBOX KELUARKAN MASSAL) ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                Daftar Pemilih yang Berhak Ikut ({electionVoters.length})
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Cari pemilih terdaftar…"
                  value={searchEnrolled}
                  onChange={e => setSearchEnrolled(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', width: '180px' }}
                />
                {election.status !== 'closed' && removableVoters.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={toggleSelectAllEnrolled}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                    >
                      {selectedEnrolledIds.size === removableVoters.length && removableVoters.length > 0
                        ? 'Batal Pilih'
                        : 'Pilih Belum Memilih'}
                    </button>
                    <button
                      type="button"
                      className="revoke-btn"
                      disabled={selectedEnrolledIds.size === 0 || processingRemove}
                      onClick={handleBatchRemoveVoters}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                    >
                      {processingRemove ? 'Memproses…' : `Hapus Terpilih (${selectedEnrolledIds.size})`}
                    </button>
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Memuat pemilih…</p>
            ) : electionVoters.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Belum ada akun pemilih yang ditentukan untuk pemilihan ini.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                {displayedEnrolledVoters.map((v) => {
                  const isChecked = selectedEnrolledIds.has(v.user_id)
                  return (
                    <div
                      key={v.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.85rem',
                        background: isChecked ? '#fff1f2' : 'var(--white)',
                        border: `1px solid ${isChecked ? '#fecdd3' : 'var(--border)'}`,
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        {!v.has_voted && election.status !== 'closed' && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleEnrolled(v.user_id, v.has_voted)}
                            style={{ cursor: 'pointer' }}
                            title="Pilih untuk hapus akses massal"
                          />
                        )}
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{v.username}</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginLeft: '0.6rem' }}>{v.email}</span>
                          {v.has_voted ? (
                            <span style={{ marginLeft: '0.6rem', fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#e9f4ec', color: '#2a7a3b', fontWeight: 700 }}>
                              Sudah Memilih
                            </span>
                          ) : (
                            <span style={{ marginLeft: '0.6rem', fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#fef2f2', color: '#b91c1c', fontWeight: 600 }}>
                              Belum Memilih
                            </span>
                          )}
                        </div>
                      </div>

                      {!v.has_voted && election.status !== 'closed' && (
                        <button
                          type="button"
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
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
