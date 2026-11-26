import { useEffect, useState } from 'react'
import { FolderOpen, CircleCheck, CircleAlert, ExternalLink } from 'lucide-react'
import { api, type AppEnv } from '@/lib/api'
import { useSettings, type ThemeChoice } from '@/lib/settings'
import { Button, PageHeader, Panel, Segmented, cx } from '@/components/ui'
import { Logo } from '@/components/Logo'
import { iconFor } from '@/components/Sidebar'

const REPO = 'https://github.com/Sm3th/io-convert'

const THEMES: { id: ThemeChoice; label: string; hint: string }[] = [
  { id: 'system', label: 'System', hint: 'Follows your Windows setting' },
  { id: 'dark', label: 'Dark mode', hint: 'Darkroom: prussian blue' },
  { id: 'light', label: 'Light mode', hint: 'Print: cream paper, blue ink' }
]

// Fixed colors on purpose: each card shows its theme whatever theme is active.
const SWATCH = {
  dark: { canvas: '#0d1830', side: '#0b1529', panel: '#12213f', line: '#253a64', text: '#edf2fb', dim: '#64779d', accent: '#6fb6ff', amber: '#f4b860' },
  light: { canvas: '#f2eee3', side: '#ebe5d5', panel: '#fbf9f3', line: '#ddd5c1', text: '#13254b', dim: '#7a849b', accent: '#1d5fbf', amber: '#b9700f' }
}

function MiniApp({ c }: { c: (typeof SWATCH)['dark'] }) {
  return (
    <svg viewBox="0 0 160 96" className="block h-full w-full">
      <rect width="160" height="96" fill={c.canvas} />
      <rect width="38" height="96" fill={c.side} />
      <rect x="8" y="10" width="8" height="8" rx="2.5" fill={c.panel} stroke={c.line} />
      <rect x="9.6" y="12" width="1.6" height="4" rx=".8" fill={c.amber} />
      <circle cx="13.6" cy="14" r="1.8" fill="none" stroke={c.accent} strokeWidth="1.2" />
      <rect x="6" y="26" width="26" height="6" rx="2" fill={c.accent} opacity=".22" />
      {[38, 48, 58, 68].map((y) => (
        <rect key={y} x="9" y={y} width={y === 48 ? 16 : 20} height="3" rx="1.5" fill={c.dim} opacity=".7" />
      ))}
      <rect x="48" y="12" width="44" height="6" rx="2" fill={c.text} />
      <rect x="48" y="22" width="70" height="3" rx="1.5" fill={c.dim} />
      <rect x="48" y="32" width="70" height="54" rx="5" fill={c.panel} stroke={c.line} />
      <rect x="56" y="40" width="22" height="30" rx="1.5" fill="#fff" stroke={c.line} />
      <rect x="84" y="40" width="22" height="30" rx="1.5" fill="#fff" stroke={c.line} />
      <rect x="124" y="32" width="28" height="54" rx="5" fill={c.panel} stroke={c.line} />
      <rect x="129" y="72" width="18" height="7" rx="2" fill={c.accent} />
    </svg>
  )
}

function ThemePreview({ kind }: { kind: ThemeChoice }) {
  return (
    <div className="relative aspect-[5/3] overflow-hidden rounded-lg border border-line">
      {kind === 'light' ? (
        <MiniApp c={SWATCH.light} />
      ) : kind === 'dark' ? (
        <MiniApp c={SWATCH.dark} />
      ) : (
        <>
          <MiniApp c={SWATCH.dark} />
          <div className="absolute inset-0" style={{ clipPath: 'polygon(62% 0, 100% 0, 100% 100%, 38% 100%)' }}>
            <MiniApp c={SWATCH.light} />
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-6 px-6 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium">{label}</p>
        {hint && (
          <p className="truncate text-xs text-dim" title={hint}>
            {hint}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

export function Settings() {
  const { t, lang, outDir, theme, set } = useSettings()
  const [env, setEnv] = useState<AppEnv | null>(null)
  useEffect(() => {
    api.env().then(setEnv).catch(() => {})
  }, [])
  return (
    <div className="h-full overflow-y-auto pb-6">
      <PageHeader icon={iconFor('Settings')} title={t('Settings')} description={t('IO Convert works entirely offline. Your files never leave this computer.')} />
      <div className="max-w-[680px] space-y-5">
        <Panel className="p-6">
          <h2 className="mb-1 font-medium">{t('Theme')}</h2>
          <div className="mt-3 grid grid-cols-3 gap-3" role="radiogroup" aria-label={t('Theme')}>
            {THEMES.map((th) => (
              <button
                key={th.id}
                role="radio"
                aria-checked={theme === th.id}
                onClick={() => set({ theme: th.id })}
                className={cx(
                  'group rounded-xl border p-2 text-left transition-colors',
                  theme === th.id ? 'border-cyan bg-cyan/[0.06] ring-1 ring-cyan/40' : 'border-line hover:border-line-strong'
                )}
              >
                <ThemePreview kind={th.id} />
                <p className="mt-2.5 flex items-center gap-2 px-1 text-[13px] font-medium">
                  <span className={cx('flex h-3.5 w-3.5 items-center justify-center rounded-full border', theme === th.id ? 'border-cyan' : 'border-line-strong')}>
                    {theme === th.id && <span className="h-1.5 w-1.5 rounded-full bg-cyan" />}
                  </span>
                  {t(th.label)}
                </p>
                <p className="px-1 pl-6 text-xs text-dim">{t(th.hint)}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="divide-y divide-line">
          <Row label={t('Language')}>
            <div className="w-64">
              <Segmented value={lang} onChange={(l) => set({ lang: l })} options={[{ value: 'en', label: 'English' }, { value: 'tr', label: 'Türkçe' }]} />
            </div>
          </Row>
          <Row label={t('Output folder')} hint={outDir || t('Next to the original file')}>
            <div className="flex shrink-0 items-center gap-2">
              {outDir && (
                <Button variant="quiet" onClick={() => set({ outDir: '' })}>
                  {t('Reset')}
                </Button>
              )}
              <Button
                icon={<FolderOpen size={15} />}
                onClick={async () => {
                  const d = await api.pickFolder()
                  if (d) set({ outDir: d })
                }}
              >
                {t('Choose folder')}
              </Button>
            </div>
          </Row>
        </Panel>

        <Panel className="p-6">
          <h2 className="mb-3 font-medium">{t('Office documents')}</h2>
          {env && (
            <div className="flex items-start gap-3 text-[13px]">
              {env.office ? <CircleCheck size={18} className="mt-0.5 shrink-0 text-mint" /> : <CircleAlert size={18} className="mt-0.5 shrink-0 text-amber" />}
              <div className="flex-1">
                <p className="text-faded">
                  {env.office
                    ? t('LibreOffice found. Word, PowerPoint and OpenDocument files convert with full layout.')
                    : t('LibreOffice not found. DOCX, Markdown, HTML and text still work. Install LibreOffice for DOC, ODT, RTF and PowerPoint.')}
                </p>
                {!env.office && (
                  <a href="https://www.libreoffice.org/download/download/" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-cyan hover:underline">
                    {t('Get LibreOffice')} <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          )}
        </Panel>

        <Panel className="flex items-center gap-4 p-6">
          <Logo size={44} />
          <div className="flex-1">
            <p className="font-display text-lg font-semibold">IO Convert {env && <span className="font-normal text-faded">v{env.version}</span>}</p>
            <p className="text-[13px] text-faded">© IO Software · İsmet Organ · MIT</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-[13px]">
            <a href={`${REPO}/releases/latest`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-cyan hover:underline">
              {t('Check for updates')} <ExternalLink size={13} />
            </a>
            <a href={`${REPO}/issues/new/choose`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-faded hover:text-paper hover:underline">
              {t('Report a problem')} <ExternalLink size={13} />
            </a>
          </div>
        </Panel>
      </div>
    </div>
  )
}
