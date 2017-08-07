'use strict';

import * as fs from 'mz/fs';
import * as path from 'path';
import * as Rx from 'rxjs';
import * as vscode from 'vscode';

import { TopicMetadata, TopicType } from './docfx/docfx';
import { MetadataCache } from './metadata-cache';
import { TopicChange, TopicChangeType, observeTopicChanges } from './change-adapter';
import { UIDCompletionProvider } from './completion-provider';

// Extension state.
let disableAutoScan: boolean;
let currentWorkspaceRootPath: string;
let topicMetadataCache: MetadataCache;

/**
 * Called when the extension is activated.
 * 
 * @param context The extension context.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    configure(context);
    
    topicMetadataCache = new MetadataCache(context.workspaceState);

    context.subscriptions.push(
        vscode.commands.registerCommand('docfx.refreshTopicUIDs', handleRefreshTopicUIDs)
    );
    
    // Attempt to pre-populate the cache, but don't kick up a stink if the workspace does not contain a valid project file.
    if (!disableAutoScan) {
        await checkCache(true);
    }

    const topicChanges = await observeTopicChanges(context);
    
    const cacheSubscription = topicChanges.subscribe(topicMetadataCache.topicChanges);
    context.subscriptions.push(
        new vscode.Disposable(
            () => cacheSubscription.unsubscribe()
        )
    );

    const languageSelectors = [ 'markdown', 'yaml' ];
    const completionProvider = new UIDCompletionProvider(topicMetadataCache);
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(languageSelectors, completionProvider, '@')
    );
}

/**
 * Called when the extension is deactivated.
 */
export async function deactivate(): Promise<void> {
    await topicMetadataCache.flush();
    topicMetadataCache = null;
}

/**
 * Handle the docfx.refreshTopicUIDs command.
 */
async function handleRefreshTopicUIDs(): Promise<void> {
    await topicMetadataCache.flush();

    await topicMetadataCache.ensurePopulated();
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
 * Check if the cache needs to be invalidated (because the workspace's root path has changed).
 */
async function checkCache(ignoreMissingProjectFile?: boolean): Promise<boolean> {
    if (vscode.workspace.rootPath !== currentWorkspaceRootPath) {
        await topicMetadataCache.flush();

        currentWorkspaceRootPath = vscode.workspace.rootPath;
    }

    return await topicMetadataCache.ensurePopulated(ignoreMissingProjectFile);
}
