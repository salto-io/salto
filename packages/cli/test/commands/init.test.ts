import { Config } from 'salto'
import * as mocks from '../mocks'
import { command } from '../../src/commands/init'

jest.mock('salto', () => ({
  init: jest.fn().mockImplementation((workspaceName: string): {config: Config} => {
    if (workspaceName === 'error') throw new Error('failed')
    return { config: {
      name: workspaceName,
      localStorage: '',
      baseDir: '',
      stateLocation: '',
      services: ['salesforce'],
      uid: '',
      envs: [],
    } }
  }),
}))

describe('describe command', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }

  beforeEach(async () => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
  })

  it('should invoke api\'s init', async () => {
    await command('test', cliOutput).execute()
    expect(cliOutput.stdout.content.search('test')).toBeGreaterThan(0)
  })

  it('should print errors', async () => {
    await command('error', cliOutput).execute()
    expect(cliOutput.stderr.content.search('failed')).toBeGreaterThan(0)
  })
})
