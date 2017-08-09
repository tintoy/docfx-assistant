import * as vscode from 'vscode';

/**
 * Get the UID-compatible text at the current position.
 * 
 * @param textEditor The target text editor.
 */
export function getUIDAtCursor(textEditor?: vscode.TextEditor): string | null {
    textEditor = textEditor || vscode.window.activeTextEditor;
    if (!textEditor)
        return null;
    
    return getUIDAtPosition(textEditor.document, textEditor.selection.active);
}

/**
 * Get the UID-compatible text at the specified position.
 * 
 * @param document The target document.
 * @param position The position within the text editor.
 */
export function getUIDAtPosition(document: vscode.TextDocument, position: vscode.Position): string | null {
    const wordRange = document.getWordRangeAtPosition(
        position,
        /[A-Za-z0-9_\(\)\.#]+/
    );
    if (wordRange.isEmpty)
        return null;

    return document.getText(wordRange);
}

/**
 * Get the UID-compatible text range at the specified position.
 * 
 * @param document The target document.
 * @param position The position within the text editor.
 */
export function getUIDRangeAtPosition(document: vscode.TextDocument, position: vscode.Position): vscode.Range {
    return document.getWordRangeAtPosition(
        position,
        /[A-Za-z0-9_\(\)\.#]+/
    );
}
