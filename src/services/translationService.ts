import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { flattenTranslations } from '../utils/translationUtils';

export interface TranslationCache {
  keys: string[];
  values: Map<string, string>;
  lastUpdated: number;
}

let translationCache: TranslationCache | null = null;
const CACHE_TIMEOUT = 30000; // 30 seconds

export async function initializeTranslations(): Promise<void> {
  await getTranslationData();
}

export async function getTranslationData(): Promise<{ keys: string[], values: Map<string, string> } | null> {
  // Check if cache is valid
  const now = Date.now();
  if (translationCache && now - translationCache.lastUpdated < CACHE_TIMEOUT) {
    return { keys: translationCache.keys, values: translationCache.values };
  }

  try {
    // Find en.json in the workspace
    const enJsonPath = await findTranslationFile();
    
    if (!enJsonPath) {
      vscode.window.showWarningMessage('Could not find en.json file in the workspace');
      return null;
    }

    return loadAndCacheTranslations(enJsonPath);
  } catch (error) {
    console.error('Error loading translation keys:', error);
    vscode.window.showErrorMessage('Error loading translation keys');
    return null;
  }
}

export function loadAndCacheTranslations(filePath: string): { keys: string[], values: Map<string, string> } | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Remove comments to ensure valid JSON
    const jsonContent = content.replace(/^\s*\/\/.*$/gm, '');

    const translations = JSON.parse(jsonContent);

    // Flatten the nested translations
    const keys: string[] = [];
    const values = new Map<string, string>();

    flattenTranslations(translations, '', keys, values);

    // Cache the results
    translationCache = {
      keys,
      values,
      lastUpdated: Date.now()
    };

    return { keys, values };
  } catch (error) {
    console.error('Error parsing en.json:', error);
    return null;
  }
}

export function resetCache(): void {
  translationCache = null;
}

export async function findTranslationFile(): Promise<string | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return null;
  }

  // Use common locations for translation files
  let enJsonPath: string | null = null;
  const commonLocations = [
    'src/locales/en.json',
    'client/src/locales/en.json',
    'locales/en.json',
    'translations/en.json',
    'i18n/en.json'
  ];

  for (const folder of workspaceFolders) {
    for (const location of commonLocations) {
      const filePath = path.join(folder.uri.fsPath, location);
      if (fs.existsSync(filePath)) {
        enJsonPath = filePath;
        break;
      }
    }
    if (enJsonPath) break;
  }

  // If not found in common locations, try through file search
  if (!enJsonPath) {
    const files = await vscode.workspace.findFiles('**/en.json', '**/node_modules/**', 1);
    if (files.length > 0) {
      enJsonPath = files[0].fsPath;
    }
  }

  return enJsonPath;
}