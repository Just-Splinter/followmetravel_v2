import { useState, useRef } from 'react'
import styles from '../styles/MetaAds.module.css'

// ─── Meta API helpers ─────────────────────────────────────────────
const GRAPH = 'https://graph.facebook.com/v25.0'

async function metaPost(endpoint, body, token) {
  const params = new URLSearchParams({ ...body, access_token: token })
  const res = await fetch(`${GRAPH}${endpoint}`, { method: 'POST', body: params })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json
}

async function metaGet(endpoint, params, token) {
  const qs = new URLSearchParams({ ...params, access_token: token })
  const res = await fetch(`${GRAPH}${endpoint}?${qs}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json
}

// Upload image to ad account media library and return hash
async function uploadImage(adAccountId, base64DataUrl, token) {
  const blob = await fetch(base64DataUrl).then(r => r.blob())
  const fd = new FormData()
  fd.append('filename', blob, 'creative.jpg')
  fd.append('access_token', token)
  const res = await fetch(`${GRAPH}/act_${adAccountId}/adimages`, { method: 'POST', body: fd })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  const hashes = Object.values(json.images || {})
  return hashes[0]?.hash
}

// Full 3-step launch: campaign → adset → ad
async function launchFullCampaign({ token, adAccountId, pageId, cfg }) {
  const steps = []

  // 1 — Campaign
  const campaign = await metaPost(`/act_${adAccountId}/campaigns`, {
    name:      cfg.campaignName,
    objective: cfg.objective,
    status:    'PAUSED',
    special_ad_categories: '[]',
  }, token)
  steps.push({ label: 'Campagne créée', id: campaign.id })

  // 2 — Ad Set
  const targeting = JSON.stringify({
    geo_locations: {
      countries: cfg.countries.split(',').map(s => s.trim()).filter(Boolean),
    },
    age_min:  cfg.ageMin,
    age_max:  cfg.ageMax,
    ...(cfg.genders !== '0' ? { genders: [Number(cfg.genders)] } : {}),
  })

  const adset = await metaPost(`/act_${adAccountId}/adsets`, {
    name:               cfg.adsetName,
    campaign_id:        campaign.id,
    billing_event:      'IMPRESSIONS',
    optimization_goal:  cfg.optimizationGoal,
    bid_strategy:       'LOWEST_COST_WITHOUT_CAP',
    daily_budget:       String(Number(cfg.dailyBudget) * 100), // cents
    targeting,
    start_time:         cfg.startDate,
    end_time:           cfg.endDate,
    status:             'PAUSED',
  }, token)
  steps.push({ label: 'Ad Set créé', id: adset.id })

  // 3 — Creative &amp; Ad
  let imageHash = null
  if (cfg.creativeImage) {
    imageHash = await uploadImage(adAccountId, cfg.creativeImage, token)
    steps.push({ label: 'Image uploadée', id: imageHash?.slice(0, 12) + '…' })
  }

  const creativeBody = {
    name:    cfg.creativeName,
    object_story_spec: JSON.stringify({
      page_id: pageId,
      link_data: {
        message:      cfg.adText,
        link:         cfg.destinationUrl,
        name:         cfg.headline,
        description:  cfg.description,
        call_to_action: { type: cfg.ctaType },
        ...(imageHash ? { image_hash: imageHash } : {}),
      },
    }),
  }
  const creative = await metaPost(`/act_${adAccountId}/adcreatives`, creativeBody, token)
  steps.push({ label: 'Créatif créé', id: creative.id })

  const ad = await metaPost(`/act_${adAccountId}/ads`, {
    name:        cfg.adName,
    adset_id:    adset.id,
    creative:    JSON.stringify({ creative_id: creative.id }),
    status:      'PAUSED',
  }, token)
  steps.push({ label: 'Ad créée (en pause)', id: ad.id })

  return steps
}

// ─── Component ────────────────────────────────────────────────────

const OBJECTIVES = [
  { value: 'OUTCOME_TRAFFIC',     label: 'Trafic vers site' },
  { value: 'OUTCOME_LEADS',       label: 'Génération de leads' },
  { value: 'OUTCOME_ENGAGEMENT',  label: 'Engagement' },
  { value: 'OUTCOME_AWARENESS',   label: 'Notoriété' },
  { value: 'OUTCOME_SALES',       label: 'Ventes / Conversions' },
]

const OPT_GOALS = [
  { value: 'LINK_CLICKS',     label: 'Clics sur le lien' },
  { value: 'LANDING_PAGE_VIEWS', label: 'Vues de page de destination' },
  { value: 'REACH',           label: 'Portée' },
  { value: 'IMPRESSIONS',     label: 'Impressions' },
  { value: 'LEAD_GENERATION', label: 'Leads' },
]

const CTA_TYPES = [
  { value: 'LEARN_MORE',    label: 'En savoir plus' },
  { value: 'BOOK_TRAVEL',   label: 'Réserver un voyage' },
  { value: 'CONTACT_US',    label: 'Nous contacter' },
  { value: 'SIGN_UP',       label: "S'inscrire" },
  { value: 'GET_QUOTE',     label: 'Obtenir un devis' },
  { value: 'SEND_MESSAGE',  label: 'Envoyer un message' },
]

export default function MetaAds({ packages = [] }) {
  // Connection
  const [token,        setToken]        = useState('')
  const [adAccountId,  setAdAccountId]  = useState('')
  const [pageId,       setPageId]       = useState('')
  const [connected,    setConnected]    = useState(false)
  const [connecting,   setConnecting]   = useState(false)
  const [connError,    setConnError]    = useState('')

  // Selected package
  const [selectedPkg,  setSelectedPkg]  = useState(null)

  // Wizard step
  const [step,         setStep]         = useState(6)

  const [cfg, setCfg] = useState(() => {
    const today  = new Date().toISOString().slice(0, 10)
    const inWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)
    return {
      campaignName:    '',
      objective:       'OUTCOME_TRAFFIC',
      adsetName:       '',
      dailyBudget:     '50',
      countries:       'MA',
      ageMin:          25,
      ageMax:          55,
      genders:         '0',
      startDate:       today,
      endDate:         inWeek,
      optimizationGoal:'LINK_CLICKS',
      creativeName:    '',
      adName:          '',
      headline:        '',
      description:     '',
      adText:          '',
      destinationUrl:  'https://www.followmetravel.ma',
      ctaType:         'BOOK_TRAVEL',
      creativeImage:   null,
      placement:       'feed',
    }
  })

  // Launch state
  const [launching,    setLaunching]    = useState(false)
  const [launchSteps,  setLaunchSteps]  = useState([])
  const [launchError,  setLaunchError]  = useState('')
  const [launched,     setLaunched]     = useState(false)

  const imageRef = useRef()

  const set = key => val => setCfg(p => ({ ...p, [key]: val }))

  // Pre-fill from package
  const applyPackage = (pkg) => {
    setSelectedPkg(pkg)
    setCfg(p => ({
      ...p,
      campaignName:  `[FMT] ${pkg.name} — ${pkg.destination}`,
      adsetName:     `${pkg.destination} · ${pkg.duration}J/${pkg.nights}N`,
      creativeName:  `Creative — ${pkg.name}`,
      adName:        `Ad — ${pkg.name}`,
      headline:      pkg.name || pkg.destination,
      description:   pkg.tagline || '',
      adText:        `✈ ${pkg.destination} | ${pkg.duration} jours / ${pkg.nights} nuits\nÀ partir de ${(pkg.basePrice||0).toLocaleString('fr-MA')} DH\n${pkg.tagline || ''}`,
      creativeImage: pkg.heroBg || (pkg.gallery?.[0]?.url) || null,
    }))
  }

  // Step validation
  const canNext = () => {
    if (step === 1) return connected
    if (step === 2) return !!selectedPkg
    if (step === 3) return cfg.campaignName && cfg.dailyBudget && cfg.countries
    if (step === 4) return cfg.headline && cfg.adText && cfg.destinationUrl
    return true
  }

  // Connect / verify token
  const connect = async () => {
    if (!token || !adAccountId) { setConnError('Renseignez le token et l\'ID de compte.'); return }
    setConnecting(true); setConnError('')
    try {
      await metaGet(`/act_${adAccountId}`, { fields: 'id,name' }, token)
      setConnected(true)
    } catch (e) {
      setConnError(e.message)
    } finally {
      setConnecting(false)
    }
  }

  // Launch
  const launch = async () => {
    setLaunching(true); setLaunchError(''); setLaunchSteps([])
    try {
      const steps = await launchFullCampaign({ token, adAccountId, pageId, cfg, pkg: selectedPkg })
      setLaunchSteps(steps)
      setLaunched(true)
      setStep(6)
    } catch (e) {
      setLaunchError(e.message)
    } finally {
      setLaunching(false)
    }
  }

  const handleImageFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => set('creativeImage')(reader.result)
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  const STEPS = ['Connexion', 'Package', 'Campagne', 'Créatif', 'Révision', launched ? 'Lancé ✓' : 'Lancer']

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <span className={styles.metaIcon}>𝕗</span> Meta Ads
          </h1>
          <p className={styles.subtitle}>Publiez vos packages sur Facebook &amp;amp; Instagram</p>
        </div>
        {connected && (
          <div className={styles.connectedBadge}>
            <span className={styles.dot} /> Connecté · act_{adAccountId}
          </div>
        )}
      </div>

      {/* ── Stepper ── */}
      <div className={styles.stepper}>
        {STEPS.map((label, i) => {
          const n = i + 1
          const done    = n < step
          const active  = n === step
          return (
            <div key={n} className={[styles.stepItem, done && styles.done, active && styles.active].filter(Boolean).join(' ')}
              onClick={() => done && setStep(n)} style={{ cursor: done ? 'pointer' : 'default' }}>
              <div className={styles.stepCircle}>{done ? '✓' : n}</div>
              <div className={styles.stepLabel}>{label}</div>
              {i < STEPS.length - 1 && <div className={styles.stepLine} />}
            </div>
          )
        })}
      </div>

      {/* ── Step panels ── */}
      <div className={styles.panel}>

        {/* ─ Step 1 : Connexion ─ */}
        {step === 1 && (
          <StepShell
            title="Connexion Meta"
            icon="🔑"
            desc="Renseignez vos identifiants Meta Business pour autoriser la création de campagnes."
          >
            {connected ? (
              <div className={styles.successBox}>
                <span className={styles.successIcon}>✅</span>
                <div>
                  <div className={styles.successTitle}>Compte connecté</div>
                  <div className={styles.successSub}>act_{adAccountId}</div>
                </div>
                <button className={styles.btnGhost} onClick={() => setConnected(false)}>Déconnecter</button>
              </div>
            ) : (
              <div className={styles.formGrid}>
                <Field label="Token d'accès (User Access Token)" required>
                  <input type="password" className={styles.input} value={token} onChange={e => setToken(e.target.value)}
                    placeholder="EAABsbCS…" />
                  <HelpText>Générez un token depuis <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className={styles.link}>Graph API Explorer</a> avec les scopes <code>ads_management</code> et <code>pages_read_engagement</code>.</HelpText>
                </Field>
                <Field label="ID du compte publicitaire" required>
                  <input className={styles.input} value={adAccountId} onChange={e => setAdAccountId(e.target.value)} placeholder="123456789" />
                  <HelpText>Trouvez-le dans Meta Business Manager → Comptes publicitaires.</HelpText>
                </Field>
                <Field label="ID de la Page Facebook (pour les créatifs)">
                  <input className={styles.input} value={pageId} onChange={e => setPageId(e.target.value)} placeholder="987654321" />
                </Field>
                {connError && <div className={styles.errorBox}>{connError}</div>}
                <button className={styles.btnGold} onClick={connect} disabled={connecting}>
                  {connecting ? 'Vérification…' : '🔗 Vérifier et connecter'}
                </button>
              </div>
            )}
          </StepShell>
        )}

        {/* ─ Step 2 : Sélection du package ─ */}
        {step === 2 && (
          <StepShell title="Sélectionner un package" icon="📦" desc="Choisissez le package à promouvoir. Les données seront pré-remplies automatiquement.">
            {packages.length === 0 ? (
              <div className={styles.emptyState}>
                <span>📭</span>
                <p>Aucun package disponible. Créez-en un depuis la section Packages.</p>
              </div>
            ) : (
              <div className={styles.pkgGrid}>
                {packages.map(pkg => (
                  <div key={pkg.id}
                    className={[styles.pkgOption, selectedPkg?.id === pkg.id && styles.pkgOptionSelected].filter(Boolean).join(' ')}
                    onClick={() => applyPackage(pkg)}>
                    <div className={styles.pkgOptionHero} style={pkg.heroBg ? { backgroundImage: `url(${pkg.heroBg})` } : {}}>
                      {!pkg.heroBg && <span style={{ fontSize: 28 }}>🌍</span>}
                    </div>
                    <div className={styles.pkgOptionBody}>
                      <div className={styles.pkgOptionName}>{pkg.name || pkg.destination}</div>
                      <div className={styles.pkgOptionPrice}>{(pkg.basePrice || 0).toLocaleString('fr-MA')} DH</div>
                      <div className={styles.pkgOptionMeta}>{pkg.duration}J / {pkg.nights}N · {pkg.airline}</div>
                    </div>
                    {selectedPkg?.id === pkg.id && <div className={styles.pkgOptionCheck}>✓</div>}
                  </div>
                ))}
              </div>
            )}
          </StepShell>
        )}

        {/* ─ Step 3 : Campagne &amp; ciblage ─ */}
        {step === 3 && (
          <StepShell title="Campagne &amp; Ciblage" icon="🎯" desc="Configurez l'objectif, le budget et l'audience de votre campagne.">
            <SectionTitle>Campagne</SectionTitle>
            <div className={styles.formRow2}>
              <Field label="Nom de la campagne" required>
                <input className={styles.input} value={cfg.campaignName} onChange={e => set('campaignName')(e.target.value)} />
              </Field>
              <Field label="Objectif">
                <select className={styles.select} value={cfg.objective} onChange={e => set('objective')(e.target.value)}>
                  {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
            <div className={styles.formRow2}>
              <Field label="Nom de l'Ad Set" required>
                <input className={styles.input} value={cfg.adsetName} onChange={e => set('adsetName')(e.target.value)} />
              </Field>
              <Field label="Objectif d'optimisation">
                <select className={styles.select} value={cfg.optimizationGoal} onChange={e => set('optimizationGoal')(e.target.value)}>
                  {OPT_GOALS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>

            <SectionTitle>Budget &amp; Calendrier</SectionTitle>
            <div className={styles.formRow3}>
              <Field label="Budget quotidien (DH)" required>
                <div className={styles.inputGroup}>
                  <input className={styles.input} type="number" min="10" value={cfg.dailyBudget} onChange={e => set('dailyBudget')(e.target.value)} />
                  <span className={styles.inputSuffix}>DH / jour</span>
                </div>
              </Field>
              <Field label="Date de début">
                <input className={styles.input} type="date" value={cfg.startDate} onChange={e => set('startDate')(e.target.value)} />
              </Field>
              <Field label="Date de fin">
                <input className={styles.input} type="date" value={cfg.endDate} onChange={e => set('endDate')(e.target.value)} />
              </Field>
            </div>

            <SectionTitle>Audience</SectionTitle>
            <div className={styles.formRow3}>
              <Field label="Pays (codes ISO séparés par virgule)">
                <input className={styles.input} value={cfg.countries} onChange={e => set('countries')(e.target.value)} placeholder="MA, FR, BE" />
              </Field>
              <Field label="Âge min">
                <input className={styles.input} type="number" min="18" max="65" value={cfg.ageMin} onChange={e => set('ageMin')(Number(e.target.value))} />
              </Field>
              <Field label="Âge max">
                <input className={styles.input} type="number" min="18" max="65" value={cfg.ageMax} onChange={e => set('ageMax')(Number(e.target.value))} />
              </Field>
            </div>
            <div className={styles.formRow2}>
              <Field label="Genre">
                <select className={styles.select} value={cfg.genders} onChange={e => set('genders')(e.target.value)}>
                  <option value="0">Tous</option>
                  <option value="1">Hommes</option>
                  <option value="2">Femmes</option>
                </select>
              </Field>
              <Field label="Placement">
                <select className={styles.select} value={cfg.placement} onChange={e => set('placement')(e.target.value)}>
                  <option value="feed">Feed (Facebook + Instagram)</option>
                  <option value="story">Stories</option>
                  <option value="reels">Reels</option>
                  <option value="all">Tous les placements</option>
                </select>
              </Field>
            </div>
          </StepShell>
        )}

        {/* ─ Step 4 : Créatif ─ */}
        {step === 4 && (
          <StepShell title="Créatif de l'annonce" icon="🎨" desc="Rédigez le texte de l'annonce et choisissez l'image ou vidéo.">
            <div className={styles.creativeLayout}>

              {/* Form */}
              <div className={styles.creativeForm}>
                <SectionTitle>Contenu</SectionTitle>
                <Field label="Titre (headline)" required>
                  <input className={styles.input} value={cfg.headline} onChange={e => set('headline')(e.target.value)} maxLength={40} placeholder="ex: Istanbul Summer Holiday" />
                  <CharCount val={cfg.headline} max={40} />
                </Field>
                <Field label="Description">
                  <input className={styles.input} value={cfg.description} onChange={e => set('description')(e.target.value)} maxLength={30} placeholder="ex: À partir de 7690 DH" />
                  <CharCount val={cfg.description} max={30} />
                </Field>
                <Field label="Texte principal de l'annonce" required>
                  <textarea className={styles.textarea} rows={4} value={cfg.adText} onChange={e => set('adText')(e.target.value)} maxLength={500} />
                  <CharCount val={cfg.adText} max={500} />
                </Field>
                <Field label="URL de destination" required>
                  <input className={styles.input} type="url" value={cfg.destinationUrl} onChange={e => set('destinationUrl')(e.target.value)} placeholder="https://…" />
                </Field>
                <Field label="Bouton CTA">
                  <select className={styles.select} value={cfg.ctaType} onChange={e => set('ctaType')(e.target.value)}>
                    {CTA_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <div className={styles.formRow2}>
                  <Field label="Nom du créatif">
                    <input className={styles.input} value={cfg.creativeName} onChange={e => set('creativeName')(e.target.value)} />
                  </Field>
                  <Field label="Nom de l'annonce">
                    <input className={styles.input} value={cfg.adName} onChange={e => set('adName')(e.target.value)} />
                  </Field>
                </div>
              </div>

              {/* Preview + image upload */}
              <div className={styles.creativeRight}>
                <SectionTitle>Image / Visuel</SectionTitle>
                <div className={styles.imageUploadZone} onClick={() => imageRef.current.click()}
                  style={cfg.creativeImage ? { backgroundImage: `url(${cfg.creativeImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                  {!cfg.creativeImage && (
                    <div className={styles.imageUploadPlaceholder}>
                      <span>🖼️</span>
                      <span>Cliquer pour uploader<br /><small>1080×1080 recommandé</small></span>
                    </div>
                  )}
                  {cfg.creativeImage && (
                    <button className={styles.removeImageBtn} onClick={e => { e.stopPropagation(); set('creativeImage')(null) }}>✕</button>
                  )}
                </div>
                <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
                {cfg.creativeImage && (
                  <button className={styles.btnGhostSm} onClick={() => set('creativeImage')(null)}>✕ Supprimer l'image</button>
                )}

                {/* Ad preview */}
                <SectionTitle style={{ marginTop: 20 }}>Aperçu annonce</SectionTitle>
                <AdPreview cfg={cfg} />
              </div>
            </div>
          </StepShell>
        )}

        {/* ─ Step 5 : Révision ─ */}
        {step === 5 && (
          <StepShell title="Révision finale" icon="📋" desc="Vérifiez tous les paramètres avant de lancer. L'annonce sera créée en statut PAUSED.">
            <div className={styles.reviewGrid}>
              <ReviewCard title="Connexion" icon="🔑">
                <ReviewRow label="Compte" value={`act_${adAccountId}`} />
                <ReviewRow label="Page" value={pageId || '—'} />
              </ReviewCard>
              <ReviewCard title="Package" icon="📦">
                <ReviewRow label="Nom" value={selectedPkg?.name || '—'} />
                <ReviewRow label="Destination" value={selectedPkg?.destination || '—'} />
                <ReviewRow label="Prix" value={`${(selectedPkg?.basePrice || 0).toLocaleString('fr-MA')} DH`} />
              </ReviewCard>
              <ReviewCard title="Campagne" icon="🎯">
                <ReviewRow label="Nom" value={cfg.campaignName} />
                <ReviewRow label="Objectif" value={OBJECTIVES.find(o => o.value === cfg.objective)?.label} />
                <ReviewRow label="Budget" value={`${cfg.dailyBudget} DH / jour`} />
                <ReviewRow label="Période" value={`${cfg.startDate} → ${cfg.endDate}`} />
              </ReviewCard>
              <ReviewCard title="Audience" icon="👥">
                <ReviewRow label="Pays" value={cfg.countries} />
                <ReviewRow label="Âge" value={`${cfg.ageMin} – ${cfg.ageMax} ans`} />
                <ReviewRow label="Genre" value={{ '0': 'Tous', '1': 'Hommes', '2': 'Femmes' }[cfg.genders]} />
                <ReviewRow label="Optimisation" value={OPT_GOALS.find(o => o.value === cfg.optimizationGoal)?.label} />
              </ReviewCard>
              <ReviewCard title="Créatif" icon="🎨" wide>
                <ReviewRow label="Titre" value={cfg.headline} />
                <ReviewRow label="Description" value={cfg.description || '—'} />
                <ReviewRow label="CTA" value={CTA_TYPES.find(c => c.value === cfg.ctaType)?.label} />
                <ReviewRow label="URL" value={cfg.destinationUrl} />
                <ReviewRow label="Image" value={cfg.creativeImage ? '✅ Uploadée' : '❌ Aucune'} />
              </ReviewCard>
            </div>

            <div className={styles.launchNotice}>
              ⚠️ L'annonce sera créée en statut <strong>PAUSED</strong>. Vous devrez l'activer manuellement dans Meta Ads Manager.
            </div>

            {launchError && <div className={styles.errorBox}>{launchError}</div>}

            <button className={styles.btnLaunch} onClick={launch} disabled={launching}>
              {launching ? (
                <><span className={styles.spinner} /> Création en cours…</>
              ) : (
                <>🚀 Lancer la campagne Meta</>
              )}
            </button>
          </StepShell>
        )}

        {/* ─ Step 6 : Succès ─ */}
        {step === 6 && (
          <StepShell title="Campagne créée !" icon="🎉" desc="Votre campagne a été créée avec succès dans Meta Ads Manager.">
            <div className={styles.successLaunch}>
              <div className={styles.successBig}>🎉</div>
              <h2 className={styles.successH2}>Campagne créée avec succès</h2>
              <p className={styles.successP}>Elle est actuellement en statut <strong>PAUSED</strong>. Activez-la dans Meta Ads Manager quand vous êtes prêt.</p>

              <div className={styles.stepsLog}>
                {launchSteps.map((s, i) => (
                  <div key={i} className={styles.logRow}>
                    <span className={styles.logCheck}>✓</span>
                    <span className={styles.logLabel}>{s.label}</span>
                    <code className={styles.logId}>{s.id}</code>
                  </div>
                ))}
              </div>

              <a href={`https://adsmanager.facebook.com/`} target="_blank" rel="noreferrer" className={styles.btnGold}>
                Ouvrir Meta Ads Manager →
              </a>
            </div>
          </StepShell>
        )}

      </div>

      {/* ── Bottom navigation ── */}
      {step < 6 && (
        <div className={styles.nav}>
          <button className={styles.btnGhost} onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
            ← Précédent
          </button>
          <div className={styles.navInfo}>{step} / {STEPS.length - 1}</div>
          {step < 5 ? (
            <button className={styles.btnGold} onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
              Suivant →
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ─── Local sub-components ─────────────────────────────────────────

function StepShell({ title, icon, desc, children }) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, fontWeight: 700, margin: 0 }}>
          <span>{icon}</span>{title}
        </h2>
        {desc && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function SectionTitle({ children, style }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '16px 0 8px', ...style }}>{children}</div>
}

function Field({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
        {label} {required && <span style={{ color: 'var(--gold)' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function HelpText({ children }) {
  return <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '3px 0 0', lineHeight: 1.5 }}>{children}</p>
}

function CharCount({ val, max }) {
  const len = (val || '').length
  return <span style={{ fontSize: 10, color: len > max * 0.85 ? 'var(--danger, #dc2626)' : 'var(--text-muted)', textAlign: 'right' }}>{len}/{max}</span>
}

function ReviewCard({ title, icon, children, wide }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px', gridColumn: wide ? 'span 2' : 'span 1' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon} {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, gap: 8 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function AdPreview({ cfg }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: '#fff', fontSize: 13, maxWidth: 300, boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
      {/* FB top bar */}
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>f</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>Follow Me Travel</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>Sponsorisé · 🌍</div>
        </div>
      </div>
      {/* Text */}
      <div style={{ padding: '0 12px 10px', fontSize: 13, color: '#0f172a', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
        {cfg.adText || 'Votre texte ici…'}
      </div>
      {/* Image */}
      {cfg.creativeImage
        ? <img src={cfg.creativeImage} alt="creative" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
        : <div style={{ height: 160, background: '#f0ece3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 12 }}>Image de l'annonce</div>
      }
      {/* CTA bar */}
      <div style={{ padding: '10px 12px', background: '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{cfg.headline || 'Titre'}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{cfg.description || new URL(cfg.destinationUrl || 'https://x.com').hostname}</div>
        </div>
        <div style={{ background: '#1877f2', color: '#fff', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {CTA_TYPES.find(c => c.value === cfg.ctaType)?.label || 'En savoir +'}
        </div>
      </div>
    </div>
  )
}
