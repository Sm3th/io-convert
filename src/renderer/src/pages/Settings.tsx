import { useEffect, useState } from 'react'
import { FolderOpen, CircleCheck, CircleAlert, ExternalLink } from 'lucide-react'
import { api, type AppEnv } from '@/lib/api'
import { useSettings } from '@/lib/settings'
import { Button, Field, PageHeader, Panel, Segmented } from '@/components/ui'
import { Logo } from '@/components/Logo'

const REPO = 'https://github.com/Sm3th/io-convert'

export function Settings() {
  const { t, lang, outDir, set } = useSettings()
  const [env, setEnv] = useState<AppEnv | null>(null)
  useEffect(() => {
    api.env().then(setEnv).catch(() => {})
  }, [])
  return (
    <div className="h-full overflow-y-auto pb-6">
      <PageHeader title={t('Settings')} description={t('IO Convert works entirely offline. Your files never leave this computer.')} />
      <div className="max-w-[640px] space-y-5">
        <Panel className="space-y-6 p-6">
          <Field label={t('Language')}>
            <div className="w-64">
              <Segmented value={lang} onChange={(l) => set({ lang: l })} options={[{ value: 'en', label: 'English' }, { value: 'tr', label: 'Türkçe' }]} />
            </div>
          </Field>
          <Field label={t('Output folder')}>
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 truncate rounded-lg border border-line bg-ink/60 px-3 py-2 text-[13px]">{outDir || t('Next to the original file')}</p>
              <Button
                icon={<FolderOpen size={15} />}
                onClick={async () => {
                  const d = await api.pickFolder()
                  if (d) set({ outDir: d })
                }}
              >
                {t('Choose folder')}
              </Button>
              {outDir && (
                <Button variant="quiet" onClick={() => set({ outDir: '' })}>
                  {t('Reset changes')}
                </Button>
              )}
            </div>
          </Field>
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
