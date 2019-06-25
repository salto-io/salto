import {
  ObjectType,
  ListType,
  PrimitiveTypes,
  PrimitiveType,
  TypesRegistry,
  isObjectType,
  isListType,
  isPrimitiveType,
  TypeID,
} from '../src/core/elements'

describe('Test elements.ts', () => {
  it('should create a basic primitive type with all params passed to the constructor', () => {
    const ptStr = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    expect(ptStr.typeID).toEqual({ adapter: 'test', name: 'prim' })
    expect(ptStr.primitive).toBe(PrimitiveTypes.STRING)
    const ptNum = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {},
      annotationsValues: {},
    })
    expect(ptNum.typeID).toEqual({ adapter: 'test', name: 'prim' })
    expect(ptNum.primitive).toBe(PrimitiveTypes.NUMBER)
  })
  it('should create a basic object type with all params passed to the constructor', () => {
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
    const ot = new ObjectType({
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
    expect(ot.typeID).toEqual({ adapter: 'test', name: 'obj' })
    expect(ot.fields.num_field).toBeInstanceOf(PrimitiveType)
    expect(ot.fields.str_field).toBeInstanceOf(PrimitiveType)
  })
  it('should allow basic list type creations withh all params passed to the constructor', () => {
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
    const ot = new ObjectType({
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

    const lt = new ListType({
      typeID: new TypeID({ adapter: 'test', name: 'list' }),
      elementType: ot,
      annotations: {},
      annotationsValues: {},
    })
    expect(lt.typeID).toEqual({ adapter: 'test', name: 'list' })
    expect(lt.elementType).toBe(ot)
  })

  it('should allow to create types from the correct type them using registery.getType method', () => {
    const registery = new TypesRegistry()
    // Check you can create Primitive Type
    const st = registery.getType(
      new TypeID({ adapter: '', name: 'string' }),
      PrimitiveTypes.STRING,
    )
    expect(st).toBeInstanceOf(PrimitiveType)
    const ot = registery.getType(
      new TypeID({ adapter: '', name: 'object' }),
      PrimitiveTypes.OBJECT,
    )
    expect(ot).toBeInstanceOf(ObjectType)
    const lt = registery.getType(
      new TypeID({ adapter: '', name: 'list' }),
      PrimitiveTypes.LIST,
    )
    expect(lt).toBeInstanceOf(ListType)
  })

  it('should reuse created types', () => {
    const registery = new TypesRegistry()
    const st = registery.getType(
      new TypeID({ adapter: '', name: 'string' }),
      PrimitiveTypes.STRING,
    )
    const st2 = registery.getType(
      new TypeID({ adapter: '', name: 'string' }),
      PrimitiveTypes.STRING,
    )
    const st3 = registery.getType(
      new TypeID({ adapter: '', name: 'string2' }),
      PrimitiveTypes.STRING,
    )
    expect(st).toBe(st2)
    expect(st).not.toBe(st3)
  })

  it('should register types that were registered explictly', () => {
    const registery = new TypesRegistry()
    const ptStr = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'out_reg' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    registery.registerType(ptStr)
    const ptStr2 = registery.getType(new TypeID({ adapter: 'test', name: 'out_reg' }))
    expect(ptStr).toBe(ptStr2)
  })

  it('should not allow registeration of same type id twice', () => {
    const registery = new TypesRegistry()
    const ptStr = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'out_reg' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ptStr2 = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'out_reg' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    registery.registerType(ptStr)
    expect(() => {
      registery.registerType(ptStr2)
    }).toThrow()
  })


  it('should allow clone without annotations.', () => {
    const registery = new TypesRegistry()
    const saltoAddr = registery.getType(new TypeID({ adapter: 'salto', name: 'address' }))
    saltoAddr.annotations.label = registery.getType(
      new TypeID({ adapter: '', name: 'string' }),
    )
    saltoAddr.fields.country = registery.getType(
      new TypeID({ adapter: '', name: 'string' }),
    )
    saltoAddr.fields.city = registery.getType(new TypeID({ adapter: '', name: 'string' }))

    const saltoAddr2 = saltoAddr.clone()
    expect(saltoAddr).not.toBe(saltoAddr2)
    expect(saltoAddr).toEqual(saltoAddr2)

    const nicknames = registery.getType(
      new TypeID({ adapter: 'salto', name: ' nicknamed' }),
      PrimitiveTypes.LIST,
    )
    const nicknames2 = nicknames.clone()

    expect(nicknames).not.toBe(nicknames2)
    expect(nicknames).toEqual(nicknames2)

    const prim = registery.getType(
      new TypeID({ adapter: '', name: 'prim' }),
      PrimitiveTypes.STRING,
    )
    const prim2 = prim.clone()

    expect(prim).not.toBe(prim2)
    expect(prim).toEqual(prim2)
  })

  it('should allow clone with annotations.', () => {
    const registery = new TypesRegistry()
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const annotations: { [key: string]: any } = {}
    annotations.label = 'label'

    // Object
    const saltoAddr = registery.getType(new TypeID({ adapter: 'salto', name: 'address' }))
    saltoAddr.fields.country = registery.getType(
      new TypeID({ adapter: '', name: 'string' }),
    )
    saltoAddr.fields.city = registery.getType(new TypeID({ adapter: '', name: 'string' }))

    const saltoAddr2 = saltoAddr.clone(annotations)
    expect(saltoAddr).not.toBe(saltoAddr2)
    expect(saltoAddr2).toMatchObject(saltoAddr)

    const nicknames = registery.getType(
      new TypeID({ adapter: 'salto', name: ' nicknamed' }),
      PrimitiveTypes.LIST,
    )
    const nicknames2 = nicknames.clone(annotations)

    expect(nicknames).not.toBe(nicknames2)
    expect(nicknames2).toMatchObject(nicknames)

    const prim = registery.getType(
      new TypeID({ adapter: '', name: 'prim' }),
      PrimitiveTypes.STRING,
    )
    const prim2 = prim.clone(annotations)

    expect(prim).not.toBe(prim2)
    expect(prim2).toMatchObject(prim)
  })

  it('should provide type guard for all types', () => {
    const registery = new TypesRegistry()
    const pt = registery.getType(
      new TypeID({ adapter: 'test', name: 'pt1' }),
      PrimitiveTypes.STRING,
    )
    const ot = registery.getType(
      new TypeID({ adapter: 'test', name: 'ot1' }),
      PrimitiveTypes.OBJECT,
    )
    const lt = registery.getType(
      new TypeID({ adapter: 'test', name: 'lt1' }),
      PrimitiveTypes.LIST,
    )
    expect(isObjectType(ot)).toBeTruthy()
    expect(isListType(lt)).toBeTruthy()
    expect(isPrimitiveType(pt)).toBeTruthy()
  })

  it('should allow clone on a list element with an element type', () => {
    const registery = new TypesRegistry()
    const pt = registery.getType(
      new TypeID({ adapter: 'test', name: 'pt1' }),
      PrimitiveTypes.STRING,
    )
    const lt1 = registery.getType(
      new TypeID({ adapter: 'test', name: 'list1' }),
      PrimitiveTypes.LIST,
    )
    lt1.elementType = pt
    const lt2 = lt1.clone()
    expect(lt1).not.toBe(lt2)
    expect(lt2).toMatchObject(lt1)
  })

  it('should allow to init a registery with types', () => {
    const pt = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const pt2 = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim2' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const registery = new TypesRegistry([pt, pt2])
    expect(registery.hasType(pt.typeID)).toBe(true)
    expect(registery.hasType(pt2.typeID)).toBe(true)

    const allTypes = registery.getAllTypes()
    expect(allTypes).toContain(pt)
    expect(allTypes).toContain(pt2)
  })

  it('should allow basic registery merge', () => {
    const pt = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const pt2 = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'prim2' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const registery = new TypesRegistry([pt])
    const registery2 = new TypesRegistry([pt2])
    const mergedReg = registery.merge(registery2)

    expect(mergedReg.hasType(pt.typeID)).toBe(true)
    expect(mergedReg.hasType(pt2.typeID)).toBe(true)
  })
})
