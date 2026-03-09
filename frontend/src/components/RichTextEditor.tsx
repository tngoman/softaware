import React, { useRef, useCallback, useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onImagePaste?: (files: File[]) => void;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write something…',
  disabled = false,
  onImagePaste,
}) => {
  const quillRef = useRef<ReactQuill>(null);

  const handleChange = useCallback(
    (content: string) => {
      // ReactQuill returns <p><br></p> for empty content
      const isEmpty = content === '<p><br></p>' || content === '<p></p>';
      onChange(isEmpty ? '' : content);
    },
    [onChange]
  );

  const modules = useMemo(
    () => ({
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'code-block'],
        ['link', 'image'],
        ['clean'],
      ],
      clipboard: { matchVisual: false },
    }),
    []
  );

  const formats = useMemo(
    () => [
      'bold',
      'italic',
      'underline',
      'strike',
      'list',
      'bullet',
      'blockquote',
      'code-block',
      'link',
      'image',
    ],
    []
  );

  return (
    <div
      className="rich-text-editor"
      onPaste={(e) => {
        if (!onImagePaste) return;
        const items = Array.from(e.clipboardData?.items || []);
        const imageFiles = items
          .filter((item) => item.type?.startsWith('image/'))
          .map((item) => item.getAsFile())
          .filter(Boolean) as File[];
        if (imageFiles.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          onImagePaste(imageFiles);
        }
      }}
    >
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={disabled}
      />
      <style>{`
        .rich-text-editor .ql-container {
          min-height: 120px;
          font-size: 14px;
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
        }
        .rich-text-editor .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          background: #f9fafb;
        }
        .rich-text-editor .ql-editor {
          min-height: 100px;
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: normal;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
