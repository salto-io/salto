"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const elements_1 = require("../src/elements");
describe('Test elements.ts', () => {
    it('should create a basic primitive type with all params passed to the constructor', () => {
        const ptStr = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        expect(ptStr.typeID).toEqual({ adapter: 'test', name: 'prim' });
        expect(ptStr.primitive).toBe(elements_1.PrimitiveTypes.STRING);
        const ptNum = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.NUMBER,
            annotations: {},
            annotationsValues: {},
        });
        expect(ptNum.typeID).toEqual({ adapter: 'test', name: 'prim' });
        expect(ptNum.primitive).toBe(elements_1.PrimitiveTypes.NUMBER);
    });
    it('should create a basic object type with all params passed to the constructor', () => {
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
        const ot = new elements_1.ObjectType({
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
        expect(ot.typeID).toEqual({ adapter: 'test', name: 'obj' });
        expect(ot.fields.num_field).toBeInstanceOf(elements_1.PrimitiveType);
        expect(ot.fields.str_field).toBeInstanceOf(elements_1.PrimitiveType);
    });
    it('should allow basic list type creations withh all params passed to the constructor', () => {
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
        const ot = new elements_1.ObjectType({
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
        const lt = new elements_1.ListType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'list' }),
            elementType: ot,
            annotations: {},
            annotationsValues: {},
        });
        expect(lt.typeID).toEqual({ adapter: 'test', name: 'list' });
        expect(lt.elementType).toBe(ot);
    });
    it('should allow to create types from the correct type them using registery.getType method', () => {
        const registery = new elements_1.TypesRegistry();
        // Check you can create Primitive Type
        const st = registery.getType(new elements_1.TypeID({ adapter: '', name: 'string' }), elements_1.PrimitiveTypes.STRING);
        expect(st).toBeInstanceOf(elements_1.PrimitiveType);
        const ot = registery.getType(new elements_1.TypeID({ adapter: '', name: 'object' }), elements_1.PrimitiveTypes.OBJECT);
        expect(ot).toBeInstanceOf(elements_1.ObjectType);
        const lt = registery.getType(new elements_1.TypeID({ adapter: '', name: 'list' }), elements_1.PrimitiveTypes.LIST);
        expect(lt).toBeInstanceOf(elements_1.ListType);
    });
    it('should reuse created types', () => {
        const registery = new elements_1.TypesRegistry();
        const st = registery.getType(new elements_1.TypeID({ adapter: '', name: 'string' }), elements_1.PrimitiveTypes.STRING);
        const st2 = registery.getType(new elements_1.TypeID({ adapter: '', name: 'string' }), elements_1.PrimitiveTypes.STRING);
        const st3 = registery.getType(new elements_1.TypeID({ adapter: '', name: 'string2' }), elements_1.PrimitiveTypes.STRING);
        expect(st).toBe(st2);
        expect(st).not.toBe(st3);
    });
    it('should register types that were registered explictly', () => {
        const registery = new elements_1.TypesRegistry();
        const ptStr = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'out_reg' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        registery.registerType(ptStr);
        const ptStr2 = registery.getType(new elements_1.TypeID({ adapter: 'test', name: 'out_reg' }));
        expect(ptStr).toBe(ptStr2);
    });
    it('should not allow registeration of same type id twice', () => {
        const registery = new elements_1.TypesRegistry();
        const ptStr = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'out_reg' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        const ptStr2 = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'out_reg' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        registery.registerType(ptStr);
        expect(() => {
            registery.registerType(ptStr2);
        }).toThrow();
    });
    it('should allow clone without annotations.', () => {
        const registery = new elements_1.TypesRegistry();
        const saltoAddr = registery.getType(new elements_1.TypeID({ adapter: 'salto', name: 'address' }));
        saltoAddr.annotations.label = registery.getType(new elements_1.TypeID({ adapter: '', name: 'string' }));
        saltoAddr.fields.country = registery.getType(new elements_1.TypeID({ adapter: '', name: 'string' }));
        saltoAddr.fields.city = registery.getType(new elements_1.TypeID({ adapter: '', name: 'string' }));
        const saltoAddr2 = saltoAddr.clone();
        expect(saltoAddr).not.toBe(saltoAddr2);
        expect(saltoAddr).toEqual(saltoAddr2);
        const nicknames = registery.getType(new elements_1.TypeID({ adapter: 'salto', name: ' nicknamed' }), elements_1.PrimitiveTypes.LIST);
        const nicknames2 = nicknames.clone();
        expect(nicknames).not.toBe(nicknames2);
        expect(nicknames).toEqual(nicknames2);
        const prim = registery.getType(new elements_1.TypeID({ adapter: '', name: 'prim' }), elements_1.PrimitiveTypes.STRING);
        const prim2 = prim.clone();
        expect(prim).not.toBe(prim2);
        expect(prim).toEqual(prim2);
    });
    it('should allow clone with annotations.', () => {
        const registery = new elements_1.TypesRegistry();
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const annotations = {};
        annotations.label = 'label';
        // Object
        const saltoAddr = registery.getType(new elements_1.TypeID({ adapter: 'salto', name: 'address' }));
        saltoAddr.fields.country = registery.getType(new elements_1.TypeID({ adapter: '', name: 'string' }));
        saltoAddr.fields.city = registery.getType(new elements_1.TypeID({ adapter: '', name: 'string' }));
        const saltoAddr2 = saltoAddr.clone(annotations);
        expect(saltoAddr).not.toBe(saltoAddr2);
        expect(saltoAddr2).toMatchObject(saltoAddr);
        const nicknames = registery.getType(new elements_1.TypeID({ adapter: 'salto', name: ' nicknamed' }), elements_1.PrimitiveTypes.LIST);
        const nicknames2 = nicknames.clone(annotations);
        expect(nicknames).not.toBe(nicknames2);
        expect(nicknames2).toMatchObject(nicknames);
        const prim = registery.getType(new elements_1.TypeID({ adapter: '', name: 'prim' }), elements_1.PrimitiveTypes.STRING);
        const prim2 = prim.clone(annotations);
        expect(prim).not.toBe(prim2);
        expect(prim2).toMatchObject(prim);
    });
    it('should provide type guard for all types', () => {
        const registery = new elements_1.TypesRegistry();
        const pt = registery.getType(new elements_1.TypeID({ adapter: 'test', name: 'pt1' }), elements_1.PrimitiveTypes.STRING);
        const ot = registery.getType(new elements_1.TypeID({ adapter: 'test', name: 'ot1' }), elements_1.PrimitiveTypes.OBJECT);
        const lt = registery.getType(new elements_1.TypeID({ adapter: 'test', name: 'lt1' }), elements_1.PrimitiveTypes.LIST);
        expect(elements_1.isObjectType(ot)).toBeTruthy();
        expect(elements_1.isListType(lt)).toBeTruthy();
        expect(elements_1.isPrimitiveType(pt)).toBeTruthy();
    });
    it('should allow clone on a list element with an element type', () => {
        const registery = new elements_1.TypesRegistry();
        const pt = registery.getType(new elements_1.TypeID({ adapter: 'test', name: 'pt1' }), elements_1.PrimitiveTypes.STRING);
        const lt1 = registery.getType(new elements_1.TypeID({ adapter: 'test', name: 'list1' }), elements_1.PrimitiveTypes.LIST);
        lt1.elementType = pt;
        const lt2 = lt1.clone();
        expect(lt1).not.toBe(lt2);
        expect(lt2).toMatchObject(lt1);
    });
    it('should allow to init a registery with types', () => {
        const pt = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        const pt2 = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim2' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        const registery = new elements_1.TypesRegistry([pt, pt2]);
        expect(registery.hasType(pt.typeID)).toBe(true);
        expect(registery.hasType(pt2.typeID)).toBe(true);
        const allTypes = registery.getAllTypes();
        expect(allTypes).toContain(pt);
        expect(allTypes).toContain(pt2);
    });
    it('should allow basic registery merge', () => {
        const pt = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        const pt2 = new elements_1.PrimitiveType({
            typeID: new elements_1.TypeID({ adapter: 'test', name: 'prim2' }),
            primitive: elements_1.PrimitiveTypes.STRING,
            annotations: {},
            annotationsValues: {},
        });
        const registery = new elements_1.TypesRegistry([pt]);
        const registery2 = new elements_1.TypesRegistry([pt2]);
        const mergedReg = registery.merge(registery2);
        expect(mergedReg.hasType(pt.typeID)).toBe(true);
        expect(mergedReg.hasType(pt2.typeID)).toBe(true);
    });
});
//# sourceMappingURL=elements.test.js.map