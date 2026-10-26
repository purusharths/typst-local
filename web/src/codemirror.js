// Single bundle so every module shares one @codemirror/state instance.
export { EditorView, basicSetup } from "codemirror";
export { EditorState, Compartment } from "@codemirror/state";
export { keymap } from "@codemirror/view";
export { indentWithTab } from "@codemirror/commands";
export { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
export { tags } from "@lezer/highlight";
export { oneDark } from "@codemirror/theme-one-dark";
