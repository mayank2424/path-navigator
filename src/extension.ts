// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import path from 'path';
import * as vscode from 'vscode';
import fs from 'fs';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const underlineDecoration = vscode.window.createTextEditorDecorationType({
		textDecoration: 'underline',
	});

	let isCtrlOrCommandPressed: boolean = false;


	const selectionListener = vscode.window.onDidChangeTextEditorSelection((e) => {
		const editor = vscode.window.activeTextEditor;
		console.log({ editor });
		if (!editor) {

		};

		const platformKey = process.platform === 'darwin' ? 'metaKey' : 'ctrlKey';
		const keyState = e.kind === vscode.TextEditorSelectionChangeKind.Command;
		console.log({ platformKey, keyState });

        isCtrlOrCommandPressed = editor?.selections?.some((selection) =>
            selection.isEmpty && platformKey
        ) as boolean;
	
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('navigate-to-source-code', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from Link To Source Code 2!');
	});
	
	context.subscriptions.push(selectionListener, disposable);
	context.subscriptions.push(vscode.languages.registerHoverProvider(
		'typescript',
		{
			provideHover(document, position, token) {
				if(!isCtrlOrCommandPressed as boolean) {
					return;
				};

				console.log({ document, position, token });
				const wordRange = document.getWordRangeAtPosition(position, /['"`][^'"`]+['"`]/);
                if (!wordRange) {
					return;
				};

				const hoveredContent = document.getText(wordRange);
				console.log({ hoveredContent});

				if(hoveredContent) {
					const cleanedContent = hoveredContent.replace(/^['"]|['"]$/g, "");
					resolveSourceUrl(cleanedContent);
				}

				return new vscode.Hover("Navigate to source code");
			}
		}
	));
}

// This method is called when your extension is deactivated
export function deactivate() {}


function resolveSourceUrl(moduleName: string): string | null {
	console.log({ moduleName });
    if (moduleName.startsWith('@') || !moduleName.startsWith('.')) {
		 // Resolve to a CDN or repository
		// Open Github repository
		getMatchingPackageNameUsingPath(moduleName);
		// getModuleRepositoryURL(moduleName);
		return `https://unpkg.com/${moduleName}`;
        
    } else {
       // Local import, resolve to file path
	   return null; // Implement relative path handling if required
    }
}

function getModuleRepositoryURL(moduleName: string) {
	console.log({ moduleName })
	try {
		const packagePath = require.resolve(path.join(`node_modules/${moduleName}`, 'package.json'));
		console.log({ packagePath });

		// Read 
		
		return JSON.parse(fs .readFileSync(packagePath, 'utf8'));
	} catch(error) {
		console.error(`Could not find package.json for ${moduleName}:`, error);
        return null;
	}
}

function getMatchingPackageNameUsingPath(pathName: string) {
	const splittedPath = pathName.split('/');
	console.log({ splittedPath });

	// check iteratively if the package name exists in the source code
	let packageName = null;
	const projectNodeModulesDirectory = findProjectNodeModulesDirectoryPath();
	if(!projectNodeModulesDirectory) {
		// Show notification
		vscode.window.showInformationMessage('Could not find package.json for the module');
		return;
	}
	
	for (let i = splittedPath.length; i >= 0; i--) {
		try {
			const currentPath = splittedPath.slice(0, i).join('/');
			
			const isPathExistInProjectPackages = checkIfModuleExistsInSourcePackageJson(currentPath);
			if(isPathExistInProjectPackages) {
				console.log({ isPathExistInProjectPackages, path: currentPath });

				// Check if the module is in the project's node_modules directory
				const packagePathInNodeModulesDirectory = path.join(projectNodeModulesDirectory, currentPath);

				const packagePath = require.resolve(path.join(packagePathInNodeModulesDirectory, 'package.json'));
				console.log({ packagePath });

				// Find remaining paths from the splitted path
				const remainingPath = splittedPath.slice(i).join('/');
		
				if (packagePath) {
					const modulePackageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
					
					// Extract repository URL
					const repositoryURL = getRepositoryUrlFromPackageJson(packagePath);
					
					// TODO: Add logic to open the repository URL and navigate to the file
					
					
				}

				break;
			}
		} catch(error) {
			console.error(`Could not find package.json for ${pathName}:`, error);
			continue;
		}
	}
	
	
}

function findProjectNodeModulesDirectoryPath() {
	// Check if the module is in the project's node_modules directory
	const projectRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
	const nodeModulesPath = path.join(projectRoot as string, 'node_modules');

	if (fs.existsSync(nodeModulesPath)) {
		return nodeModulesPath;
	}

	return null;
}

function checkIfModuleExistsInSourcePackageJson(moduleName: string): boolean {
	const packageJsonPath = path.join(vscode.workspace.workspaceFolders?.[0].uri.fsPath as string, 'package.json');

	if (!fs.existsSync(packageJsonPath)) {
		return false;
	}

	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	const dependencies = packageJson.dependencies;
	const devDependencies = packageJson.devDependencies;

	const moduleExistsInDependencies = dependencies && dependencies[moduleName];

	if (moduleExistsInDependencies) {
		return true;
	}

	const moduleExistsInDevDependencies = devDependencies && devDependencies[moduleName];

	if (moduleExistsInDevDependencies) {
		return true;
	}

	return false;
}

function getRepositoryUrlFromPackageJson(packagePath: string) {
	const modulePackageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

	// Extract repository URL
	const repository = modulePackageJson.repository;
	const repositoryUrl = repository.url;
	const repositoryPackage = repository.package;

	// Check if repository URL is of

	return `${repositoryUrl}${repositoryPackage ? '/' + repositoryPackage : ''}`;
}
