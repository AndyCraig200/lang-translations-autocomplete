import * as vscode from 'vscode';
import { initializeTranslations, resetCache } from '../services/translationService';
import { registerCompletionProvider } from '../providers/completionProvider';
import { registerLinkProvider } from '../providers/linkProvider';
import { openFileAtPosition } from '../services/fileService';

export function activate(context: vscode.ExtensionContext) {
  console.log('Activating Translation Autocomplete extension');
  vscode.window.showInformationMessage('Translation Autocomplete extension activated');
  
  // Initialize translations when the extension activates
  initializeTranslations().catch(err =>
    console.error('Failed to initialize translations:', err)
  );

  // Register command to open files at specific positions
  let disposable = vscode.commands.registerCommand(
    'lang-translation-autocomplete.openAtPosition',
    openFileAtPosition
  );
  context.subscriptions.push(disposable);

  // Register providers
  const completionProvider = registerCompletionProvider(context);
  const linkProvider = registerLinkProvider(context);
  
  context.subscriptions.push(completionProvider);
  context.subscriptions.push(linkProvider);

  // Refresh cache when en.json changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/en.json');
  watcher.onDidChange(() => resetCache());
  watcher.onDidCreate(() => resetCache());
  watcher.onDidDelete(() => resetCache());

  context.subscriptions.push(watcher);
}

export function deactivate() {}