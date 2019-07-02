"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plan_1 = require("../src/plan");
const elements_1 = require("../src/elements");
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
        const ptStr = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        const ptNum = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.NUMBER,
            annotations: {},
            annotationsValues: {},
        });
        const lt = new elements_1.ListType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'list' }),
            elementType: ptNum,
            annotations: {},
            annotationsValues: {},
        });
        const oldElement = new elements_1.ObjectType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'obj' }),
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
        });
        const pa = plan_1.PlanAction.createFromElements(oldElement, undefined, 'name');
        expect(pa.actionType).toBe(plan_1.PlanActionType.REMOVE);
    });
    it('Should create a plan from new elements', () => {
        const ptStr = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        const ptNum = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.NUMBER,
            annotations: {},
            annotationsValues: {},
        });
        const newElement = new elements_1.ObjectType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'obj' }),
            fields: {
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                num_field: ptNum,
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                str_field: ptStr,
            },
            annotations: {},
            annotationsValues: {},
        });
        const pa = plan_1.PlanAction.createFromElements(undefined, newElement, 'name');
        expect(pa.actionType).toBe(plan_1.PlanActionType.ADD);
    });
    it('Should create a plan from old and new elements', () => {
        const ptStr = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        const ptNum = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.NUMBER,
            annotations: {},
            annotationsValues: {},
        });
        const newElement = new elements_1.ObjectType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'obj' }),
            fields: {
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                num_field: ptNum,
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                str_field: ptStr,
            },
            annotations: {},
            annotationsValues: {},
        });
        const oldElement = new elements_1.ObjectType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'obj' }),
            fields: {
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                str_field: ptStr,
            },
            annotations: {},
            annotationsValues: {},
        });
        const pa = plan_1.PlanAction.createFromElements(oldElement, newElement, 'name');
        expect(pa.actionType).toBe(plan_1.PlanActionType.MODIFY);
    });
    it('Should create a plan from old and new elements with lists', () => {
        const ptNum = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.NUMBER,
            annotations: {},
            annotationsValues: {},
        });
        const lt = new elements_1.ListType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'list' }),
            elementType: ptNum,
            annotations: {},
            annotationsValues: {},
        });
        const ptStr = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        const newElement = new elements_1.ObjectType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'obj' }),
            fields: {
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                list_field: lt,
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                str_field: ptStr,
            },
            annotations: {},
            annotationsValues: {},
        });
        const oldElement = new elements_1.ObjectType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'obj' }),
            fields: {
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                str_field: ptStr,
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                list_field: lt,
            },
            annotations: {},
            annotationsValues: {},
        });
        const pa = plan_1.PlanAction.createFromElements(oldElement, newElement, 'name');
        expect(pa.actionType).toBe(plan_1.PlanActionType.MODIFY);
    });
    it('Should handle annotationsValues changes', () => {
        const ptStr = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        const ptNum = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.NUMBER,
            annotations: {},
            annotationsValues: {},
        });
        const newElement = new elements_1.ObjectType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'obj' }),
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
        });
        const oldElement = new elements_1.ObjectType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'obj' }),
            fields: {
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                str_field: ptStr,
            },
            annotations: {},
            annotationsValues: {
                a1: 11, a2: 2, a3: { a4: 4 }, a5: [1, 2, 33], a6: 1,
            },
        });
        const pa = plan_1.PlanAction.createFromElements(oldElement, newElement, 'name');
        expect(pa.actionType).toBe(plan_1.PlanActionType.MODIFY);
    });
    it('Should handle annotations changes', () => {
        const ptStr = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        const ptNum = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.NUMBER,
            annotations: {},
            annotationsValues: {},
        });
        const newElement = new elements_1.ObjectType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'obj' }),
            fields: {
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                num_field: ptNum,
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                str_field: ptStr,
            },
            annotations: {},
            annotationsValues: {},
        });
        const oldElement = new elements_1.ObjectType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'obj' }),
            fields: {
                /* eslint-disable-next-line @typescript-eslint/camelcase */
                str_field: ptStr,
            },
            /* eslint-disable-next-line @typescript-eslint/camelcase */
            annotations: { str_anno: ptStr },
            annotationsValues: {},
        });
        const pa = plan_1.PlanAction.createFromElements(oldElement, newElement, 'name');
        expect(pa.actionType).toBe(plan_1.PlanActionType.MODIFY);
    });
    it('Should require at least one element to be defined', () => {
        expect(() => plan_1.PlanAction.createFromElements(undefined, undefined, 'name')).toThrow();
    });
});
//# sourceMappingURL=plan.test.js.map