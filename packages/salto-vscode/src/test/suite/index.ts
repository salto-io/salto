import * as path from 'path';
import { runCLI } from 'jest-cli';

const projectRoot = path.resolve(__dirname, '../../..');

console.log('outside run')
export const run = (_testsRoot: string, reportTestResults: (error?: Error, failures?: number) => void): void => {
	console.log(`run entered, testsRoot=${_testsRoot}, reportTestResults=${reportTestResults}`)

	const config = path.join(projectRoot, 'jest.config.js')
	console.log(`config=${config}`)

	runCLI({ config } as any, [projectRoot]).then(jestCliCallResult => {
		const { results } = jestCliCallResult
		const { testResults } = results
		testResults.forEach(testResult => {
			testResult.testResults
				.filter(assertionResult => assertionResult.status === 'passed')
				.forEach(({ ancestorTitles, title, status }) => {
					console.info(`  ● ${ancestorTitles} › ${title} (${status})`);
				});
		});

		testResults.forEach(testResult => {
			if (testResult.failureMessage) {
				console.error(testResult.failureMessage);
			}
		});

		const failures = results.numFailedTests + results.numRuntimeErrorTestSuites
		reportTestResults(undefined, failures)
	}).catch(errorCaughtByJestRunner => {
		reportTestResults(errorCaughtByJestRunner, 0)
	})

	console.log('after runCLI')
}

export default run