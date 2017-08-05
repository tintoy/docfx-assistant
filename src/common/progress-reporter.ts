/*
 * Abstractions for progress reporting so underlying components do not directly depend on VS Code
 */

import * as vscode from 'vscode';

/**
 * A dummy ProgressReporter that discards progress messages.
 */
export const dummyProgressReporter: ProgressReporter<string> = {
    report: function(message: string) {}
};

/**
 * A mechanism for reporting progress.
 */
export interface ProgressReporter<T> {
    /**
     * Report progress.
     * 
     * @param progress The progress value.
     */
    report(progress: T): void;
}

/**
 * Wrap the specified vscode.Progress in a new ProgressReporter.
 * 
 * @template T The type of progress value to report.
 * @param progress The vscode.Progress to wrap.
 * 
 * @returns {ProgressReporter<T>} The ProgressReporter.
 */
export function createProgressReporter<T>(progress: vscode.Progress<T>): ProgressReporter<T> {
    return {
        report: function(value: T) {
            progress.report(value)
        }
    };
}

/**
 * Wrap the specified message-based vscode.Progress in a new ProgressReporter.
 * 
 * @param progress The vscode.Progress to wrap.
 * 
 * @returns {ProgressReporter<string>} The ProgressReporter.
 */
export function createMessageProgressReporter(progress: vscode.Progress<{ message: string }>): ProgressReporter<string> {
    return {
        report: function(value: string) {
            progress.report({
                message: value
            });
        }
    };
}
