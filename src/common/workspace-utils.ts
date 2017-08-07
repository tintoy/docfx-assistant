import * as fs from 'mz/fs';
import * as vscode from 'vscode';

/**
 * Get the DocFX project file (if any) for the current workspace.
 * 
 * @param context The current extension context.
 */
export async function getDocFXProjectFile(context: vscode.ExtensionContext): Promise<string> {
    const cachedProjectFile = context.workspaceState.get<string>('docfxAssistant.projectFile');
    if (cachedProjectFile && await fs.exists(cachedProjectFile)) {
        return cachedProjectFile;
    }

    const files = await vscode.workspace.findFiles('**/docfx.json', '.git/**,**/node_modules/**', 1);
    if (files.length)
        return files[0].fsPath;

    return null;
}
