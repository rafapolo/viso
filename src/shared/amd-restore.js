// Restore AMD define after D3 loads
if (typeof window !== 'undefined' && typeof window.originalDefine !== 'undefined') {
    window.define = window.originalDefine;
}