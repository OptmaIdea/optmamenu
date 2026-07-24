# 📁 Estrutura de Arquivos e Dependências — OptmaMenu

Este documento contém a estrutura física completa dos arquivos e pastas do projeto, com foco na pasta `src` e nos arquivos de configuração raiz, incluindo um mapeamento preliminar de dependências locais (importações).

## 🚀 Principais Pontos de Entrada e Fluxos

- **[index.html](file:///d:/OptmaIdea/optmamenu/index.html)**: Ponto de entrada HTML do navegador.
- **[src/main.tsx](file:///d:/OptmaIdea/optmamenu/src/main.tsx)**: Ponto de entrada do React que renderiza o App.
- **[src/App.tsx](file:///d:/OptmaIdea/optmamenu/src/App.tsx)**: Componente raiz que inicializa os provedores, estilos globais (`App.css`, `index.css`) e renderiza as rotas.
- **[src/AppRoutes.tsx](file:///d:/OptmaIdea/optmamenu/src/AppRoutes.tsx)**: Gerenciador de rotas da aplicação, dividindo rotas públicas, rotas da loja pública e rotas privadas protegidas do admin.

## 🌲 Árvore de Diretórios (src e configurações da raiz)

- **src/**
  - **__tests__/**
    - **services/**
      - [cashbookService.test.ts](file:///d:/OptmaIdea/optmamenu/src/__tests__/services/cashbookService.test.ts) <!-- Depende de: cashbookService.ts -->
    - **store/**
      - [useCartStore.test.ts](file:///d:/OptmaIdea/optmamenu/src/__tests__/store/useCartStore.test.ts) <!-- Depende de: useCartStore.ts, index.ts -->
    - **utils/**
      - [timezoneUtils.test.ts](file:///d:/OptmaIdea/optmamenu/src/__tests__/utils/timezoneUtils.test.ts) <!-- Depende de: timezoneUtils.ts -->
  - **components/**
    - **admin/**
      - [index.ts](file:///d:/OptmaIdea/optmamenu/src/components/admin/index.ts)
      - [StorePreview.tsx](file:///d:/OptmaIdea/optmamenu/src/components/admin/StorePreview.tsx) <!-- Depende de: index.ts -->
    - **common/**
      - **empty-state/**
        - [EmptyState.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyState.tsx)
        - [EmptyTableState.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyTableState.tsx)
      - **navigation/**
        - [BackToTopButton.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/navigation/BackToTopButton.tsx)
      - **tooltip/**
        - [InfoTooltip.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/tooltip/InfoTooltip.tsx)
      - [AlertBanner.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/AlertBanner.tsx)
      - [CookieConsent.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/CookieConsent.tsx)
      - [DataCard.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/DataCard.tsx)
      - [DateRangeFilter.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/DateRangeFilter.tsx)
      - [index.ts](file:///d:/OptmaIdea/optmamenu/src/components/common/index.ts)
      - [InfoCard.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/InfoCard.tsx)
      - [LoadingSpinner.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
      - [MetaTags.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/MetaTags.tsx)
      - [OrderStatusFilter.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/OrderStatusFilter.tsx)
      - [PageContainer.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
      - [ProgressCard.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/ProgressCard.tsx)
      - [RecentActivity.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/RecentActivity.tsx)
      - [SecurityConfirmModal.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/SecurityConfirmModal.tsx) <!-- Depende de: useStorePassword.ts -->
      - [StatsCard.tsx](file:///d:/OptmaIdea/optmamenu/src/components/common/StatsCard.tsx)
    - **invites/**
      - [MyStoreInvitesBanner.tsx](file:///d:/OptmaIdea/optmamenu/src/components/invites/MyStoreInvitesBanner.tsx) <!-- Depende de: useMyStoreInvites.ts, myStoreInvites.ts -->
    - **layouts/**
      - [PrivateLayout.tsx](file:///d:/OptmaIdea/optmamenu/src/components/layouts/PrivateLayout.tsx) <!-- Depende de: supabase.ts, sessionSecurity.ts, securityService.ts, useOrderMonitor.ts, LoadingSpinner.tsx, BackToTopButton.tsx, useInventoryAttentionCount.ts, usePermissions.ts, permissions.ts, useRealtimeListener.ts, MyStoreInvitesBanner.tsx, useIdleSessionTimeout.ts, permissionEvents.ts, activeStore.ts -->
      - [PublicLayout.tsx](file:///d:/OptmaIdea/optmamenu/src/components/layouts/PublicLayout.tsx)
      - [StoreLayout.tsx](file:///d:/OptmaIdea/optmamenu/src/components/layouts/StoreLayout.tsx) <!-- Depende de: useCartStore.ts -->
    - **mobile/**
      - [NotificationReceiver.tsx](file:///d:/OptmaIdea/optmamenu/src/components/mobile/NotificationReceiver.tsx) <!-- Depende de: supabase.ts, notificationService.ts -->
    - **security/**
      - [PermissionLocked.tsx](file:///d:/OptmaIdea/optmamenu/src/components/security/PermissionLocked.tsx)
      - [PermissionReadOnlyNotice.tsx](file:///d:/OptmaIdea/optmamenu/src/components/security/PermissionReadOnlyNotice.tsx)
    - **users/**
      - [index.ts](file:///d:/OptmaIdea/optmamenu/src/components/users/index.ts)
      - [UserCard.tsx](file:///d:/OptmaIdea/optmamenu/src/components/users/UserCard.tsx) <!-- Depende de: index.ts, security.ts, UserStatusBadge.tsx, UserRoleBadge.tsx -->
      - [UserDetailModal.tsx](file:///d:/OptmaIdea/optmamenu/src/components/users/UserDetailModal.tsx) <!-- Depende de: index.ts, security.ts, UserStatusBadge.tsx, UserRoleBadge.tsx, useStoreMemberDetails.ts, useStoreMemberFullHistory.ts, securityService.ts, userAvatarService.ts -->
      - [UserFormModal.tsx](file:///d:/OptmaIdea/optmamenu/src/components/users/UserFormModal.tsx) <!-- Depende de: index.ts -->
      - [UserInvitesPanel.tsx](file:///d:/OptmaIdea/optmamenu/src/components/users/UserInvitesPanel.tsx) <!-- Depende de: storeMemberInvites.ts, security.ts -->
      - [UserRoleBadge.tsx](file:///d:/OptmaIdea/optmamenu/src/components/users/UserRoleBadge.tsx) <!-- Depende de: index.ts -->
      - [UserStatusBadge.tsx](file:///d:/OptmaIdea/optmamenu/src/components/users/UserStatusBadge.tsx) <!-- Depende de: index.ts -->
    - [index.ts](file:///d:/OptmaIdea/optmamenu/src/components/index.ts)
    - [LoyaltyPoints.tsx](file:///d:/OptmaIdea/optmamenu/src/components/LoyaltyPoints.tsx) <!-- Depende de: supabase.ts, useCustomerAuth.ts, customerService.ts, index.ts -->
    - [ProtectedRoute.tsx](file:///d:/OptmaIdea/optmamenu/src/components/ProtectedRoute.tsx) <!-- Depende de: useAuthStore.ts -->
    - [RequireActiveStoreMember.tsx](file:///d:/OptmaIdea/optmamenu/src/components/RequireActiveStoreMember.tsx) <!-- Depende de: useSecurityContext.ts, activeStore.ts, PageContainer.tsx -->
    - [RequirePermission.tsx](file:///d:/OptmaIdea/optmamenu/src/components/RequirePermission.tsx) <!-- Depende de: useSecurityContext.ts, usePermissions.ts, permissions.ts, activeStore.ts, PageContainer.tsx -->
  - **constants/**
    - [legalTemplates.ts](file:///d:/OptmaIdea/optmamenu/src/constants/legalTemplates.ts)
  - **hooks/**
    - **financial/**
      - [useCashbookClassificationOptions.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/financial/useCashbookClassificationOptions.ts) <!-- Depende de: cashbookAccountPlanService.ts, financialAccountsService.ts, cashbookService.ts, ptBrFinancialLabels.ts -->
    - **inventory/**
      - [useInventoryAttentionCount.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/inventory/useInventoryAttentionCount.ts) <!-- Depende de: useCurrentStore.ts, stockService.ts -->
      - [useProductInventorySnapshot.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/inventory/useProductInventorySnapshot.ts) <!-- Depende de: useCurrentStore.ts, stockService.ts -->
    - **security/**
      - [useSecurityPermissionsAdmin.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/security/useSecurityPermissionsAdmin.ts) <!-- Depende de: supabase.ts, activeStore.ts, permissionEvents.ts, permissionCatalogVisibility.ts, security.ts -->
      - [useStoreCustomRoles.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/security/useStoreCustomRoles.ts) <!-- Depende de: supabase.ts, activeStore.ts, security.ts -->
      - [useStoreMemberFullHistory.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/security/useStoreMemberFullHistory.ts) <!-- Depende de: supabase.ts, activeStore.ts, security.ts -->
      - [useStoreMemberSessionSummary.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/security/useStoreMemberSessionSummary.ts) <!-- Depende de: supabase.ts, activeStore.ts, security.ts -->
    - **stock/**
      - [useStockAlerts.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/stock/useStockAlerts.ts) <!-- Depende de: supabase.ts -->
    - **store/**
      - [useCurrentStore.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts) <!-- Depende de: supabase.ts, activeStore.ts -->
    - [useIdleSessionTimeout.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/useIdleSessionTimeout.ts) <!-- Depende de: supabase.ts, useAuthStore.ts, activeStore.ts -->
    - [useMyStoreInvites.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/useMyStoreInvites.ts) <!-- Depende de: myStoreInviteService.ts, myStoreInvites.ts -->
    - [useOrderMonitor.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/useOrderMonitor.ts) <!-- Depende de: supabase.ts -->
    - [usePermissions.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts) <!-- Depende de: supabase.ts, permissionService.ts, permissionEvents.ts, permissions.ts -->
    - [useRealtimeListener.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/useRealtimeListener.ts) <!-- Depende de: supabase.ts -->
    - [useRefreshFrame.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/useRefreshFrame.ts)
    - [useSecurityContext.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/useSecurityContext.ts) <!-- Depende de: securityService.ts, security.ts -->
    - [useStoreMemberDetails.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreMemberDetails.ts) <!-- Depende de: userMemberDetailsService.ts, userMemberDetails.ts -->
    - [useStoreMemberInvites.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreMemberInvites.ts) <!-- Depende de: storeMemberInviteService.ts, storeMemberInvites.ts, security.ts -->
    - [useStoreSecurityConfig.ts](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreSecurityConfig.ts) <!-- Depende de: supabase.ts -->
  - **lib/**
    - [jwt.ts](file:///d:/OptmaIdea/optmamenu/src/lib/jwt.ts) <!-- Depende de: supabase.ts -->
    - [supabase.ts](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
  - **pages/**
    - **initial/**
      - **auth/**
        - [ActivateInvite.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/initial/auth/ActivateInvite.tsx) <!-- Depende de: supabase.ts, myStoreInviteService.ts, activeStore.ts, sessionSecurity.ts -->
        - [ForgotPassword.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/initial/auth/ForgotPassword.tsx) <!-- Depende de: supabase.ts -->
        - [Login.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/initial/auth/Login.tsx) <!-- Depende de: supabase.ts, activeStore.ts, security.ts, sessionSecurity.ts -->
        - [ResetPassword.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/initial/auth/ResetPassword.tsx) <!-- Depende de: supabase.ts -->
        - [SignUp.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/initial/auth/SignUp.tsx) <!-- Depende de: supabase.ts -->
      - **home/**
        - [Landing.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/initial/home/Landing.tsx) <!-- Depende de: MetaTags.tsx -->
      - **legal/**
        - [PrivacyPolicy.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/initial/legal/PrivacyPolicy.tsx)
        - [Terms.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/initial/legal/Terms.tsx)
    - **private/**
      - **admin/**
        - **commercial/**
          - **customers/**
            - [Customers.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/customers/Customers.tsx) <!-- Depende de: supabase.ts -->
          - **dashboard/**
            - [CommercialDashboardPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/dashboard/CommercialDashboardPage.tsx) <!-- Depende de: useCurrentStore.ts, PageContainer.tsx, DateRangeFilter.tsx, commercialDashboardService.ts -->
          - **directSales/**
            - **components/**
              - [QuickPosCartSheet.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/directSales/components/QuickPosCartSheet.tsx) <!-- Depende de: customers360Service.ts, DirectSalesPage.tsx -->
              - [QuickPosModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/directSales/components/QuickPosModal.tsx) <!-- Depende de: customers360Service.ts, QuickPosProductCard.tsx, QuickPosCartSheet.tsx, DirectSalesPage.tsx -->
              - [QuickPosProductCard.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/directSales/components/QuickPosProductCard.tsx)
            - [DirectSalesPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx) <!-- Depende de: PageContainer.tsx, supabase.ts, activeStore.ts, directSalesService.ts, customers360Service.ts, QuickPosModal.tsx -->
          - **loyalty/**
            - **settings/**
              - [CategoryRules.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/settings/CategoryRules.tsx) <!-- Depende de: supabase.ts -->
              - [LevelsConfig.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/settings/LevelsConfig.tsx) <!-- Depende de: supabase.ts -->
              - [ManualPoints.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/settings/ManualPoints.tsx) <!-- Depende de: supabase.ts -->
              - [RewardsConfig.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/settings/RewardsConfig.tsx) <!-- Depende de: supabase.ts -->
            - **terms/**
              - [LegalTerms.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/terms/LegalTerms.tsx) <!-- Depende de: supabase.ts -->
            - [LoyaltyConfig.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/LoyaltyConfig.tsx) <!-- Depende de: supabase.ts, PageContainer.tsx, LevelsConfig.tsx, CategoryRules.tsx, ManualPoints.tsx, RewardsConfig.tsx, LegalTerms.tsx, index.ts -->
          - **messages/**
            - [Messages.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/messages/Messages.tsx) <!-- Depende de: supabase.ts, PageContainer.tsx -->
          - **orders/**
            - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/orders/index.ts)
            - [OrderHistory.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/orders/OrderHistory.tsx) <!-- Depende de: customerService.ts, useCustomerAuth.ts, index.ts -->
            - [Orders.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/orders/Orders.tsx) <!-- Depende de: supabase.ts, index.ts, PageContainer.tsx, OrderStatusFilter.tsx, useRefreshFrame.ts, useRealtimeListener.ts -->
          - **paymentMethods/**
            - [PaymentMethodsPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/paymentMethods/PaymentMethodsPage.tsx) <!-- Depende de: useCurrentStore.ts, PageContainer.tsx, paymentMethodsService.ts -->
          - **salesChannels/**
            - [SalesChannelsPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/salesChannels/SalesChannelsPage.tsx) <!-- Depende de: useCurrentStore.ts, PageContainer.tsx, salesChannelsService.ts -->
          - **settings/**
            - [CommercialSettingsPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/settings/CommercialSettingsPage.tsx) <!-- Depende de: useCurrentStore.ts, PageContainer.tsx, commercialSettingsService.ts -->
          - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/index.ts)
        - **customers/**
          - [CustomerEditPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/customers/CustomerEditPage.tsx) <!-- Depende de: useCurrentStore.ts, usePermissions.ts, customers360Service.ts -->
          - [CustomerFormPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/customers/CustomerFormPage.tsx) <!-- Depende de: useCurrentStore.ts, usePermissions.ts, customers360Service.ts -->
          - [CustomerLifecyclePage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/customers/CustomerLifecyclePage.tsx) <!-- Depende de: useCurrentStore.ts, usePermissions.ts, customers360Service.ts -->
          - [Customers.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/customers/Customers.tsx) <!-- Depende de: useCurrentStore.ts, usePermissions.ts, PageContainer.tsx, customers360Service.ts -->
        - **dashboard/**
          - **push/**
            - [PushNotifications.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/dashboard/push/PushNotifications.tsx) <!-- Depende de: PageContainer.tsx -->
          - [Activity.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/dashboard/Activity.tsx) <!-- Depende de: LoadingSpinner.tsx, PageContainer.tsx, EmptyState.tsx, supabase.ts, useCurrentStore.ts, csv.ts, dateTime.ts, operationalTimeline.types.ts -->
          - [Alerts.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/dashboard/Alerts.tsx) <!-- Depende de: PageContainer.tsx, StatsCard.tsx, useCurrentStore.ts, useStockAlerts.ts -->
          - [Dashboard.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/dashboard/Dashboard.tsx) <!-- Depende de: supabase.ts, activeStore.ts, usePermissions.ts, PageContainer.tsx, StatsCard.tsx, DataCard.tsx, AlertBanner.tsx, RecentActivity.tsx, ProgressCard.tsx, useStockAlerts.ts -->
          - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/dashboard/index.ts)
          - [Reports.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/dashboard/Reports.tsx) <!-- Depende de: PageContainer.tsx, useCurrentStore.ts, usePermissions.ts -->
        - **delivery/**
          - [Delivery.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/delivery/Delivery.tsx) <!-- Depende de: PageContainer.tsx -->
          - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/delivery/index.ts)
        - **financial/**
          - **accountPlan/**
            - **components/**
              - [AccountPlanGovernanceSummaryCard.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/accountPlan/components/AccountPlanGovernanceSummaryCard.tsx) <!-- Depende de: cashbookAccountPlanTreeService.ts -->
              - [AccountPlanTrialBalancePanel.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/accountPlan/components/AccountPlanTrialBalancePanel.tsx) <!-- Depende de: LoadingSpinner.tsx, cashbookAccountPlanTrialBalanceService.ts, ptBrFinancialLabels.ts, activeStore.ts -->
            - [AccountPlanPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/accountPlan/AccountPlanPage.tsx) <!-- Depende de: PageContainer.tsx, LoadingSpinner.tsx, cashbookAccountPlanTreeService.ts, cashbookAccountPlanService.ts, ptBrFinancialLabels.ts, AccountPlanTrialBalancePanel.tsx, AccountPlanGovernanceSummaryCard.tsx -->
          - **cashbook/**
            - **components/**
              - [CashbookClassificationFields.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/components/CashbookClassificationFields.tsx) <!-- Depende de: cashbookService.ts, useCashbookClassificationOptions.ts -->
              - [CashbookOccurrenceResolutionBox.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/components/CashbookOccurrenceResolutionBox.tsx) <!-- Depende de: cashbookDiscrepancyService.ts -->
              - [DayClosingPanel.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/components/DayClosingPanel.tsx) <!-- Depende de: cashbookService.ts, cashbookDiscrepancyService.ts, formatters.ts, CashbookOccurrenceResolutionBox.tsx -->
              - [PendingReceivablesPanel.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/components/PendingReceivablesPanel.tsx) <!-- Depende de: cashbookService.ts, formatters.ts, DayClosingPanel.tsx -->
            - [CashbookPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/CashbookPage.tsx) <!-- Depende de: useCurrentStore.ts, PageContainer.tsx, cashbookService.ts, LoadingSpinner.tsx, formatters.ts, usePermissions.ts, supabase.ts, PendingReceivablesPanel.tsx, CashbookClassificationFields.tsx -->
        - **loyalty/**
          - [LoyaltyAdvancedPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/loyalty/LoyaltyAdvancedPage.tsx) <!-- Depende de: useCurrentStore.ts, PageContainer.tsx, loyaltyAdvancedService.ts -->
        - **marketing/**
          - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/marketing/index.ts)
          - [Marketing.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/marketing/Marketing.tsx)
          - [MarketingCenterPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/marketing/MarketingCenterPage.tsx) <!-- Depende de: useCurrentStore.ts, PageContainer.tsx, marketingCenterService.ts -->
        - **payments/**
          - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/payments/index.ts)
          - [Payments.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/payments/Payments.tsx) <!-- Depende de: PageContainer.tsx -->
        - **products/**
          - **category/**
            - **components/**
              - [CategoryCard.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryCard.tsx) <!-- Depende de: category.types.ts, CategoryThumb.tsx -->
              - [CategoryDeleteConfirmModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryDeleteConfirmModal.tsx) <!-- Depende de: SecurityConfirmModal.tsx, useStoreSecurityConfig.ts, category.types.ts -->
              - [CategoryEditModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryEditModal.tsx) <!-- Depende de: category.types.ts, useCategoryForm.ts, useCategorySave.ts, CategoryFormFields.tsx -->
              - [CategoryFormFields.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryFormFields.tsx)
              - [CategoryProductsModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryProductsModal.tsx)
              - [CategoryProductsSimpleModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryProductsSimpleModal.tsx)
              - [CategoryRow.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryRow.tsx)
              - [CategoryTable.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryTable.tsx) <!-- Depende de: category.types.ts, CategoryThumb.tsx -->
              - [CategoryThumb.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryThumb.tsx)
              - [CategoryViewModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryViewModal.tsx) <!-- Depende de: category.types.ts, CategoryThumb.tsx, categoryPricing.ts -->
            - **hooks/**
              - [useCategories.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategories.ts) <!-- Depende de: supabase.ts, securityLog.ts, category.types.ts, activeStore.ts -->
              - [useCategoryFilters.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategoryFilters.ts) <!-- Depende de: category.types.ts -->
              - [useCategoryForm.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategoryForm.ts) <!-- Depende de: category.types.ts -->
              - [useCategoryModals.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategoryModals.ts) <!-- Depende de: category.types.ts -->
              - [useCategorySave.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategorySave.ts) <!-- Depende de: supabase.ts, activeStore.ts, category.types.ts -->
            - **types/**
              - [category.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/types/category.types.ts)
            - **utils/**
              - [categoryPricing.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/utils/categoryPricing.ts)
          - **inventory/**
            - **components/**
              - [InventoryItem.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/InventoryItem.tsx) <!-- Depende de: inventory.types.ts -->
              - [InventoryList.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/InventoryList.tsx) <!-- Depende de: inventory.types.ts, InventoryItem.tsx -->
              - [InventoryQuickNav.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/InventoryQuickNav.tsx)
              - [ManualStockAdjustmentModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/ManualStockAdjustmentModal.tsx) <!-- Depende de: stockService.ts, supabase.ts -->
              - [OperationalTimeline.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/OperationalTimeline.tsx) <!-- Depende de: LoadingSpinner.tsx, dateTime.ts, operationalTimeline.types.ts -->
              - [PrintableStockMovements.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/PrintableStockMovements.tsx) <!-- Depende de: inventory.types.ts -->
              - [ProductStockManagementCards.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/ProductStockManagementCards.tsx) <!-- Depende de: stockService.ts, productLifecycle.types.ts, formatters.ts -->
              - [ProductSupplierCostPanel.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/ProductSupplierCostPanel.tsx) <!-- Depende de: formatters.ts, dateTime.ts, productSupplierLifecycle.types.ts -->
              - [ProductTransitPanel.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/ProductTransitPanel.tsx) <!-- Depende de: formatters.ts, useProductTransitSummary.ts -->
              - [PurchaseQuotationPreviewModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/PurchaseQuotationPreviewModal.tsx)
              - [PurchaseQuotationsPanel.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/PurchaseQuotationsPanel.tsx) <!-- Depende de: supabase.ts, stockService.ts, OperationalTimeline.tsx, useOperationalTimeline.ts, dateTime.ts -->
              - [PurchaseSuggestionsPanel.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/PurchaseSuggestionsPanel.tsx) <!-- Depende de: supabase.ts, stockService.ts, formatters.ts, usePurchaseSuggestions.ts, PurchaseQuotationPreviewModal.tsx -->
              - [StockAdjustmentModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/StockAdjustmentModal.tsx) <!-- Depende de: supabase.ts, SecurityConfirmModal.tsx, useStockAdjustment.ts, useStoreSecurityConfig.ts, useSuppliers.ts, inventory.types.ts -->
              - [StockClearanceModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/StockClearanceModal.tsx) <!-- Depende de: SecurityConfirmModal.tsx, useStockMovement.ts, useStoreSecurityConfig.ts, inventory.types.ts -->
              - [SupplierFormModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/SupplierFormModal.tsx) <!-- Depende de: supplierForm.types.ts, supplierFormUtils.ts -->
              - [SupplierLifecycleSummaryCards.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/SupplierLifecycleSummaryCards.tsx) <!-- Depende de: formatters.ts, supplierLifecycle.types.ts -->
              - [SupplierLifecycleTabs.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/SupplierLifecycleTabs.tsx) <!-- Depende de: formatters.ts, dateTime.ts, supplierLifecycle.types.ts -->
              - [TransferDetailHeader.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/TransferDetailHeader.tsx) <!-- Depende de: stockService.ts, TransferStatusBadge.tsx -->
              - [TransferItemsTable.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/TransferItemsTable.tsx) <!-- Depende de: stockService.ts, EmptyTableState.tsx, InfoTooltip.tsx -->
              - [TransferListTable.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/TransferListTable.tsx) <!-- Depende de: stockService.ts, TransferStatusBadge.tsx, EmptyTableState.tsx, InfoTooltip.tsx, dateTime.ts -->
              - [TransferStatusBadge.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/TransferStatusBadge.tsx) <!-- Depende de: multiStock.types.ts -->
            - **hooks/**
              - [useInventory.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventory.ts) <!-- Depende de: supabase.ts, inventory.types.ts, activeStore.ts -->
              - [useInventoryByLocation.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventoryByLocation.ts) <!-- Depende de: useCurrentStore.ts, stockService.ts -->
              - [useInventoryFilters.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventoryFilters.ts) <!-- Depende de: inventory.types.ts -->
              - [useInventoryTransit.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventoryTransit.ts) <!-- Depende de: supabase.ts, inventoryTransit.types.ts -->
              - [useLowStock.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useLowStock.ts) <!-- Depende de: useStockAlerts.ts -->
              - [useOperationalTimeline.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useOperationalTimeline.ts) <!-- Depende de: supabase.ts, operationalTimeline.types.ts -->
              - [useProcurementDashboard.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProcurementDashboard.ts) <!-- Depende de: supabase.ts, useCurrentStore.ts -->
              - [useProductInventoryAudit.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductInventoryAudit.ts) <!-- Depende de: useCurrentStore.ts, stockService.ts -->
              - [useProductLifecycle.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductLifecycle.ts) <!-- Depende de: useCurrentStore.ts, stockService.ts, productLifecycleService.ts -->
              - [useProductLocationInventory.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductLocationInventory.ts) <!-- Depende de: useInventoryByLocation.ts -->
              - [useProductStockManagement.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductStockManagement.ts) <!-- Depende de: supabase.ts, productLifecycle.types.ts -->
              - [useProductStockMovements.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductStockMovements.ts) <!-- Depende de: useCurrentStore.ts, stockService.ts -->
              - [useProductSupplierLifecycle.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductSupplierLifecycle.ts) <!-- Depende de: supabase.ts, productSupplierLifecycle.types.ts -->
              - [useProductTransitSummary.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductTransitSummary.ts) <!-- Depende de: supabase.ts -->
              - [usePurchaseSuggestions.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/usePurchaseSuggestions.ts) <!-- Depende de: stockService.ts -->
              - [useStockAdjustment.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockAdjustment.ts) <!-- Depende de: supabase.ts, securityLog.ts, useStockMovement.ts, inventory.types.ts -->
              - [useStockMovement.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockMovement.ts) <!-- Depende de: supabase.ts, activeStore.ts, inventory.types.ts -->
              - [useStockTransferDetail.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockTransferDetail.ts) <!-- Depende de: stockService.ts -->
              - [useStockTransfers.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockTransfers.ts) <!-- Depende de: useCurrentStore.ts, stockService.ts -->
              - [useStockTransferSuggestions.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockTransferSuggestions.ts) <!-- Depende de: supabase.ts, useCurrentStore.ts, transferSuggestion.types.ts -->
              - [useSupplierLifecycle.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useSupplierLifecycle.ts) <!-- Depende de: supabase.ts, supplierLifecycle.types.ts -->
            - **services/**
              - [productLifecycleService.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/services/productLifecycleService.ts) <!-- Depende de: supabase.ts -->
              - [supplierLifecycleService.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/services/supplierLifecycleService.ts) <!-- Depende de: supabase.ts -->
              - [supplierLifecycleService.ts_](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/services/supplierLifecycleService.ts_)
            - **types/**
              - [inventory.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventory.types.ts)
              - [inventoryTransit.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventoryTransit.types.ts)
              - [multiStock.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/multiStock.types.ts)
              - [operationalTimeline.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/operationalTimeline.types.ts)
              - [productLifecycle.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/productLifecycle.types.ts)
              - [productSupplierLifecycle.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/productSupplierLifecycle.types.ts)
              - [supplierForm.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/supplierForm.types.ts)
              - [supplierLifecycle.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/supplierLifecycle.types.ts)
              - [transferSuggestion.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/transferSuggestion.types.ts)
            - **utils/**
              - [exportSupplierLifecycle.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/exportSupplierLifecycle.ts) <!-- Depende de: formatters.ts, dateTime.ts, csv.ts, supplierLifecycle.types.ts -->
              - [inventoryHelpers.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/inventoryHelpers.ts)
              - [mergeInventoryTransit.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/mergeInventoryTransit.ts) <!-- Depende de: inventoryTransit.types.ts -->
              - [productMovementNarrative.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/productMovementNarrative.ts)
              - [supplierFormUtils.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/supplierFormUtils.ts) <!-- Depende de: supplierForm.types.ts -->
              - [supplierLifecycleLabels.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/supplierLifecycleLabels.ts)
              - [supplierStatusUtils.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/supplierStatusUtils.ts)
            - [InventoryByLocationPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/InventoryByLocationPage.tsx) <!-- Depende de: LoadingSpinner.tsx, useInventoryByLocation.ts, useInventoryTransit.ts, mergeInventoryTransit.ts, csv.ts, formatters.ts, EmptyState.tsx, EmptyTableState.tsx, InfoTooltip.tsx, PageContainer.tsx, usePermissions.ts, permissions.ts -->
            - [ProductLifecyclePage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/ProductLifecyclePage.tsx) <!-- Depende de: supabase.ts, activeStore.ts, LoadingSpinner.tsx, PageContainer.tsx, useProductLifecycle.ts, useProductStockMovements.ts, useProductInventoryAudit.ts, useProductLocationInventory.ts, useProductStockManagement.ts, ProductStockManagementCards.tsx, useProductSupplierLifecycle.ts, ProductSupplierCostPanel.tsx, useProductTransitSummary.ts, ProductTransitPanel.tsx, csv.ts, formatters.ts, dateTime.ts, useCurrentStore.ts, usePermissions.ts, EmptyState.tsx, InfoTooltip.tsx, productMovementNarrative.ts -->
            - [ProductLifecycleSelectorPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/ProductLifecycleSelectorPage.tsx) <!-- Depende de: useProducts.ts, LoadingSpinner.tsx, PageContainer.tsx, EmptyState.tsx, supabase.ts, formatters.ts, activeStore.ts -->
            - [PurchaseDocumentsPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/PurchaseDocumentsPage.tsx) <!-- Depende de: dateTime.ts, PurchaseQuotationsPanel.tsx, supabase.ts, stockService.ts, PageContainer.tsx, LoadingSpinner.tsx, AlertBanner.tsx, StatsCard.tsx, csv.ts, supplier.types.ts, supplierStatusUtils.ts, useInventory.ts, PurchaseSuggestionsPanel.tsx, OperationalTimeline.tsx, useOperationalTimeline.ts, activeStore.ts, usePermissions.ts -->
            - [PurchaseInsightsPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/PurchaseInsightsPage.tsx) <!-- Depende de: PageContainer.tsx, StatsCard.tsx, LoadingSpinner.tsx, AlertBanner.tsx, useProcurementDashboard.ts, csv.ts -->
            - [PurchaseQuotationsPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/PurchaseQuotationsPage.tsx) <!-- Depende de: dateTime.ts, OperationalTimeline.tsx, useOperationalTimeline.ts, PageContainer.tsx, LoadingSpinner.tsx, EmptyState.tsx, supabase.ts, stockService.ts, supplier.types.ts, useInventory.ts, csv.ts, supplierStatusUtils.ts, activeStore.ts, usePermissions.ts, permissions.ts -->
            - [PurchasesLedger.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/PurchasesLedger.tsx) <!-- Depende de: supabase.ts, PageContainer.tsx, LoadingSpinner.tsx -->
            - [StockMovements.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/StockMovements.tsx) <!-- Depende de: PageContainer.tsx, supabase.ts, EmptyState.tsx, InfoTooltip.tsx, useStockMovement.ts, useInventory.ts, inventory.types.ts, PrintableStockMovements.tsx, csv.ts, dateTime.ts, formatters.ts, ManualStockAdjustmentModal.tsx, productMovementNarrative.ts, activeStore.ts, useCurrentStore.ts, usePermissions.ts -->
            - [SupplierLifecyclePage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/SupplierLifecyclePage.tsx) <!-- Depende de: useSupplierLifecycle.ts, supplierLifecycleService.ts, exportSupplierLifecycle.ts, SupplierLifecycleSummaryCards.tsx, SupplierLifecycleTabs.tsx, activeStore.ts, usePermissions.ts, supplierStatusUtils.ts -->
            - [TransferDetailPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/TransferDetailPage.tsx) <!-- Depende de: LoadingSpinner.tsx, PageContainer.tsx, TransferDetailHeader.tsx, TransferItemsTable.tsx, useStockTransferDetail.ts, stockService.ts, csv.ts, OperationalTimeline.tsx, useOperationalTimeline.ts, useCurrentStore.ts, usePermissions.ts, formatters.ts, dateTime.ts -->
            - [TransfersPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/TransfersPage.tsx) <!-- Depende de: LoadingSpinner.tsx, PageContainer.tsx, TransferListTable.tsx, useStockTransfers.ts, csv.ts, formatters.ts, dateTime.ts, EmptyState.tsx, stockService.ts, supabase.ts, useStockTransferSuggestions.ts, useInventoryTransit.ts, useCurrentStore.ts, usePermissions.ts, transferSuggestion.types.ts -->
          - **products/**
            - **components/**
              - **AdminProductEditModal/**
                - **panels/**
                  - [FormPanel.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/panels/FormPanel.tsx)
                  - [ImagesPanel.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/panels/ImagesPanel.tsx)
                  - [ProductFormPanel.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/panels/ProductFormPanel.tsx) <!-- Depende de: product.types.ts -->
                - [AdminProductEditModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/AdminProductEditModal.tsx) <!-- Depende de: supabase.ts, activeStore.ts, CategoryEditModal.tsx, DeactivateProductModal.tsx, ReactivateProductModal.tsx, ImageSection.tsx, ProductFormPanel.tsx, securityLog.ts, useStockMovement.ts, useProductSave.ts, useCurrentStore.ts, usePermissions.ts, product.types.ts -->
                - [CategorySelector.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/CategorySelector.tsx) <!-- Depende de: product.types.ts -->
                - [DeactivateProductModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/DeactivateProductModal.tsx) <!-- Depende de: supabase.ts, SecurityConfirmModal.tsx, useStockMovement.ts, useStoreSecurityConfig.ts, securityLog.ts, product.types.ts -->
                - [FormSection.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/FormSection.tsx)
                - [ImageSection.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/ImageSection.tsx) <!-- Depende de: SortableThumb.tsx, useProductImages.ts -->
                - [PriceSection.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/PriceSection.tsx) <!-- Depende de: product.types.ts -->
                - [ReactivateProductModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/ReactivateProductModal.tsx) <!-- Depende de: supabase.ts, SecurityConfirmModal.tsx, useStockMovement.ts, useStoreSecurityConfig.ts, securityLog.ts, product.types.ts -->
                - [SortableThumb.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/SortableThumb.tsx) <!-- Depende de: useProductImages.ts -->
                - [StockFields.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/StockFields.tsx)
              - **productForm/**
                - **sections/**
                  - [DangerZone.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/productForm/sections/DangerZone.tsx)
                  - [MainFields.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/productForm/sections/MainFields.tsx)
                  - [MediaManager.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/productForm/sections/MediaManager.tsx)
                  - [Pricing.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/productForm/sections/Pricing.tsx)
                  - [Stock.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/productForm/sections/Stock.tsx)
                - [product.schema.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/productForm/product.schema.ts)
                - [ProductFormModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/productForm/ProductFormModal.tsx) <!-- Depende de: product.types.ts -->
                - [useProductForm.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/productForm/useProductForm.ts) <!-- Depende de: product.types.ts -->
              - [AdminProductViewModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductViewModal.tsx) <!-- Depende de: product.types.ts -->
              - [DiscontinuedProductsModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/DiscontinuedProductsModal.tsx) <!-- Depende de: product.types.ts, AdminProductViewModal.tsx -->
              - [FilterBar.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/FilterBar.tsx) <!-- Depende de: product.types.ts, useExport.ts -->
              - [FilteredProductsModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/FilteredProductsModal.tsx) <!-- Depende de: product.types.ts, ProductThumb.tsx, PrintableReport.tsx -->
              - [PrintableReport.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/PrintableReport.tsx) <!-- Depende de: product.types.ts -->
              - [ProductActionModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductActionModal.tsx) <!-- Depende de: product.types.ts, ProductThumb.tsx -->
              - [ProductDeleteConfirmModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductDeleteConfirmModal.tsx) <!-- Depende de: supabase.ts, SecurityConfirmModal.tsx, StockClearanceModal.tsx, product.types.ts, inventory.types.ts, useStoreSecurityConfig.ts, securityLog.ts -->
              - [ProductRow.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductRow.tsx) <!-- Depende de: product.types.ts, ProductThumb.tsx -->
              - [ProductTable.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductTable.tsx) <!-- Depende de: product.types.ts, ProductRow.tsx, EmptyTableState.tsx -->
              - [ProductThumb.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductThumb.tsx) <!-- Depende de: product.types.ts -->
              - [StatsCards.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/StatsCards.tsx) <!-- Depende de: product.types.ts, InfoTooltip.tsx -->
            - **hooks/**
              - [useExport.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useExport.ts) <!-- Depende de: product.types.ts -->
              - [useFilters.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useFilters.ts) <!-- Depende de: supabase.ts, product.types.ts, activeStore.ts -->
              - [useModals.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useModals.ts) <!-- Depende de: product.types.ts -->
              - [useProductCategories.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductCategories.ts) <!-- Depende de: supabase.ts, product.types.ts, activeStore.ts -->
              - [useProductDelete.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductDelete.ts) <!-- Depende de: supabase.ts, securityLog.ts, supabaseStorage.ts -->
              - [useProductForm.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductForm.ts) <!-- Depende de: product.types.ts -->
              - [useProductImages.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductImages.ts)
              - [useProductPricing.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductPricing.ts) <!-- Depende de: product.types.ts -->
              - [useProducts.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProducts.ts) <!-- Depende de: supabase.ts, product.types.ts, activeStore.ts -->
              - [useProductSave.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductSave.ts) <!-- Depende de: supabase.ts, activeStore.ts, useProductImages.ts, product.types.ts -->
              - [useStorePassword.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useStorePassword.ts) <!-- Depende de: supabase.ts -->
            - **types/**
              - [product.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)
            - **utils/**
              - [securityLog.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/utils/securityLog.ts) <!-- Depende de: supabase.ts, activeStore.ts -->
          - **suppliers/**
            - **hooks/**
              - [useSuppliers.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/suppliers/hooks/useSuppliers.ts) <!-- Depende de: supabase.ts, supplier.types.ts, activeStore.ts -->
            - **types/**
              - [supplier.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/suppliers/types/supplier.types.ts)
            - [SuppliersPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/suppliers/SuppliersPage.tsx) <!-- Depende de: PageContainer.tsx, StatsCard.tsx, LoadingSpinner.tsx, supabase.ts, activeStore.ts, usePermissions.ts, useSuppliers.ts, supplier.types.ts, useSuppliersInsights.ts, csv.ts, supplierStatusUtils.ts, SupplierFormModal.tsx -->
          - [Categories.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/Categories.tsx) <!-- Depende de: supabase.ts, PageContainer.tsx, category.types.ts, usePermissions.ts, activeStore.ts, useCategories.ts, useCategoryFilters.ts, useCategoryModals.ts, CategoryTable.tsx, CategoryCard.tsx, CategoryViewModal.tsx, CategoryEditModal.tsx, CategoryDeleteConfirmModal.tsx, LoadingSpinner.tsx, CategoryProductsSimpleModal.tsx -->
          - [Inventory.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/Inventory.tsx) <!-- Depende de: PageContainer.tsx, useInventory.ts, useInventoryFilters.ts, InventoryList.tsx, LoadingSpinner.tsx, inventory.types.ts -->
          - [Products.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/Products.tsx) <!-- Depende de: supabase.ts, AdminProductViewModal.tsx, ProductDeleteConfirmModal.tsx, product.types.ts, AdminProductEditModal.tsx, useProducts.ts, useFilters.ts, useModals.ts, useExport.ts, activeStore.ts, useRefreshFrame.ts, useCurrentStore.ts, usePermissions.ts, PageContainer.tsx, StatsCards.tsx, FilterBar.tsx, ProductTable.tsx, FilteredProductsModal.tsx, ProductActionModal.tsx, LoadingSpinner.tsx, DiscontinuedProductsModal.tsx, EmptyState.tsx -->
          - [Suppliers.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/Suppliers.tsx) <!-- Depende de: SuppliersPage.tsx -->
        - **settings/**
          - **appearance/**
            - [Appearance.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/appearance/Appearance.tsx) <!-- Depende de: supabase.ts, activeStore.ts, index.ts, StorePreview.tsx, PageContainer.tsx -->
            - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/appearance/index.ts)
          - **financialAccounts/**
            - [FinancialAccountsSettingsPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/financialAccounts/FinancialAccountsSettingsPage.tsx) <!-- Depende de: PageContainer.tsx, activeStore.ts, financialAccountsService.ts, ptBrFinancialLabels.ts -->
          - **hours/**
            - [Hours.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/hours/Hours.tsx) <!-- Depende de: supabase.ts, index.ts, PageContainer.tsx, usePermissions.ts, useCurrentStore.ts, PermissionLocked.tsx -->
            - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/hours/index.ts)
          - **messages/**
            - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/messages/index.ts)
            - [MessageSettings.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/messages/MessageSettings.tsx) <!-- Depende de: supabase.ts, PageContainer.tsx, activeStore.ts, useSecurityContext.ts, usePermissions.ts -->
          - **myHistory/**
            - [MyHistory.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/myHistory/MyHistory.tsx) <!-- Depende de: PageContainer.tsx, useRefreshFrame.ts, myHistoryService.ts, activeStore.ts -->
          - **onlineOrders/**
            - [OnlineOrderSettingsPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/onlineOrders/OnlineOrderSettingsPage.tsx) <!-- Depende de: PageContainer.tsx, useCurrentStore.ts, onlineOrderSettingsService.ts -->
          - **profile/**
            - **components/**
              - [MyProfileAdditionalInfoTab.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/components/MyProfileAdditionalInfoTab.tsx) <!-- Depende de: InfoCard.tsx -->
              - [MyProfileAddressTab.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/components/MyProfileAddressTab.tsx)
              - [MyProfileChangeRequestsTab.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/components/MyProfileChangeRequestsTab.tsx) <!-- Depende de: securityService.ts -->
              - [MyProfileIdentityTab.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/components/MyProfileIdentityTab.tsx) <!-- Depende de: securityService.ts -->
            - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/index.ts)
            - [Profile.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/Profile.tsx) <!-- Depende de: supabase.ts, MyProfileIdentityTab.tsx, MyProfileAddressTab.tsx, MyProfileAdditionalInfoTab.tsx, MyProfileChangeRequestsTab.tsx, PageContainer.tsx, useSecurityContext.ts, securityService.ts, userAvatarService.ts, activeStore.ts -->
          - **security/**
            - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/security/index.ts)
            - [Security.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/security/Security.tsx) <!-- Depende de: supabase.ts, PageContainer.tsx, timezoneUtils.ts, index.ts, security.ts, useSecurityContext.ts, usePermissions.ts, permissions.ts, activeStore.ts, useSecurityPermissionsAdmin.ts, useRefreshFrame.ts, useStoreCustomRoles.ts, permissionEvents.ts -->
          - **storeSettings/**
            - **tabs/**
              - [AddressTab.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/tabs/AddressTab.tsx) <!-- Depende de: storeSettings.types.ts -->
              - [ContactsTab.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/tabs/ContactsTab.tsx) <!-- Depende de: storeSettings.types.ts -->
              - [CorporateTab.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/tabs/CorporateTab.tsx) <!-- Depende de: storeSettings.types.ts -->
              - [LegalTab.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/tabs/LegalTab.tsx) <!-- Depende de: storeSettings.types.ts -->
            - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/index.ts)
            - [StoreSettings.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/StoreSettings.tsx) <!-- Depende de: supabase.ts, storeSettings.types.ts, PageContainer.tsx, CorporateTab.tsx, AddressTab.tsx, ContactsTab.tsx, LegalTab.tsx, legalTemplates.ts, activeStore.ts, useSecurityContext.ts, usePermissions.ts, PermissionLocked.tsx, CommercialSettingsPage.tsx, Appearance.tsx, OnlineOrderSettingsPage.tsx, StockSettingsPage.tsx, Delivery.tsx, PaymentMethodsPage.tsx, Hours.tsx, MessageSettings.tsx -->
            - [storeSettings.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/storeSettings.types.ts)
          - **users/**
            - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/users/index.ts)
            - [Users.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/users/Users.tsx)
          - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/index.ts)
        - **stock/**
          - **settings/**
            - [StockSettingsPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/stock/settings/StockSettingsPage.tsx) <!-- Depende de: useCurrentStore.ts, PageContainer.tsx, stockSettingsService.ts -->
        - **suppliers/**
          - **components/**
            - [SupplierModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/components/SupplierModal.tsx) <!-- Depende de: supplier.types.ts, useSuppliers.ts -->
          - **hooks/**
            - [useSupplierInsights.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/hooks/useSupplierInsights.ts) <!-- Depende de: supabase.ts -->
            - [useSupplierMetrics.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/hooks/useSupplierMetrics.ts) <!-- Depende de: supabase.ts -->
            - [useSuppliers.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/hooks/useSuppliers.ts) <!-- Depende de: useSuppliers.ts, supplier.types.ts -->
            - [useSuppliersInsights.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/hooks/useSuppliersInsights.ts) <!-- Depende de: supabase.ts, useCurrentStore.ts -->
          - **types/**
            - [supplier.types.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/types/supplier.types.ts)
          - [SupplierDetailPage.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/SupplierDetailPage.tsx) <!-- Depende de: PageContainer.tsx, LoadingSpinner.tsx, AlertBanner.tsx, StatsCard.tsx, supabase.ts, useCurrentStore.ts, useSupplierMetrics.ts, useSupplierInsights.ts, csv.ts -->
        - **support/**
          - [Documentation.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/support/Documentation.tsx) <!-- Depende de: PageContainer.tsx -->
          - [FAQ.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/support/FAQ.tsx) <!-- Depende de: index.ts, PageContainer.tsx -->
          - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/support/index.ts)
          - [Legal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/support/Legal.tsx) <!-- Depende de: PageContainer.tsx -->
        - **users/**
          - [index.ts](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/users/index.ts)
          - [Users.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/users/Users.tsx) <!-- Depende de: useUsersStore.ts, index.ts, index.ts, UserInvitesPanel.tsx, useSecurityContext.ts, usePermissions.ts, useStoreMemberInvites.ts, PageContainer.tsx, StatsCard.tsx, useStoreMemberSessionSummary.ts, activeStore.ts, supabase.ts, useStoreCustomRoles.ts, useRefreshFrame.ts, useRealtimeListener.ts, securityService.ts -->
    - **store/**
      - **components/**
        - [CartDrawer.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/store/components/CartDrawer.tsx) <!-- Depende de: useCartStore.ts, supabase.ts, index.ts -->
        - [CustomerProfile.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/store/components/CustomerProfile.tsx) <!-- Depende de: OrderHistory.tsx, LoyaltyPoints.tsx, customerService.ts, notificationService.ts, useCustomerAuth.ts, timezoneUtils.ts, index.ts -->
      - [Catalog.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/store/Catalog.tsx) <!-- Depende de: supabase.ts, index.ts, ProductCard.tsx, ProductModal.tsx, useCartStore.ts, useCustomerAuth.ts, customerAuth.ts, customerService.ts, CartDrawer.tsx, CustomerProfile.tsx, publicStorefrontService.ts, publicOrderService.ts, timezoneUtils.ts, whatsapp.ts, publicLoyaltyService.ts -->
      - [Checkout.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/store/Checkout.tsx) <!-- Depende de: useCartStore.ts -->
      - [ProductCard.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/store/ProductCard.tsx) <!-- Depende de: index.ts, useCartStore.ts, pricing.ts -->
      - [ProductModal.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/store/ProductModal.tsx) <!-- Depende de: index.ts, useCartStore.ts, pricing.ts -->
      - [PublicOrderTracking.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/store/PublicOrderTracking.tsx) <!-- Depende de: publicOrderService.ts -->
    - [CreateStore.tsx](file:///d:/OptmaIdea/optmamenu/src/pages/CreateStore.tsx) <!-- Depende de: supabase.ts -->
  - **services/**
    - **notifications/**
      - [notificationService.ts](file:///d:/OptmaIdea/optmamenu/src/services/notifications/notificationService.ts) <!-- Depende de: supabase.ts -->
    - [cashbookAccountPlanService.ts](file:///d:/OptmaIdea/optmamenu/src/services/cashbookAccountPlanService.ts) <!-- Depende de: supabase.ts -->
    - [cashbookAccountPlanTreeService.ts](file:///d:/OptmaIdea/optmamenu/src/services/cashbookAccountPlanTreeService.ts) <!-- Depende de: supabase.ts, cashbookAccountPlanService.ts -->
    - [cashbookAccountPlanTrialBalanceService.ts](file:///d:/OptmaIdea/optmamenu/src/services/cashbookAccountPlanTrialBalanceService.ts) <!-- Depende de: supabase.ts -->
    - [cashbookDiscrepancyService.ts](file:///d:/OptmaIdea/optmamenu/src/services/cashbookDiscrepancyService.ts) <!-- Depende de: supabase.ts -->
    - [cashbookService.ts](file:///d:/OptmaIdea/optmamenu/src/services/cashbookService.ts) <!-- Depende de: supabase.ts -->
    - [cashbookSpecialEntryPresets.ts](file:///d:/OptmaIdea/optmamenu/src/services/cashbookSpecialEntryPresets.ts)
    - [commercialDashboardService.ts](file:///d:/OptmaIdea/optmamenu/src/services/commercialDashboardService.ts) <!-- Depende de: supabase.ts -->
    - [commercialSettingsService.ts](file:///d:/OptmaIdea/optmamenu/src/services/commercialSettingsService.ts) <!-- Depende de: supabase.ts -->
    - [customerAuth.ts](file:///d:/OptmaIdea/optmamenu/src/services/customerAuth.ts) <!-- Depende de: supabase.ts, useCustomerAuth.ts, jwt.ts, index.ts -->
    - [customers360Service.ts](file:///d:/OptmaIdea/optmamenu/src/services/customers360Service.ts) <!-- Depende de: supabase.ts -->
    - [customerService.ts](file:///d:/OptmaIdea/optmamenu/src/services/customerService.ts) <!-- Depende de: supabase.ts -->
    - [deliveryMethodsService.ts](file:///d:/OptmaIdea/optmamenu/src/services/deliveryMethodsService.ts) <!-- Depende de: supabase.ts -->
    - [directSalesService.ts](file:///d:/OptmaIdea/optmamenu/src/services/directSalesService.ts) <!-- Depende de: supabase.ts -->
    - [financialAccountsService.ts](file:///d:/OptmaIdea/optmamenu/src/services/financialAccountsService.ts) <!-- Depende de: supabase.ts -->
    - [index.ts](file:///d:/OptmaIdea/optmamenu/src/services/index.ts)
    - [loyaltyAdvancedService.ts](file:///d:/OptmaIdea/optmamenu/src/services/loyaltyAdvancedService.ts) <!-- Depende de: supabase.ts -->
    - [marketingCenterService.ts](file:///d:/OptmaIdea/optmamenu/src/services/marketingCenterService.ts) <!-- Depende de: supabase.ts -->
    - [myHistoryService.ts](file:///d:/OptmaIdea/optmamenu/src/services/myHistoryService.ts) <!-- Depende de: supabase.ts -->
    - [myStoreInviteService.ts](file:///d:/OptmaIdea/optmamenu/src/services/myStoreInviteService.ts) <!-- Depende de: supabase.ts, myStoreInvites.ts -->
    - [notificationService.ts](file:///d:/OptmaIdea/optmamenu/src/services/notificationService.ts) <!-- Depende de: customerService.ts -->
    - [onlineOrderSettingsService.ts](file:///d:/OptmaIdea/optmamenu/src/services/onlineOrderSettingsService.ts) <!-- Depende de: supabase.ts -->
    - [paymentMethodsService.ts](file:///d:/OptmaIdea/optmamenu/src/services/paymentMethodsService.ts) <!-- Depende de: supabase.ts -->
    - [permissionService.ts](file:///d:/OptmaIdea/optmamenu/src/services/permissionService.ts) <!-- Depende de: supabase.ts, permissions.ts -->
    - [publicLoyaltyService.ts](file:///d:/OptmaIdea/optmamenu/src/services/publicLoyaltyService.ts) <!-- Depende de: supabase.ts -->
    - [publicOrderService.ts](file:///d:/OptmaIdea/optmamenu/src/services/publicOrderService.ts) <!-- Depende de: supabase.ts -->
    - [publicStorefrontService.ts](file:///d:/OptmaIdea/optmamenu/src/services/publicStorefrontService.ts) <!-- Depende de: supabase.ts, index.ts -->
    - [salesChannelsService.ts](file:///d:/OptmaIdea/optmamenu/src/services/salesChannelsService.ts) <!-- Depende de: supabase.ts -->
    - [securityService.ts](file:///d:/OptmaIdea/optmamenu/src/services/securityService.ts) <!-- Depende de: supabase.ts, security.ts -->
    - [stockService.ts](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts) <!-- Depende de: supabase.ts -->
    - [stockSettingsService.ts](file:///d:/OptmaIdea/optmamenu/src/services/stockSettingsService.ts) <!-- Depende de: supabase.ts -->
    - [storeMemberInviteService.ts](file:///d:/OptmaIdea/optmamenu/src/services/storeMemberInviteService.ts) <!-- Depende de: supabase.ts, storeMemberInvites.ts, security.ts -->
    - [userAvatarService.ts](file:///d:/OptmaIdea/optmamenu/src/services/userAvatarService.ts) <!-- Depende de: supabase.ts -->
    - [userMemberDetailsService.ts](file:///d:/OptmaIdea/optmamenu/src/services/userMemberDetailsService.ts) <!-- Depende de: supabase.ts, userMemberDetails.ts -->
  - **store/**
    - [index.ts](file:///d:/OptmaIdea/optmamenu/src/store/index.ts)
    - [useAuthStore.ts](file:///d:/OptmaIdea/optmamenu/src/store/useAuthStore.ts) <!-- Depende de: index.ts -->
    - [useCartStore.ts](file:///d:/OptmaIdea/optmamenu/src/store/useCartStore.ts) <!-- Depende de: index.ts, pricing.ts -->
    - [useCustomerAuth.ts](file:///d:/OptmaIdea/optmamenu/src/store/useCustomerAuth.ts) <!-- Depende de: index.ts -->
    - [useUsersStore.ts](file:///d:/OptmaIdea/optmamenu/src/store/useUsersStore.ts) <!-- Depende de: supabase.ts, index.ts, security.ts, securityService.ts, storeMemberInviteService.ts, activeStore.ts -->
  - **types/**
    - [admin.ts](file:///d:/OptmaIdea/optmamenu/src/types/admin.ts)
    - [index.ts](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
    - [loyalty.ts](file:///d:/OptmaIdea/optmamenu/src/types/loyalty.ts)
    - [myStoreInvites.ts](file:///d:/OptmaIdea/optmamenu/src/types/myStoreInvites.ts) <!-- Depende de: security.ts -->
    - [order.ts](file:///d:/OptmaIdea/optmamenu/src/types/order.ts) <!-- Depende de: index.ts -->
    - [permissions.ts](file:///d:/OptmaIdea/optmamenu/src/types/permissions.ts)
    - [security.ts](file:///d:/OptmaIdea/optmamenu/src/types/security.ts) <!-- Depende de: permissions.ts -->
    - [store.ts](file:///d:/OptmaIdea/optmamenu/src/types/store.ts) <!-- Depende de: index.ts -->
    - [storeMemberInvites.ts](file:///d:/OptmaIdea/optmamenu/src/types/storeMemberInvites.ts) <!-- Depende de: security.ts -->
    - [userMemberDetails.ts](file:///d:/OptmaIdea/optmamenu/src/types/userMemberDetails.ts)
  - **utils/**
    - **export/**
      - [csv.ts](file:///d:/OptmaIdea/optmamenu/src/utils/export/csv.ts)
      - [formatters.ts](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
    - **finance/**
      - [ptBrFinancialLabels.ts](file:///d:/OptmaIdea/optmamenu/src/utils/finance/ptBrFinancialLabels.ts)
    - **security/**
      - [permissionCatalogVisibility.ts](file:///d:/OptmaIdea/optmamenu/src/utils/security/permissionCatalogVisibility.ts) <!-- Depende de: security.ts -->
      - [permissionReadOnlyMode.ts](file:///d:/OptmaIdea/optmamenu/src/utils/security/permissionReadOnlyMode.ts)
    - [activeStore.ts](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
    - [csv.ts](file:///d:/OptmaIdea/optmamenu/src/utils/csv.ts)
    - [dateTime.ts](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)
    - [permissionEvents.ts](file:///d:/OptmaIdea/optmamenu/src/utils/permissionEvents.ts)
    - [permissionGroups.ts](file:///d:/OptmaIdea/optmamenu/src/utils/permissionGroups.ts)
    - [permissions.ts](file:///d:/OptmaIdea/optmamenu/src/utils/permissions.ts) <!-- Depende de: permissions.ts -->
    - [pricing.ts](file:///d:/OptmaIdea/optmamenu/src/utils/pricing.ts)
    - [sessionSecurity.ts](file:///d:/OptmaIdea/optmamenu/src/utils/sessionSecurity.ts) <!-- Depende de: supabase.ts, activeStore.ts -->
    - [supabaseStorage.ts](file:///d:/OptmaIdea/optmamenu/src/utils/supabaseStorage.ts)
    - [timezoneUtils.ts](file:///d:/OptmaIdea/optmamenu/src/utils/timezoneUtils.ts)
    - [whatsapp.ts](file:///d:/OptmaIdea/optmamenu/src/utils/whatsapp.ts)
  - [App.css](file:///d:/OptmaIdea/optmamenu/src/App.css)
  - [App.tsx](file:///d:/OptmaIdea/optmamenu/src/App.tsx) <!-- Depende de: useAuthStore.ts, supabase.ts, AppRoutes.tsx, CookieConsent.tsx, sessionSecurity.ts -->
  - [AppRoutes.tsx](file:///d:/OptmaIdea/optmamenu/src/AppRoutes.tsx) <!-- Depende de: ProtectedRoute.tsx, RequirePermission.tsx, RequireActiveStoreMember.tsx, CreateStore.tsx, useSecurityContext.ts, usePermissions.ts, activeStore.ts, permissions.ts -->
  - [index.css](file:///d:/OptmaIdea/optmamenu/src/index.css)
  - [main.tsx](file:///d:/OptmaIdea/optmamenu/src/main.tsx) <!-- Depende de: App.tsx, index.css -->
- [eslint.config.js](file:///d:/OptmaIdea/optmamenu/eslint.config.js)
- [index.html](file:///d:/OptmaIdea/optmamenu/index.html)
- [package.json](file:///d:/OptmaIdea/optmamenu/package.json)
- [postcss.config.js](file:///d:/OptmaIdea/optmamenu/postcss.config.js)
- [tailwind.config.js](file:///d:/OptmaIdea/optmamenu/tailwind.config.js)
- [tsconfig.json](file:///d:/OptmaIdea/optmamenu/tsconfig.json)
- [vercel.json](file:///d:/OptmaIdea/optmamenu/vercel.json)
- [vite.config.ts](file:///d:/OptmaIdea/optmamenu/vite.config.ts)

## 🔗 Mapeamento Detalhado de Dependências de Importação (Grafo Local)

Abaixo estão listadas as dependências internas detectadas para cada arquivo chave do projeto (arquivos que importam outros arquivos locais):

### 📄 [`src/App.tsx`](file:///d:/OptmaIdea/optmamenu/src/App.tsx)
Imports locais:
- [`src/store/useAuthStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useAuthStore.ts)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/AppRoutes.tsx`](file:///d:/OptmaIdea/optmamenu/src/AppRoutes.tsx)
- [`src/components/common/CookieConsent.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/CookieConsent.tsx)
- [`src/utils/sessionSecurity.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/sessionSecurity.ts)

### 📄 [`src/AppRoutes.tsx`](file:///d:/OptmaIdea/optmamenu/src/AppRoutes.tsx)
Imports locais:
- [`src/components/ProtectedRoute.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/ProtectedRoute.tsx)
- [`src/components/RequirePermission.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/RequirePermission.tsx)
- [`src/components/RequireActiveStoreMember.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/RequireActiveStoreMember.tsx)
- [`src/pages/CreateStore.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/CreateStore.tsx)
- [`src/hooks/useSecurityContext.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useSecurityContext.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/utils/permissions.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/permissions.ts)

### 📄 [`src/__tests__/services/cashbookService.test.ts`](file:///d:/OptmaIdea/optmamenu/src/__tests__/services/cashbookService.test.ts)
Imports locais:
- [`src/services/cashbookService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookService.ts)

### 📄 [`src/__tests__/store/useCartStore.test.ts`](file:///d:/OptmaIdea/optmamenu/src/__tests__/store/useCartStore.test.ts)
Imports locais:
- [`src/store/useCartStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCartStore.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/__tests__/utils/timezoneUtils.test.ts`](file:///d:/OptmaIdea/optmamenu/src/__tests__/utils/timezoneUtils.test.ts)
Imports locais:
- [`src/utils/timezoneUtils.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/timezoneUtils.ts)

### 📄 [`src/components/LoyaltyPoints.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/LoyaltyPoints.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/store/useCustomerAuth.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCustomerAuth.ts)
- [`src/services/customerService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customerService.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/components/ProtectedRoute.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/ProtectedRoute.tsx)
Imports locais:
- [`src/store/useAuthStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useAuthStore.ts)

### 📄 [`src/components/RequireActiveStoreMember.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/RequireActiveStoreMember.tsx)
Imports locais:
- [`src/hooks/useSecurityContext.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useSecurityContext.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)

### 📄 [`src/components/RequirePermission.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/RequirePermission.tsx)
Imports locais:
- [`src/hooks/useSecurityContext.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useSecurityContext.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/utils/permissions.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/permissions.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)

### 📄 [`src/components/admin/StorePreview.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/admin/StorePreview.tsx)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/components/common/SecurityConfirmModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/SecurityConfirmModal.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/hooks/useStorePassword.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useStorePassword.ts)

### 📄 [`src/components/invites/MyStoreInvitesBanner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/invites/MyStoreInvitesBanner.tsx)
Imports locais:
- [`src/hooks/useMyStoreInvites.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useMyStoreInvites.ts)
- [`src/types/myStoreInvites.ts`](file:///d:/OptmaIdea/optmamenu/src/types/myStoreInvites.ts)

### 📄 [`src/components/layouts/PrivateLayout.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/layouts/PrivateLayout.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/sessionSecurity.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/sessionSecurity.ts)
- [`src/services/securityService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/securityService.ts)
- [`src/hooks/useOrderMonitor.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useOrderMonitor.ts)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/components/common/navigation/BackToTopButton.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/navigation/BackToTopButton.tsx)
- [`src/hooks/inventory/useInventoryAttentionCount.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/inventory/useInventoryAttentionCount.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/utils/permissions.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/permissions.ts)
- [`src/hooks/useRealtimeListener.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useRealtimeListener.ts)
- [`src/components/invites/MyStoreInvitesBanner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/invites/MyStoreInvitesBanner.tsx)
- [`src/hooks/useIdleSessionTimeout.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useIdleSessionTimeout.ts)
- [`src/utils/permissionEvents.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/permissionEvents.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/components/layouts/StoreLayout.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/layouts/StoreLayout.tsx)
Imports locais:
- [`src/store/useCartStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCartStore.ts)

### 📄 [`src/components/mobile/NotificationReceiver.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/mobile/NotificationReceiver.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/services/notifications/notificationService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/notifications/notificationService.ts)

### 📄 [`src/components/users/UserCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/users/UserCard.tsx)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)
- [`src/components/users/UserStatusBadge.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/users/UserStatusBadge.tsx)
- [`src/components/users/UserRoleBadge.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/users/UserRoleBadge.tsx)

### 📄 [`src/components/users/UserDetailModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/users/UserDetailModal.tsx)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)
- [`src/components/users/UserStatusBadge.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/users/UserStatusBadge.tsx)
- [`src/components/users/UserRoleBadge.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/users/UserRoleBadge.tsx)
- [`src/hooks/useStoreMemberDetails.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreMemberDetails.ts)
- [`src/hooks/security/useStoreMemberFullHistory.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/security/useStoreMemberFullHistory.ts)
- [`src/services/securityService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/securityService.ts)
- [`src/services/userAvatarService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/userAvatarService.ts)

### 📄 [`src/components/users/UserFormModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/users/UserFormModal.tsx)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/components/users/UserInvitesPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/users/UserInvitesPanel.tsx)
Imports locais:
- [`src/types/storeMemberInvites.ts`](file:///d:/OptmaIdea/optmamenu/src/types/storeMemberInvites.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)

### 📄 [`src/components/users/UserRoleBadge.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/users/UserRoleBadge.tsx)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/components/users/UserStatusBadge.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/users/UserStatusBadge.tsx)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/hooks/financial/useCashbookClassificationOptions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/financial/useCashbookClassificationOptions.ts)
Imports locais:
- [`src/services/cashbookAccountPlanService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookAccountPlanService.ts)
- [`src/services/financialAccountsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/financialAccountsService.ts)
- [`src/services/cashbookService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookService.ts)
- [`src/utils/finance/ptBrFinancialLabels.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/finance/ptBrFinancialLabels.ts)

### 📄 [`src/hooks/inventory/useInventoryAttentionCount.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/inventory/useInventoryAttentionCount.ts)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)

### 📄 [`src/hooks/inventory/useProductInventorySnapshot.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/inventory/useProductInventorySnapshot.ts)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)

### 📄 [`src/hooks/security/useSecurityPermissionsAdmin.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/security/useSecurityPermissionsAdmin.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/utils/permissionEvents.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/permissionEvents.ts)
- [`src/utils/security/permissionCatalogVisibility.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/security/permissionCatalogVisibility.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)

### 📄 [`src/hooks/security/useStoreCustomRoles.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/security/useStoreCustomRoles.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)

### 📄 [`src/hooks/security/useStoreMemberFullHistory.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/security/useStoreMemberFullHistory.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)

### 📄 [`src/hooks/security/useStoreMemberSessionSummary.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/security/useStoreMemberSessionSummary.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)

### 📄 [`src/hooks/stock/useStockAlerts.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/stock/useStockAlerts.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/hooks/useIdleSessionTimeout.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useIdleSessionTimeout.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/store/useAuthStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useAuthStore.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/hooks/useMyStoreInvites.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useMyStoreInvites.ts)
Imports locais:
- [`src/services/myStoreInviteService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/myStoreInviteService.ts)
- [`src/types/myStoreInvites.ts`](file:///d:/OptmaIdea/optmamenu/src/types/myStoreInvites.ts)

### 📄 [`src/hooks/useOrderMonitor.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useOrderMonitor.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/services/permissionService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/permissionService.ts)
- [`src/utils/permissionEvents.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/permissionEvents.ts)
- [`src/types/permissions.ts`](file:///d:/OptmaIdea/optmamenu/src/types/permissions.ts)

### 📄 [`src/hooks/useRealtimeListener.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useRealtimeListener.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/hooks/useSecurityContext.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useSecurityContext.ts)
Imports locais:
- [`src/services/securityService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/securityService.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)

### 📄 [`src/hooks/useStoreMemberDetails.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreMemberDetails.ts)
Imports locais:
- [`src/services/userMemberDetailsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/userMemberDetailsService.ts)
- [`src/types/userMemberDetails.ts`](file:///d:/OptmaIdea/optmamenu/src/types/userMemberDetails.ts)

### 📄 [`src/hooks/useStoreMemberInvites.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreMemberInvites.ts)
Imports locais:
- [`src/services/storeMemberInviteService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/storeMemberInviteService.ts)
- [`src/types/storeMemberInvites.ts`](file:///d:/OptmaIdea/optmamenu/src/types/storeMemberInvites.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)

### 📄 [`src/hooks/useStoreSecurityConfig.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreSecurityConfig.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/lib/jwt.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/jwt.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/main.tsx`](file:///d:/OptmaIdea/optmamenu/src/main.tsx)
Imports locais:
- [`src/App.tsx`](file:///d:/OptmaIdea/optmamenu/src/App.tsx)
- [`src/index.css`](file:///d:/OptmaIdea/optmamenu/src/index.css)

### 📄 [`src/pages/CreateStore.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/CreateStore.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/initial/auth/ActivateInvite.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/initial/auth/ActivateInvite.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/services/myStoreInviteService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/myStoreInviteService.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/utils/sessionSecurity.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/sessionSecurity.ts)

### 📄 [`src/pages/initial/auth/ForgotPassword.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/initial/auth/ForgotPassword.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/initial/auth/Login.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/initial/auth/Login.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)
- [`src/utils/sessionSecurity.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/sessionSecurity.ts)

### 📄 [`src/pages/initial/auth/ResetPassword.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/initial/auth/ResetPassword.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/initial/auth/SignUp.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/initial/auth/SignUp.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/initial/home/Landing.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/initial/home/Landing.tsx)
Imports locais:
- [`src/components/common/MetaTags.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/MetaTags.tsx)

### 📄 [`src/pages/private/admin/commercial/customers/Customers.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/customers/Customers.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/private/admin/commercial/dashboard/CommercialDashboardPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/dashboard/CommercialDashboardPage.tsx)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/DateRangeFilter.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/DateRangeFilter.tsx)
- [`src/services/commercialDashboardService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/commercialDashboardService.ts)

### 📄 [`src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/services/directSalesService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/directSalesService.ts)
- [`src/services/customers360Service.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customers360Service.ts)
- [`src/pages/private/admin/commercial/directSales/components/QuickPosModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/directSales/components/QuickPosModal.tsx)

### 📄 [`src/pages/private/admin/commercial/directSales/components/QuickPosCartSheet.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/directSales/components/QuickPosCartSheet.tsx)
Imports locais:
- [`src/services/customers360Service.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customers360Service.ts)
- [`src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx)

### 📄 [`src/pages/private/admin/commercial/directSales/components/QuickPosModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/directSales/components/QuickPosModal.tsx)
Imports locais:
- [`src/services/customers360Service.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customers360Service.ts)
- [`src/pages/private/admin/commercial/directSales/components/QuickPosProductCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/directSales/components/QuickPosProductCard.tsx)
- [`src/pages/private/admin/commercial/directSales/components/QuickPosCartSheet.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/directSales/components/QuickPosCartSheet.tsx)
- [`src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx)

### 📄 [`src/pages/private/admin/commercial/loyalty/LoyaltyConfig.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/LoyaltyConfig.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/pages/private/admin/commercial/loyalty/settings/LevelsConfig.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/settings/LevelsConfig.tsx)
- [`src/pages/private/admin/commercial/loyalty/settings/CategoryRules.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/settings/CategoryRules.tsx)
- [`src/pages/private/admin/commercial/loyalty/settings/ManualPoints.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/settings/ManualPoints.tsx)
- [`src/pages/private/admin/commercial/loyalty/settings/RewardsConfig.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/settings/RewardsConfig.tsx)
- [`src/pages/private/admin/commercial/loyalty/terms/LegalTerms.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/terms/LegalTerms.tsx)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/pages/private/admin/commercial/loyalty/settings/CategoryRules.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/settings/CategoryRules.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/private/admin/commercial/loyalty/settings/LevelsConfig.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/settings/LevelsConfig.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/private/admin/commercial/loyalty/settings/ManualPoints.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/settings/ManualPoints.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/private/admin/commercial/loyalty/settings/RewardsConfig.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/settings/RewardsConfig.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/private/admin/commercial/loyalty/terms/LegalTerms.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/loyalty/terms/LegalTerms.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/private/admin/commercial/messages/Messages.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/messages/Messages.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)

### 📄 [`src/pages/private/admin/commercial/orders/OrderHistory.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/orders/OrderHistory.tsx)
Imports locais:
- [`src/services/customerService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customerService.ts)
- [`src/store/useCustomerAuth.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCustomerAuth.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/pages/private/admin/commercial/orders/Orders.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/orders/Orders.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/OrderStatusFilter.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/OrderStatusFilter.tsx)
- [`src/hooks/useRefreshFrame.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useRefreshFrame.ts)
- [`src/hooks/useRealtimeListener.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useRealtimeListener.ts)

### 📄 [`src/pages/private/admin/commercial/paymentMethods/PaymentMethodsPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/paymentMethods/PaymentMethodsPage.tsx)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/services/paymentMethodsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/paymentMethodsService.ts)

### 📄 [`src/pages/private/admin/commercial/salesChannels/SalesChannelsPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/salesChannels/SalesChannelsPage.tsx)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/services/salesChannelsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/salesChannelsService.ts)

### 📄 [`src/pages/private/admin/commercial/settings/CommercialSettingsPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/settings/CommercialSettingsPage.tsx)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/services/commercialSettingsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/commercialSettingsService.ts)

### 📄 [`src/pages/private/admin/customers/CustomerEditPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/customers/CustomerEditPage.tsx)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/services/customers360Service.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customers360Service.ts)

### 📄 [`src/pages/private/admin/customers/CustomerFormPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/customers/CustomerFormPage.tsx)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/services/customers360Service.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customers360Service.ts)

### 📄 [`src/pages/private/admin/customers/CustomerLifecyclePage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/customers/CustomerLifecyclePage.tsx)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/services/customers360Service.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customers360Service.ts)

### 📄 [`src/pages/private/admin/customers/Customers.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/customers/Customers.tsx)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/services/customers360Service.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customers360Service.ts)

### 📄 [`src/pages/private/admin/dashboard/Activity.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/dashboard/Activity.tsx)
Imports locais:
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/empty-state/EmptyState.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyState.tsx)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/utils/export/csv.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/csv.ts)
- [`src/utils/dateTime.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)
- [`src/pages/private/admin/products/inventory/types/operationalTimeline.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/operationalTimeline.types.ts)

### 📄 [`src/pages/private/admin/dashboard/Alerts.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/dashboard/Alerts.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/StatsCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/StatsCard.tsx)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/hooks/stock/useStockAlerts.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/stock/useStockAlerts.ts)

### 📄 [`src/pages/private/admin/dashboard/Dashboard.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/dashboard/Dashboard.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/StatsCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/StatsCard.tsx)
- [`src/components/common/DataCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/DataCard.tsx)
- [`src/components/common/AlertBanner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/AlertBanner.tsx)
- [`src/components/common/RecentActivity.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/RecentActivity.tsx)
- [`src/components/common/ProgressCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/ProgressCard.tsx)
- [`src/hooks/stock/useStockAlerts.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/stock/useStockAlerts.ts)

### 📄 [`src/pages/private/admin/dashboard/Reports.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/dashboard/Reports.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)

### 📄 [`src/pages/private/admin/dashboard/push/PushNotifications.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/dashboard/push/PushNotifications.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)

### 📄 [`src/pages/private/admin/delivery/Delivery.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/delivery/Delivery.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)

### 📄 [`src/pages/private/admin/financial/accountPlan/AccountPlanPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/accountPlan/AccountPlanPage.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/services/cashbookAccountPlanTreeService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookAccountPlanTreeService.ts)
- [`src/services/cashbookAccountPlanService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookAccountPlanService.ts)
- [`src/utils/finance/ptBrFinancialLabels.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/finance/ptBrFinancialLabels.ts)
- [`src/pages/private/admin/financial/accountPlan/components/AccountPlanTrialBalancePanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/accountPlan/components/AccountPlanTrialBalancePanel.tsx)
- [`src/pages/private/admin/financial/accountPlan/components/AccountPlanGovernanceSummaryCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/accountPlan/components/AccountPlanGovernanceSummaryCard.tsx)

### 📄 [`src/pages/private/admin/financial/accountPlan/components/AccountPlanGovernanceSummaryCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/accountPlan/components/AccountPlanGovernanceSummaryCard.tsx)
Imports locais:
- [`src/services/cashbookAccountPlanTreeService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookAccountPlanTreeService.ts)

### 📄 [`src/pages/private/admin/financial/accountPlan/components/AccountPlanTrialBalancePanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/accountPlan/components/AccountPlanTrialBalancePanel.tsx)
Imports locais:
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/services/cashbookAccountPlanTrialBalanceService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookAccountPlanTrialBalanceService.ts)
- [`src/utils/finance/ptBrFinancialLabels.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/finance/ptBrFinancialLabels.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/pages/private/admin/financial/cashbook/CashbookPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/CashbookPage.tsx)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/services/cashbookService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookService.ts)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/financial/cashbook/components/PendingReceivablesPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/components/PendingReceivablesPanel.tsx)
- [`src/pages/private/admin/financial/cashbook/components/CashbookClassificationFields.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/components/CashbookClassificationFields.tsx)

### 📄 [`src/pages/private/admin/financial/cashbook/components/CashbookClassificationFields.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/components/CashbookClassificationFields.tsx)
Imports locais:
- [`src/services/cashbookService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookService.ts)
- [`src/hooks/financial/useCashbookClassificationOptions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/financial/useCashbookClassificationOptions.ts)

### 📄 [`src/pages/private/admin/financial/cashbook/components/CashbookOccurrenceResolutionBox.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/components/CashbookOccurrenceResolutionBox.tsx)
Imports locais:
- [`src/services/cashbookDiscrepancyService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookDiscrepancyService.ts)

### 📄 [`src/pages/private/admin/financial/cashbook/components/DayClosingPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/components/DayClosingPanel.tsx)
Imports locais:
- [`src/services/cashbookService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookService.ts)
- [`src/services/cashbookDiscrepancyService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookDiscrepancyService.ts)
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/pages/private/admin/financial/cashbook/components/CashbookOccurrenceResolutionBox.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/components/CashbookOccurrenceResolutionBox.tsx)

### 📄 [`src/pages/private/admin/financial/cashbook/components/PendingReceivablesPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/components/PendingReceivablesPanel.tsx)
Imports locais:
- [`src/services/cashbookService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookService.ts)
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/pages/private/admin/financial/cashbook/components/DayClosingPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/financial/cashbook/components/DayClosingPanel.tsx)

### 📄 [`src/pages/private/admin/loyalty/LoyaltyAdvancedPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/loyalty/LoyaltyAdvancedPage.tsx)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/services/loyaltyAdvancedService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/loyaltyAdvancedService.ts)

### 📄 [`src/pages/private/admin/marketing/MarketingCenterPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/marketing/MarketingCenterPage.tsx)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/services/marketingCenterService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/marketingCenterService.ts)

### 📄 [`src/pages/private/admin/payments/Payments.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/payments/Payments.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)

### 📄 [`src/pages/private/admin/products/Categories.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/Categories.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/pages/private/admin/products/category/types/category.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/types/category.types.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/pages/private/admin/products/category/hooks/useCategories.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategories.ts)
- [`src/pages/private/admin/products/category/hooks/useCategoryFilters.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategoryFilters.ts)
- [`src/pages/private/admin/products/category/hooks/useCategoryModals.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategoryModals.ts)
- [`src/pages/private/admin/products/category/components/CategoryTable.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryTable.tsx)
- [`src/pages/private/admin/products/category/components/CategoryCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryCard.tsx)
- [`src/pages/private/admin/products/category/components/CategoryViewModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryViewModal.tsx)
- [`src/pages/private/admin/products/category/components/CategoryEditModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryEditModal.tsx)
- [`src/pages/private/admin/products/category/components/CategoryDeleteConfirmModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryDeleteConfirmModal.tsx)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/pages/private/admin/products/category/components/CategoryProductsSimpleModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryProductsSimpleModal.tsx)

### 📄 [`src/pages/private/admin/products/Inventory.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/Inventory.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useInventory.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventory.ts)
- [`src/pages/private/admin/products/inventory/hooks/useInventoryFilters.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventoryFilters.ts)
- [`src/pages/private/admin/products/inventory/components/InventoryList.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/InventoryList.tsx)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/pages/private/admin/products/inventory/types/inventory.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventory.types.ts)

### 📄 [`src/pages/private/admin/products/Products.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/Products.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/products/components/AdminProductViewModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductViewModal.tsx)
- [`src/pages/private/admin/products/products/components/ProductDeleteConfirmModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductDeleteConfirmModal.tsx)
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)
- [`src/pages/private/admin/products/products/components/AdminProductEditModal/AdminProductEditModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/AdminProductEditModal.tsx)
- [`src/pages/private/admin/products/products/hooks/useProducts.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProducts.ts)
- [`src/pages/private/admin/products/products/hooks/useFilters.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useFilters.ts)
- [`src/pages/private/admin/products/products/hooks/useModals.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useModals.ts)
- [`src/pages/private/admin/products/products/hooks/useExport.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useExport.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/hooks/useRefreshFrame.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useRefreshFrame.ts)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/pages/private/admin/products/products/components/StatsCards.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/StatsCards.tsx)
- [`src/pages/private/admin/products/products/components/FilterBar.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/FilterBar.tsx)
- [`src/pages/private/admin/products/products/components/ProductTable.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductTable.tsx)
- [`src/pages/private/admin/products/products/components/FilteredProductsModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/FilteredProductsModal.tsx)
- [`src/pages/private/admin/products/products/components/ProductActionModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductActionModal.tsx)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/pages/private/admin/products/products/components/DiscontinuedProductsModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/DiscontinuedProductsModal.tsx)
- [`src/components/common/empty-state/EmptyState.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyState.tsx)

### 📄 [`src/pages/private/admin/products/Suppliers.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/Suppliers.tsx)
Imports locais:
- [`src/pages/private/admin/products/suppliers/SuppliersPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/suppliers/SuppliersPage.tsx)

### 📄 [`src/pages/private/admin/products/category/components/CategoryCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryCard.tsx)
Imports locais:
- [`src/pages/private/admin/products/category/types/category.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/types/category.types.ts)
- [`src/pages/private/admin/products/category/components/CategoryThumb.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryThumb.tsx)

### 📄 [`src/pages/private/admin/products/category/components/CategoryDeleteConfirmModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryDeleteConfirmModal.tsx)
Imports locais:
- [`src/components/common/SecurityConfirmModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/SecurityConfirmModal.tsx)
- [`src/hooks/useStoreSecurityConfig.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreSecurityConfig.ts)
- [`src/pages/private/admin/products/category/types/category.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/types/category.types.ts)

### 📄 [`src/pages/private/admin/products/category/components/CategoryEditModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryEditModal.tsx)
Imports locais:
- [`src/pages/private/admin/products/category/types/category.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/types/category.types.ts)
- [`src/pages/private/admin/products/category/hooks/useCategoryForm.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategoryForm.ts)
- [`src/pages/private/admin/products/category/hooks/useCategorySave.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategorySave.ts)
- [`src/pages/private/admin/products/category/components/CategoryFormFields.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryFormFields.tsx)

### 📄 [`src/pages/private/admin/products/category/components/CategoryTable.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryTable.tsx)
Imports locais:
- [`src/pages/private/admin/products/category/types/category.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/types/category.types.ts)
- [`src/pages/private/admin/products/category/components/CategoryThumb.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryThumb.tsx)

### 📄 [`src/pages/private/admin/products/category/components/CategoryViewModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryViewModal.tsx)
Imports locais:
- [`src/pages/private/admin/products/category/types/category.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/types/category.types.ts)
- [`src/pages/private/admin/products/category/components/CategoryThumb.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryThumb.tsx)
- [`src/pages/private/admin/products/category/utils/categoryPricing.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/utils/categoryPricing.ts)

### 📄 [`src/pages/private/admin/products/category/hooks/useCategories.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategories.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/products/utils/securityLog.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/utils/securityLog.ts)
- [`src/pages/private/admin/products/category/types/category.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/types/category.types.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/pages/private/admin/products/category/hooks/useCategoryFilters.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategoryFilters.ts)
Imports locais:
- [`src/pages/private/admin/products/category/types/category.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/types/category.types.ts)

### 📄 [`src/pages/private/admin/products/category/hooks/useCategoryForm.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategoryForm.ts)
Imports locais:
- [`src/pages/private/admin/products/category/types/category.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/types/category.types.ts)

### 📄 [`src/pages/private/admin/products/category/hooks/useCategoryModals.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategoryModals.ts)
Imports locais:
- [`src/pages/private/admin/products/category/types/category.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/types/category.types.ts)

### 📄 [`src/pages/private/admin/products/category/hooks/useCategorySave.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/hooks/useCategorySave.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/pages/private/admin/products/category/types/category.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/types/category.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/InventoryByLocationPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/InventoryByLocationPage.tsx)
Imports locais:
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useInventoryByLocation.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventoryByLocation.ts)
- [`src/pages/private/admin/products/inventory/hooks/useInventoryTransit.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventoryTransit.ts)
- [`src/pages/private/admin/products/inventory/utils/mergeInventoryTransit.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/mergeInventoryTransit.ts)
- [`src/utils/export/csv.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/csv.ts)
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/components/common/empty-state/EmptyState.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyState.tsx)
- [`src/components/common/empty-state/EmptyTableState.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyTableState.tsx)
- [`src/components/common/tooltip/InfoTooltip.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/tooltip/InfoTooltip.tsx)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/utils/permissions.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/permissions.ts)

### 📄 [`src/pages/private/admin/products/inventory/ProductLifecyclePage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/ProductLifecyclePage.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useProductLifecycle.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductLifecycle.ts)
- [`src/pages/private/admin/products/inventory/hooks/useProductStockMovements.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductStockMovements.ts)
- [`src/pages/private/admin/products/inventory/hooks/useProductInventoryAudit.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductInventoryAudit.ts)
- [`src/pages/private/admin/products/inventory/hooks/useProductLocationInventory.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductLocationInventory.ts)
- [`src/pages/private/admin/products/inventory/hooks/useProductStockManagement.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductStockManagement.ts)
- [`src/pages/private/admin/products/inventory/components/ProductStockManagementCards.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/ProductStockManagementCards.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useProductSupplierLifecycle.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductSupplierLifecycle.ts)
- [`src/pages/private/admin/products/inventory/components/ProductSupplierCostPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/ProductSupplierCostPanel.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useProductTransitSummary.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductTransitSummary.ts)
- [`src/pages/private/admin/products/inventory/components/ProductTransitPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/ProductTransitPanel.tsx)
- [`src/utils/export/csv.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/csv.ts)
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/utils/dateTime.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/components/common/empty-state/EmptyState.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyState.tsx)
- [`src/components/common/tooltip/InfoTooltip.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/tooltip/InfoTooltip.tsx)
- [`src/pages/private/admin/products/inventory/utils/productMovementNarrative.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/productMovementNarrative.ts)

### 📄 [`src/pages/private/admin/products/inventory/ProductLifecycleSelectorPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/ProductLifecycleSelectorPage.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/hooks/useProducts.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProducts.ts)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/empty-state/EmptyState.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyState.tsx)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/pages/private/admin/products/inventory/PurchaseDocumentsPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/PurchaseDocumentsPage.tsx)
Imports locais:
- [`src/utils/dateTime.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)
- [`src/pages/private/admin/products/inventory/components/PurchaseQuotationsPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/PurchaseQuotationsPanel.tsx)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/components/common/AlertBanner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/AlertBanner.tsx)
- [`src/components/common/StatsCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/StatsCard.tsx)
- [`src/utils/csv.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/csv.ts)
- [`src/pages/private/admin/products/suppliers/types/supplier.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/suppliers/types/supplier.types.ts)
- [`src/pages/private/admin/products/inventory/utils/supplierStatusUtils.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/supplierStatusUtils.ts)
- [`src/pages/private/admin/products/inventory/hooks/useInventory.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventory.ts)
- [`src/pages/private/admin/products/inventory/components/PurchaseSuggestionsPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/PurchaseSuggestionsPanel.tsx)
- [`src/pages/private/admin/products/inventory/components/OperationalTimeline.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/OperationalTimeline.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useOperationalTimeline.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useOperationalTimeline.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)

### 📄 [`src/pages/private/admin/products/inventory/PurchaseInsightsPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/PurchaseInsightsPage.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/StatsCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/StatsCard.tsx)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/components/common/AlertBanner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/AlertBanner.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useProcurementDashboard.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProcurementDashboard.ts)
- [`src/utils/csv.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/csv.ts)

### 📄 [`src/pages/private/admin/products/inventory/PurchaseQuotationsPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/PurchaseQuotationsPage.tsx)
Imports locais:
- [`src/utils/dateTime.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)
- [`src/pages/private/admin/products/inventory/components/OperationalTimeline.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/OperationalTimeline.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useOperationalTimeline.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useOperationalTimeline.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/components/common/empty-state/EmptyState.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyState.tsx)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)
- [`src/pages/private/admin/products/suppliers/types/supplier.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/suppliers/types/supplier.types.ts)
- [`src/pages/private/admin/products/inventory/hooks/useInventory.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventory.ts)
- [`src/utils/csv.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/csv.ts)
- [`src/pages/private/admin/products/inventory/utils/supplierStatusUtils.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/supplierStatusUtils.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/utils/permissions.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/permissions.ts)

### 📄 [`src/pages/private/admin/products/inventory/PurchasesLedger.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/PurchasesLedger.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)

### 📄 [`src/pages/private/admin/products/inventory/StockMovements.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/StockMovements.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/components/common/empty-state/EmptyState.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyState.tsx)
- [`src/components/common/tooltip/InfoTooltip.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/tooltip/InfoTooltip.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useStockMovement.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockMovement.ts)
- [`src/pages/private/admin/products/inventory/hooks/useInventory.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventory.ts)
- [`src/pages/private/admin/products/inventory/types/inventory.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventory.types.ts)
- [`src/pages/private/admin/products/inventory/components/PrintableStockMovements.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/PrintableStockMovements.tsx)
- [`src/utils/export/csv.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/csv.ts)
- [`src/utils/dateTime.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/pages/private/admin/products/inventory/components/ManualStockAdjustmentModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/ManualStockAdjustmentModal.tsx)
- [`src/pages/private/admin/products/inventory/utils/productMovementNarrative.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/productMovementNarrative.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)

### 📄 [`src/pages/private/admin/products/inventory/SupplierLifecyclePage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/SupplierLifecyclePage.tsx)
Imports locais:
- [`src/pages/private/admin/products/inventory/hooks/useSupplierLifecycle.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useSupplierLifecycle.ts)
- [`src/pages/private/admin/products/inventory/services/supplierLifecycleService.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/services/supplierLifecycleService.ts)
- [`src/pages/private/admin/products/inventory/utils/exportSupplierLifecycle.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/exportSupplierLifecycle.ts)
- [`src/pages/private/admin/products/inventory/components/SupplierLifecycleSummaryCards.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/SupplierLifecycleSummaryCards.tsx)
- [`src/pages/private/admin/products/inventory/components/SupplierLifecycleTabs.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/SupplierLifecycleTabs.tsx)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/pages/private/admin/products/inventory/utils/supplierStatusUtils.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/supplierStatusUtils.ts)

### 📄 [`src/pages/private/admin/products/inventory/TransferDetailPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/TransferDetailPage.tsx)
Imports locais:
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/pages/private/admin/products/inventory/components/TransferDetailHeader.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/TransferDetailHeader.tsx)
- [`src/pages/private/admin/products/inventory/components/TransferItemsTable.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/TransferItemsTable.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useStockTransferDetail.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockTransferDetail.ts)
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)
- [`src/utils/export/csv.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/csv.ts)
- [`src/pages/private/admin/products/inventory/components/OperationalTimeline.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/OperationalTimeline.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useOperationalTimeline.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useOperationalTimeline.ts)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/utils/dateTime.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)

### 📄 [`src/pages/private/admin/products/inventory/TransfersPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/TransfersPage.tsx)
Imports locais:
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/pages/private/admin/products/inventory/components/TransferListTable.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/TransferListTable.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useStockTransfers.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockTransfers.ts)
- [`src/utils/export/csv.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/csv.ts)
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/utils/dateTime.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)
- [`src/components/common/empty-state/EmptyState.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyState.tsx)
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/inventory/hooks/useStockTransferSuggestions.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockTransferSuggestions.ts)
- [`src/pages/private/admin/products/inventory/hooks/useInventoryTransit.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventoryTransit.ts)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/pages/private/admin/products/inventory/types/transferSuggestion.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/transferSuggestion.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/InventoryItem.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/InventoryItem.tsx)
Imports locais:
- [`src/pages/private/admin/products/inventory/types/inventory.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventory.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/InventoryList.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/InventoryList.tsx)
Imports locais:
- [`src/pages/private/admin/products/inventory/types/inventory.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventory.types.ts)
- [`src/pages/private/admin/products/inventory/components/InventoryItem.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/InventoryItem.tsx)

### 📄 [`src/pages/private/admin/products/inventory/components/ManualStockAdjustmentModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/ManualStockAdjustmentModal.tsx)
Imports locais:
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/OperationalTimeline.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/OperationalTimeline.tsx)
Imports locais:
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/utils/dateTime.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)
- [`src/pages/private/admin/products/inventory/types/operationalTimeline.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/operationalTimeline.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/PrintableStockMovements.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/PrintableStockMovements.tsx)
Imports locais:
- [`src/pages/private/admin/products/inventory/types/inventory.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventory.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/ProductStockManagementCards.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/ProductStockManagementCards.tsx)
Imports locais:
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)
- [`src/pages/private/admin/products/inventory/types/productLifecycle.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/productLifecycle.types.ts)
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/ProductSupplierCostPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/ProductSupplierCostPanel.tsx)
Imports locais:
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/utils/dateTime.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)
- [`src/pages/private/admin/products/inventory/types/productSupplierLifecycle.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/productSupplierLifecycle.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/ProductTransitPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/ProductTransitPanel.tsx)
Imports locais:
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/pages/private/admin/products/inventory/hooks/useProductTransitSummary.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductTransitSummary.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/PurchaseQuotationsPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/PurchaseQuotationsPanel.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)
- [`src/pages/private/admin/products/inventory/components/OperationalTimeline.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/OperationalTimeline.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useOperationalTimeline.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useOperationalTimeline.ts)
- [`src/utils/dateTime.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/PurchaseSuggestionsPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/PurchaseSuggestionsPanel.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/pages/private/admin/products/inventory/hooks/usePurchaseSuggestions.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/usePurchaseSuggestions.ts)
- [`src/pages/private/admin/products/inventory/components/PurchaseQuotationPreviewModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/PurchaseQuotationPreviewModal.tsx)

### 📄 [`src/pages/private/admin/products/inventory/components/StockAdjustmentModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/StockAdjustmentModal.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/components/common/SecurityConfirmModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/SecurityConfirmModal.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useStockAdjustment.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockAdjustment.ts)
- [`src/hooks/useStoreSecurityConfig.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreSecurityConfig.ts)
- [`src/pages/private/admin/products/suppliers/hooks/useSuppliers.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/suppliers/hooks/useSuppliers.ts)
- [`src/pages/private/admin/products/inventory/types/inventory.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventory.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/StockClearanceModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/StockClearanceModal.tsx)
Imports locais:
- [`src/components/common/SecurityConfirmModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/SecurityConfirmModal.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useStockMovement.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockMovement.ts)
- [`src/hooks/useStoreSecurityConfig.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreSecurityConfig.ts)
- [`src/pages/private/admin/products/inventory/types/inventory.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventory.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/SupplierFormModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/SupplierFormModal.tsx)
Imports locais:
- [`src/pages/private/admin/products/inventory/types/supplierForm.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/supplierForm.types.ts)
- [`src/pages/private/admin/products/inventory/utils/supplierFormUtils.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/supplierFormUtils.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/SupplierLifecycleSummaryCards.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/SupplierLifecycleSummaryCards.tsx)
Imports locais:
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/pages/private/admin/products/inventory/types/supplierLifecycle.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/supplierLifecycle.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/SupplierLifecycleTabs.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/SupplierLifecycleTabs.tsx)
Imports locais:
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/utils/dateTime.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)
- [`src/pages/private/admin/products/inventory/types/supplierLifecycle.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/supplierLifecycle.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/TransferDetailHeader.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/TransferDetailHeader.tsx)
Imports locais:
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)
- [`src/pages/private/admin/products/inventory/components/TransferStatusBadge.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/TransferStatusBadge.tsx)

### 📄 [`src/pages/private/admin/products/inventory/components/TransferItemsTable.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/TransferItemsTable.tsx)
Imports locais:
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)
- [`src/components/common/empty-state/EmptyTableState.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyTableState.tsx)
- [`src/components/common/tooltip/InfoTooltip.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/tooltip/InfoTooltip.tsx)

### 📄 [`src/pages/private/admin/products/inventory/components/TransferListTable.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/TransferListTable.tsx)
Imports locais:
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)
- [`src/pages/private/admin/products/inventory/components/TransferStatusBadge.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/TransferStatusBadge.tsx)
- [`src/components/common/empty-state/EmptyTableState.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyTableState.tsx)
- [`src/components/common/tooltip/InfoTooltip.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/tooltip/InfoTooltip.tsx)
- [`src/utils/dateTime.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)

### 📄 [`src/pages/private/admin/products/inventory/components/TransferStatusBadge.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/TransferStatusBadge.tsx)
Imports locais:
- [`src/pages/private/admin/products/inventory/types/multiStock.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/multiStock.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useInventory.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventory.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/inventory/types/inventory.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventory.types.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useInventoryByLocation.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventoryByLocation.ts)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useInventoryFilters.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventoryFilters.ts)
Imports locais:
- [`src/pages/private/admin/products/inventory/types/inventory.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventory.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useInventoryTransit.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventoryTransit.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/inventory/types/inventoryTransit.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventoryTransit.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useLowStock.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useLowStock.ts)
Imports locais:
- [`src/hooks/stock/useStockAlerts.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/stock/useStockAlerts.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useOperationalTimeline.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useOperationalTimeline.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/inventory/types/operationalTimeline.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/operationalTimeline.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useProcurementDashboard.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProcurementDashboard.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useProductInventoryAudit.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductInventoryAudit.ts)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useProductLifecycle.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductLifecycle.ts)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)
- [`src/pages/private/admin/products/inventory/services/productLifecycleService.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/services/productLifecycleService.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useProductLocationInventory.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductLocationInventory.ts)
Imports locais:
- [`src/pages/private/admin/products/inventory/hooks/useInventoryByLocation.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useInventoryByLocation.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useProductStockManagement.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductStockManagement.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/inventory/types/productLifecycle.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/productLifecycle.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useProductStockMovements.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductStockMovements.ts)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useProductSupplierLifecycle.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductSupplierLifecycle.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/inventory/types/productSupplierLifecycle.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/productSupplierLifecycle.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useProductTransitSummary.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useProductTransitSummary.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/usePurchaseSuggestions.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/usePurchaseSuggestions.ts)
Imports locais:
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useStockAdjustment.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockAdjustment.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/products/utils/securityLog.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/utils/securityLog.ts)
- [`src/pages/private/admin/products/inventory/hooks/useStockMovement.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockMovement.ts)
- [`src/pages/private/admin/products/inventory/types/inventory.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventory.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useStockMovement.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockMovement.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/pages/private/admin/products/inventory/types/inventory.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventory.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useStockTransferDetail.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockTransferDetail.ts)
Imports locais:
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useStockTransferSuggestions.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockTransferSuggestions.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/pages/private/admin/products/inventory/types/transferSuggestion.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/transferSuggestion.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useStockTransfers.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockTransfers.ts)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)

### 📄 [`src/pages/private/admin/products/inventory/hooks/useSupplierLifecycle.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useSupplierLifecycle.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/inventory/types/supplierLifecycle.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/supplierLifecycle.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/services/productLifecycleService.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/services/productLifecycleService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/private/admin/products/inventory/services/supplierLifecycleService.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/services/supplierLifecycleService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/private/admin/products/inventory/utils/exportSupplierLifecycle.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/exportSupplierLifecycle.ts)
Imports locais:
- [`src/utils/export/formatters.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/formatters.ts)
- [`src/utils/dateTime.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/dateTime.ts)
- [`src/utils/export/csv.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/export/csv.ts)
- [`src/pages/private/admin/products/inventory/types/supplierLifecycle.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/supplierLifecycle.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/utils/mergeInventoryTransit.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/mergeInventoryTransit.ts)
Imports locais:
- [`src/pages/private/admin/products/inventory/types/inventoryTransit.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventoryTransit.types.ts)

### 📄 [`src/pages/private/admin/products/inventory/utils/supplierFormUtils.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/supplierFormUtils.ts)
Imports locais:
- [`src/pages/private/admin/products/inventory/types/supplierForm.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/supplierForm.types.ts)

### 📄 [`src/pages/private/admin/products/products/components/AdminProductEditModal/AdminProductEditModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/AdminProductEditModal.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/pages/private/admin/products/category/components/CategoryEditModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/category/components/CategoryEditModal.tsx)
- [`src/pages/private/admin/products/products/components/AdminProductEditModal/DeactivateProductModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/DeactivateProductModal.tsx)
- [`src/pages/private/admin/products/products/components/AdminProductEditModal/ReactivateProductModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/ReactivateProductModal.tsx)
- [`src/pages/private/admin/products/products/components/AdminProductEditModal/ImageSection.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/ImageSection.tsx)
- [`src/pages/private/admin/products/products/components/AdminProductEditModal/panels/ProductFormPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/panels/ProductFormPanel.tsx)
- [`src/pages/private/admin/products/products/utils/securityLog.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/utils/securityLog.ts)
- [`src/pages/private/admin/products/inventory/hooks/useStockMovement.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockMovement.ts)
- [`src/pages/private/admin/products/products/hooks/useProductSave.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductSave.ts)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/components/AdminProductEditModal/CategorySelector.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/CategorySelector.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/components/AdminProductEditModal/DeactivateProductModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/DeactivateProductModal.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/components/common/SecurityConfirmModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/SecurityConfirmModal.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useStockMovement.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockMovement.ts)
- [`src/hooks/useStoreSecurityConfig.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreSecurityConfig.ts)
- [`src/pages/private/admin/products/products/utils/securityLog.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/utils/securityLog.ts)
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/components/AdminProductEditModal/ImageSection.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/ImageSection.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/components/AdminProductEditModal/SortableThumb.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/SortableThumb.tsx)
- [`src/pages/private/admin/products/products/hooks/useProductImages.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductImages.ts)

### 📄 [`src/pages/private/admin/products/products/components/AdminProductEditModal/PriceSection.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/PriceSection.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/components/AdminProductEditModal/ReactivateProductModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/ReactivateProductModal.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/components/common/SecurityConfirmModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/SecurityConfirmModal.tsx)
- [`src/pages/private/admin/products/inventory/hooks/useStockMovement.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/hooks/useStockMovement.ts)
- [`src/hooks/useStoreSecurityConfig.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreSecurityConfig.ts)
- [`src/pages/private/admin/products/products/utils/securityLog.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/utils/securityLog.ts)
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/components/AdminProductEditModal/SortableThumb.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/SortableThumb.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/hooks/useProductImages.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductImages.ts)

### 📄 [`src/pages/private/admin/products/products/components/AdminProductEditModal/panels/ProductFormPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductEditModal/panels/ProductFormPanel.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/components/AdminProductViewModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductViewModal.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/components/DiscontinuedProductsModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/DiscontinuedProductsModal.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)
- [`src/pages/private/admin/products/products/components/AdminProductViewModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/AdminProductViewModal.tsx)

### 📄 [`src/pages/private/admin/products/products/components/FilterBar.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/FilterBar.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)
- [`src/pages/private/admin/products/products/hooks/useExport.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useExport.ts)

### 📄 [`src/pages/private/admin/products/products/components/FilteredProductsModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/FilteredProductsModal.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)
- [`src/pages/private/admin/products/products/components/ProductThumb.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductThumb.tsx)
- [`src/pages/private/admin/products/products/components/PrintableReport.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/PrintableReport.tsx)

### 📄 [`src/pages/private/admin/products/products/components/PrintableReport.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/PrintableReport.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/components/ProductActionModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductActionModal.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)
- [`src/pages/private/admin/products/products/components/ProductThumb.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductThumb.tsx)

### 📄 [`src/pages/private/admin/products/products/components/ProductDeleteConfirmModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductDeleteConfirmModal.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/components/common/SecurityConfirmModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/SecurityConfirmModal.tsx)
- [`src/pages/private/admin/products/inventory/components/StockClearanceModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/StockClearanceModal.tsx)
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)
- [`src/pages/private/admin/products/inventory/types/inventory.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/types/inventory.types.ts)
- [`src/hooks/useStoreSecurityConfig.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreSecurityConfig.ts)
- [`src/pages/private/admin/products/products/utils/securityLog.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/utils/securityLog.ts)

### 📄 [`src/pages/private/admin/products/products/components/ProductRow.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductRow.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)
- [`src/pages/private/admin/products/products/components/ProductThumb.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductThumb.tsx)

### 📄 [`src/pages/private/admin/products/products/components/ProductTable.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductTable.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)
- [`src/pages/private/admin/products/products/components/ProductRow.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductRow.tsx)
- [`src/components/common/empty-state/EmptyTableState.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/empty-state/EmptyTableState.tsx)

### 📄 [`src/pages/private/admin/products/products/components/ProductThumb.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/ProductThumb.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/components/StatsCards.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/StatsCards.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)
- [`src/components/common/tooltip/InfoTooltip.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/tooltip/InfoTooltip.tsx)

### 📄 [`src/pages/private/admin/products/products/components/productForm/ProductFormModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/productForm/ProductFormModal.tsx)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/components/productForm/useProductForm.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/components/productForm/useProductForm.ts)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/hooks/useExport.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useExport.ts)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/hooks/useFilters.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useFilters.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/pages/private/admin/products/products/hooks/useModals.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useModals.ts)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/hooks/useProductCategories.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductCategories.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/pages/private/admin/products/products/hooks/useProductDelete.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductDelete.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/products/utils/securityLog.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/utils/securityLog.ts)
- [`src/utils/supabaseStorage.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/supabaseStorage.ts)

### 📄 [`src/pages/private/admin/products/products/hooks/useProductForm.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductForm.ts)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/hooks/useProductPricing.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductPricing.ts)
Imports locais:
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/hooks/useProductSave.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductSave.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/pages/private/admin/products/products/hooks/useProductImages.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProductImages.ts)
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)

### 📄 [`src/pages/private/admin/products/products/hooks/useProducts.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useProducts.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/products/types/product.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/types/product.types.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/pages/private/admin/products/products/hooks/useStorePassword.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/hooks/useStorePassword.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/private/admin/products/products/utils/securityLog.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/products/utils/securityLog.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/pages/private/admin/products/suppliers/SuppliersPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/suppliers/SuppliersPage.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/StatsCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/StatsCard.tsx)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/pages/private/admin/products/suppliers/hooks/useSuppliers.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/suppliers/hooks/useSuppliers.ts)
- [`src/pages/private/admin/products/suppliers/types/supplier.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/suppliers/types/supplier.types.ts)
- [`src/pages/private/admin/suppliers/hooks/useSuppliersInsights.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/hooks/useSuppliersInsights.ts)
- [`src/utils/csv.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/csv.ts)
- [`src/pages/private/admin/products/inventory/utils/supplierStatusUtils.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/utils/supplierStatusUtils.ts)
- [`src/pages/private/admin/products/inventory/components/SupplierFormModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/inventory/components/SupplierFormModal.tsx)

### 📄 [`src/pages/private/admin/products/suppliers/hooks/useSuppliers.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/suppliers/hooks/useSuppliers.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/products/suppliers/types/supplier.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/suppliers/types/supplier.types.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/pages/private/admin/settings/appearance/Appearance.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/appearance/Appearance.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
- [`src/components/admin/StorePreview.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/admin/StorePreview.tsx)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)

### 📄 [`src/pages/private/admin/settings/financialAccounts/FinancialAccountsSettingsPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/financialAccounts/FinancialAccountsSettingsPage.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/services/financialAccountsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/financialAccountsService.ts)
- [`src/utils/finance/ptBrFinancialLabels.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/finance/ptBrFinancialLabels.ts)

### 📄 [`src/pages/private/admin/settings/hours/Hours.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/hours/Hours.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/components/security/PermissionLocked.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/security/PermissionLocked.tsx)

### 📄 [`src/pages/private/admin/settings/messages/MessageSettings.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/messages/MessageSettings.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/hooks/useSecurityContext.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useSecurityContext.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)

### 📄 [`src/pages/private/admin/settings/myHistory/MyHistory.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/myHistory/MyHistory.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/hooks/useRefreshFrame.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useRefreshFrame.ts)
- [`src/services/myHistoryService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/myHistoryService.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/pages/private/admin/settings/onlineOrders/OnlineOrderSettingsPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/onlineOrders/OnlineOrderSettingsPage.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/services/onlineOrderSettingsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/onlineOrderSettingsService.ts)

### 📄 [`src/pages/private/admin/settings/profile/Profile.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/Profile.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/settings/profile/components/MyProfileIdentityTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/components/MyProfileIdentityTab.tsx)
- [`src/pages/private/admin/settings/profile/components/MyProfileAddressTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/components/MyProfileAddressTab.tsx)
- [`src/pages/private/admin/settings/profile/components/MyProfileAdditionalInfoTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/components/MyProfileAdditionalInfoTab.tsx)
- [`src/pages/private/admin/settings/profile/components/MyProfileChangeRequestsTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/components/MyProfileChangeRequestsTab.tsx)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/hooks/useSecurityContext.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useSecurityContext.ts)
- [`src/services/securityService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/securityService.ts)
- [`src/services/userAvatarService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/userAvatarService.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/pages/private/admin/settings/profile/components/MyProfileAdditionalInfoTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/components/MyProfileAdditionalInfoTab.tsx)
Imports locais:
- [`src/components/common/InfoCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/InfoCard.tsx)

### 📄 [`src/pages/private/admin/settings/profile/components/MyProfileChangeRequestsTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/components/MyProfileChangeRequestsTab.tsx)
Imports locais:
- [`src/services/securityService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/securityService.ts)

### 📄 [`src/pages/private/admin/settings/profile/components/MyProfileIdentityTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/profile/components/MyProfileIdentityTab.tsx)
Imports locais:
- [`src/services/securityService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/securityService.ts)

### 📄 [`src/pages/private/admin/settings/security/Security.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/security/Security.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/utils/timezoneUtils.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/timezoneUtils.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)
- [`src/hooks/useSecurityContext.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useSecurityContext.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/utils/permissions.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/permissions.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/hooks/security/useSecurityPermissionsAdmin.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/security/useSecurityPermissionsAdmin.ts)
- [`src/hooks/useRefreshFrame.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useRefreshFrame.ts)
- [`src/hooks/security/useStoreCustomRoles.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/security/useStoreCustomRoles.ts)
- [`src/utils/permissionEvents.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/permissionEvents.ts)

### 📄 [`src/pages/private/admin/settings/storeSettings/StoreSettings.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/StoreSettings.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/pages/private/admin/settings/storeSettings/storeSettings.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/storeSettings.types.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/pages/private/admin/settings/storeSettings/tabs/CorporateTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/tabs/CorporateTab.tsx)
- [`src/pages/private/admin/settings/storeSettings/tabs/AddressTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/tabs/AddressTab.tsx)
- [`src/pages/private/admin/settings/storeSettings/tabs/ContactsTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/tabs/ContactsTab.tsx)
- [`src/pages/private/admin/settings/storeSettings/tabs/LegalTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/tabs/LegalTab.tsx)
- [`src/constants/legalTemplates.ts`](file:///d:/OptmaIdea/optmamenu/src/constants/legalTemplates.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/hooks/useSecurityContext.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useSecurityContext.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/components/security/PermissionLocked.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/security/PermissionLocked.tsx)
- [`src/pages/private/admin/commercial/settings/CommercialSettingsPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/settings/CommercialSettingsPage.tsx)
- [`src/pages/private/admin/settings/appearance/Appearance.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/appearance/Appearance.tsx)
- [`src/pages/private/admin/settings/onlineOrders/OnlineOrderSettingsPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/onlineOrders/OnlineOrderSettingsPage.tsx)
- [`src/pages/private/admin/stock/settings/StockSettingsPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/stock/settings/StockSettingsPage.tsx)
- [`src/pages/private/admin/delivery/Delivery.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/delivery/Delivery.tsx)
- [`src/pages/private/admin/commercial/paymentMethods/PaymentMethodsPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/paymentMethods/PaymentMethodsPage.tsx)
- [`src/pages/private/admin/settings/hours/Hours.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/hours/Hours.tsx)
- [`src/pages/private/admin/settings/messages/MessageSettings.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/messages/MessageSettings.tsx)

### 📄 [`src/pages/private/admin/settings/storeSettings/tabs/AddressTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/tabs/AddressTab.tsx)
Imports locais:
- [`src/pages/private/admin/settings/storeSettings/storeSettings.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/storeSettings.types.ts)

### 📄 [`src/pages/private/admin/settings/storeSettings/tabs/ContactsTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/tabs/ContactsTab.tsx)
Imports locais:
- [`src/pages/private/admin/settings/storeSettings/storeSettings.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/storeSettings.types.ts)

### 📄 [`src/pages/private/admin/settings/storeSettings/tabs/CorporateTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/tabs/CorporateTab.tsx)
Imports locais:
- [`src/pages/private/admin/settings/storeSettings/storeSettings.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/storeSettings.types.ts)

### 📄 [`src/pages/private/admin/settings/storeSettings/tabs/LegalTab.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/tabs/LegalTab.tsx)
Imports locais:
- [`src/pages/private/admin/settings/storeSettings/storeSettings.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/settings/storeSettings/storeSettings.types.ts)

### 📄 [`src/pages/private/admin/stock/settings/StockSettingsPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/stock/settings/StockSettingsPage.tsx)
Imports locais:
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/services/stockSettingsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockSettingsService.ts)

### 📄 [`src/pages/private/admin/suppliers/SupplierDetailPage.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/SupplierDetailPage.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/LoadingSpinner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/LoadingSpinner.tsx)
- [`src/components/common/AlertBanner.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/AlertBanner.tsx)
- [`src/components/common/StatsCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/StatsCard.tsx)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)
- [`src/pages/private/admin/suppliers/hooks/useSupplierMetrics.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/hooks/useSupplierMetrics.ts)
- [`src/pages/private/admin/suppliers/hooks/useSupplierInsights.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/hooks/useSupplierInsights.ts)
- [`src/utils/csv.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/csv.ts)

### 📄 [`src/pages/private/admin/suppliers/components/SupplierModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/components/SupplierModal.tsx)
Imports locais:
- [`src/pages/private/admin/suppliers/types/supplier.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/types/supplier.types.ts)
- [`src/pages/private/admin/suppliers/hooks/useSuppliers.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/hooks/useSuppliers.ts)

### 📄 [`src/pages/private/admin/suppliers/hooks/useSupplierInsights.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/hooks/useSupplierInsights.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/private/admin/suppliers/hooks/useSupplierMetrics.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/hooks/useSupplierMetrics.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/pages/private/admin/suppliers/hooks/useSuppliers.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/hooks/useSuppliers.ts)
Imports locais:
- [`src/pages/private/admin/products/suppliers/hooks/useSuppliers.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/products/suppliers/hooks/useSuppliers.ts)
- [`src/pages/private/admin/suppliers/types/supplier.types.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/types/supplier.types.ts)

### 📄 [`src/pages/private/admin/suppliers/hooks/useSuppliersInsights.ts`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/suppliers/hooks/useSuppliersInsights.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/hooks/store/useCurrentStore.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/store/useCurrentStore.ts)

### 📄 [`src/pages/private/admin/support/Documentation.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/support/Documentation.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)

### 📄 [`src/pages/private/admin/support/FAQ.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/support/FAQ.tsx)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)

### 📄 [`src/pages/private/admin/support/Legal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/support/Legal.tsx)
Imports locais:
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)

### 📄 [`src/pages/private/admin/users/Users.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/users/Users.tsx)
Imports locais:
- [`src/store/useUsersStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useUsersStore.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
- [`src/components/users/index.ts`](file:///d:/OptmaIdea/optmamenu/src/components/users/index.ts)
- [`src/components/users/UserInvitesPanel.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/users/UserInvitesPanel.tsx)
- [`src/hooks/useSecurityContext.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useSecurityContext.ts)
- [`src/hooks/usePermissions.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/usePermissions.ts)
- [`src/hooks/useStoreMemberInvites.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useStoreMemberInvites.ts)
- [`src/components/common/PageContainer.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/PageContainer.tsx)
- [`src/components/common/StatsCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/common/StatsCard.tsx)
- [`src/hooks/security/useStoreMemberSessionSummary.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/security/useStoreMemberSessionSummary.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/hooks/security/useStoreCustomRoles.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/security/useStoreCustomRoles.ts)
- [`src/hooks/useRefreshFrame.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useRefreshFrame.ts)
- [`src/hooks/useRealtimeListener.ts`](file:///d:/OptmaIdea/optmamenu/src/hooks/useRealtimeListener.ts)
- [`src/services/securityService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/securityService.ts)

### 📄 [`src/pages/store/Catalog.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/store/Catalog.tsx)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
- [`src/pages/store/ProductCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/store/ProductCard.tsx)
- [`src/pages/store/ProductModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/store/ProductModal.tsx)
- [`src/store/useCartStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCartStore.ts)
- [`src/store/useCustomerAuth.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCustomerAuth.ts)
- [`src/services/customerAuth.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customerAuth.ts)
- [`src/services/customerService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customerService.ts)
- [`src/pages/store/components/CartDrawer.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/store/components/CartDrawer.tsx)
- [`src/pages/store/components/CustomerProfile.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/store/components/CustomerProfile.tsx)
- [`src/services/publicStorefrontService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/publicStorefrontService.ts)
- [`src/services/publicOrderService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/publicOrderService.ts)
- [`src/utils/timezoneUtils.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/timezoneUtils.ts)
- [`src/utils/whatsapp.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/whatsapp.ts)
- [`src/services/publicLoyaltyService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/publicLoyaltyService.ts)

### 📄 [`src/pages/store/Checkout.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/store/Checkout.tsx)
Imports locais:
- [`src/store/useCartStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCartStore.ts)

### 📄 [`src/pages/store/ProductCard.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/store/ProductCard.tsx)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
- [`src/store/useCartStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCartStore.ts)
- [`src/utils/pricing.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/pricing.ts)

### 📄 [`src/pages/store/ProductModal.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/store/ProductModal.tsx)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
- [`src/store/useCartStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCartStore.ts)
- [`src/utils/pricing.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/pricing.ts)

### 📄 [`src/pages/store/PublicOrderTracking.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/store/PublicOrderTracking.tsx)
Imports locais:
- [`src/services/publicOrderService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/publicOrderService.ts)

### 📄 [`src/pages/store/components/CartDrawer.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/store/components/CartDrawer.tsx)
Imports locais:
- [`src/store/useCartStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCartStore.ts)
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/pages/store/components/CustomerProfile.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/store/components/CustomerProfile.tsx)
Imports locais:
- [`src/pages/private/admin/commercial/orders/OrderHistory.tsx`](file:///d:/OptmaIdea/optmamenu/src/pages/private/admin/commercial/orders/OrderHistory.tsx)
- [`src/components/LoyaltyPoints.tsx`](file:///d:/OptmaIdea/optmamenu/src/components/LoyaltyPoints.tsx)
- [`src/services/customerService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customerService.ts)
- [`src/services/notificationService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/notificationService.ts)
- [`src/store/useCustomerAuth.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCustomerAuth.ts)
- [`src/utils/timezoneUtils.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/timezoneUtils.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/services/cashbookAccountPlanService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookAccountPlanService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/cashbookAccountPlanTreeService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookAccountPlanTreeService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/services/cashbookAccountPlanService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookAccountPlanService.ts)

### 📄 [`src/services/cashbookAccountPlanTrialBalanceService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookAccountPlanTrialBalanceService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/cashbookDiscrepancyService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookDiscrepancyService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/cashbookService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/cashbookService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/commercialDashboardService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/commercialDashboardService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/commercialSettingsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/commercialSettingsService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/customerAuth.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customerAuth.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/store/useCustomerAuth.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCustomerAuth.ts)
- [`src/lib/jwt.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/jwt.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/services/customerService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customerService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/customers360Service.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customers360Service.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/deliveryMethodsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/deliveryMethodsService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/directSalesService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/directSalesService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/financialAccountsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/financialAccountsService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/loyaltyAdvancedService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/loyaltyAdvancedService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/marketingCenterService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/marketingCenterService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/myHistoryService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/myHistoryService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/myStoreInviteService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/myStoreInviteService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/types/myStoreInvites.ts`](file:///d:/OptmaIdea/optmamenu/src/types/myStoreInvites.ts)

### 📄 [`src/services/notificationService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/notificationService.ts)
Imports locais:
- [`src/services/customerService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/customerService.ts)

### 📄 [`src/services/notifications/notificationService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/notifications/notificationService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/onlineOrderSettingsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/onlineOrderSettingsService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/paymentMethodsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/paymentMethodsService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/permissionService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/permissionService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/types/permissions.ts`](file:///d:/OptmaIdea/optmamenu/src/types/permissions.ts)

### 📄 [`src/services/publicLoyaltyService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/publicLoyaltyService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/publicOrderService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/publicOrderService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/publicStorefrontService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/publicStorefrontService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/services/salesChannelsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/salesChannelsService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/securityService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/securityService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)

### 📄 [`src/services/stockService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/stockSettingsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/stockSettingsService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/storeMemberInviteService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/storeMemberInviteService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/types/storeMemberInvites.ts`](file:///d:/OptmaIdea/optmamenu/src/types/storeMemberInvites.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)

### 📄 [`src/services/userAvatarService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/userAvatarService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)

### 📄 [`src/services/userMemberDetailsService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/userMemberDetailsService.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/types/userMemberDetails.ts`](file:///d:/OptmaIdea/optmamenu/src/types/userMemberDetails.ts)

### 📄 [`src/store/useAuthStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useAuthStore.ts)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/store/useCartStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCartStore.ts)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
- [`src/utils/pricing.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/pricing.ts)

### 📄 [`src/store/useCustomerAuth.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useCustomerAuth.ts)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/store/useUsersStore.ts`](file:///d:/OptmaIdea/optmamenu/src/store/useUsersStore.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)
- [`src/services/securityService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/securityService.ts)
- [`src/services/storeMemberInviteService.ts`](file:///d:/OptmaIdea/optmamenu/src/services/storeMemberInviteService.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

### 📄 [`src/types/myStoreInvites.ts`](file:///d:/OptmaIdea/optmamenu/src/types/myStoreInvites.ts)
Imports locais:
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)

### 📄 [`src/types/order.ts`](file:///d:/OptmaIdea/optmamenu/src/types/order.ts)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)
Imports locais:
- [`src/types/permissions.ts`](file:///d:/OptmaIdea/optmamenu/src/types/permissions.ts)

### 📄 [`src/types/store.ts`](file:///d:/OptmaIdea/optmamenu/src/types/store.ts)
Imports locais:
- [`src/types/index.ts`](file:///d:/OptmaIdea/optmamenu/src/types/index.ts)

### 📄 [`src/types/storeMemberInvites.ts`](file:///d:/OptmaIdea/optmamenu/src/types/storeMemberInvites.ts)
Imports locais:
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)

### 📄 [`src/utils/permissions.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/permissions.ts)
Imports locais:
- [`src/types/permissions.ts`](file:///d:/OptmaIdea/optmamenu/src/types/permissions.ts)

### 📄 [`src/utils/security/permissionCatalogVisibility.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/security/permissionCatalogVisibility.ts)
Imports locais:
- [`src/types/security.ts`](file:///d:/OptmaIdea/optmamenu/src/types/security.ts)

### 📄 [`src/utils/sessionSecurity.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/sessionSecurity.ts)
Imports locais:
- [`src/lib/supabase.ts`](file:///d:/OptmaIdea/optmamenu/src/lib/supabase.ts)
- [`src/utils/activeStore.ts`](file:///d:/OptmaIdea/optmamenu/src/utils/activeStore.ts)

## PDV dedicado — Fase 2

### Rota

- `/admin/pdv` — rota autenticada com layout exclusivo e `pdv.view`.
- `/pdv` — alias autenticado para `/admin/pdv`.

### Arquivos

- `src/components/layouts/PdvLayout.tsx` — frame reduzido do terminal.
- `src/pages/private/admin/pdv/PdvPage.tsx` — bootstrap, busca, categorias e catálogo.
- `src/services/pdvService.ts` — acesso à RPC reduzida do PDV.
- `src/types/pdv.ts` — contratos de loja, operador, local, categoria, produto e código.
- `supabase/migrations/20260723234330_pdv2_catalog_bootstrap.sql` — códigos,
  RLS, Realtime e `get_pos_bootstrap`.

### Banco

- `product_codes` — códigos extensíveis por produto e loja.
- `get_pos_bootstrap(uuid, uuid)` — contexto mínimo do terminal.
- `inventory_location_balances` — publicada no `supabase_realtime`.


## PDV dedicado — correção operacional 2026-07-24

- `src/pages/private/admin/pdv/PdvPage.tsx` — catálogo com imagens, carrinho persistente, pagamento, troco e finalização.
- `src/components/layouts/PdvLayout.tsx` — tema, avatar e navegação responsiva.
- `public/pdv.webmanifest` e `public/pdv-sw.js` — instalação dedicada do PDV.
- Cadastro de Produto — edição de código interno, SKU e EAN em `product_codes`.
- Migração `20260724002328_pdv_stock_exception_and_sell_permission.sql` — venda com divergência auditada.

## PDV dedicado — fechamento parcial de preços e catálogo 2026-07-24

- `src/pages/private/admin/pdv/PdvPage.tsx` — cotação autoritativa no carrinho,
  desconto automático visível e troco calculado sobre o preço efetivo.
- `src/services/pdvService.ts` e `src/types/pdv.ts` — contrato da prévia de preço.
- `src/pages/private/admin/products/products/hooks/useFilters.ts` — busca por nome,
  descrição, código interno, SKU e EAN.
- `ProductTable.tsx` e `CategoryTable.tsx` — rolagem horizontal superior
  sincronizada; a coluna Produto deixa de sobrepor as demais.
- Categorias — contagem e modal sem produtos descontinuados.
- `public/pdv.webmanifest` — identidade instalável própria do PDV, separada da
  aplicação administrativa.
- Migração `20260724012303_pdv_pricing_preview_safe.sql` — RPC
  `quote_pos_cart_safe` e fechamento do acesso direto ao motor interno.


### Correção de saldo local ausente do PDV — 24/07/2026

- `supabase/migrations/20260724130259_fix_pdv_missing_stock_balance.sql`
  corrige a finalização quando ainda não existe saldo para loja + local + produto.
- `docs/PDV_CORRECAO_SALDO_LOCAL_AUSENTE_20260724.md` registra causa, contrato,
  UX e validação transacional.


## Atualização 24/07/2026 — fechamento e divergências operacionais

- `src/pages/private/admin/products/inventory/StockDiscrepanciesPage.tsx`: fila auditável de vendas concluídas com exceção de estoque.
- `src/services/stockDiscrepancyService.ts`: leitura e tratamento das ocorrências por RPC.
- `src/pages/private/admin/financial/cashbook/components/DayClosingPanel.tsx`: separação visual de fundo de abertura, movimento diário e esperado físico.
- `src/services/cashbookService.ts`: listagem por período/data operacional e contrato ampliado do fechamento.
- `supabase/migrations/20260724145045_fix_cashbook_and_stock_discrepancies.sql`: correção do fechamento, filtro por `entry_date`, tabela/RLS/Realtime/trigger/RPCs de divergências.
- Rota protegida: `/admin/stock/divergences` com `stock.view`; tratamento exige `stock.manage` ou `stock.adjust`.
- Decisões e evolução de conciliação financeira: `docs/FECHAMENTO_CAIXA_E_DIVERGENCIAS_ESTOQUE_20260724.md`.

- `supabase/migrations/20260724145323_index_stock_discrepancy_actors.sql`: índices das referências de operador/responsável da fila de divergências.
