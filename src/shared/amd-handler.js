// Clear AMD define to avoid conflicts with D3
if (typeof window !== 'undefined' && typeof window.define !== 'undefined') {
    window.originalDefine = window.define;
    window.define = undefined;
}