import { View, Text } from 'react-native';

import { cn } from '@/lib/utils';
import type { ComplianceStatus, ApprovalStatus } from '@/types/client';

interface ComplianceBadgeProps {
  status: ComplianceStatus;
  className?: string;
}

const COMPLIANCE_STYLES: Record<ComplianceStatus, { bg: string; text: string; label: string }> = {
  pending_review: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Pending Review' },
  under_review: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Under Review' },
  cleared: { bg: 'bg-green-100', text: 'text-green-700', label: 'Cleared' },
  flagged: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Flagged' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
};

export function ComplianceBadge({ status, className }: ComplianceBadgeProps) {
  const style = COMPLIANCE_STYLES[status];
  return (
    <View className={cn('rounded-full px-2.5 py-0.5', style.bg, className)}>
      <Text className={cn('text-xs font-medium', style.text)}>{style.label}</Text>
    </View>
  );
}

interface ApprovalBadgeProps {
  status: ApprovalStatus;
  className?: string;
}

const APPROVAL_STYLES: Record<ApprovalStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
  pending_compliance: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending Compliance' },
  compliance_cleared: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Compliance Cleared' },
  pending_md_approval: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pending MD Approval' },
  approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
};

export function ApprovalBadge({ status, className }: ApprovalBadgeProps) {
  const style = APPROVAL_STYLES[status];
  return (
    <View className={cn('rounded-full px-2.5 py-0.5', style.bg, className)}>
      <Text className={cn('text-xs font-medium', style.text)}>{style.label}</Text>
    </View>
  );
}
