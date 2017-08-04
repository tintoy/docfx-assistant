'use strict';

import * as path from 'path';
import * as vscode from 'vscode';

import { TopicMetadata } from './docfx/docfx';
import { MetadataCache } from "./metadata-cache";

const topicMetadataCache = new MetadataCache();

/**
 * Called when the extension is activated.
 * 
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext) {    
    context.subscriptions.push(
        vscode.commands.registerCommand('docfx.refreshTopicUIDs', handleRefreshTopicUIDs)
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('docfx.insertTopicUID', handleInsertTopicUID)
    );
}

/**
 * Handle the docfx.refreshTopicUIDs command.
 */
async function handleRefreshTopicUIDs() {
    topicMetadataCache.flush();

    await topicMetadataCache.ensurePopulated();
}

/**
 * Handle the docfx.insertTopicUID command.
 */
async function handleInsertTopicUID() {
    if (!isSupportedLanguage())
        return;

    const topicQuickPickItems: vscode.QuickPickItem[] = await topicMetadataCache.getUIDQuickPickItems();
    if (!topicQuickPickItems)
        return;

    const selectedItem = await vscode.window.showQuickPick(topicQuickPickItems, { placeHolder: "Choose a topic UID"});
    if (!selectedItem)
        return;
    
    await vscode.window.activeTextEditor.edit(edit => {
        edit.insert(
            vscode.window.activeTextEditor.selection.active,
            selectedItem.label
        );
    });
}

/**
 * Determine whether the active editor (if any) is for a supported language.
 */
function isSupportedLanguage(): boolean {
    if (!vscode.window.activeTextEditor)
        return false;

    switch (vscode.window.activeTextEditor.document.languageId) {
        case "markdown":
        case "yaml": {
            return true;
        }
        default: {
            return false;
        }
    }
}


/**
 * Called when the extension is deactivated.
 */
export function deactivate() {
    topicMetadataCache.flush();
}
