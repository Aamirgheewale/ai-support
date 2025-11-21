import React, { useState } from 'react';

interface FeedbackWidgetProps {
  onClose: () => void;
  onSubmit: (mark: 'up' | 'down' | 'flag', note?: string) => void;
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ onClose, onSubmit }) => {
  const [mark, setMark] = useState<'up' | 'down' | 'flag' | null>(null);
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    if (mark) {
      onSubmit(mark, note || undefined);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Feedback</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mark</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setMark('up')}
                  className={`flex-1 px-4 py-2 rounded ${mark === 'up' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  👍 Helpful
                </button>
                <button
                  onClick={() => setMark('down')}
                  className={`flex-1 px-4 py-2 rounded ${mark === 'down' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  👎 Unhelpful
                </button>
                <button
                  onClick={() => setMark('flag')}
                  className={`flex-1 px-4 py-2 rounded ${mark === 'flag' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  🚩 Flag
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Add a note..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!mark}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackWidget;

