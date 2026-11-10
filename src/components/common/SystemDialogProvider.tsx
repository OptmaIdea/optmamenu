import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, Trash2, X } from 'lucide-react';

export type SystemDialogTone = 'default' | 'danger' | 'success';

export interface SystemConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: SystemDialogTone;
}

export interface SystemPromptOptions extends SystemConfirmOptions {
  inputLabel: string;
  placeholder?: string;
}

type PendingDialog =
  | (SystemConfirmOptions & { kind: 'confirm'; resolve: (confirmed: boolean) => void })
  | (SystemConfirmOptions & { kind: 'notice'; resolve: () => void })
  | (SystemPromptOptions & { kind: 'prompt'; resolve: (answer: string | null) => void });

type SystemDialogContextValue = {
  confirm: (options: SystemConfirmOptions) => Promise<boolean>;
};

const SystemDialogContext = createContext<SystemDialogContextValue | null>(null);
let imperativeConfirm: ((options: SystemConfirmOptions) => Promise<boolean>) | null = null;
let imperativeNotice: ((options: SystemConfirmOptions) => Promise<void>) | null = null;
let imperativePrompt: ((options: SystemPromptOptions) => Promise<string | null>) | null = null;

export function systemConfirm(options: SystemConfirmOptions) {
  if (!imperativeConfirm) return Promise.resolve(false);
  return imperativeConfirm(options);
}

export function systemNotice(options: SystemConfirmOptions): Promise<void> {
  return imperativeNotice?.(options) ?? Promise.resolve();
}

export function systemPrompt(options: SystemPromptOptions): Promise<string | null> {
  return imperativePrompt?.(options) ?? Promise.resolve(null);
}

export function useSystemDialog() {
  const context = useContext(SystemDialogContext);
  if (!context) throw new Error('useSystemDialog must be used within SystemDialogProvider');
  return context;
}

export function SystemDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDialog | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback((options: SystemConfirmOptions) => (
    new Promise<boolean>((resolve) => {
      setPending({ ...options, kind: 'confirm', resolve });
    })
  ), []);

  const notice = useCallback((options: SystemConfirmOptions) => (
    new Promise<void>((resolve) => setPending({ ...options, kind: 'notice', resolve }))
  ), []);

  const prompt = useCallback((options: SystemPromptOptions) => (
    new Promise<string | null>((resolve) => {
      setPromptValue('');
      setPending({ ...options, kind: 'prompt', resolve });
    })
  ), []);

  useEffect(() => {
    imperativeConfirm = confirm;
    imperativeNotice = notice;
    imperativePrompt = prompt;
    return () => {
      if (imperativeConfirm === confirm) imperativeConfirm = null;
      if (imperativeNotice === notice) imperativeNotice = null;
      if (imperativePrompt === prompt) imperativePrompt = null;
    };
  }, [confirm, notice, prompt]);

  const finish = useCallback((confirmed: boolean) => {
    setPending((current) => {
      if (current?.kind === 'confirm') current.resolve(confirmed);
      else if (current?.kind === 'notice') current.resolve();
      else if (current?.kind === 'prompt') current.resolve(confirmed ? promptValue.trim() || null : null);
      return null;
    });
  }, [promptValue]);

  useEffect(() => {
    if (!pending) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => confirmButtonRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [finish, pending]);

  const value = useMemo(() => ({ confirm }), [confirm]);

  const tone = pending?.tone ?? 'default';
  const toneClasses = tone === 'danger'
    ? {
        icon: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
        button: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
      }
    : tone === 'success'
      ? {
          icon: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
          button: 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500',
        }
      : {
          icon: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
          button: 'bg-slate-900 hover:bg-slate-800 focus-visible:ring-slate-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100',
        };

  const Icon = tone === 'danger' ? Trash2 : tone === 'success' ? CheckCircle2 : Info;

  return (
    <SystemDialogContext.Provider value={value}>
      {children}

      {pending && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/55 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) finish(false);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="system-dialog-title"
            aria-describedby="system-dialog-description"
            className="relative w-full max-w-md rounded-[2rem] border border-white/20 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => finish(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label="Fechar aviso"
            >
              <X className="h-5 w-5" />
            </button>

            <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${toneClasses.icon}`}>
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>

            <h2 id="system-dialog-title" className="pr-10 text-xl font-black text-slate-950 dark:text-white">
              {pending.title}
            </h2>
            <p id="system-dialog-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {pending.description}
            </p>

            {tone === 'danger' && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Confirme somente se deseja realmente continuar.
              </div>
            )}

            {pending.kind === 'prompt' && (
              <label className="mt-5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                {pending.inputLabel}
                <textarea
                  value={promptValue}
                  onChange={(event) => setPromptValue(event.target.value)}
                  placeholder={pending.placeholder}
                  rows={3}
                  autoFocus
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </label>
            )}

            <div className={`mt-6 grid gap-3 ${pending.kind === 'notice' ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {pending.kind !== 'notice' && (
                <button
                  type="button"
                  onClick={() => finish(false)}
                  className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  {pending.cancelLabel ?? 'Cancelar'}
                </button>
              )}
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => finish(true)}
                disabled={pending.kind === 'prompt' && promptValue.trim().length === 0}
                className={`min-h-12 rounded-2xl px-4 text-sm font-black text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 ${toneClasses.button}`}
              >
                {pending.confirmLabel ?? (pending.kind === 'notice' ? 'Entendi' : 'Confirmar')}
              </button>
            </div>
          </section>
        </div>
      )}
    </SystemDialogContext.Provider>
  );
}
