import React, { useEffect } from 'react';
import { XMarkIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';
import Button from './Button';

interface PaymentFormData {
  payment_amount: number;
  payment_date: string;
  process_payment: boolean;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentFormData) => Promise<void>;
  invoiceId: number;
  invoiceTotal: number;
  amountPaid: number;
  loading?: boolean;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  invoiceId,
  invoiceTotal,
  amountPaid,
  loading = false
}) => {
  const rawOutstanding = invoiceTotal - amountPaid;
  const outstandingAmount = Math.max(rawOutstanding, 0);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<PaymentFormData>({
    defaultValues: {
      payment_amount: outstandingAmount,
      payment_date: new Date().toISOString().split('T')[0],
      process_payment: true
    }
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        payment_amount: outstandingAmount,
        payment_date: new Date().toISOString().split('T')[0],
        process_payment: true
      });
    }
  }, [isOpen, outstandingAmount, reset]);

  const paymentAmount = watch('payment_amount');

  const handleFormSubmit = async (data: PaymentFormData) => {
    await onSubmit(data);
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
          {/* Header */}
          <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                  <BanknotesIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Add Payment</h3>
                  <p className="text-sm text-white/90">Invoice #{invoiceId}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6">
            {/* Payment Summary */}
            <div className="mb-6 rounded-lg bg-gray-50 p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Invoice Total:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(invoiceTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(amountPaid)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Outstanding:</span>
                    <span className="font-bold text-scarlet">{formatCurrency(outstandingAmount)}</span>
                  </div>
                  {rawOutstanding < 0 && (
                    <p className="mt-1 text-xs text-gray-600">
                      Invoice currently overpaid by {formatCurrency(Math.abs(rawOutstanding))}.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Amount */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Payment Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-500">R</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...register('payment_amount', {
                    required: 'Payment amount is required',
                    min: {
                      value: 0.01,
                      message: 'Amount must be greater than 0'
                    }
                  })}
                  className={`block w-full rounded-lg border pl-8 pr-4 py-2 focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 ${
                    errors.payment_amount ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
              </div>
              {errors.payment_amount && (
                <p className="mt-1 text-sm text-red-500">{errors.payment_amount.message}</p>
              )}
              
              {/* Quick Amount Buttons */}
              {outstandingAmount > 0 && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setValue('payment_amount', outstandingAmount / 2)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('payment_amount', outstandingAmount)}
                    className="flex-1 rounded-lg border border-picton-blue bg-picton-blue/10 px-3 py-1 text-xs font-medium text-picton-blue hover:bg-picton-blue/20 transition-colors"
                  >
                    Full Amount
                  </button>
                </div>
              )}
            </div>

            {/* Payment Date */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register('payment_date', {
                  required: 'Payment date is required'
                })}
                className={`block w-full rounded-lg border px-4 py-2 focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 ${
                  errors.payment_date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.payment_date && (
                <p className="mt-1 text-sm text-red-500">{errors.payment_date.message}</p>
              )}
            </div>

            {/* New Balance Preview */}
            {paymentAmount && paymentAmount > 0 && (
              <div className="mb-6 rounded-lg border-2 border-green-200 bg-green-50 p-4">
                {(() => {
                  const balanceAfterPayment = rawOutstanding - (paymentAmount || 0);
                  const balanceClass = balanceAfterPayment > 0 ? 'text-scarlet' : 'text-green-700';
                  return (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-green-900">Balance After Payment:</span>
                      <span className={`text-lg font-bold ${balanceClass}`}>
                        {formatCurrency(balanceAfterPayment)}
                      </span>
                    </div>
                  );
                })()}
                {rawOutstanding - (paymentAmount || 0) === 0 && (
                  <p className="mt-2 text-xs text-green-700">
                    ✓ This payment will fully settle the invoice
                  </p>
                )}
                {rawOutstanding - (paymentAmount || 0) < 0 && (
                  <p className="mt-2 text-xs text-green-700">
                    ✓ This will create a credit balance of {formatCurrency(Math.abs(rawOutstanding - (paymentAmount || 0)))}
                  </p>
                )}
              </div>
            )}

            {/* Processing Toggle */}
            <div className="mb-6 rounded-lg border border-gray-200 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-picton-blue focus:ring-picton-blue"
                  {...register('process_payment')}
                />
                <span>
                  <span className="text-sm font-medium text-gray-900">Add to VAT ledger</span>
                  <p className="text-xs text-gray-600 mt-1">
                    When enabled, this payment is recorded as an income transaction so your VAT and reporting stay in sync.
                  </p>
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                loading={loading}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Add Payment'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
