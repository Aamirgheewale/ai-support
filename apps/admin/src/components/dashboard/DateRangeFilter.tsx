import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

// Helper functions (no date-fns dependency)
const subDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
};

const format = (date: Date, formatStr: string): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    if (formatStr === 'MMM d') return `${month} ${day}`;
    if (formatStr === 'MMM d, yyyy') return `${month} ${day}, ${year}`;
    return date.toLocaleDateString();
};

const startOfToday = (): Date => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
};

const startOfYesterday = (): Date => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    date.setHours(0, 0, 0, 0);
    return date;
};

interface DateRangeFilterProps {
    onFilterChange: (range: { start: Date; end: Date; label: string }) => void;
}

type PresetOption = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';

export default function DateRangeFilter({ onFilterChange }: DateRangeFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [customModalOpen, setCustomModalOpen] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<PresetOption>('last7');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [currentLabel, setCurrentLabel] = useState('Last 7 Days');
    
    const dropdownRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // Initialize with default (last 7 days) - only on mount
    useEffect(() => {
        const end = new Date();
        const start = subDays(end, 7);
        onFilterChange({ start, end, label: 'Last 7 Days' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only on mount

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
            if (modalRef.current && !modalRef.current.contains(event.target as Node) && customModalOpen) {
                // Don't close modal on outside click - user must click Cancel or Apply
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [customModalOpen]);

    const applyPreset = (preset: PresetOption) => {
        let start: Date;
        let end: Date = new Date();
        let label: string;

        switch (preset) {
            case 'today':
                start = startOfToday();
                end = new Date();
                label = 'Today';
                break;
            case 'yesterday':
                start = startOfYesterday();
                end = new Date(startOfYesterday().getTime() + 24 * 60 * 60 * 1000 - 1);
                label = 'Yesterday';
                break;
            case 'last7':
                start = subDays(end, 7);
                label = 'Last 7 Days';
                break;
            case 'last30':
                start = subDays(end, 30);
                label = 'Last 30 Days';
                break;
            case 'custom':
                setCustomModalOpen(true);
                setIsOpen(false);
                return;
            default:
                start = subDays(end, 7);
                label = 'Last 7 Days';
        }

        setSelectedPreset(preset);
        setCurrentLabel(label);
        setIsOpen(false);
        onFilterChange({ start, end, label });
    };

    const applyCustomRange = () => {
        if (!customStart || !customEnd) {
            alert('Please select both start and end dates');
            return;
        }

        const start = new Date(customStart);
        const end = new Date(customEnd);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (start > end) {
            alert('Start date must be before end date');
            return;
        }

        const label = `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
        setSelectedPreset('custom');
        setCurrentLabel(label);
        setCustomModalOpen(false);
        onFilterChange({ start, end, label });
    };

    const resetToDefault = () => {
        const end = new Date();
        const start = subDays(end, 7);
        setSelectedPreset('last7');
        setCurrentLabel('Last 7 Days');
        setCustomStart('');
        setCustomEnd('');
        onFilterChange({ start, end, label: 'Last 7 Days' });
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Main Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">{currentLabel}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    <button
                        onClick={() => applyPreset('today')}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            selectedPreset === 'today' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'
                        }`}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => applyPreset('yesterday')}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            selectedPreset === 'yesterday' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'
                        }`}
                    >
                        Yesterday
                    </button>
                    <button
                        onClick={() => applyPreset('last7')}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            selectedPreset === 'last7' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'
                        }`}
                    >
                        Last 7 Days
                    </button>
                    <button
                        onClick={() => applyPreset('last30')}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            selectedPreset === 'last30' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'
                        }`}
                    >
                        Last 30 Days
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-700" />
                    <button
                        onClick={() => applyPreset('custom')}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            selectedPreset === 'custom' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'
                        }`}
                    >
                        Custom Range
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-700" />
                    <button
                        onClick={resetToDefault}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Reset
                    </button>
                </div>
            )}

            {/* Custom Range Modal */}
            {customModalOpen && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div
                        ref={modalRef}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 border border-gray-200 dark:border-gray-700"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Custom Date Range</h3>
                                <button
                                    onClick={() => setCustomModalOpen(false)}
                                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    From
                                </label>
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    To
                                </label>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setCustomModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={applyCustomRange}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 rounded-lg transition-colors"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
