import path from 'path'
import * as fs from 'async-file'
import {
  ElemID, InstanceElement, ObjectType, PlanAction, Plan,
  PrimitiveType, PrimitiveTypes,
} from 'adapter-api'
import * as commands from '../src/cli/commands'
import * as coreMock from './core/mocks/core'
import { Blueprint } from '../src/core/core'

let outputData = ''
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function storeLog(inputs: any): void {
  outputData += inputs
}

// eslint-disable-next-line no-console
console.log = jest.fn(storeLog)
// eslint-disable-next-line no-console
console.error = jest.fn(storeLog)

function resetConsoleOutput(): void {
  outputData = ''
}

const mockApply = coreMock.apply
const mockDiscover = coreMock.discover
const mockPlan = coreMock.plan
const mockGetElements = coreMock.getAllElements

jest.mock('../src/core/core', () => ({
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
  getAllElements: jest.fn().mockImplementation((bp: Blueprint[]) => mockGetElements(bp)),
}))


describe('Test commands.ts', () => {
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
    resetConsoleOutput()
    await commands.describe(['XXX', 'ggg', 'A'])
    expect(outputData).toMatch('Unknown element type.')
  })

  it('should output proper value when proper desc is provided', async () => {
    resetConsoleOutput()
    await commands.describe(['salto_office'])
    expect(outputData).toMatch('=== salto_office ===')
    expect(outputData).toMatch('Office Location')
    expect(outputData).toMatch('address')
  })

  it('should output proper value when proper desc is provided for list', async () => {
    resetConsoleOutput()
    await commands.describe(['salto_employee', 'nicknames'])
    expect(outputData).toMatch('=== string ===')
  })

  it('should output proper value when proper desc is provided for inner fields', async () => {
    resetConsoleOutput()
    await commands.describe(['salto_office', 'location'])
    expect(outputData).toMatch('=== salto_address ===')
  })

  it('should suggest proper value when proper desc is provided start path', async () => {
    resetConsoleOutput()
    await commands.describe(['salto_offic', 'locatin', 'city'])
    expect(outputData).toMatch('Could not find what you were looking for.')
    expect(outputData).toMatch('salto_office.location.city')
  })

  it('should suggest proper value when proper desc is provided end path', async () => {
    resetConsoleOutput()
    await commands.describe(['salto_office', 'locatin', 'cit'])
    expect(outputData).toMatch('Could not find what you were looking for.')
    expect(outputData).toMatch('salto_office.location.city')
  })

  it('should suggest proper value when proper desc is provided mid path', async () => {
    resetConsoleOutput()
    await commands.describe(['salto_office', 'locatin', 'city'])
    expect(outputData).toMatch('Could not find what you were looking for.')
    expect(outputData).toMatch('salto_office.location.city')
  })

  it('unknown type on single word', async () => {
    resetConsoleOutput()
    await commands.describe(['ZZZZZZZZZZZZZZZ'])
    expect(outputData).toMatch('Unknown element type.')
  })

  it('suggest type on single word', async () => {
    resetConsoleOutput()
    await commands.describe(['salto_ofice'])
    expect(outputData).toMatch('Did you mean')
  })

  it('should output the proper plan when the plan phase is invoked', async () => {
    resetConsoleOutput()
    const blueprintsFiles = [`${__dirname}/../../test/blueprints/salto.bp`]

    await commands.plan(blueprintsFiles)
    expect(outputData).toMatch('Salto will perform the following action')
    expect(outputData).toMatch('do_you_have_a_sales_team')
    expect(outputData).toMatch('Be sure to go over the plan')
  })

  it('should output the proper plan when the plan phase is invoked with dir', async () => {
    resetConsoleOutput()
    const blueprintsDir = `${__dirname}/../../test/blueprints`

    await commands.plan([], blueprintsDir)
    expect(outputData).toMatch('Salto will perform the following action')
    expect(outputData).toMatch('do_you_have_a_sales_team')
    expect(outputData).toMatch('Be sure to go over the plan')
  })

  it('should throw error when the blueprint files do no exist', async () => {
    resetConsoleOutput()
    const blueprintsFiles = [`${__dirname}/../../test/blueprints/salto_not_here.bp`]
    await commands.apply(blueprintsFiles, undefined, true)
    expect(outputData).toMatch('Error: Failed to load blueprints files')
  })

  it('should invoke setenv without errors', async () => {
    resetConsoleOutput()
    expect(async () => {
      commands.setenv()
    }).not.toThrow()
  })

  it('should create proper inquier field', async () => {
    const pts = new PrimitiveType({
      elemID: new ElemID('salesforce', 'dummy'),
      primitive: PrimitiveTypes.STRING,
    })
    const stRes = commands.getFieldInputType(pts)
    const pti = new PrimitiveType({
      elemID: new ElemID('salesforce', 'dummy'),
      primitive: PrimitiveTypes.NUMBER,
    })
    const iRes = commands.getFieldInputType(pti)
    const ptb = new PrimitiveType({
      elemID: new ElemID('salesforce', 'dummy'),
      primitive: PrimitiveTypes.BOOLEAN,
    })
    const bRes = commands.getFieldInputType(ptb)
    expect(iRes).toBe('number')
    expect(bRes).toBe('confirm')
    expect(stRes).toBe('input')
  })
})
