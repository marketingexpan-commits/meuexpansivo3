import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { ListItem } from '@tiptap/extension-list-item';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { TextAlign } from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Bold as BoldIcon, Italic as ItalicIcon, List as ListIcon, ListOrdered as ListOrderedIcon, Undo as UndoIcon, Redo as RedoIcon, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) return null;

    return (
        <div className="flex items-center flex-nowrap gap-0.5 p-1 bg-gray-50 border-b border-gray-200 sticky top-0 z-10 rounded-t-xl overflow-x-auto no-scrollbar">
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('bold') ? 'bg-gray-200 text-blue-900' : 'text-gray-600'}`}
                title="Negrito"
            >
                <BoldIcon className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('italic') ? 'bg-gray-200 text-blue-900' : 'text-gray-600'}`}
                title="Itálico"
            >
                <ItalicIcon className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('underline') ? 'bg-gray-200 text-blue-900' : 'text-gray-600'}`}
                title="Sublinhado"
            >
                <span className="font-bold underline text-[10px] px-0.5">U</span>
            </button>

            <div className="w-px h-4 bg-gray-200 mx-0.5"></div>

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('bulletList') ? 'bg-gray-200 text-blue-900' : 'text-gray-600'}`}
                title="Lista com marcadores"
            >
                <ListIcon className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('orderedList') ? 'bg-gray-200 text-blue-900' : 'text-gray-600'}`}
                title="Lista numerada"
            >
                <ListOrderedIcon className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-gray-200 mx-0.5"></div>

            <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200 text-blue-900' : 'text-gray-600'}`}
                title="Alinhar à esquerda"
            >
                <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200 text-blue-900' : 'text-gray-600'}`}
                title="Centralizar"
            >
                <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200 text-blue-900' : 'text-gray-600'}`}
                title="Alinhar à direita"
            >
                <AlignRight className="w-3.5 h-3.5" />
            </button>

            <div className="flex-1"></div>

            <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                className="p-1 rounded hover:bg-gray-200 text-gray-400"
                title="Desfazer"
            >
                <UndoIcon className="w-3.5 h-3.5" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                className="p-1 rounded hover:bg-gray-200 text-gray-400"
                title="Refazer"
            >
                <RedoIcon className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, placeholder }) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextStyle,
            Color,
            ListItem,
            BulletList.configure({
                HTMLAttributes: { class: 'list-disc ml-4' },
            }),
            OrderedList.configure({
                HTMLAttributes: { class: 'list-decimal ml-4' },
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Placeholder.configure({
                placeholder: placeholder || 'Digite a descrição aqui...',
                emptyEditorClass: 'is-editor-empty',
            }),
            Link.configure({ openOnClick: false }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[150px] p-4 cursor-text h-full',
            },
        },
    });

    React.useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    return (
        <div 
            className="border border-gray-200 rounded-xl overflow-hidden focus-within:border-blue-900 focus-within:ring-1 focus-within:ring-blue-900 transition-all bg-white flex flex-col"
            onClick={() => editor?.chain().focus().run()}
        >
            <MenuBar editor={editor} />
            <div className="flex-1 min-h-[150px]">
                <EditorContent editor={editor} className="h-full" />
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .is-editor-empty:before {
                    content: attr(data-placeholder);
                    float: left;
                    color: #adb5bd;
                    pointer-events: none;
                    height: 0;
                }
                .ProseMirror {
                    min-height: 150px;
                    outline: none !important;
                }
                .ProseMirror p {
                    margin-top: 0.25em !important;
                    margin-bottom: 0.25em !important;
                    line-height: 1.4;
                }
                .ProseMirror ul, .ProseMirror ol {
                    margin-top: 0.25em !important;
                    margin-bottom: 0.25em !important;
                }
                .ProseMirror li p {
                    margin-top: 0 !important;
                    margin-bottom: 0 !important;
                }
            `}} />
        </div>
    );
};
