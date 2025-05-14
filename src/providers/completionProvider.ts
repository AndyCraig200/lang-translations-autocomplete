import * as vscode from 'vscode';
import { getTranslationData } from '../services/translationService';

export function registerCompletionProvider(context: vscode.ExtensionContext): vscode.Disposable {
  const provider = vscode.languages.registerCompletionItemProvider(
    ['javascript', 'typescript', 'vue', 'javascriptreact', 'typescriptreact'],
    {
      async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const lineText = document.lineAt(position).text;

        // Detect when cursor is inside quotes
        let match;

        // Check Lang.t pattern for all files
        const langTRegex = /Lang\s*\.\s*t\s*\(\s*(?:[^,)'"]*,\s*)?(['"`])([^'"]*)?$/;
        match = linePrefix.match(langTRegex);

        // If not found and this is a Vue file, check for $t pattern
        if (!match && document.uri.fsPath.endsWith('.vue')) {
          const vueRegex = /\$t\s*\(\s*(?:[^,)'"]*,\s*)?(['"`])([^'"]*)?$/;
          match = linePrefix.match(vueRegex);
        }

        if (!match) {
          return undefined;
        }

        const translationData = await getTranslationData();
        if (!translationData) {
          return undefined;
        }

        const { keys, values } = translationData;
        const currentInput = match[2] || '';

        // Filter keys based on current input
        const filteredKeys = currentInput ?
          keys.filter(key => key.toLowerCase().includes(currentInput.toLowerCase())) :
          keys;

        // Create completion items for each key
        return filteredKeys.map(key => {
          const completionItem = new vscode.CompletionItem(key, vscode.CompletionItemKind.Text);
          const value = values.get(key);

          // Fix the replacement range to replace the entire content between quotes
          const quoteChar = match[1]; // The quote character used (', ", or `)
          const startQuotePos = linePrefix.lastIndexOf(quoteChar);
          const endQuotePos = lineText.indexOf(quoteChar, position.character);

          if (startQuotePos !== -1 && endQuotePos !== -1) {
            const startPos = new vscode.Position(position.line, startQuotePos + 1); // +1 to exclude the opening quote
            const endPos = new vscode.Position(position.line, endQuotePos);
            completionItem.range = new vscode.Range(startPos, endPos);
          }

          if (value) {
            completionItem.detail = value;
            completionItem.documentation = new vscode.MarkdownString(`**${key}**: ${value}`);
          }

          return completionItem;
        });
      }
    },
    "'", '"', '`', '.', ' '  // Triggers
  );

  return provider;
}