'use strict';

import { TopicMetadata, TopicType } from 'docfx-project';
import * as fs from 'mz/fs';
import * as path from 'path';
import * as Rx from 'rxjs';
import * as vscode from 'vscode';

import { MetadataCache } from './metadata-cache';
import { TopicChange, TopicChangeType, observeTopicChanges } from './change-adapter';
import { UIDCompletionProvider } from './providers/uid-completion';
import { UIDLinkProvider } from './providers/uid-link';

// Extension state.
let disableAutoScan: boolean;
let outputChannel: vscode.OutputChannel;
let topicMetadataCache: MetadataCache;

/**
 * Called when the extension is activated.
 * 
 * @param context The extension context.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel = vscode.window.createOutputChannel('DocFX Assistant');
    context.subscriptions.push(outputChannel);

    configure(context);
    
    topicMetadataCache = new MetadataCache(context.workspaceState);

    context.subscriptions.push(
        vscode.commands.registerCommand('docfx.refreshTopicUIDs', handleRefreshTopicUIDs)
    );
    
    // Attempt to pre-populate the cache, but don't kick up a stink if the workspace does not contain a valid project file.
    if (!disableAutoScan) {
        outputChannel.append('Populating topic cache...\n');
        await topicMetadataCache.ensurePopulated(true);
        outputChannel.append(
            `Topic cache now contains ${topicMetadataCache.topicCount} topics from "${topicMetadataCache.projectFile}".\n`
        );
    }

    outputChannel.append('Observing workspace changes...\n');
    const topicChanges = await observeTopicChanges(context);
    
    const cacheSubscription = topicChanges.subscribe(topicMetadataCache.topicChanges);
    context.subscriptions.push(
        new vscode.Disposable(
            () => cacheSubscription.unsubscribe()
        )
    );

    outputChannel.append('Workspace change observer configured.\n');

    outputChannel.append('Initialising completion provider...\n');

    const languageSelectors = [ 'markdown', 'yaml' ];
    const completionProvider = new UIDCompletionProvider(topicMetadataCache);
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(languageSelectors, completionProvider, '@')
    );

    outputChannel.append('Completion provider initialised.\n');

    context.subscriptions.push(
        vscode.languages.registerDocumentLinkProvider('markdown',
            new UIDLinkProvider(topicMetadataCache)
        )
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
    outputChannel.clear();
    outputChannel.append('Flushing the topic cache...\n');
    
    await topicMetadataCache.flush(true);
    
    outputChannel.append('Topic cache flushed.\n');

    outputChannel.append('Flushing the topic cache.\n');
    
    await topicMetadataCache.ensurePopulated();
    
    outputChannel.append(
        `Topic cache now contains ${topicMetadataCache.topicCount} topics from "${topicMetadataCache.projectFile}".\n`
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
