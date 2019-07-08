import {
  ObjectType,
  ListType,
  PrimitiveTypes,
  PrimitiveType,
  ElementsRegistry,
  isObjectType,
  isListType,
  isPrimitiveType,
  ElemID,
  InstanceElement,
} from '../src/elements'

describe('Test elements.ts', () => {
  it('should create a basic primitive type with all params passed to the constructor', () => {
    const ptStr = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    expect(ptStr.elemID).toEqual({ adapter: 'test', name: 'prim' })
    expect(ptStr.primitive).toBe(PrimitiveTypes.STRING)
    const ptNum = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {},
      annotationsValues: {},
    })
    expect(ptNum.elemID).toEqual({ adapter: 'test', name: 'prim' })
    expect(ptNum.primitive).toBe(PrimitiveTypes.NUMBER)
  })
  it('should create a basic object type with all params passed to the constructor', () => {
    const ptStr = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ptNum = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {},
      annotationsValues: {},
    })
    const ot = new ObjectType({
      elemID: new ElemID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: ptNum,
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: ptStr,
      },
      annotations: {},
      annotationsValues: {},
    })
    expect(ot.elemID).toEqual({ adapter: 'test', name: 'obj' })
    expect(ot.fields.num_field).toBeInstanceOf(PrimitiveType)
    expect(ot.fields.str_field).toBeInstanceOf(PrimitiveType)
  })

  it('should get fields not in other', () => {
    const ptStr = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
    })
    const ptNum = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.NUMBER,
    })
    const ot1 = new ObjectType({
      elemID: new ElemID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: ptNum,
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: ptStr,
      },
    })
    const ot2 = new ObjectType({
      elemID: new ElemID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: ptNum,
      },
    })

    expect(ot1.getFieldsThatAreNotInOther(ot2).join('')).toBe('str_field')
  })

  it('should get intersection of fields', () => {
    const ptStr = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
    })
    const ptNum = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.NUMBER,
    })
    const ot1 = new ObjectType({
      elemID: new ElemID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: ptNum,
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: ptStr,
      },
    })
    const ot2 = new ObjectType({
      elemID: new ElemID({ adapter: 'test', name: 'obj' }),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: ptNum,
      },
    })

    expect(ot1.getMutualFieldsWithOther(ot2).join('')).toBe('num_field')
  })

  it('should allow basic list type creations withh all params passed to the constructor', () => {
    const ptStr = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ptNum = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {},
      annotationsValues: {},
    })
    const ot = new ObjectType({
      elemID: new ElemID({ adapter: 'test', name: 'obj' }),
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
      elemID: new ElemID({ adapter: 'test', name: 'list' }),
      elementType: ot,
      annotations: {},
      annotationsValues: {},
    })
    expect(lt.elemID).toEqual({ adapter: 'test', name: 'list' })
    expect(lt.elementType).toBe(ot)
  })

  it('should allow to create types from the correct type them using registery.getElement method', () => {
    const registery = new ElementsRegistry()
    // Check you can create Primitive Type
    const st = registery.getElement(
      new ElemID({ adapter: '', name: 'string' }),
      PrimitiveTypes.STRING,
    )
    expect(st).toBeInstanceOf(PrimitiveType)
    const ot = registery.getElement(
      new ElemID({ adapter: '', name: 'object' }),
      PrimitiveTypes.OBJECT,
    )
    expect(ot).toBeInstanceOf(ObjectType)
    const lt = registery.getElement(
      new ElemID({ adapter: '', name: 'list' }),
      PrimitiveTypes.LIST,
    )
    expect(lt).toBeInstanceOf(ListType)
  })

  it('should reuse created types', () => {
    const registery = new ElementsRegistry()
    const st = registery.getElement(
      new ElemID({ adapter: '', name: 'string' }),
      PrimitiveTypes.STRING,
    )
    const st2 = registery.getElement(
      new ElemID({ adapter: '', name: 'string' }),
      PrimitiveTypes.STRING,
    )
    const st3 = registery.getElement(
      new ElemID({ adapter: '', name: 'string2' }),
      PrimitiveTypes.STRING,
    )
    expect(st).toBe(st2)
    expect(st).not.toBe(st3)
  })

  it('should register types that were registered explictly', () => {
    const registery = new ElementsRegistry()
    const ptStr = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'out_reg' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    registery.registerElement(ptStr)
    const ptStr2 = registery.getElement(new ElemID({ adapter: 'test', name: 'out_reg' }))
    expect(ptStr).toBe(ptStr2)
  })

  it('should not allow registeration of same type id twice', () => {
    const registery = new ElementsRegistry()
    const ptStr = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'out_reg' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ptStr2 = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'out_reg' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    registery.registerElement(ptStr)
    expect(() => {
      registery.registerElement(ptStr2)
    }).toThrow()
  })


  it('should allow clone without annotations.', () => {
    const registery = new ElementsRegistry()
    const saltoAddr = registery.getElement(new ElemID({ adapter: 'salto', name: 'address' }))
    saltoAddr.annotations.label = registery.getElement(
      new ElemID({ adapter: '', name: 'string' }),
    )
    saltoAddr.fields.country = registery.getElement(
      new ElemID({ adapter: '', name: 'string' }),
    )
    saltoAddr.fields.city = registery.getElement(new ElemID({ adapter: '', name: 'string' }))

    const saltoAddr2 = saltoAddr.clone()
    expect(saltoAddr).not.toBe(saltoAddr2)
    expect(saltoAddr).toEqual(saltoAddr2)

    const nicknames = registery.getElement(
      new ElemID({ adapter: 'salto', name: ' nicknamed' }),
      PrimitiveTypes.LIST,
    )
    const nicknames2 = nicknames.clone()

    expect(nicknames).not.toBe(nicknames2)
    expect(nicknames).toEqual(nicknames2)

    const prim = registery.getElement(
      new ElemID({ adapter: '', name: 'prim' }),
      PrimitiveTypes.STRING,
    )
    const prim2 = prim.clone()

    expect(prim).not.toBe(prim2)
    expect(prim).toEqual(prim2)
  })

  it('should allow clone with annotations.', () => {
    const registery = new ElementsRegistry()
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const annotations: { [key: string]: any } = {}
    annotations.label = 'label'

    // Object
    const saltoAddr = registery.getElement(new ElemID({ adapter: 'salto', name: 'address' }))
    saltoAddr.fields.country = registery.getElement(
      new ElemID({ adapter: '', name: 'string' }),
    )
    saltoAddr.fields.city = registery.getElement(new ElemID({ adapter: '', name: 'string' }))

    const saltoAddr2 = saltoAddr.clone(annotations)
    expect(saltoAddr).not.toBe(saltoAddr2)
    expect(saltoAddr2).toMatchObject(saltoAddr)

    const nicknames = registery.getElement(
      new ElemID({ adapter: 'salto', name: ' nicknamed' }),
      PrimitiveTypes.LIST,
    )
    const nicknames2 = nicknames.clone(annotations)

    expect(nicknames).not.toBe(nicknames2)
    expect(nicknames2).toMatchObject(nicknames)

    const prim = registery.getElement(
      new ElemID({ adapter: '', name: 'prim' }),
      PrimitiveTypes.STRING,
    )
    const prim2 = prim.clone(annotations)

    expect(prim).not.toBe(prim2)
    expect(prim2).toMatchObject(prim)
  })

  it('should provide type guard for all types', () => {
    const registery = new ElementsRegistry()
    const pt = registery.getElement(
      new ElemID({ adapter: 'test', name: 'pt1' }),
      PrimitiveTypes.STRING,
    )
    const ot = registery.getElement(
      new ElemID({ adapter: 'test', name: 'ot1' }),
      PrimitiveTypes.OBJECT,
    )
    const lt = registery.getElement(
      new ElemID({ adapter: 'test', name: 'lt1' }),
      PrimitiveTypes.LIST,
    )
    expect(isObjectType(ot)).toBeTruthy()
    expect(isListType(lt)).toBeTruthy()
    expect(isPrimitiveType(pt)).toBeTruthy()
  })

  it('should allow clone on a list element with an element type', () => {
    const registery = new ElementsRegistry()
    const pt = registery.getElement(
      new ElemID({ adapter: 'test', name: 'pt1' }),
      PrimitiveTypes.STRING,
    )
    const lt1 = registery.getElement(
      new ElemID({ adapter: 'test', name: 'list1' }),
      PrimitiveTypes.LIST,
    )
    lt1.elementType = pt
    const lt2 = lt1.clone()
    expect(lt1).not.toBe(lt2)
    expect(lt2).toMatchObject(lt1)
  })

  it('should allow to init a registery with types', () => {
    const pt = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const pt2 = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim2' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const registery = new ElementsRegistry([pt, pt2])
    expect(registery.hasElement(pt.elemID)).toBe(true)
    expect(registery.hasElement(pt2.elemID)).toBe(true)

    const allTypes = registery.getAllElements()
    expect(allTypes).toContain(pt)
    expect(allTypes).toContain(pt2)
  })

  it('should allow basic registery merge', () => {
    const pt = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const pt2 = new PrimitiveType({
      elemID: new ElemID({ adapter: 'test', name: 'prim2' }),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const registery = new ElementsRegistry([pt])
    const registery2 = new ElementsRegistry([pt2])
    const mergedReg = registery.merge(registery2)

    expect(mergedReg.hasElement(pt.elemID)).toBe(true)
    expect(mergedReg.hasElement(pt2.elemID)).toBe(true)
  })

  it('should create a basic instance element', () => {
    const registery = new ElementsRegistry()
    const ot = registery.getElement(
      new ElemID({ adapter: 'test', name: 'ot1' }),
      PrimitiveTypes.OBJECT,
    )
    const inst = new InstanceElement(new ElemID({ adapter: 'test', name: 'test' }), ot, { test: 'test' })
    expect(inst.elemID).toEqual(new ElemID({ adapter: 'test', name: 'test' }))
    expect(inst.type).toBe(ot)
    expect(inst.value.test).toBe('test')
  })

  it('should create a basic instance element from registery', () => {
    const registery = new ElementsRegistry()
    const ot = registery.getElement(
      new ElemID({ adapter: 'test', name: 'ot1' }),
      PrimitiveTypes.OBJECT,
    )
    const inst = registery.getElement(
      new ElemID({ adapter: 'test', name: 'inst' }),
      ot,
    )
    expect(inst.type).toBe(ot)
  })

  it('should access nested annotation values', () => {
    const elem = new ObjectType({
      elemID: new ElemID({ adapter: 'test', name: 'ot1' }),
      annotationsValues: {
        test: {
          nested: {
            value: 1,
          },
        },
      },
    })

    expect(elem.getAnnotationValue('test', 'nested', 'value')).toEqual(1)
    expect(elem.getAnnotationValue('test', 'non', 'existing')).toBe(undefined)
  })
})
