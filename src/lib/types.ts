export type TransactionType = "income" | "expense" | "transfer";
export type CategoryType = "income" | "expense";
export type PaymentMethod = "cash" | "qris_bank";
export type AccountKind = "cash" | "bank" | "other";
export type BudgetPeriodType = "weekly" | "monthly";
export type GoalStatus = "active" | "achieved" | "cancelled";
export type PlanItemKind = "fixed" | "budget";

export interface Profile {
  id: string;
  full_name: string | null;
}

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  initial_balance: number;
  is_archived: boolean;
  sort_order: number;
}

export interface AccountWithBalance extends Account {
  balance: number;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  sort_order: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category_id: string | null;
  account_id: string;
  to_account_id: string | null;
  tx_date: string;
  payment_method: PaymentMethod | null;
  note: string | null;
  count_weekly: boolean;
  count_monthly: boolean;
  created_at: string;
}

/** Kolom minimum untuk agregasi (hemat transfer data). */
export type TransactionLite = Pick<
  Transaction,
  "id" | "type" | "amount" | "category_id" | "account_id" | "to_account_id" | "tx_date" | "count_weekly" | "count_monthly"
>;

export interface Budget {
  id: string;
  period_type: BudgetPeriodType;
  category_id: string | null;
  period_start: string;
  amount: number;
}

export interface FinancialPlan {
  id: string;
  month: string;
  salary: number;
}

export interface PlanItem {
  id: string;
  plan_id: string;
  name: string;
  kind: PlanItemKind;
  category_id: string | null;
  amount: number;
  sort_order: number;
}

export interface FinancialGoal {
  id: string;
  name: string;
  target_amount: number;
  deadline: string | null;
  note: string | null;
  status: GoalStatus;
  created_at: string;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  amount: number;
  contributed_on: string;
  note: string | null;
}
