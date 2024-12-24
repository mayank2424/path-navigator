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
		['javascript', 'typescript'],
		{
			provideHover(document, position, token) {
				let contentMessage = `Loading source code URL...`;

				if(!isCtrlOrCommandPressed as boolean) {
					return;
				};

				const wordRange = document.getWordRangeAtPosition(position, /['"`][^'"`]+['"`]/);
                if (!wordRange) {
					return;
				};

				const hoveredContent = document.getText(wordRange);

				if(hoveredContent) {
					const cleanedContent = hoveredContent.replace(/^['"]|['"]$/g, "");
					const URL = resolveSourceUrl(cleanedContent);

					if(URL) {
						// Remove loading hover pushed initially
						contentMessage = `[View Source](${URL}): ${URL}`; 

						return new vscode.Hover(contentMessage);
					}
				}
			}
		}
	));
}

// This method is called when your extension is deactivated
export function deactivate() {}


function resolveSourceUrl(moduleName: string): string | undefined | null {
	console.log({ moduleName });
    if (moduleName.startsWith('@') || !moduleName.startsWith('.')) {
		 // Resolve to a CDN or repository
		// Open Github repository
		const packageUrl = getMatchingPackageNameUsingPath(moduleName);
		// getModuleRepositoryURL(moduleName);
		return packageUrl;
        
    };
	
	return null;
}

function getMatchingPackageNameUsingPath(pathName: string, language = 'typescript') {
	const splittedPath = pathName.split('/');

	// check iteratively if the package name exists in the source code
	let packageName = null;
	const projectNodeModulesDirectory = findProjectNodeModulesDirectoryPath();
	if(!projectNodeModulesDirectory) {
		// Show notification
		vscode.window.showInformationMessage('Could not find package.json for the module');
		return;
	}

	console.log({ splittedPath });
	
	for (let i = splittedPath.length; i >= 0; i--) {
		try {
			const currentPath = splittedPath.slice(0, i).join('/');
			
			const isPathExistInProjectPackages = checkIfModuleExistsInSourcePackageJson(currentPath);
			if(isPathExistInProjectPackages) {
				console.log({ isPathExistInProjectPackages, path: currentPath });

				// Check if the module is in the project's node_modules directory
				const packagePathInNodeModulesDirectory = path.join(projectNodeModulesDirectory, currentPath);

				const packagePath = require.resolve(path.join(packagePathInNodeModulesDirectory, 'package.json'));
				console.log({ packagePath, i, a: splittedPath.slice(i) });

				// Find remaining paths from the splitted path
				const remainingPath = identifyRemainingPathFileTypeOrDirectory(packagePathInNodeModulesDirectory, splittedPath.slice(i).join('/'));
				console.log("Remaining pth", { remainingPath });

				if (packagePath) {
					// Extract repository URL
					let repositoryURL = generateRepositoryUrl(packagePath, packagePathInNodeModulesDirectory, remainingPath);
					return repositoryURL;

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

function identifyRemainingPathFileTypeOrDirectory(packageNodeModulesBasePath: string, remainingPath: string) {
	if(!remainingPath) {
		return '';
	}

	const fullPath = path.join(packageNodeModulesBasePath, remainingPath);
	const supportedLanguageExtensions = [
		".js",
		".ts",
		".d.ts",
		".jsx",
		".tsx",
		".json",
		".css",
		".scss",
		".less",
		".sass",
		".md",
		".html",
		".vue",
		".svelte",
		".php",
		".py",
		".rb",
	]

	if(fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
		return `/tree/master/${remainingPath}`;
	}
	else if(!fs.existsSync(fullPath)) {
		for(const extension of supportedLanguageExtensions) {
			const fileWithExtension = fullPath + extension;
			if(fs.existsSync(fileWithExtension)) {
				console.log({ fileWithExtension });
				return `/blob/master/${remainingPath}${extension}`;
			}
		}
	} else {
		throw new Error('File type not supported');
	}
}

function generateRepositoryUrl(packagePath: string, packagePathInNodeModulesDirectory: string, remainingPath?: string) {
	const modulePackageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

	// Extract repository URL
	const repositoryData = modulePackageJson.repository;
	const repositoryUrl = getSourceCodeRepositoryBaseUrl(modulePackageJson, packagePathInNodeModulesDirectory);
	const repositoryPackage = repositoryData.package || repositoryData.directory;
	const packageName = modulePackageJson.name;

	console.log({ repositoryPackage, remainingPath, packagePath, packagePathInNodeModulesDirectory });

	let repoUrl;

	const srcPath = path.join(packagePathInNodeModulesDirectory, "src");
	const hasRemainingPathSrc = remainingPath?.includes('/src');
	const hasSrcDirectory = !hasRemainingPathSrc && fs.existsSync(srcPath);
	const hasPackages = !repositoryPackage && isScopedPackage(packageName);

	// If remaining path already contains /tree/master or /blob/master, then append the remaining path to the repository URL
	if(remainingPath?.includes('/tree/master')) {
		const updatedRemainingPath = remainingPath.replace('/tree/master', '');
		let updatedFullPath = `${repositoryUrl}/tree/master${repositoryPackage ? `/${repositoryPackage}` : ''}`;

		if(hasSrcDirectory) {
			updatedFullPath+= '/src';
		} else if(hasPackages) {
			updatedFullPath+= '/packages';
		}

		repoUrl = `${updatedFullPath}${updatedRemainingPath}`;
		
	} else if(remainingPath?.includes('/blob/master')) {
		const updatedRemainingPath = remainingPath.replace('/blob/master', '');
		let updatedFullPath = `${repositoryUrl}/blob/master${repositoryPackage ? `/${repositoryPackage}` : ''}`;

		if(hasSrcDirectory) {
			updatedFullPath+= '/src';
		} else if(hasPackages) {
			updatedFullPath+= '/packages';
		}

		repoUrl = `${updatedFullPath}${updatedRemainingPath}`;
	} else {
		// if git repository is package or directory, then /tree/master is appended
		// because it is assumed that the repository is a directory
		if(hasSrcDirectory) {	
			repoUrl = `${repositoryUrl}${repositoryPackage ? '/tree/master/src/' + repositoryPackage : ''}`;
		} 
		else if(hasPackages) {
			repoUrl = `${repositoryUrl}${repositoryPackage ? '/tree/master/packages/' + repositoryPackage : ''}`;
		}
		else {
			repoUrl = `${repositoryUrl}${repositoryPackage ? '/tree/master/' + repositoryPackage : ''}`;
		}
	}

	return repoUrl;
}

function isScopedPackage(packageName: string) {
	return packageName.startsWith('@') && packageName.includes('/');
}


function getSourceCodeRepositoryBaseUrl(modulePackageJson: any, packagePathInNodeModulesDirectory: string) {
	const repository = modulePackageJson.repository;
	let url;

	if(typeof repository === "string") {
		url = repository;
	} else if(repository?.url) {
		url = repository.url;
	}

	const providers = {
		github: "https://github.com",
		gitlab: "https://gitlab.com",
		bitbucket: "https://bitbucket.org",
	  };

	const [provider, repoPath] = url.split(":");	
	const matchedProvider = providers[provider as keyof typeof providers]
	if(matchedProvider) {
		url = `${matchedProvider}/${repoPath}`;
	}

	// Replace git+ssh with https
	if (url?.includes('git+ssh')) {	
		url = url.replace('git+ssh://git@', 'https://');
	} else if(url?.includes("git://")) {
		url = url.replace('git://', 'https://');
	}

	url = url.replace(/\.git$/, '');

	return url;
}

function determineExtensionBasedOnLanguage() {

}
