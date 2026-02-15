import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { useTheme } from '../context/ThemeContext';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  minHeight?: string;
  placeholder?: string;
  className?: string;
}

export function JsonEditor({
  value,
  onChange,
  minHeight = '150px',
  placeholder,
  className = '',
}: JsonEditorProps) {
  const { theme } = useTheme();

  return (
    <div className={`json-editor-wrapper ${className}`}>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[json()]}
        theme={theme === 'dark' ? 'dark' : 'light'}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          highlightActiveLine: true,
          indentOnInput: true,
        }}
        style={{ minHeight }}
      />
    </div>
  );
}
