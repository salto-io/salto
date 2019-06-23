import cli from '../src/cli/salto-cli'

let outputData = ''
/* eslint-disable-next-line explicit-function-return-type no-return-assign, @typescript-eslint/no-explicit-any */
function storeLog(inputs: any): void {
  outputData += inputs
}

// eslint-disable-next-line no-console
console.log = jest.fn(storeLog)
// eslint-disable-next-line no-console
console.error = jest.fn(storeLog)

process.stdout.write = jest.fn(storeLog)

function resetConsoleOutput(): void {
  outputData = ''
}

const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {})

describe('Test commands.ts', () => {
  it('should print the help file', async () => {
    resetConsoleOutput()
    const args = ['node', 'salto-cli.js', '--help']
    cli.parseAndRun(args)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(outputData).toMatch('Usage: salto-cli [options] [command]')
    expect(outputData).toMatch('apply [options]')
    expect(outputData).toMatch('plan [options]')
    expect(outputData).toMatch('describe [options] <searchWords>')
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('should print the help for specific commands', () => {})

  it('should invoke the apply command', async () => {
    resetConsoleOutput()
    const args = [
      'node',
      'salto-cli.js',
      'apply',
      '-f',
      '-b',
      `${__dirname}/blueprints/salto.bp`,
    ]
    cli.parseAndRun(args)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(outputData).toMatch('Salto will perform the following action')
    expect(outputData).toMatch('Salto-cli will start the apply step')
    expect(outputData).toMatch('do_you_have_a_sales_team')
  })

  it('should invoke the apply command with blueprintsDir', async () => {
    resetConsoleOutput()
    const args = [
      'node',
      'salto-cli.js',
      'apply',
      '-f',
      '-d',
      `${__dirname}/blueprints`,
    ]
    cli.parseAndRun(args)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(outputData).toMatch('Salto will perform the following action')
    expect(outputData).toMatch('Salto-cli will start the apply step')
    expect(outputData).toMatch('do_you_have_a_sales_team')
  })

  it('should invoke the plan command', async () => {
    resetConsoleOutput()
    const args = ['node', 'salto-cli.js', 'plan']
    cli.parseAndRun(args)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(outputData).toMatch('Salto will perform the following action')
    expect(outputData).toMatch('Do you have a sales team')
    expect(outputData).toMatch('Be sure to go over the plan')
  })

  it('should invoke the describe command', async () => {
    resetConsoleOutput()
    const args = [
      'node',
      'salto-cli.js',
      'describe',
      'salto_office',
      '-r',
      '2c',
    ]
    cli.parseAndRun(args)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(outputData).toMatch('=== salto_office ===')
    expect(outputData).toMatch('Office Location')
    expect(outputData).toMatch('salto_address')
  })

  it('should invoke the discover command', async () => {
    resetConsoleOutput()
    const args = ['node', 'salto-cli.js', 'discover']
    cli.parseAndRun(args)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('should create the cli as singleton', async () => {
    resetConsoleOutput()
    const args = ['node', 'salto-cli.js', 'discover']
    cli.parseAndRun(args)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(mockExit).toHaveBeenCalledWith(0)
  })
})
