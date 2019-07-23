import * as fs from 'async-file'
import SaltoCommander from '../src/cli/salto-cli'

let outputData = ''
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

const mockApply = jest.fn().mockImplementation(() => {})
const mockPlan = jest.fn().mockImplementation(() => {})
const mockDiscover = jest.fn().mockImplementation(() => {})
const mockDescribe = jest.fn().mockImplementation(() => {})

jest.mock('../src/cli/commands', () => ({
  apply: jest.fn().mockImplementation((bp, bpd, f) => mockApply(bp, bpd, f)),
  discover: jest.fn().mockImplementation((o, bp, bpd) => mockDiscover(o, bp, bpd)),
  plan: jest.fn().mockImplementation((bp, bpd) => mockPlan(bp, bpd)),
  describe: jest.fn().mockImplementation(sw => mockDescribe(sw)),
}))

describe('Test commands.ts', () => {
  const bp = `${__dirname}/../../test/blueprints/salto.bp`
  const bpDir = `${__dirname}/../../test/blueprints`
  const output = 'tmp.bp'

  it('should print the help file', async () => {
    const cli = new SaltoCommander()
    resetConsoleOutput()
    const args = ['node', 'salto-cli.js', '--help']
    cli.parseAndRun(args)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(outputData).toMatch('Usage: salto-cli [options] [command]')
    expect(outputData).toMatch('apply [options]')
    expect(outputData).toMatch('plan [options]')
    expect(outputData).toMatch('describe <searchWords>')
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('should invoke the apply command', async () => {
    const cli = new SaltoCommander()
    resetConsoleOutput()
    const args = [
      'node',
      'salto-cli.js',
      'apply',
      '-f',
      '-b',
      bp,
      '-d',
      bpDir,
    ]
    await cli.parseAndRun(args)
    expect(mockApply).toHaveBeenLastCalledWith([bp], bpDir, true)
  })

  it('should invoke the plan command', async () => {
    const cli = new SaltoCommander()
    resetConsoleOutput()
    const args = [
      'node',
      'salto-cli.js',
      'plan',
      '-f',
      '-b',
      bp,
      '-d',
      bpDir,
    ]
    await cli.parseAndRun(args)
    expect(mockPlan).toHaveBeenLastCalledWith([bp], bpDir)
  })

  it('should invoke the plan command with blueprintsDir', async () => {
    const cli = new SaltoCommander()
    resetConsoleOutput()
    const args = [
      'node',
      'salto-cli.js',
      'plan',
      '-f',
      '-d',
      bpDir,
      '-b',
      bp,
    ]
    await cli.parseAndRun(args)
    expect(mockPlan).toHaveBeenLastCalledWith([bp], bpDir)
  })

  it('should invoke the describe command', async () => {
    const cli = new SaltoCommander()
    resetConsoleOutput()
    const args = [
      'node',
      'salto-cli.js',
      'describe',
      'salto_office',
    ]
    await cli.parseAndRun(args)
    expect(mockDescribe).toHaveBeenLastCalledWith(['salto_office'])
  })

  it('should invoke the discover command', async () => {
    const cli = new SaltoCommander()
    try {
      resetConsoleOutput()
      const args = [
        'node',
        'salto-cli.js',
        'discover',
        '-o',
        output,
        '-b',
        bp,
      ]
      await cli.parseAndRun(args)
      expect(mockDiscover).toHaveBeenLastCalledWith(output, [bp], undefined)
    } finally {
      fs.delete('tmp.bp')
    }
  })

  it('should create the cli as singleton', async () => {
    const cli = new SaltoCommander()
    try {
      resetConsoleOutput()
      const args = ['node', 'salto-cli.js', 'discover', '-o', 'tmp.bp']
      await cli.parseAndRun(args)
      expect(mockExit).toHaveBeenCalledWith(0)
    } finally {
      fs.delete('tmp.bp')
    }
  })
})
