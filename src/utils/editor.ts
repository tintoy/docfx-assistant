import * as vscode from 'vscode';

/**
 * Get the UID-compatible text at the current position.
 * 
 * @param textEditor The target text editor.
 * 
 * @returns The UID, or null if there is no UID-compatible text at the current position.
 */
export function getUIDAtCurrentPosition(textEditor?: vscode.TextEditor): string | null {
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
 * 
 * @returns The UID, or null if there is no UID-compatible text at the specified position.
 */
export function getUIDAtPosition(document: vscode.TextDocument, position: vscode.Position): string | null {
    const uidRange = getUIDRangeAtPosition(document, position);
    if (uidRange.isEmpty)
        return null;

    return document.getText(uidRange);
}

/**
 * Get the UID-compatible text range (if any) at the specified position.
 * 
 * @param document The target document.
 * @param position The position within the text editor.
 * 
 * @returns The text range. Will be empty if there is no UID-compatible text at the specified position.
 */
export function getUIDRangeAtPosition(document: vscode.TextDocument, position: vscode.Position): vscode.Range {
    return document.getWordRangeAtPosition(
        position,
        /[A-Za-z0-9_\(\)\.#]+/
    );
}
