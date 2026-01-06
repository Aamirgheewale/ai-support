import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: string;
}

export default function RichTextEditor({
    value,
    onChange,
    placeholder = 'Enter your response here...',
    minHeight = 'min-h-[150px]'
}: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder,
            }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: `prose prose-sm max-w-none focus:outline-none ${minHeight} p-3 border border-gray-300 rounded-b-md`,
            },
        },
    });

    if (!editor) {
        return null;
    }

    return (
        <div className="border border-gray-300 rounded-md overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-300">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    className={`px-3 py-1.5 text-sm font-semibold rounded transition-colors ${editor.isActive('bold')
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        } disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300`}
                    title="Bold (Ctrl+B)"
                >
                    B
                </button>

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    className={`px-3 py-1.5 text-sm italic font-medium rounded transition-colors ${editor.isActive('italic')
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        } disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300`}
                    title="Italic (Ctrl+I)"
                >
                    I
                </button>

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    disabled={!editor.can().chain().focus().toggleStrike().run()}
                    className={`px-3 py-1.5 text-sm line-through font-medium rounded transition-colors ${editor.isActive('strike')
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        } disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300`}
                    title="Strikethrough"
                >
                    S
                </button>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${editor.isActive('bulletList')
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        } border border-gray-300`}
                    title="Bullet List"
                >
                    • List
                </button>

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${editor.isActive('orderedList')
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        } border border-gray-300`}
                    title="Numbered List"
                >
                    1. List
                </button>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`px-3 py-1.5 text-sm font-bold rounded transition-colors ${editor.isActive('heading', { level: 2 })
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        } border border-gray-300`}
                    title="Heading"
                >
                    H2
                </button>

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${editor.isActive('blockquote')
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        } border border-gray-300`}
                    title="Quote"
                >
                    " Quote
                </button>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                <button
                    type="button"
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    className="px-3 py-1.5 text-sm font-medium rounded transition-colors bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                    title="Horizontal Line"
                >
                    ―
                </button>

                <button
                    type="button"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().chain().focus().undo().run()}
                    className="px-3 py-1.5 text-sm font-medium rounded transition-colors bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300"
                    title="Undo (Ctrl+Z)"
                >
                    ↶
                </button>

                <button
                    type="button"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().chain().focus().redo().run()}
                    className="px-3 py-1.5 text-sm font-medium rounded transition-colors bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300"
                    title="Redo (Ctrl+Y)"
                >
                    ↷
                </button>
            </div>

            {/* Editor Content */}
            <EditorContent editor={editor} />
        </div>
    );
}
