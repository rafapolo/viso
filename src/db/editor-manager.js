// Monaco Editor Management
import { ErrorHandler } from '../shared/error-handler.js';

export class EditorManager {
  constructor() {
    this.editor = null;
    this.isInitialized = false;
  }

  /**
   * Initialize Monaco Editor
   * @returns {Promise<void>}
   */
  async initializeEditor() {
    return new Promise((resolve) => {
      const editorContainer = document.getElementById('editor');
      if (!editorContainer) {
        console.warn('Editor container not found');
        resolve();
        return;
      }

      try {
        const isDark = document.documentElement.classList.contains('dark');
        this.editor = window.monaco.editor.create(editorContainer, {
          value: 'SELECT * FROM despesas LIMIT 10;',
          language: 'sql',
          theme: isDark ? 'vs-dark' : 'vs',
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false
        });

        // Add keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        this.isInitialized = true;
        console.log('✅ Monaco Editor initialized');
        resolve();
      } catch (error) {
        ErrorHandler.handleError(error, 'Editor Initialization');
        resolve();
      }
    });
  }

  /**
   * Setup keyboard shortcuts for the editor
   */
  setupKeyboardShortcuts() {
    if (!this.editor || !window.monaco) return;

    // Ctrl+Enter / Cmd+Enter to execute query
    this.editor.addCommand(
      window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Enter,
      () => {
        const event = new CustomEvent('executeQuery');
        document.dispatchEvent(event);
      }
    );
  }

  /**
   * Get current editor content
   * @returns {string} SQL content
   */
  getValue() {
    return this.editor ? this.editor.getValue().trim() : '';
  }

  /**
   * Set editor content
   * @param {string} value - SQL content to set
   */
  setValue(value) {
    if (this.editor) {
      this.editor.setValue(value);
    }
  }

  /**
   * Clear editor content
   */
  clear() {
    if (this.editor) {
      this.editor.setValue('');
    }
  }

  /**
   * Update editor theme
   * @param {string} theme - Theme name ('vs' or 'vs-dark')
   */
  updateTheme(theme) {
    if (this.editor) {
      this.editor.updateOptions({ theme });
    }
  }

  /**
   * Format SQL in the editor
   */
  formatSQL() {
    if (!this.editor) return;

    const currentValue = this.getValue();
    if (!currentValue) return;

    try {
      const formattedSQL = this.formatSQLString(currentValue);
      if (formattedSQL !== currentValue) {
        this.setValue(formattedSQL);
      }
    } catch (error) {
      ErrorHandler.handleError(error, 'SQL Formatting');
    }
  }

  /**
   * Format SQL string using available formatter
   * @param {string} sql - SQL to format
   * @returns {string} Formatted SQL
   */
  formatSQLString(sql) {
    if (!sql || typeof sql !== 'string') return sql;

    try {
      if (typeof window.sqlFormatter !== 'undefined' && window.sqlFormatter.format) {
        return window.sqlFormatter.format(sql.trim(), {
          language: 'sql',
          indent: '    ', // 4 spaces
          uppercase: true,
          linesBetweenQueries: 2
        });
      } else {
        console.warn('SQL formatter not available, returning unformatted SQL');
        return sql.trim();
      }
    } catch (error) {
      console.warn('SQL formatting error:', error);
      return sql.trim();
    }
  }

  /**
   * Get editor instance (for advanced operations)
   * @returns {Object|null} Monaco editor instance
   */
  getEditor() {
    return this.editor;
  }

  /**
   * Check if editor is ready
   * @returns {boolean} Whether editor is initialized
   */
  isReady() {
    return this.isInitialized && this.editor !== null;
  }

  /**
   * Dispose of the editor
   */
  dispose() {
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
      this.isInitialized = false;
    }
  }

  /**
   * Focus the editor
   */
  focus() {
    if (this.editor) {
      this.editor.focus();
    }
  }

  /**
   * Get cursor position
   * @returns {Object} Cursor position
   */
  getCursorPosition() {
    if (this.editor) {
      return this.editor.getPosition();
    }
    return null;
  }

  /**
   * Set cursor position
   * @param {number} lineNumber - Line number
   * @param {number} column - Column number
   */
  setCursorPosition(lineNumber, column) {
    if (this.editor) {
      this.editor.setPosition({ lineNumber, column });
    }
  }

  /**
   * Get selected text
   * @returns {string} Selected text
   */
  getSelectedText() {
    if (this.editor) {
      const selection = this.editor.getSelection();
      return this.editor.getModel().getValueInRange(selection);
    }
    return '';
  }

  /**
   * Insert text at current cursor position
   * @param {string} text - Text to insert
   */
  insertText(text) {
    if (this.editor) {
      const position = this.editor.getPosition();
      this.editor.executeEdits('', [{
        range: new window.monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        text
      }]);
    }
  }

  /**
   * Add event listener for editor events
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   */
  addEventListener(event, handler) {
    if (this.editor && typeof handler === 'function') {
      switch (event) {
        case 'change':
          this.editor.onDidChangeModelContent(handler);
          break;
        case 'cursorChange':
          this.editor.onDidChangeCursorPosition(handler);
          break;
        case 'focus':
          this.editor.onDidFocusEditorText(handler);
          break;
        case 'blur':
          this.editor.onDidBlurEditorText(handler);
          break;
      }
    }
  }
}