// src/components/shared/StatusBadge.tsx
import { Badge } from '../ui/Badge';
import { AgentStatus, AgentKycStatus, AccountStatus, LoanStatus } from '../../types';

interface StatusBadgeProps {
  status: AgentStatus | AgentKycStatus | AccountStatus | LoanStatus | 'open' | 'closed' | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    // Agent
    case 'active':
      return <Badge variant="success">Active</Badge>;
    case 'inactive':
      return <Badge variant="secondary">Inactive</Badge>;
    case 'suspended':
      return <Badge variant="warning">Suspended</Badge>;
    case 'terminated':
      return <Badge variant="destructive">Terminated</Badge>;

    // KYC
    case 'kyc_verified':
      return <Badge variant="success">Verified</Badge>;
    case 'kyc_pending':
      return <Badge variant="warning">KYC Pending</Badge>;
    case 'documents_submitted':
      return <Badge variant="default" className="bg-blue-600">Under Review</Badge>;
    case 'kyc_rejected':
      return <Badge variant="destructive">Rejected</Badge>;

    // Accounts & Loans
    case 'frozen':
      return <Badge variant="destructive">Frozen</Badge>;
    case 'overdue':
      return <Badge variant="destructive">Overdue</Badge>;
    case 'closed':
      return <Badge variant="secondary">Closed</Badge>;
    case 'written_off':
      return <Badge variant="destructive">Written Off</Badge>;

    // Fallback
    default:
      return <Badge variant="outline" className="uppercase">{String(status).replace('_', ' ')}</Badge>;
  }
}
