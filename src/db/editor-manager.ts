// Monaco Editor Management
import * as monaco from 'monaco-editor';
import { ErrorHandler } from '../shared/error-handler.js';

export class EditorManager {
  private editor: import('monaco-editor').editor.IStandaloneCodeEditor | null;
  private isInitialized: boolean;

  constructor() {
    this.editor = null;
    this.isInitialized = false;
  }

  async initializeEditor(): Promise<void> {
    return new Promise((resolve) => {
      const editorContainer = document.getElementById('editor');
      if (!editorContainer) {
        resolve();
        return;
      }

      try {
        const isDark = document.documentElement.classList.contains('dark');
        this.editor = monaco.editor.create(editorContainer, {
          value: 'SELECT * FROM despesas LIMIT 10;',
          language: 'sql',
          theme: isDark ? 'vs-dark' : 'vs',
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
        });

        this.setupKeyboardShortcuts();
        this.isInitialized = true;
        resolve();
      } catch (error) {
        ErrorHandler.handleError(error as Error, 'Editor Initialization');
        resolve();
      }
    });
  }

  setupKeyboardShortcuts(): void {
    if (!this.editor) return;

    this.editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {
        document.dispatchEvent(new CustomEvent('executeQuery'));
      }
    );
  }

  getValue(): string {
    return this.editor ? this.editor.getValue().trim() : '';
  }

  setValue(value: string): void {
    if (this.editor) {
      this.editor.setValue(value);
    }
  }

  clear(): void {
    if (this.editor) {
      this.editor.setValue('');
    }
  }

  updateTheme(theme: string): void {
    if (this.editor) {
      this.editor.updateOptions({ theme });
    }
  }

  layout(): void {
    if (this.editor) {
      this.editor.layout();
    }
  }

  formatSQL(): void {
    if (!this.editor) return;

    const currentValue = this.getValue();
    if (!currentValue) return;

    try {
      const formattedSQL = this.formatSQLString(currentValue);
      if (formattedSQL !== currentValue) {
        this.setValue(formattedSQL);
      }
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'SQL Formatting');
    }
  }

  formatSQLString(sql: string): string {
    if (!sql || typeof sql !== 'string') return sql;

    try {
      if (typeof window.sqlFormatter !== 'undefined' && window.sqlFormatter.format) {
        return window.sqlFormatter.format(sql.trim(), {
          language: 'sql',
          indent: '    ',
          uppercase: true,
          linesBetweenQueries: 2,
        });
      } else {
        return sql.trim();
      }
    } catch {
      return sql.trim();
    }
  }

  getEditor(): import('monaco-editor').editor.IStandaloneCodeEditor | null {
    return this.editor;
  }

  isReady(): boolean {
    return this.isInitialized && this.editor !== null;
  }

  dispose(): void {
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
      this.isInitialized = false;
    }
  }

  focus(): void {
    if (this.editor) {
      this.editor.focus();
    }
  }

  getCursorPosition(): import('monaco-editor').Position | null {
    return this.editor ? this.editor.getPosition() : null;
  }

  setCursorPosition(lineNumber: number, column: number): void {
    if (this.editor) {
      this.editor.setPosition({ lineNumber, column });
    }
  }

  getSelectedText(): string {
    if (this.editor) {
      const selection = this.editor.getSelection();
      if (selection) {
        return this.editor.getModel()?.getValueInRange(selection) ?? '';
      }
    }
    return '';
  }

  insertText(text: string): void {
    if (this.editor) {
      const position = this.editor.getPosition();
      if (position) {
        this.editor.executeEdits('', [{
          range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text,
        }]);
      }
    }
  }

  addEventListener(event: string, handler: (...args: unknown[]) => void): void {
    if (this.editor && typeof handler === 'function') {
      switch (event) {
        case 'change':
          this.editor.onDidChangeModelContent(handler as () => void);
          break;
        case 'cursorChange':
          this.editor.onDidChangeCursorPosition(handler as () => void);
          break;
        case 'focus':
          this.editor.onDidFocusEditorText(handler as () => void);
          break;
        case 'blur':
          this.editor.onDidBlurEditorText(handler as () => void);
          break;
      }
    }
  }
}
