export const statusLabels = {
  profile_incomplete: 'Profile incomplete',
  documents_pending: 'Documents pending',
  ready_for_admin_review: 'Ready for admin',
  pending_admin_review: 'Admin review',
  admin_changes_requested: 'Changes requested',
  submitted_to_university: 'Submitted',
  awaiting_decision: 'Awaiting decision',
  offer_received: 'Offer received',
  offer_rejected: 'Offer rejected',
  conditional_offer: 'Conditional offer',
  unconditional_offer: 'Unconditional offer',
  deposit_paid: 'Deposit paid',
  cas_issued: 'CAS/I-20/COE issued',
  visa_filed: 'Visa filed',
  visa_granted: 'Visa granted',
  enrolled: 'Enrolled',
  rejected: 'Rejected',
  uploaded: 'Uploaded',
  approved: 'Approved',
  rejected_document: 'Rejected',
  scanning: 'Scanning',
  replaced: 'Replaced',
  open: 'Open',
  done: 'Done',
  active: 'Active',
  needs_auth_user: 'Needs auth user',
  needs_login_creation: 'Needs login',
  invited: 'Invited',
  pending_manager_activation: 'Pending setup',
  pending_login_creation: 'Pending login',
  cancelled: 'Cancelled',
  requested: 'Requested',
  in_progress: 'In progress',
  completed: 'Completed',
  verified: 'Verified',
};

export const statusTone = {
  profile_incomplete: 'neutral',
  documents_pending: 'warning',
  ready_for_admin_review: 'info',
  pending_admin_review: 'violet',
  admin_changes_requested: 'warning',
  submitted_to_university: 'info',
  awaiting_decision: 'info',
  offer_received: 'success',
  offer_rejected: 'danger',
  conditional_offer: 'success',
  unconditional_offer: 'success',
  deposit_paid: 'success',
  cas_issued: 'violet',
  visa_filed: 'violet',
  visa_granted: 'success',
  enrolled: 'success',
  rejected: 'danger',
  uploaded: 'info',
  approved: 'success',
  rejected_document: 'danger',
  projected: 'info',
  ready_to_invoice: 'warning',
  invoiced: 'violet',
  paid: 'success',
  disputed: 'danger',
  active: 'success',
  needs_auth_user: 'warning',
  needs_login_creation: 'warning',
  invited: 'info',
  pending_manager_activation: 'warning',
  pending_login_creation: 'warning',
  cancelled: 'neutral',
  requested: 'info',
  in_progress: 'warning',
  completed: 'success',
  verified: 'success',
};

export function labelFor(value) {
  return statusLabels[value] || String(value || '').replace(/_/g, ' ');
}

export function money(value, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }
}
