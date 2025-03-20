import { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { githubLight } from '@uiw/codemirror-theme-github';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { Play, Copy, Check, X, Maximize2, Minimize2, Sun, Moon, RefreshCw } from 'lucide-react';
import OpenAI from 'openai';

interface CodeEditorProps {
  initialCode?: string;
  language?: string;
  readOnly?: boolean;
  onRun?: (code: string) => void;
  onClose?: () => void;
  context?: string; // Tutorial context for code generation
}

const languageMap: { [key: string]: any } = {
  javascript,
  python,
  html,
  css,
  sql,
};

const themes = {
  light: githubLight,
  dark: vscodeDark,
  oneDark: oneDark,
};

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

const CodeEditor: React.FC<CodeEditorProps> = ({
  initialCode = '',
  language = 'javascript',
  readOnly = false,
  onRun,
  onClose,
  context = ''
}) => {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'oneDark'>('oneDark');
  const [isGenerating, setIsGenerating] = useState(false);
  const [fontSize, setFontSize] = useState(14);

  useEffect(() => {
    // Sync theme with system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const runCode = () => {
    if (onRun) {
      onRun(code);
      return;
    }

    setIsRunning(true);
    try {
      // Create a safe evaluation environment
      const consoleOutput: string[] = [];
      const safeConsole = {
        log: (...args: any[]) => consoleOutput.push(args.join(' ')),
        error: (...args: any[]) => consoleOutput.push(`Error: ${args.join(' ')}`),
        warn: (...args: any[]) => consoleOutput.push(`Warning: ${args.join(' ')}`)
      };

      // Create a safe context for evaluation
      const context = {
        console: safeConsole,
        setTimeout: () => {},
        setInterval: () => {},
        fetch: () => {},
        XMLHttpRequest: () => {},
        WebSocket: () => {}
      };

      // Execute the code in the safe context
      const fn = new Function('context', `with(context){${code}}`);
      fn(context);

      setOutput(consoleOutput.join('\n'));
    } catch (error) {
      if (error instanceof Error) {
        setOutput(`Error: ${error.message}`);
      } else {
        setOutput('An unknown error occurred');
      }
    }
    setIsRunning(false);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const toggleTheme = () => {
    const themes: ('light' | 'dark' | 'oneDark')[] = ['light', 'dark', 'oneDark'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const generateCode = async () => {
    if (!context) return;
    
    setIsGenerating(true);
    try {
      const prompt = `
        Generate a code example in ${language} based on this context:
        ${context}
        
        Requirements:
        - Code should be practical and demonstrate the concept
        - Include helpful comments explaining key parts
        - Keep it under 50 lines
        - Ensure it's runnable in a browser environment
        - Focus on clarity and best practices
      `;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an expert programmer helping generate clear, practical code examples.' },
          { role: 'user', content: prompt }
        ]
      });

      const generatedCode = completion.choices[0].message?.content;
      if (generatedCode) {
        setCode(generatedCode.trim());
      }
    } catch (error) {
      console.error('Error generating code:', error);
      setOutput('Failed to generate code example. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const adjustFontSize = (delta: number) => {
    setFontSize(prev => Math.max(10, Math.min(24, prev + delta)));
  };

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden ${
      isFullscreen ? 'fixed inset-0 z-50' : ''
    }`}>
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <span className="text-gray-400 text-sm capitalize">{language}</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => adjustFontSize(-2)}
              className="p-1 text-gray-400 hover:text-white rounded"
              title="Decrease font size"
            >
              A-
            </button>
            <span className="text-gray-400 text-sm">{fontSize}px</span>
            <button
              onClick={() => adjustFontSize(2)}
              className="p-1 text-gray-400 hover:text-white rounded"
              title="Increase font size"
            >
              A+
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {context && (
            <button
              onClick={generateCode}
              disabled={isGenerating}
              className={`p-1.5 text-gray-400 hover:text-white rounded transition-colors ${
                isGenerating ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Generate code example"
            >
              <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
            title="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
            title="Copy code"
          >
            {isCopied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          {!readOnly && (
            <button
              onClick={runCode}
              disabled={isRunning}
              className={`p-1.5 text-gray-400 hover:text-white rounded transition-colors ${
                isRunning ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Run code"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
              title="Close editor"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <CodeMirror
        value={code}
        height={isFullscreen ? "calc(100vh - 120px)" : "300px"}
        theme={themes[theme]}
        extensions={[languageMap[language]()]}
        onChange={(value) => setCode(value)}
        readOnly={readOnly}
        style={{ fontSize: `${fontSize}px` }}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          history: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true
        }}
      />

      {!readOnly && output && (
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Output:</h3>
          <pre className="text-sm text-white whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;