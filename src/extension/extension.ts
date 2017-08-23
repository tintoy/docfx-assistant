'use strict';

import * as docfx from 'docfx-project';
import * as fs from 'mz/fs';
import * as path from 'path';
import * as Rx from 'rxjs';
import * as vscode from 'vscode';

import { StateKeys } from './constants';
import { UIDCompletionProvider } from './providers/uid-completion';
import { UIDLinkProvider } from './providers/uid-link';
import { runWithProgressObserver } from './utils/progress';
import { getDocFXProjectFile } from './utils/workspace';

const stateDirectory = path.join(vscode.workspace.rootPath, '.vscode', 'docfx-assistant');

// Extension state.
let disableAutoScan: boolean;
let outputChannel: vscode.OutputChannel;
let metadataCache: docfx.MetadataCache;

/**
 * Called when the extension is activated.
 * 
 * @param context The extension context.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel = vscode.window.createOutputChannel('DocFX Assistant');
    context.subscriptions.push(outputChannel);

    configure(context);

    metadataCache = new docfx.MetadataCache(stateDirectory);
    await tryOpenDocFXProject(context.workspaceState);
    
    context.subscriptions.push(
        vscode.commands.registerCommand('docfx.refreshTopicUIDs', async () => {
            await handleRefreshTopicUIDs(context.workspaceState);
        })
    );
    
    // Attempt to pre-populate the cache, but don't kick up a stink if the workspace does not contain a valid project file.
    if (metadataCache.hasOpenProject) {
        if (!disableAutoScan) {
            outputChannel.append('Populating topic cache...\n');
            
            await runWithProgressObserver(
                progress => metadataCache.ensurePopulated(progress)
            );
            
            outputChannel.append(
                `Topic cache now contains ${metadataCache.topicCount} topics from "${metadataCache.projectFile}".\n`
            );
        }
        
        outputChannel.append('Observing workspace changes...\n');
        const topicChanges = docfx.observeTopicChanges(metadataCache.projectDir);
    
        const cacheSubscription = topicChanges.subscribe(metadataCache.topicChanges);
        context.subscriptions.push(
            new vscode.Disposable(
                () => cacheSubscription.unsubscribe()
            )
        );

        outputChannel.append('Workspace change observer configured.\n');
    }

    outputChannel.append('Initialising completion provider...\n');

    const languageSelectors = [ 'markdown', 'yaml' ];
    const completionProvider = new UIDCompletionProvider(metadataCache);
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(languageSelectors, completionProvider, '@')
    );

    outputChannel.append('Completion provider initialised.\n');

    context.subscriptions.push(
        vscode.languages.registerDocumentLinkProvider('markdown',
            new UIDLinkProvider(metadataCache)
        )
    );
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
    metadataCache.closeProject();
}

/**
 * Handle the docfx.refreshTopicUIDs command.
 * 
 * @param workspaceState The workspace state store.
 */
async function handleRefreshTopicUIDs(workspaceState: vscode.Memento): Promise<void> {
    outputChannel.clear();
    outputChannel.append('Flushing the topic cache...\n');
    
    await metadataCache.flush(true);

    outputChannel.append('Topic cache flushed.\n');

    outputChannel.append('Reloading DocFX project...\n');

    await metadataCache.closeProject();
    await tryOpenDocFXProject(workspaceState);

    outputChannel.append('DocFX project reloaded.\n');
    
    outputChannel.append('Repopulating the topic cache...\n');

    await runWithProgressObserver(
        progress => metadataCache.ensurePopulated(progress)
    );
    
    outputChannel.append(
        `Topic cache now contains ${metadataCache.topicCount} topics from "${metadataCache.projectFile}".\n`
    );
}

/**
 * Configure the extension using settings from the workspace configuration, and listen for changes.
 * 
 * @param context The current extension context.
 */
function configure(context: vscode.ExtensionContext): void {
    loadConfiguration();
    
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(evt => {
            loadConfiguration();
        })
    );
}

/**
 * Load extension configuration from the workspace.
 */
function loadConfiguration(): void {
    const configuration = vscode.workspace.getConfiguration();

    disableAutoScan = configuration.get<boolean>('docfxAssistant.disableAutoScan');
}

/**
 * Determine whether the active editor (if any) is for a supported language.
 */
function isSupportedLanguage(): boolean {
    if (!vscode.window.activeTextEditor)
        return false;

    switch (vscode.window.activeTextEditor.document.languageId) {
        case 'markdown':
        case 'yaml': {
            return true;
        }
        default: {
            return false;
        }
    }
}

/**
 * Try to open the DocFX project (if any) for the current workspace.
 * 
 * @param workspaceState Persistent workspace state.
 */
async function tryOpenDocFXProject(workspaceState: vscode.Memento): Promise<void> {
    const projectFile = await runWithProgressObserver(
        progress => getDocFXProjectFile(workspaceState, progress, true)
    );
    if (projectFile) {
        await metadataCache.openProject(projectFile);
    }
}

/**
 * Reset the cached DocFX project file path in current workspace state.
 * 
 * TODO: Eliminate the need for this by making the metadata cache take the project file path as a parameter.
 * 
 * @param progress An Observable<string> used to report progress.
 * @param ignoreMissingProjectFile When true, then no alert will be displayed if no DocFX project file is found in the current workspace.
 */
async function resetDocFXProjectFile(workspaceState: vscode.Memento): Promise<void> {
    await workspaceState.update(StateKeys.projectFile, null);
}
