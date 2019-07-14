import path from 'path'
import * as fs from 'async-file'
import {
  ObjectType, InstanceElement, ElemID,
  PrimitiveType, PrimitiveTypes, Type,
} from 'adapter-api'
import Cli from '../src/cli/commands'
import SaltoCoreMock from './core/mocks/core'

let outputData = ''
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function storeLog(inputs: any): void {
  outputData += inputs
}

async function getConfigFromUser(configType: ObjectType): Promise<InstanceElement> {
  const value = {
    username: 'test@test',
    password: 'test',
    token: 'test',
    sandbox: false,
  }
  const elemID = new ElemID({ adapter: 'salesforce' })
  return new InstanceElement(elemID, configType, value)
}
// eslint-disable-next-line no-console
console.log = jest.fn(storeLog)
// eslint-disable-next-line no-console
console.error = jest.fn(storeLog)
const cli: Cli = new Cli(new SaltoCoreMock({
  getConfigFromUser,
}))

cli.currentActionPollerInterval = 1
function resetConsoleOutput(): void {
  outputData = ''
}

class CliTester extends Cli {
  public static testGetFieldInputType(field: Type): string {
    return Cli.getFieldInputType(field)
  }
}

describe('Test commands.ts', () => {
  it('set env should be defined', () => {
    expect(cli.setenv).toBeDefined()
  })

  it('discover should be defined', () => {
    expect(cli.discover).toBeDefined()
  })

  it('discover should create file', async () => {
    const outputName = path.join(__dirname, 'tmp.bp')
    try {
      await cli.discover(outputName, [])
      expect(await fs.exists(outputName)).toBe(true)
      expect((await fs.readFile(outputName)).toString()).toMatch('asd')
    } finally {
      fs.delete(outputName)
    }
  })

  it('should output not found when describing a complete mismatch', async () => {
    resetConsoleOutput()
    await cli.describe(['XXX', 'ggg', 'A'])
    expect(outputData).toMatch('Unknown element type.')
  })

  it('should output proper value when proper desc is provided', async () => {
    resetConsoleOutput()
    await cli.describe(['salto_office'])
    expect(outputData).toMatch('=== salto_office ===')
    expect(outputData).toMatch('Office Location')
    expect(outputData).toMatch('address')
  })

  it('should output proper value when proper desc is provided for list', async () => {
    resetConsoleOutput()
    await cli.describe(['salto_employee', 'nicknames'])
    expect(outputData).toMatch('=== string ===')
  })

  it('should output proper value when proper desc is provided for inner fields', async () => {
    resetConsoleOutput()
    await cli.describe(['salto_office', 'location'])
    expect(outputData).toMatch('=== salto_address ===')
  })

  it('should suggest proper value when proper desc is provided start path', async () => {
    resetConsoleOutput()
    await cli.describe(['salto_offic', 'locatin', 'city'])
    expect(outputData).toMatch('Could not find what you were looking for.')
    expect(outputData).toMatch('salto_office.location.city')
  })

  it('should suggest proper value when proper desc is provided end path', async () => {
    resetConsoleOutput()
    await cli.describe(['salto_office', 'locatin', 'cit'])
    expect(outputData).toMatch('Could not find what you were looking for.')
    expect(outputData).toMatch('salto_office.location.city')
  })

  it('should suggest proper value when proper desc is provided mid path', async () => {
    resetConsoleOutput()
    await cli.describe(['salto_office', 'locatin', 'city'])
    expect(outputData).toMatch('Could not find what you were looking for.')
    expect(outputData).toMatch('salto_office.location.city')
  })

  it('unknown type on single word', async () => {
    resetConsoleOutput()
    await cli.describe(['ZZZZZZZZZZZZZZZ'])
    expect(outputData).toMatch('Unknown element type.')
  })

  it('suggest type on single word', async () => {
    resetConsoleOutput()
    await cli.describe(['salto_ofice'])
    expect(outputData).toMatch('Did you mean')
  })

  it('should output the proper plan when the plan phase is invoked', async () => {
    resetConsoleOutput()
    const blueprintsFiles = [`${__dirname}/../test/blueprints/salto.bp`]
    await cli.plan(blueprintsFiles)
    expect(outputData).toMatch('Salto will perform the following action')
    expect(outputData).toMatch('Do you have a sales team')
    expect(outputData).toMatch('Be sure to go over the plan')
  })

  it('should output the proper plan when the plan phase is invoked with dir', async () => {
    resetConsoleOutput()
    const blueprintsDir = `${__dirname}/../test/blueprints`

    await cli.plan([], blueprintsDir)
    expect(outputData).toMatch('Salto will perform the following action')
    expect(outputData).toMatch('Do you have a sales team')
    expect(outputData).toMatch('Be sure to go over the plan')
  })

  it('should propmt the user for input after printing the plan when apply is invoked', async () => {
    resetConsoleOutput()
    const blueprintsFiles = [`${__dirname}/../test/blueprints/salto.bp`]
    await cli.apply(blueprintsFiles, undefined, true)
    expect(outputData).toMatch('Salto will perform the following action')
    expect(outputData).toMatch('Salto-cli will start the apply step')
    expect(outputData).toMatch('do_you_have_a_sales_team')
  })

  it('should throw error when the blueprint files do no exist', async () => {
    resetConsoleOutput()
    const blueprintsFiles = [`${__dirname}/../test/blueprints/salto_not_here.bp`]
    await cli.apply(blueprintsFiles, undefined, true)
    expect(outputData).toMatch('Error: Failed to load blueprints files')
  })

  it('should invoke setenv without errors', async () => {
    resetConsoleOutput()
    expect(async () => {
      cli.setenv()
    }).not.toThrow()
  })

  it('should create proper inquier field', async () => {
    const pts = new PrimitiveType({
      elemID: new ElemID({ adapter: 'salesforce', name: 'dummy' }),
      primitive: PrimitiveTypes.STRING,
    })
    const stRes = CliTester.testGetFieldInputType(pts)
    const pti = new PrimitiveType({
      elemID: new ElemID({ adapter: 'salesforce', name: 'dummy' }),
      primitive: PrimitiveTypes.NUMBER,
    })
    const iRes = CliTester.testGetFieldInputType(pti)
    const ptb = new PrimitiveType({
      elemID: new ElemID({ adapter: 'salesforce', name: 'dummy' }),
      primitive: PrimitiveTypes.BOOLEAN,
    })
    const bRes = CliTester.testGetFieldInputType(ptb)
    expect(iRes).toBe('number')
    expect(bRes).toBe('confirm')
    expect(stRes).toBe('input')
  })
})
