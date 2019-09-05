import * as vscode from 'vscode';
import Parser from 'salto/dist/src/parser/salto'
const baseBPDir = ''
let counter = 0

const elementsPerFile = {}

const loadAllFiles = async () => {
	
}

const onDidChangeTextDocument = async (event: vscode.TextDocumentChangeEvent) => {
	console.log("START")
	const text = event.document.getText()
	const {elements, errors} = await Parser.parse(text, '')
	console.log(counter, elements.length, errors.length)
	elements.forEach( e => console.log(e.elemID.getFullName()))
}


export const activate = (context: vscode.ExtensionContext) => {
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(onDidChangeTextDocument)
	)
}