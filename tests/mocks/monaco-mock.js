// Mock Monaco Editor for testing SQL query interface
export const mockMonacoEditor = {
  create: jest.fn(() => ({
    getValue: jest.fn(() => 'SELECT * FROM despesas LIMIT 10'),
    setValue: jest.fn(),
    getModel: jest.fn(() => ({
      onDidChangeContent: jest.fn(),
      getLanguageId: jest.fn(() => 'sql')
    })),
    addCommand: jest.fn(),
    dispose: jest.fn(),
    focus: jest.fn(),
    layout: jest.fn(),
    onDidChangeModelContent: jest.fn(),
    updateOptions: jest.fn(),
    setTheme: jest.fn()
  })),
  
  setTheme: jest.fn(),
  defineTheme: jest.fn(),
  
  KeyMod: {
    CtrlCmd: 1,
    Shift: 2,
    Alt: 4,
    WinCtrl: 8
  },
  
  KeyCode: {
    Enter: 13,
    Escape: 27,
    F1: 112
  }
};

export const mockRequire = {
  config: jest.fn(),
  define: jest.fn()
};

// Mock the Monaco loader
global.require = jest.fn((deps, callback) => {
  if (deps.includes('vs/editor/editor.main')) {
    callback();
  }
});

// Mock Monaco as global
global.monaco = {
  editor: mockMonacoEditor
};

export default mockMonacoEditor;