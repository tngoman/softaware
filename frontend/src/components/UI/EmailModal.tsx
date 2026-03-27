import React, { useState, useEffect } from 'react';
import { XMarkIcon, PaperAirplaneIcon, EyeIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import AppSettingsModel from '../../models/AppSettingsModel';
import Swal from 'sweetalert2';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: { to: string; cc?: string; subject: string; body: string }) => Promise<void>;
  defaultRecipient?: string;
  defaultSubject: string;
  documentType: 'Quote' | 'Invoice' | 'Purchase Order';
  documentNumber: string;
}

const EmailModal: React.FC<EmailModalProps> = ({
  isOpen,
  onClose,
  onSend,
  defaultRecipient = '',
  defaultSubject,
  documentType,
  documentNumber
}) => {
  const [to, setTo] = useState(defaultRecipient);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingStatus, setSendingStatus] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');
  const [loading, setLoading] = useState(true);

  // Load email signature from settings
  useEffect(() => {
    const loadEmailSignature = async () => {
      try {
        setLoading(true);
        const settings = await AppSettingsModel.get();
        const signature = settings.email_signature || 'Best regards,\nYour Company Name';
        
        // Set default email body with signature
        const defaultBody = `Good day,

Please find attached ${documentType} #${documentNumber}.

Should you have any queries, please do not hesitate to contact us.

${signature}`;
        
        setBody(defaultBody);
      } catch (error) {
        console.error('Error loading email signature:', error);
        // Fallback to default if settings fail to load
        const fallbackBody = `Good day,

Please find attached ${documentType} #${documentNumber}.

Should you have any queries, please do not hesitate to contact us.

Best regards,
Your Company Name`;
        setBody(fallbackBody);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadEmailSignature();
    }
  }, [isOpen, documentType, documentNumber]);

  const handleSend = async () => {
    if (!to.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Recipient',
        text: 'Please enter a recipient email address'
      });
      return;
    }

    setSending(true);
    setSendingStatus('Generating PDF...');
    try {
      // Short delay so the user sees the first status before network blocks the UI
      await new Promise(r => setTimeout(r, 100));
      setSendingStatus('Sending email...');

      // Send raw body text — backend converts to HTML
      await onSend({ to, cc: cc || undefined, subject, body });

      setSending(false);
      setSendingStatus('');

      await Swal.fire({
        icon: 'success',
        title: 'Email Sent!',
        text: `${documentType} #${documentNumber} has been sent to ${to}`,
        confirmButtonColor: '#2563eb',
        timer: 4000,
        timerProgressBar: true,
      });
      onClose();
    } catch (error: any) {
      console.error('Error sending email:', error);
      setSending(false);
      setSendingStatus('');

      const errorMsg = error?.response?.data?.error
        || error?.message
        || 'Failed to send email. Please check your SMTP settings and try again.';

      Swal.fire({
        icon: 'error',
        title: 'Email Failed',
        text: errorMsg,
        confirmButtonColor: '#2563eb',
      });
    }
  };

  const renderPreview = () => {
    return body
      .split('\n\n')
      .map((para, idx) => (
        <p key={idx} className="mb-2" dangerouslySetInnerHTML={{ 
          __html: para.replace(/\n/g, '<br/>') 
        }} />
      ));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">
              Send {documentType} via Email
            </h3>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Body */}
          <div className="bg-white px-6 py-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : (
              <>
                {/* To and CC Fields - Inline */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="to" className="block text-sm font-medium text-gray-700 mb-1">
                      To <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="to"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm border"
                      placeholder="customer@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="cc" className="block text-sm font-medium text-gray-700 mb-1">
                      CC
                    </label>
                    <input
                      type="email"
                      id="cc"
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm border"
                      placeholder="cc@example.com (optional)"
                    />
                  </div>
                </div>

                {/* Subject Field */}
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm border"
                    required
                  />
                </div>

            {/* Body Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="body" className="block text-sm font-medium text-gray-700">
                  Message <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('edit')}
                    className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                      viewMode === 'edit'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <CodeBracketIcon className="h-3 w-3 mr-1" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('preview')}
                    className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                      viewMode === 'preview'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <EyeIcon className="h-3 w-3 mr-1" />
                    Preview
                  </button>
                </div>
              </div>
              
              {viewMode === 'edit' ? (
                <>
                  <textarea
                    id="body"
                    rows={10}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Enter your message here..."
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Write your message in plain text. Separate paragraphs with blank lines.
                  </p>
                </>
              ) : (
                <div className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 p-4 min-h-[240px]">
                  <div className="text-sm text-gray-900">
                    {renderPreview()}
                  </div>
                </div>
              )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {sending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {sendingStatus || 'Sending...'}
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailModal;
