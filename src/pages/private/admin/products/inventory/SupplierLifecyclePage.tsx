import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Truck, Ban, CheckCircle2, Plus, Star, Download } from 'lucide-react';
import { toast } from 'sonner';

import { useSupplierLifecycle } from './hooks/useSupplierLifecycle';
import { supplierLifecycleService } from './services/supplierLifecycleService';
import { exportSupplierLifecycleCsv } from './utils/exportSupplierLifecycle';
import { SupplierLifecycleSummaryCards } from './components/SupplierLifecycleSummaryCards';
import { SupplierLifecycleTabs } from './components/SupplierLifecycleTabs';

import { getActiveStoreId } from '@/utils/activeStore';
import { usePermissions } from '@/hooks/usePermissions';

import {
  getSupplierOperationalBadges,
} from './utils/supplierStatusUtils';

export default function SupplierLifecyclePage() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const [activeTab, setActiveTab] = useState('purchases');

  const activeStoreId = getActiveStoreId();
  const { hasPermission } = usePermissions(activeStoreId);
  const canManageSuppliers = hasPermission('suppliers.manage');

  const {
    summary,
    purchases,
    products,
    prices,
    quotations,
    timeline,
    contacts,
    unifiedTimeline,
    loading,
    error,
    refresh,
  } = useSupplierLifecycle(supplierId);

  const [showContactForm, setShowContactForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [savingAction, setSavingAction] = useState(false);

  const [contactForm, setContactForm] = useState({
    name: '',
    department: 'commercial',
    role: '',
    phone: '',
    whatsapp: '',
    email: '',
    notes: '',
    isPrimary: false,
  });

  const [eventForm, setEventForm] = useState({
    eventType: 'note',
    title: '',
    description: '',
    severity: 'info',
    status: 'open',
  });

  const handleCreateContact = async () => {
    if (!supplierId || !contactForm.name.trim()) {
      toast.warning('Informe o nome do contato.');
      return;
    }

    try {
      setSavingAction(true);

      await supplierLifecycleService.createContact({
        supplierId,
        name: contactForm.name,
        department: contactForm.department,
        role: contactForm.role || null,
        phone: contactForm.phone || null,
        whatsapp: contactForm.whatsapp || null,
        email: contactForm.email || null,
        notes: contactForm.notes || null,
        isPrimary: contactForm.isPrimary,
      });

      toast.success('Contato criado com sucesso.');
      setShowContactForm(false);
      setContactForm({
        name: '',
        department: 'commercial',
        role: '',
        phone: '',
        whatsapp: '',
        email: '',
        notes: '',
        isPrimary: false,
      });

      await refresh();
    } catch (error) {
      console.error('Erro ao criar contato:', error);
      toast.error('Não foi possível criar o contato.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!supplierId || !eventForm.title.trim()) {
      toast.warning('Informe o título do evento.');
      return;
    }

    try {
      setSavingAction(true);

      await supplierLifecycleService.createRelationshipEvent({
        supplierId,
        eventType: eventForm.eventType,
        title: eventForm.title,
        description: eventForm.description || null,
        severity: eventForm.severity,
        status: eventForm.status,
      });

      toast.success('Evento registrado com sucesso.');
      setShowEventForm(false);
      setEventForm({
        eventType: 'note',
        title: '',
        description: '',
        severity: 'info',
        status: 'open',
      });

      await refresh();
    } catch (error) {
      console.error('Erro ao registrar evento:', error);
      toast.error('Não foi possível registrar o evento.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleTogglePreferred = async () => {
    if (!supplierId || !summary) return;

    try {
      setSavingAction(true);

      await supplierLifecycleService.updateOperationalStatus({
        supplierId,
        preferredSupplier: !summary.preferred_supplier,
      });

      toast.success(
        !summary.preferred_supplier
          ? 'Fornecedor marcado como preferencial.'
          : 'Fornecedor removido dos preferenciais.'
      );

      await refresh();
    } catch (error) {
      console.error('Erro ao atualizar fornecedor preferencial:', error);
      toast.error('Não foi possível atualizar o fornecedor.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleApproveSupplier = async () => {
    if (!supplierId) return;

    try {
      setSavingAction(true);

      await supplierLifecycleService.updateOperationalStatus({
        supplierId,
        homologationStatus: 'approved',
        blocked: false,
        blockedReason: null,
      });

      toast.success('Fornecedor aprovado.');
      await refresh();
    } catch (error) {
      console.error('Erro ao aprovar fornecedor:', error);
      toast.error('Não foi possível aprovar o fornecedor.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleBlockSupplier = async () => {
    if (!supplierId || !summary) return;
    const reason = window.prompt('Informe o motivo do bloqueio:') || 'Bloqueio operacional.';
    try {
      setSavingAction(true);
      await supplierLifecycleService.updateOperationalStatus({
        supplierId,
        blocked: true,
        blockedReason: reason,
        homologationStatus: 'blocked',
      });
      await supplierLifecycleService.createRelationshipEvent({
        supplierId,
        eventType: 'block',
        title: 'Fornecedor bloqueado',
        description: reason,
        severity: 'high',
        status: 'done',
      });
      toast.success('Fornecedor bloqueado.');
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível bloquear o fornecedor.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleUnblockSupplier = async () => {
    if (!supplierId || !summary) return;
    try {
      setSavingAction(true);
      await supplierLifecycleService.updateOperationalStatus({
        supplierId,
        blocked: false,
        blockedReason: null,
        homologationStatus: 'pending',
      });
      await supplierLifecycleService.createRelationshipEvent({
        supplierId,
        eventType: 'unblock',
        title: 'Fornecedor desbloqueado',
        description: 'Bloqueio operacional removido. Homologação voltou para análise.',
        severity: 'info',
        status: 'done',
      });
      toast.success('Fornecedor desbloqueado.');
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível desbloquear o fornecedor.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleRejectSupplier = async () => {
    if (!supplierId) return;
    try {
      setSavingAction(true);
      await supplierLifecycleService.updateOperationalStatus({
        supplierId,
        homologationStatus: 'rejected',
      });
      await supplierLifecycleService.createRelationshipEvent({
        supplierId,
        eventType: 'rejection',
        title: 'Fornecedor rejeitado',
        description: 'Fornecedor marcado como rejeitado na homologação.',
        severity: 'high',
        status: 'done',
      });
      toast.success('Fornecedor rejeitado.');
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível rejeitar o fornecedor.');
    } finally {
      setSavingAction(false);
    }
  };

  const handleExportSupplierLifecycle = () => {
    if (!summary) {
      toast.warning('Nenhum fornecedor carregado para exportar.');
      return;
    }

    exportSupplierLifecycleCsv({
      summary,
      purchases,
      products,
      prices,
      quotations,
      contacts,
      timeline,
      unifiedTimeline,
    });

    toast.success('Vida do fornecedor exportada com sucesso.');
  };

  const supplierBadges = summary ? getSupplierOperationalBadges(summary) : [];

  const pageTitle = useMemo(() => {
    return summary?.trade_name || summary?.name || 'Vida do Fornecedor';
  }, [summary]);

  if (loading && !summary) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
        <div className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-700" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-700"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          <p className="font-semibold">Erro ao carregar Vida do Fornecedor</p>
          <p className="mt-1 text-sm">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-3 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          Fornecedor não encontrado ou sem permissão de acesso.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            to="/admin/suppliers"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#21A896] hover:underline"
          >
            <ArrowLeft size={16} />
            Voltar para fornecedores
          </Link>

          <div className="mt-2 flex items-center gap-2">
            <Truck size={24} className="text-[#21A896]" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {pageTitle}
            </h1>
          </div>

          {/* Badges dinâmicos do helper */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {supplierBadges.map((badge) => {
              const Icon = badge.icon;

              return (
                <span
                  key={badge.key}
                  title={badge.title}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${badge.className}`}
                >
                  <Icon size={13} />
                  {badge.label}
                </span>
              );
            })}
          </div>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Visão 360º do fornecedor, compras, produtos, preços e relacionamento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowContactForm((value) => !value)}
            disabled={savingAction}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <Plus size={16} />
            Novo contato
          </button>

          <button
            type="button"
            onClick={() => setShowEventForm((value) => !value)}
            disabled={savingAction}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <Plus size={16} />
            Registrar evento
          </button>

          <button
            type="button"
            onClick={handleExportSupplierLifecycle}
            disabled={loading || savingAction || !summary}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Download size={16} />
            Exportar vida
          </button>

          <button
            type="button"
            onClick={refresh}
            disabled={loading || savingAction}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>

          {canManageSuppliers && (
            <>
              <button
                type="button"
                onClick={handleTogglePreferred}
                disabled={savingAction}
                className="inline-flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm font-semibold text-yellow-700 hover:bg-yellow-100 disabled:opacity-60 dark:border-yellow-900/40 dark:bg-yellow-950/20 dark:text-yellow-300"
              >
                <Star size={16} />
                {summary.preferred_supplier ? 'Remover preferencial' : 'Marcar preferencial'}
              </button>

              {summary.homologation_status !== 'approved' && (
                <button
                  type="button"
                  onClick={handleApproveSupplier}
                  disabled={savingAction}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle2 size={16} />
                  Aprovar
                </button>
              )}

              {summary.homologation_status !== 'rejected' && summary.homologation_status !== 'blocked' && (
                <button
                  type="button"
                  onClick={handleRejectSupplier}
                  disabled={savingAction}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                >
                  <Ban size={16} />
                  Reprovar
                </button>
              )}

              {summary?.blocked ? (
                <button
                  type="button"
                  onClick={() => void handleUnblockSupplier()}
                  disabled={savingAction}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                >
                  Desbloquear
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleBlockSupplier()}
                  disabled={savingAction}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  <Ban size={16} />
                  Bloquear
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {showContactForm && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Novo contato
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={contactForm.name}
              onChange={(event) =>
                setContactForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Nome do contato"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
            />

            <select
              value={contactForm.department}
              onChange={(event) =>
                setContactForm((current) => ({ ...current, department: event.target.value }))
              }
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="commercial">Comercial</option>
              <option value="financial">Financeiro</option>
              <option value="fiscal">Fiscal</option>
              <option value="logistics">Logística</option>
              <option value="support">Suporte</option>
              <option value="other">Outro</option>
            </select>

            <input
              value={contactForm.role}
              onChange={(event) =>
                setContactForm((current) => ({ ...current, role: event.target.value }))
              }
              placeholder="Cargo/função"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
            />

            <input
              value={contactForm.email}
              onChange={(event) =>
                setContactForm((current) => ({ ...current, email: event.target.value }))
              }
              placeholder="E-mail"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
            />

            <input
              value={contactForm.phone}
              onChange={(event) =>
                setContactForm((current) => ({ ...current, phone: event.target.value }))
              }
              placeholder="Telefone"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
            />

            <input
              value={contactForm.whatsapp}
              onChange={(event) =>
                setContactForm((current) => ({ ...current, whatsapp: event.target.value }))
              }
              placeholder="WhatsApp"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
            />

            <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
              <input
                type="checkbox"
                checked={contactForm.isPrimary}
                onChange={(event) =>
                  setContactForm((current) => ({
                    ...current,
                    isPrimary: event.target.checked,
                  }))
                }
              />
              Contato principal
            </label>
          </div>

          <textarea
            value={contactForm.notes}
            onChange={(event) =>
              setContactForm((current) => ({ ...current, notes: event.target.value }))
            }
            placeholder="Observações"
            className="mt-3 min-h-[80px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
          />

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowContactForm(false)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium dark:border-gray-700"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleCreateContact}
              disabled={savingAction}
              className="rounded-xl bg-[#21A896] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingAction ? 'Salvando...' : 'Salvar contato'}
            </button>
          </div>
        </div>
      )}

      {showEventForm && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Registrar evento de relacionamento
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select
              value={eventForm.eventType}
              onChange={(event) =>
                setEventForm((current) => ({ ...current, eventType: event.target.value }))
              }
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="note">Observação</option>
              <option value="call">Ligação</option>
              <option value="email">E-mail</option>
              <option value="meeting">Reunião</option>
              <option value="negotiation">Negociação</option>
              <option value="incident">Incidente</option>
              <option value="complaint">Reclamação</option>
              <option value="follow_up">Follow-up</option>
              <option value="homologation">Homologação</option>
              <option value="document">Documento</option>
              <option value="other">Outro</option>
            </select>

            <input
              value={eventForm.title}
              onChange={(event) =>
                setEventForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Título"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
            />

            <select
              value={eventForm.severity}
              onChange={(event) =>
                setEventForm((current) => ({ ...current, severity: event.target.value }))
              }
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="info">Informativo</option>
              <option value="low">Baixo</option>
              <option value="medium">Médio</option>
              <option value="high">Alto</option>
              <option value="critical">Crítico</option>
            </select>

            <select
              value={eventForm.status}
              onChange={(event) =>
                setEventForm((current) => ({ ...current, status: event.target.value }))
              }
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="open">Aberto</option>
              <option value="done">Concluído</option>
              <option value="archived">Arquivado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          <textarea
            value={eventForm.description}
            onChange={(event) =>
              setEventForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Descrição do evento"
            className="mt-3 min-h-[100px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
          />

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowEventForm(false)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium dark:border-gray-700"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleCreateEvent}
              disabled={savingAction}
              className="rounded-xl bg-[#21A896] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingAction ? 'Salvando...' : 'Registrar evento'}
            </button>
          </div>
        </div>
      )}

      <SupplierLifecycleSummaryCards summary={summary} />

      <SupplierLifecycleTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        purchases={purchases}
        products={products}
        prices={prices}
        quotations={quotations}
        timeline={timeline}
        contacts={contacts}
        unifiedTimeline={unifiedTimeline}
      />
    </div>
  );
}
