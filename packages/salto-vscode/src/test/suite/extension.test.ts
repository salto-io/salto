// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../extension';

describe('Extension Test Suite', () => {
	beforeAll(() => {
		vscode.window.showInformationMessage('Start all tests.');
	});

	it('should pass', () => {
		expect(true).toBeTruthy()
	});

	it('should fail', () => {
		expect(true).toBeFalsy()
	})
});
