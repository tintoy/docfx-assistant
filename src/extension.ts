'use strict';

import * as path from 'path';
import * as vscode from 'vscode';

import { TopicMetadata } from './docfx/docfx';
import { MetadataCache } from './metadata-cache';

// Extension state.
let disableAutoScan: boolean;
let currentWorkspaceRootPath: string;
const topicMetadataCache = new MetadataCache();

/**
 * Called when the extension is activated.
 * 
 * @param context The extension context.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    configure(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('docfx.refreshTopicUIDs', handleRefreshTopicUIDs)
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('docfx.insertTopicUID', handleInsertTopicUID)
    );

    // Attempt to pre-populate the cache, but don't kick up a stink if the workspace does not contain a valid project file.
    if (!disableAutoScan) {
        await checkCache(true);
    }
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
    topicMetadataCache.flush();
}

/**
 * Handle the docfx.refreshTopicUIDs command.
 */
async function handleRefreshTopicUIDs(): Promise<void> {
    topicMetadataCache.flush();

    await topicMetadataCache.ensurePopulated();
}

/**
 * Handle the docfx.insertTopicUID command.
 */
async function handleInsertTopicUID(): Promise<void> {
    if (!isSupportedLanguage())
        return;

    if (!await checkCache())
        return;

    const topicQuickPickItems: vscode.QuickPickItem[] = await topicMetadataCache.getUIDQuickPickItems();
    if (!topicQuickPickItems)
        return;

    const selectedItem = await vscode.window.showQuickPick(topicQuickPickItems, { placeHolder: 'Choose a topic UID'});
    if (!selectedItem)
        return;
    
    await vscode.window.activeTextEditor.edit(edit => {
        edit.replace(
            vscode.window.activeTextEditor.selection.active,
            selectedItem.label
        );
    });
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
        topicMetadataCache.flush();

        currentWorkspaceRootPath = vscode.workspace.rootPath;
    }

    return await topicMetadataCache.ensurePopulated(ignoreMissingProjectFile);
}
