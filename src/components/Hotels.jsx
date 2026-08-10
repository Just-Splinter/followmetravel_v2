import { useState } from 'react'
import { Button, Card, CardHeader, Select } from './UI'
import styles from '../styles/Hotels.module.css'
import { useApp } from '../context/AppContext'

export default function Hotels() {
  const { packages, savePackage } = useApp()
  const [selectedPkgId, setSelectedPkgId] = useState(packages[0]?.id ?? '')
  const [edited, setEdited] = useState(null)  // local copy for editing

  const pkg = packages.find(p => p.id === selectedPkgId)
  const hotels = edited?.hotels ?? pkg?.hotels ?? []

  const startEdit = () => setEdited(JSON.parse(JSON.stringify(pkg)))
  const cancelEdit = () => setEdited(null)
  const save = () => { savePackage(edited); setEdited(null) }

  const updateHotel = (idx, field, val) => {
    const next = [...hotels]
    next[idx] = { ...next[idx], [field]: field === 'name' ? val : +val }
    setEdited(prev => ({ ...prev, hotels: next }))
  }

  const addHotel = () => {
    setEdited(prev => ({
      ...prev,
      hotels: [...prev.hotels, { id: 'h' + Date.now(), name: '', stars: 4, triple: 0, double: 0, single: 0 }]
    }))
  }

  const removeHotel = idx => {
    setEdited(prev => ({ ...prev, hotels: prev.hotels.filter((_, i) => i !== idx) }))
  }

  const updateChildRate = (key, val) => {
    setEdited(prev => ({ ...prev, childRates: { ...prev.childRates, [key]: +val } }))
  }

  const childRates = edited?.childRates ?? pkg?.childRates ?? {}

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Select
          value={selectedPkgId}
          onChange={v => { setSelectedPkgId(v); setEdited(null) }}
          options={packages.map(p => ({ value: p.id, label: p.name }))}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          {edited
            ? <><Button onClick={cancelEdit}>Annuler</Button><Button variant="gold" onClick={save}>💾 Enregistrer</Button></>
            : <Button onClick={startEdit}>✏ Modifier les tarifs</Button>
          }
        </div>
      </div>

      <Card>
        <CardHeader title={`Hôtels & Tarifs — ${pkg?.name ?? ''}`} />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Hôtel</th>
                <th>Cat.</th>
                <th>Triple (DH)</th>
                <th>Double (DH)</th>
                <th>Single (DH)</th>
                {edited && <th></th>}
              </tr>
            </thead>
            <tbody>
              {hotels.map((h, i) => (
                <tr key={h.id}>
                  <td>
                    {edited
                      ? <input className={styles.cell} value={h.name} onChange={e => updateHotel(i, 'name', e.target.value)} placeholder="Nom hôtel" />
                      : <span className={styles.hotelName}>{h.name}</span>
                    }
                  </td>
                  <td>
                    {edited
                      ? <select className={styles.cellSm} value={h.stars} onChange={e => updateHotel(i, 'stars', e.target.value)}>
                          <option value={3}>★★★</option><option value={4}>★★★★</option><option value={5}>★★★★★</option>
                        </select>
                      : '★'.repeat(h.stars)
                    }
                  </td>
                  {['triple', 'double', 'single'].map(rt => (
                    <td key={rt}>
                      {edited
                        ? <input className={styles.cellNum} type="number" value={h[rt] || ''} onChange={e => updateHotel(i, rt, e.target.value)} />
                        : <span className={styles.price}>{(h[rt] ?? 0).toLocaleString('fr-MA')}</span>
                      }
                    </td>
                  ))}
                  {edited && <td><button className={styles.removeBtn} onClick={() => removeHotel(i)}>✕</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {edited && (
          <button className={styles.addHotelBtn} onClick={addHotel}>+ Ajouter un hôtel</button>
        )}
      </Card>

      <Card>
        <CardHeader title="Tarifs enfants" />
        <div className={styles.childGrid}>
          <div className={styles.childCard}>
            <div className={styles.childLabel}>👶 Bébé (- 2 ans)</div>
            {edited
              ? <input className={styles.cellNum} type="number" value={childRates.baby || ''} onChange={e => updateChildRate('baby', e.target.value)} />
              : <div className={styles.childPrice}>{(childRates.baby ?? 0).toLocaleString('fr-MA')} DH</div>
            }
          </div>
          <div className={styles.childCard}>
            <div className={styles.childLabel}>🧒 Enfant 2–5 ans</div>
            {edited
              ? <input className={styles.cellNum} type="number" value={childRates.child2to5 || ''} onChange={e => updateChildRate('child2to5', e.target.value)} />
              : <div className={styles.childPrice}>{(childRates.child2to5 ?? 0).toLocaleString('fr-MA')} DH</div>
            }
          </div>
          <div className={styles.childCard}>
            <div className={styles.childLabel}>👦 Enfant 5–12 ans</div>
            {edited
              ? <input className={styles.cellNum} type="number" value={childRates.child5to12 || ''} onChange={e => updateChildRate('child5to12', e.target.value)} />
              : <div className={styles.childPrice}>{(childRates.child5to12 ?? 0).toLocaleString('fr-MA')} DH</div>
            }
          </div>
        </div>
      </Card>
    </div>
  )
}