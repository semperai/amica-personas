import { useMemo } from 'react';
import { useAAWallet } from './useAAWallet';
import { Transaction, TransactionStatus } from '../types';

interface UseTransactionsResult {
  transactions: Transaction[];
  pending: Transaction[];
  completed: Transaction[];
  failed: Transaction[];
  isPending: boolean;
  hasFailed: boolean;
}

/**
 * Hook to access and filter transactions
 * @returns Filtered transactions and status flags
 */
export function useTransactions(): UseTransactionsResult {
  const { transactions } = useAAWallet();
  
  return useMemo(() => {
    const pending = transactions.filter(tx => tx.status === TransactionStatus.PENDING);
    const completed = transactions.filter(tx => tx.status === TransactionStatus.SUCCESS);
    const failed = transactions.filter(tx => tx.status === TransactionStatus.ERROR);
    
    return {
      transactions,
      pending,
      completed,
      failed,
      isPending: pending.length > 0,
      hasFailed: failed.length > 0,
    };
  }, [transactions]);
}