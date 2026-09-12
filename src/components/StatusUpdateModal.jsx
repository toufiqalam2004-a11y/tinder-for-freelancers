import React, { useState } from 'react';
import {
  FileText,
  MessageSquare,
  Calendar,
  Trophy,
  XCircle,
  Check,
  Eye,
  Bookmark,
  Sparkles,
} from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

const STATUS_OPTIONS = [
  { id: 'saved', label: 'Saved', icon: Bookmark, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { id: 'draft', label: 'Draft', icon: FileText, color: 'text-text-muted', bgColor: 'bg-surface-hover' },
  { id: 'applied', label: 'Applied', icon: FileText, color: 'text-primary', bgColor: 'bg-primary/10' },
  { id: 'viewed', label: 'Viewed', icon: Eye, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
  { id: 'replied', label: 'Replied', icon: MessageSquare, color: 'text-sky-500', bgColor: 'bg-sky-500/10' },
  { id: 'interview', label: 'Interview', icon: Calendar, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 'negotiation', label: 'Negotiation', icon: Sparkles, color: 'text-amber-600', bgColor: 'bg-amber-500/10' },
  { id: 'hired', label: 'Hired', icon: Trophy, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  { id: 'closed', label: 'Closed', icon: XCircle, color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
];

const StatusUpdateModal = ({ isOpen, onClose, application, onStatusUpdate }) => {
  const [selectedStatus, setSelectedStatus] = useState(application?.status || 'applied');
  const [note, setNote] = useState('');

  React.useEffect(() => {
    if (application) {
      setSelectedStatus(application.status || 'applied');
      setNote('');
    }
  }, [application]);

  if (!application) return null;

  const handleUpdate = () => {
    onStatusUpdate(application.id, selectedStatus, note.trim() || undefined);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Application Stage">
      <div className="mb-4 text-center">
        <h3 className="font-semibold text-text-primary truncate">{application.title || application.jobTitle}</h3>
        <p className="text-xs text-text-secondary truncate">{application.company}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 max-h-[300px] overflow-y-auto pr-1">
        {STATUS_OPTIONS.map((status) => {
          const isSelected = selectedStatus === status.id;
          const Icon = status.icon;

          return (
            <button
              key={status.id}
              type="button"
              onClick={() => setSelectedStatus(status.id)}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-left ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-surface hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`p-1.5 rounded-lg ${status.bgColor} flex-shrink-0`}>
                  <Icon size={15} className={status.color} />
                </div>
                <span className={`text-xs font-semibold truncate ${isSelected ? 'text-primary' : 'text-text-primary'}`}>
                  {status.label}
                </span>
              </div>
              {isSelected && <Check size={14} className="text-primary flex-shrink-0 ml-1" />}
            </button>
          );
        })}
      </div>

      <div className="mb-5">
        <label className="block text-[11px] font-semibold text-text-muted mb-1">Optional Note / Update Details</label>
        <input
          type="text"
          placeholder="e.g. Received email response from client, interview booked"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full bg-surface-hover border border-border rounded-xl p-2.5 text-xs text-text-primary focus:outline-none focus:border-primary"
        />
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" fullWidth onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" fullWidth onClick={handleUpdate}>
          Save Stage Update
        </Button>
      </div>
    </Modal>
  );
};

export default StatusUpdateModal;
