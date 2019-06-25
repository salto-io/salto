import {
  ObjectType,
  ListType,
  PrimitiveTypes,
  PrimitiveType,
  getType,
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

  it('should allow to create types from the correct type them using getType method', () => {
    // Check you can create Primitive Type
    const st = getType(
      new TypeID({ adapter: '', name: 'string' }),
      PrimitiveTypes.STRING,
    )
    expect(st).toBeInstanceOf(PrimitiveType)
    const ot = getType(
      new TypeID({ adapter: '', name: 'object' }),
      PrimitiveTypes.OBJECT,
    )
    expect(ot).toBeInstanceOf(ObjectType)
    const lt = getType(
      new TypeID({ adapter: '', name: 'list' }),
      PrimitiveTypes.LIST,
    )
    expect(lt).toBeInstanceOf(ListType)
  })

  it('should reuse created types', () => {
    // Check you can create Primitive Type
    const st = getType(
      new TypeID({ adapter: '', name: 'string' }),
      PrimitiveTypes.STRING,
    )
    const st2 = getType(
      new TypeID({ adapter: '', name: 'string' }),
      PrimitiveTypes.STRING,
    )
    const st3 = getType(
      new TypeID({ adapter: '', name: 'string2' }),
      PrimitiveTypes.STRING,
    )
    expect(st).toBe(st2)
    expect(st).not.toBe(st3)
  })

  it('should register types that were created explictly using the constructor', () => {
    // Check you can create Primitive Type
    const ptStr = new PrimitiveType({
      typeID: new TypeID({ adapter: 'test', name: 'out_reg' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ptStr2 = getType(new TypeID({ adapter: 'test', name: 'out_reg' }))
    expect(ptStr).toBe(ptStr2)
  })

  it('should allow clone without annotations.', () => {
    // Check you can create Primitive Type

    // Object
    const saltoAddr = getType(new TypeID({ adapter: 'salto', name: 'address' }))
    saltoAddr.annotations.label = getType(
      new TypeID({ adapter: '', name: 'string' }),
    )
    saltoAddr.fields.country = getType(
      new TypeID({ adapter: '', name: 'string' }),
    )
    saltoAddr.fields.city = getType(new TypeID({ adapter: '', name: 'string' }))

    const saltoAddr2 = saltoAddr.clone()
    expect(saltoAddr).not.toBe(saltoAddr2)
    expect(saltoAddr).toEqual(saltoAddr2)

    const nicknames = getType(
      new TypeID({ adapter: 'salto', name: ' nicknamed' }),
      PrimitiveTypes.LIST,
    )
    const nicknames2 = nicknames.clone()

    expect(nicknames).not.toBe(nicknames2)
    expect(nicknames).toEqual(nicknames2)

    const prim = getType(
      new TypeID({ adapter: '', name: 'prim' }),
      PrimitiveTypes.STRING,
    )
    const prim2 = prim.clone()

    expect(prim).not.toBe(prim2)
    expect(prim).toEqual(prim2)
  })

  it('should allow clone with annotations.', () => {
    // Check you can create Primitive Type
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const annotations: { [key: string]: any } = {}
    annotations.label = 'label'

    // Object
    const saltoAddr = getType(new TypeID({ adapter: 'salto', name: 'address' }))
    saltoAddr.fields.country = getType(
      new TypeID({ adapter: '', name: 'string' }),
    )
    saltoAddr.fields.city = getType(new TypeID({ adapter: '', name: 'string' }))

    const saltoAddr2 = saltoAddr.clone(annotations)
    expect(saltoAddr).not.toBe(saltoAddr2)
    expect(saltoAddr2).toMatchObject(saltoAddr)

    const nicknames = getType(
      new TypeID({ adapter: 'salto', name: ' nicknamed' }),
      PrimitiveTypes.LIST,
    )
    const nicknames2 = nicknames.clone(annotations)

    expect(nicknames).not.toBe(nicknames2)
    expect(nicknames2).toMatchObject(nicknames)

    const prim = getType(
      new TypeID({ adapter: '', name: 'prim' }),
      PrimitiveTypes.STRING,
    )
    const prim2 = prim.clone(annotations)

    expect(prim).not.toBe(prim2)
    expect(prim2).toMatchObject(prim)
  })

  it('should provide type guard for all types', () => {
    const pt = getType(
      new TypeID({ adapter: 'test', name: 'pt1' }),
      PrimitiveTypes.STRING,
    )
    const ot = getType(
      new TypeID({ adapter: 'test', name: 'ot1' }),
      PrimitiveTypes.OBJECT,
    )
    const lt = getType(
      new TypeID({ adapter: 'test', name: 'lt1' }),
      PrimitiveTypes.LIST,
    )
    expect(isObjectType(ot)).toBeTruthy()
    expect(isListType(lt)).toBeTruthy()
    expect(isPrimitiveType(pt)).toBeTruthy()
  })

  it('should allow clone on a list element with an element type', () => {
    const pt = getType(
      new TypeID({ adapter: 'test', name: 'pt1' }),
      PrimitiveTypes.STRING,
    )
    const lt1 = getType(
      new TypeID({ adapter: 'test', name: 'list1' }),
      PrimitiveTypes.LIST,
    )
    lt1.elementType = pt
    const lt2 = lt1.clone()
    expect(lt1).not.toBe(lt2)
    expect(lt2).toMatchObject(lt1)
  })
})
