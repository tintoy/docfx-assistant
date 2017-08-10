import * as fs from 'mz/fs';
import * as Rx from 'rxjs';
import * as vscode from 'vscode';

import { StateKeys } from '../constants';
import { MetadataCacheError } from '../metadata-cache';

/**
 * Find the first DocFX project file (if any) in the current workspace.
 * 
 * @param progress An Observable<string> used to report progress.
 * @param ignoreMissingProjectFile When true, then no alert will be displayed if no DocFX project file is found in the current workspace.
 */
export async function getDocFXProjectFile(workspaceState: vscode.Memento, progress: Rx.Observer<string>, ignoreMissingProjectFile: boolean): Promise<string | null> {
    try {
        progress.next('Scanning workspace for DocFX project file(s)...');

        const cachedProjectFile = workspaceState.get<string>(StateKeys.projectFile);
        if (cachedProjectFile && await fs.exists(cachedProjectFile)) {
            progress.next(`Found cached project file "${cachedProjectFile}".`);

            return cachedProjectFile;
        }
        
        const files = await vscode.workspace.findFiles('**/docfx.json', '.git/**,**/node_modules/**', 1);
        if (!files.length) {
            if (!ignoreMissingProjectFile) {
                progress.error(
                    MetadataCacheError.warning('Cannot find docfx.json in the current workspace.')
                );
            } else {
                progress.next('No DocFX project files found in current workspace.');
            }

            return null;
        }

        progress.next('Caching DocFX project file...');

        const projectFile = files[0].fsPath;
        await this.workspaceState.update(StateKeys.projectFile, projectFile);

        progress.next('DocFX project file cached.');

        return projectFile;
    } catch (scanError) {
        console.log(scanError);

        progress.error(scanError);

        return null;
    }
}
