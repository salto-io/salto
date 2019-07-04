
import { PlanAction, PlanActionType } from '../src/plan'
import {
  ObjectType,
  ListType,
  PrimitiveTypes,
  PrimitiveType,
  TypeID,
  InstanceElement,
} from '../src/elements'

// let outputData = ''
// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// function storeLog(inputs: any): void {
//   outputData += inputs
// }

// // eslint-disable-next-line no-console
// console.log = jest.fn(storeLog)
// // eslint-disable-next-line no-console
// console.error = jest.fn(storeLog)
// const cli: Cli = new Cli(new SaltoCoreMock())
// cli.currentActionPollerInterval = 1
// function resetConsoleOutput(): void {
//   outputData = ''
// }

describe('Test plan.ts', () => {
  it('Should create a plan from old elements', () => {
    const ptStr = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ptNum = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {},
      annotationsValues: {},
    })

    const lt = new ListType({
      typeID: new TypeID({ adapter: 'test', name: 'list' }),
      elementType: ptNum,
      annotations: {},
      annotationsValues: {},
    })
    const oldElement = new ObjectType({
      typeID: new TypeID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: ptNum,
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: ptStr,
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        list_field: lt,
      },
      /* eslint-disable-next-line @typescript-eslint/camelcase */
      annotations: { str_anno: ptStr },
      annotationsValues: {},
    })

    const pa = PlanAction.createFromElements(oldElement, undefined, 'name')
    expect(pa.actionType).toBe(PlanActionType.REMOVE)
  })

  it('Should create a plan from new elements', () => {
    const ptStr = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ptNum = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {},
      annotationsValues: {},
    })
    const newElement = new ObjectType({
      typeID: new TypeID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: ptNum,
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: ptStr,
      },
      annotations: {},
      annotationsValues: {},
    })

    const pa = PlanAction.createFromElements(undefined, newElement, 'name')
    expect(pa.actionType).toBe(PlanActionType.ADD)
  })

  it('Should create a plan from old and new elements', () => {
    const ptStr = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ptNum = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {},
      annotationsValues: {},
    })
    const newElement = new ObjectType({
      typeID: new TypeID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: ptNum,
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: ptStr,
      },
      annotations: {},
      annotationsValues: {},
    })

    const oldElement = new ObjectType({
      typeID: new TypeID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: ptStr,
      },
      annotations: {},
      annotationsValues: {},
    })

    const pa = PlanAction.createFromElements(oldElement, newElement, 'name')
    expect(pa.actionType).toBe(PlanActionType.MODIFY)
  })

  it('Should create a plan from old and new elements with lists', () => {
    const ptNum = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {},
      annotationsValues: {},
    })

    const lt = new ListType({
      typeID: new TypeID({ adapter: 'test', name: 'list' }),
      elementType: ptNum,
      annotations: {},
      annotationsValues: {},
    })

    const ptStr = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })

    const newElement = new ObjectType({
      typeID: new TypeID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        list_field: lt,
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: ptStr,
      },
      annotations: {},
      annotationsValues: {},
    })

    const oldElement = new ObjectType({
      typeID: new TypeID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: ptStr,
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        list_field: lt,
      },
      annotations: {},
      annotationsValues: {},
    })

    const pa = PlanAction.createFromElements(oldElement, newElement, 'name')
    expect(pa.actionType).toBe(PlanActionType.MODIFY)
  })

  it('Should handle annotationsValues changes', () => {
    const ptStr = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ptNum = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {},
      annotationsValues: {},
    })
    const newElement = new ObjectType({
      typeID: new TypeID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: ptNum,
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: ptStr,
      },
      annotations: {},
      annotationsValues: {
        a1: 1, a2: 2, a3: { a4: 4 }, a5: [1, 2, 3], a7: 1, a8: { a9: 9 },
      },
    })

    const oldElement = new ObjectType({
      typeID: new TypeID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: ptStr,
      },
      annotations: {},
      annotationsValues: {
        a1: 11, a2: 2, a3: { a4: 4 }, a5: [1, 2, 33], a6: 1,
      },
    })

    const pa = PlanAction.createFromElements(oldElement, newElement, 'name')
    expect(pa.actionType).toBe(PlanActionType.MODIFY)
  })

  it('Should handle annotations changes', () => {
    const ptStr = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ptNum = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {},
      annotationsValues: {},
    })
    const newElement = new ObjectType({
      typeID: new TypeID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: ptNum,
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: ptStr,
      },
      annotations: {},
      annotationsValues: {},
    })

    const oldElement = new ObjectType({
      typeID: new TypeID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: ptStr,
      },
      /* eslint-disable-next-line @typescript-eslint/camelcase */
      annotations: { str_anno: ptStr },
      annotationsValues: {},
    })

    const pa = PlanAction.createFromElements(oldElement, newElement, 'name')
    expect(pa.actionType).toBe(PlanActionType.MODIFY)
  })

  it('Should require at least one element to be defined', () => {
    expect(() => PlanAction.createFromElements(undefined, undefined, 'name')).toThrow()
  })

  it('Should handle new instance', () => {
    const ptStr = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ot = new ObjectType({
      typeID: new TypeID({ adapter: 'test', name: 'obj' }),
      fields: {
        test: ptStr,
      },
      annotations: {},
      annotationsValues: {},
    })
    const inst = new InstanceElement(
      new TypeID({ adapter: 'test', name: 'test' }),
      ot,
      { test: 'AAA' },
    )
    const pa = PlanAction.createFromElements(undefined, inst, 'name')
    expect(pa.actionType).toBe(PlanActionType.ADD)
  })

  it('Should handle removed instance', () => {
    const ptStr = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ot = new ObjectType({
      typeID: new TypeID({ adapter: 'test', name: 'obj' }),
      fields: {
        test: ptStr,
      },
      annotations: {},
      annotationsValues: {},
    })
    const inst = new InstanceElement(
      new TypeID({ adapter: 'test', name: 'test' }),
      ot,
      { test: 'AAA' },
    )
    const pa = PlanAction.createFromElements(inst, undefined, 'name')
    expect(pa.actionType).toBe(PlanActionType.REMOVE)
  })

  it('Should handle modified instance', () => {
    const ptStr = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ot = new ObjectType({
      typeID: new TypeID({ adapter: 'test', name: 'obj' }),
      fields: {
        test: ptStr,
      },
      annotations: {},
      annotationsValues: {},
    })
    const inst = new InstanceElement(
      new TypeID({ adapter: 'test', name: 'test' }),
      ot,
      { test: 'AAA' },
    )
    const inst2 = new InstanceElement(
      new TypeID({ adapter: 'test', name: 'test' }),
      ot,
      { test: 'BBB' },
    )
    const pa = PlanAction.createFromElements(inst, inst2, 'name')
    expect(pa.actionType).toBe(PlanActionType.MODIFY)
  })
})
