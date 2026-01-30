import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    children: React.ReactNode;
    maxWidth?: string;
}

export default function Modal({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = 'max-w-2xl'
}: ModalProps) {
    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="relative z-[50]" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Backdrop - Visual Only */}
            <div
                className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm transition-opacity pointer-events-none"
                aria-hidden="true"
            />

            {/* Container - Handles Centering, Scroll & Clicks */}
            <div
                className="fixed inset-0 z-10 w-screen overflow-y-auto"
                onClick={onClose}
            >
                <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">

                    {/* Content - STOPS Propagation so clicks here don't close modal/menu */}
                    <div
                        className={`relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-900 text-left shadow-xl transition-all sm:my-8 w-full ${maxWidth}`}
                        onClick={(e) => e.stopPropagation()} // <--- VITAL: Prevents click-through
                    >
                        {/* Header (optional) */}
                        {(title || onClose) && (
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
                                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {title}
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        {/* Scrollable Content */}
                        <div className="px-6 py-4">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
