import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  ATISuperAdminDashboard,
  SystemAdminDashboard,
  DataClerkDashboard,
} from './roles/PlatformAdminDashboards';
import {
  MoAFederalDashboard,
  RBoARegionalDashboard,
  ZBoAZonalDashboard,
  WBoAWoredaDashboard,
  KebeleDADashboard,
} from './roles/GovernmentOversightDashboards';
import {
  MoTRFederalDashboard,
  RCoPARegionalDashboard,
  OmbudsmanDashboard,
  CourtJudgeDashboard,
} from './roles/RegulatoryAndJusticeDashboards';
import {
  FarmerIndividualDashboard,
  PrimaryCooperativeDashboard,
  CooperativeUnionDashboard,
  ContractorAgroProcessorDashboard,
  InputSupplierDashboard,
  CommercialBankDashboard,
} from './roles/ValueChainActorDashboards';

export interface DashboardRouterPageProps {
  onNavigate: (path: string) => void;
}

export const DashboardRouterPage: React.FC<DashboardRouterPageProps> = ({ onNavigate }) => {
  const { currentRole } = useAppStore();

  switch (currentRole as string) {
    // Platform Administration & Auditing
    case 'ATISuperAdmin':
    case 'Auditor':
      return <ATISuperAdminDashboard onNavigate={onNavigate} />;
    case 'SystemAdmin':
      return <SystemAdminDashboard onNavigate={onNavigate} />;
    case 'DataClerk':
      return <DataClerkDashboard onNavigate={onNavigate} />;

    // Government Oversight
    case 'MoAFederal':
      return <MoAFederalDashboard onNavigate={onNavigate} />;
    case 'RBoARegional':
      return <RBoARegionalDashboard onNavigate={onNavigate} />;
    case 'ZBoAZonal':
      return <ZBoAZonalDashboard onNavigate={onNavigate} />;
    case 'WBoAWoreda':
      return <WBoAWoredaDashboard onNavigate={onNavigate} />;
    case 'KebeleOfficer':
    case 'KebeleDA':
    case 'FieldAgent':
      return <KebeleDADashboard onNavigate={onNavigate} />;

    // Regulatory & Justice
    case 'MoTRIOfficer':
    case 'MoTRFederal':
      return <MoTRFederalDashboard onNavigate={onNavigate} />;
    case 'ECCOfficer':
    case 'RCoPARegional':
      return <RCoPARegionalDashboard onNavigate={onNavigate} />;
    case 'EAAOfficer':
    case 'Ombudsman':
      return <OmbudsmanDashboard onNavigate={onNavigate} />;
    case 'JusticeOfficer':
    case 'CourtJudge':
      return <CourtJudgeDashboard onNavigate={onNavigate} />;

    // Value Chain Actors
    case 'ProducerIndividual':
    case 'FarmerIndividual':
    case 'FarmerOutgrower':
      return <FarmerIndividualDashboard onNavigate={onNavigate} />;
    case 'ProducerCooperative':
    case 'PrimaryCooperative':
      return <PrimaryCooperativeDashboard onNavigate={onNavigate} />;
    case 'CooperativeUnion':
      return <CooperativeUnionDashboard onNavigate={onNavigate} />;
    case 'Contractor':
    case 'ContractorAgroProcessor':
    case 'ContractorExporter':
      return <ContractorAgroProcessorDashboard onNavigate={onNavigate} />;
    case 'AgroDealer':
    case 'InputSupplier':
      return <InputSupplierDashboard onNavigate={onNavigate} />;
    case 'FinancialInstitution':
    case 'CommercialBank':
    case 'Insurer':
      return <CommercialBankDashboard onNavigate={onNavigate} />;

    default:
      return <ATISuperAdminDashboard onNavigate={onNavigate} />;
  }
};
