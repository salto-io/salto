import path from 'path'
import * as fs from 'async-file'
import {
  InstanceElement, ObjectType, PlanAction, Plan, BuiltinTypes,
} from 'adapter-api'
import * as commands from '../src/cli/commands'
import { getFieldInputType } from '../src/cli/callbacks'
import * as coreMock from './core/mocks/core'
import Blueprint from '../src/core/blueprint'


const mockApply = coreMock.apply
const mockDiscover = coreMock.discover
const mockPlan = coreMock.plan
const mockGetElements = coreMock.getAllElements

jest.mock('../src/core/commands', () => ({
  apply: jest.fn().mockImplementation((
    blueprints: Blueprint[],
    fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
    shouldApply: (plan: Plan) => Promise<boolean>,
    reportProgress: (action: PlanAction) => void,
    force: boolean = false
  ) => mockApply(blueprints, fillConfig, shouldApply, reportProgress, force)),
  discover: jest.fn().mockImplementation((
    blueprints: Blueprint[],
    fillConfig: (configType: ObjectType) => Promise<InstanceElement>
  ) => mockDiscover(blueprints, fillConfig)),
  plan: jest.fn().mockImplementation((bp: Blueprint[]) => mockPlan(bp)),
}))

jest.mock('../src/parser/merger', () => ({
  getAllElements: jest.fn().mockImplementation((bp: Blueprint[]) => mockGetElements(bp)),
}))

describe('Test commands.ts', () => {
  let outputData = ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storeLog = (inputs: any): void => {
    outputData += inputs
  }

  const resetConsoleOutput = (): void => {
    outputData = ''
  }

  // eslint-disable-next-line no-console
  console.log = jest.fn(storeLog)
  // eslint-disable-next-line no-console
  console.error = jest.fn(storeLog)


  beforeEach(() => {
    resetConsoleOutput()
  })

  it('set env should be defined', () => {
    expect(commands.setenv).toBeDefined()
  })

  it('discover should be defined', () => {
    expect(commands.discover).toBeDefined()
  })

  it('discover should create file', async () => {
    const outputName = path.join(__dirname, 'tmp.bp')
    try {
      await commands.discover(outputName, [])
      expect(await fs.exists(outputName)).toBe(true)
      expect((await fs.readFile(outputName)).toString()).toMatch('asd')
    } finally {
      fs.delete(outputName)
    }
  })

  it('should output not found when describing a complete mismatch', async () => {
    await commands.describe(['XXX', 'ggg', 'A'])
    expect(outputData).toMatch('Unknown element type.')
  })

  it('should output proper value when proper desc is provided', async () => {
    await commands.describe(['salto_office'])
    expect(outputData).toMatch('=== salto_office ===')
    expect(outputData).toMatch('Office Location')
    expect(outputData).toMatch('address')
  })

  it('should output proper value when proper desc is provided for list', async () => {
    await commands.describe(['salto_employee', 'nicknames'])
    expect(outputData).toMatch('=== string ===')
  })

  it('should output proper value when proper desc is provided for inner fields', async () => {
    await commands.describe(['salto_office', 'location'])
    expect(outputData).toMatch('=== salto_address ===')
  })

  it('should suggest proper value when proper desc is provided start path', async () => {
    await commands.describe(['salto_offic', 'locatin', 'city'])
    expect(outputData).toMatch('Could not find what you were looking for.')
    expect(outputData).toMatch('salto_office.location.city')
  })

  it('should suggest proper value when proper desc is provided end path', async () => {
    await commands.describe(['salto_office', 'locatin', 'cit'])
    expect(outputData).toMatch('Could not find what you were looking for.')
    expect(outputData).toMatch('salto_office.location.city')
  })

  it('should suggest proper value when proper desc is provided mid path', async () => {
    await commands.describe(['salto_office', 'locatin', 'city'])
    expect(outputData).toMatch('Could not find what you were looking for.')
    expect(outputData).toMatch('salto_office.location.city')
  })

  it('unknown type on single word', async () => {
    await commands.describe(['ZZZZZZZZZZZZZZZ'])
    expect(outputData).toMatch('Unknown element type.')
  })

  it('suggest type on single word', async () => {
    await commands.describe(['salto_ofice'])
    expect(outputData).toMatch('Did you mean')
  })

  it('should output the proper plan when the plan phase is invoked', async () => {
    const blueprintsFiles = [`${__dirname}/../../test/blueprints/salto.bp`]

    await commands.plan(blueprintsFiles)
    expect(outputData).toMatch('Salto will perform the following action')
    expect(outputData).toMatch('do_you_have_a_sales_team')
    expect(outputData).toMatch('Be sure to go over the plan')
  })

  it('should output the proper plan when the plan phase is invoked with dir', async () => {
    const blueprintsDir = `${__dirname}/../../test/blueprints`

    await commands.plan([], blueprintsDir)
    expect(outputData).toMatch('Salto will perform the following action')
    expect(outputData).toMatch('do_you_have_a_sales_team')
    expect(outputData).toMatch('Be sure to go over the plan')
  })

  it('should throw error when the blueprint files do no exist', async () => {
    const blueprintsFiles = [`${__dirname}/../../test/blueprints/salto_not_here.bp`]
    await commands.apply(blueprintsFiles, undefined, true)
    expect(outputData).toMatch('Error: Failed to load blueprints files')
  })

  it('should invoke setenv without errors', async () => {
    expect(async () => {
      commands.setenv()
    }).not.toThrow()
  })

  it('should create proper inquier field', async () => {
    const stRes = getFieldInputType(BuiltinTypes.STRING)
    const iRes = getFieldInputType(BuiltinTypes.NUMBER)
    const bRes = getFieldInputType(BuiltinTypes.BOOLEAN)
    expect(iRes).toBe('number')
    expect(bRes).toBe('confirm')
    expect(stRes).toBe('input')
  })
})
