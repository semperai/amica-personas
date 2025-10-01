import React, { useEffect } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { TransactionStatus, Transaction } from '../types';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

interface TransactionToastProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  autoClose?: boolean;
  autoCloseTime?: number;
}

export const TransactionToast: React.FC<TransactionToastProps> = ({
  position = 'bottom-right',
  autoClose = true,
  autoCloseTime = 5000,
}) => {
  const { transactions } = useTransactions();
  const [visibleTxs, setVisibleTxs] = React.useState<Transaction[]>([]);
  
  // Add new transactions
  useEffect(() => {
    setVisibleTxs(prev => [
      ...prev,
      ...transactions.filter(tx => !prev.find(vTx => vTx.id === tx.id))
    ]);
  }, [transactions]);

  // Update status of existing transactions
  useEffect(() => {
    setVisibleTxs(prev =>
      prev.map(vTx => transactions.find(tx => tx.id === vTx.id) || vTx)
    );
  }, [transactions]);
  
  // Auto-close completed transactions
  useEffect(() => {
    if (!autoClose) return undefined;
    
    const completedTxs = visibleTxs.filter(tx => 
      tx.status === TransactionStatus.SUCCESS || 
      tx.status === TransactionStatus.ERROR
    );
    
    if (completedTxs.length > 0) {
      const timers = completedTxs.map(tx => 
        setTimeout(() => {
          setVisibleTxs(prev => prev.filter(t => t.id !== tx.id));
        }, autoCloseTime)
      );
      
      return () => {
        timers.forEach(timer => clearTimeout(timer));
      };
    }
    
    return undefined;
  }, [visibleTxs, autoClose, autoCloseTime]);
  
  const handleClose = (txId: string) => {
    setVisibleTxs(prev => prev.filter(tx => tx.id !== txId));
  };
  
  const positionClass = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  }[position];
  
  if (visibleTxs.length === 0) {
    return null;
  }
  
  return (
    <div className={`fixed ${positionClass} z-50 space-y-2 max-w-md w-full`}>
      {visibleTxs.map(tx => (
        <div 
          key={tx.id}
          className="bg-white rounded-lg shadow-lg p-4 border border-gray-200 flex items-center"
        >
          <div className="mr-3">
            {tx.status === TransactionStatus.PENDING && (
              <Loader className="h-5 w-5 text-blue-500 animate-spin" />
            )}
            {tx.status === TransactionStatus.SUCCESS && (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            {tx.status === TransactionStatus.ERROR && (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium">
              {tx.status === TransactionStatus.PENDING && 'Transaction Pending'}
              {tx.status === TransactionStatus.SUCCESS && 'Transaction Confirmed'}
              {tx.status === TransactionStatus.ERROR && 'Transaction Failed'}
            </div>
            <div className="text-sm text-gray-500 truncate">
              {tx.hash ? `${tx.hash.slice(0, 10)}...${tx.hash.slice(-8)}` : 'Processing...'}
            </div>
          </div>
          <button
            onClick={() => handleClose(tx.id)}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};