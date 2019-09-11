import _ from 'lodash'
import {
  ObjectType,
  PrimitiveTypes,
  PrimitiveType,
  ElementsRegistry,
  isObjectType,
  isPrimitiveType,
  ElemID,
  InstanceElement,
  Field,
  isEqualElements,
  isInstanceElement,
  isType,
} from '../src/elements'

describe('Test elements.ts', () => {
  it('should create a basic primitive type with all params passed to the constructor', () => {
    const ptStr = new PrimitiveType({
      elemID: new ElemID('test', 'prim'),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    expect(ptStr.elemID.adapter).toEqual('test')
    expect(ptStr.elemID.name).toEqual('prim')
    expect(ptStr.primitive).toBe(PrimitiveTypes.STRING)
    const ptNum = new PrimitiveType({
      elemID: new ElemID('test', 'prim'),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {},
      annotationsValues: {},
    })
    expect(ptNum.elemID.adapter).toEqual('test')
    expect(ptNum.elemID.name).toEqual('prim')
    expect(ptNum.primitive).toBe(PrimitiveTypes.NUMBER)
  })
  it('should create a basic object type with all params passed to the constructor', () => {
    const ptStr = new PrimitiveType({
      elemID: new ElemID('test', 'prim'),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ptNum = new PrimitiveType({
      elemID: new ElemID('test', 'prim'),
      primitive: PrimitiveTypes.NUMBER,
      annotations: {},
      annotationsValues: {},
    })
    const ot = new ObjectType({
      elemID: new ElemID('test', 'obj'),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: new Field(new ElemID('test', 'obj'), 'num_field', ptNum),
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: new Field(new ElemID('test', 'obj'), 'str_field', ptStr),
      },
      annotations: {},
      annotationsValues: {},
    })
    expect(ot.elemID.adapter).toEqual('test')
    expect(ot.elemID.name).toEqual('obj')
    expect(ot.fields.num_field.type).toBeInstanceOf(PrimitiveType)
    expect(ot.fields.str_field.type).toBeInstanceOf(PrimitiveType)
  })

  it('should get fields not in other', () => {
    const ptStr = new PrimitiveType({
      elemID: new ElemID('test', 'prim'),
      primitive: PrimitiveTypes.STRING,
    })
    const ptNum = new PrimitiveType({
      elemID: new ElemID('test', 'prim'),
      primitive: PrimitiveTypes.NUMBER,
    })
    const ot1 = new ObjectType({
      elemID: new ElemID('test', 'obj'),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: new Field(new ElemID('test', 'obj'), 'num_field', ptNum),
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: new Field(new ElemID('test', 'obj'), 'str_field', ptStr),
      },
    })
    const ot2 = new ObjectType({
      elemID: new ElemID('test', 'obj'),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: new Field(new ElemID('test', 'obj'), 'num_field', ptNum),
      },
    })

    expect(ot1.getFieldsThatAreNotInOther(ot2)).toEqual([ot1.fields.str_field])
  })

  it('Should test getValuesThatNotInPrevOrDifferent func', () => {
    const prevInstance = new InstanceElement(new ElemID('test', 'diff'), new ObjectType({
      elemID: new ElemID('test', 'diff'),
      fields: {
      },
      annotations: {},
      annotationsValues: {
      },
    }),
    {
      userPermissions: [
        {
          enabled: false,
          name: 'ConvertLeads',
        },
      ],
      fieldPermissions: [
        {
          field: 'Lead.Fax',
          readable: false,
          editable: false,
        },
      ],
      description: 'old unit test instance profile',
    },)

    const newInstance = new InstanceElement(new ElemID('test', 'diff'), new ObjectType({
      elemID: new ElemID('test', 'diff'),
      fields: {
      },
      annotations: {},
      annotationsValues: {
      },
    }),
    {
      userPermissions: [
        {
          enabled: false,
          name: 'ConvertLeads',
        },
      ],
      fieldPermissions: [
        {
          field: 'Lead.Fax',
          readable: false,
          editable: false,
        },
        {
          editable: false,
          field: 'Account.AccountNumber',
          readable: false,
        },
      ],
      applicationVisibilities: [
        {
          application: 'standard__ServiceConsole',
          default: false,
          visible: true,
        },
      ],
      description: 'new unit test instance profile',
    },)

    expect(newInstance.getValuesThatNotInPrevOrDifferent(prevInstance.value)).toMatchObject({
      fieldPermissions: [
        {
          field: 'Lead.Fax',
          readable: false,
          editable: false,
        },
        {
          editable: false,
          field: 'Account.AccountNumber',
          readable: false,
        },
      ],
      applicationVisibilities: [
        {
          application: 'standard__ServiceConsole',
          default: false,
          visible: true,
        },
      ],
      description: 'new unit test instance profile',
    },)
  })

  it('should get intersection of fields', () => {
    const ptStr = new PrimitiveType({
      elemID: new ElemID('test', 'prim'),
      primitive: PrimitiveTypes.STRING,
    })
    const ptNum = new PrimitiveType({
      elemID: new ElemID('test', 'prim'),
      primitive: PrimitiveTypes.NUMBER,
    })
    const ot1 = new ObjectType({
      elemID: new ElemID('test', 'obj'),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: new Field(new ElemID('test', 'obj'), 'num_field', ptNum),
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: new Field(new ElemID('test', 'obj'), 'str_field', ptStr),
      },
    })
    const ot2 = new ObjectType({
      elemID: new ElemID('test', 'obj'),
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: new Field(new ElemID('test', 'obj'), 'num_field', ptNum),
      },
    })

    expect(ot1.getMutualFieldsWithOther(ot2)).toEqual([ot1.fields.num_field])
  })

  it('should allow to create types from the correct type them using registery.getElement method', () => {
    const registery = new ElementsRegistry()
    // Check you can create Primitive Type
    const st = registery.getElement(
      new ElemID('', 'string'),
      PrimitiveTypes.STRING,
    )
    expect(st).toBeInstanceOf(PrimitiveType)
    const ot = registery.getElement(
      new ElemID('', 'object')
    )
    expect(ot).toBeInstanceOf(ObjectType)
  })

  it('should reuse created types', () => {
    const registery = new ElementsRegistry()
    const st = registery.getElement(
      new ElemID('', 'string'),
      PrimitiveTypes.STRING,
    )
    const st2 = registery.getElement(
      new ElemID('', 'string'),
      PrimitiveTypes.STRING,
    )
    const st3 = registery.getElement(
      new ElemID('', 'string2'),
      PrimitiveTypes.STRING,
    )
    expect(st).toBe(st2)
    expect(st).not.toBe(st3)
  })

  it('should register types that were registered explictly', () => {
    const registery = new ElementsRegistry()
    const ptStr = new PrimitiveType({
      elemID: new ElemID('test', 'out_reg'),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    registery.registerElement(ptStr)
    const ptStr2 = registery.getElement(new ElemID('test', 'out_reg'))
    expect(ptStr).toBe(ptStr2)
  })

  it('should not allow registeration of same type id twice', () => {
    const registery = new ElementsRegistry()
    const ptStr = new PrimitiveType({
      elemID: new ElemID('test', 'out_reg'),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ptStr2 = new PrimitiveType({
      elemID: new ElemID('test', 'out_reg'),
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
    const saltoAddr = registery.getElement(new ElemID('salto', 'address'))
    saltoAddr.annotations.label = registery.getElement(
      new ElemID('', 'string'),
    )
    saltoAddr.fields.country = registery.getElement(
      new ElemID('', 'string'),
    )
    saltoAddr.fields.city = registery.getElement(new ElemID('', 'string'))

    const saltoAddr2 = saltoAddr.clone()
    expect(saltoAddr).not.toBe(saltoAddr2)
    expect(saltoAddr).toEqual(saltoAddr2)

    const prim = registery.getElement(
      new ElemID('', 'prim'),
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
    const stringType = registery.getElement(new ElemID('', 'string'))
    const saltoAddr = registery.getElement(new ElemID('salto', 'address'))
    saltoAddr.fields.country = new Field(saltoAddr.elemID, 'country', stringType)
    saltoAddr.fields.city = new Field(saltoAddr.elemID, 'city', stringType)

    const saltoAddr2 = saltoAddr.clone(annotations)
    expect(saltoAddr).not.toBe(saltoAddr2)
    expect(saltoAddr2).toMatchObject(saltoAddr)

    const prim = registery.getElement(
      new ElemID('', 'prim'),
      PrimitiveTypes.STRING,
    )
    const prim2 = prim.clone(annotations)

    expect(prim).not.toBe(prim2)
    expect(prim2).toMatchObject(prim)
  })

  it('should provide type guard for all types', () => {
    const registery = new ElementsRegistry()
    const pt = registery.getElement(
      new ElemID('test', 'pt1'),
      PrimitiveTypes.STRING,
    )
    const ot = registery.getElement(
      new ElemID('test', 'ot1')
    )
    expect(isObjectType(ot)).toBeTruthy()
    expect(isPrimitiveType(pt)).toBeTruthy()
  })

  it('should allow to init a registery with types', () => {
    const pt = new PrimitiveType({
      elemID: new ElemID('test', 'prim'),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const pt2 = new PrimitiveType({
      elemID: new ElemID('test', 'prim2'),
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
      elemID: new ElemID('test', 'prim'),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const pt2 = new PrimitiveType({
      elemID: new ElemID('test', 'prim2'),
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
      new ElemID('test', 'ot1')
    )
    const inst = new InstanceElement(new ElemID('test', 'test'), ot, { test: 'test' })
    expect(inst.elemID).toEqual(new ElemID('test', 'test'))
    expect(inst.type).toBe(ot)
    expect(inst.value.test).toBe('test')
  })

  it('should create a basic instance element from registery', () => {
    const registery = new ElementsRegistry()
    const ot = registery.getElement(
      new ElemID('test', 'ot1')
    )
    const inst = registery.getElement(
      new ElemID('test', 'inst'),
      ot,
    )
    expect(inst.type).toBe(ot)
  })

  it('should create fullname', () => {
    const regName = new ElemID('adapter', 'name').getFullName()
    const nameMissing = new ElemID('adapter', '').getFullName()
    const adapterMissing = new ElemID('', 'name').getFullName()
    const config = new ElemID('adapter', ElemID.CONFIG_INSTANCE_NAME).getFullName()

    expect(regName).toBe('adapter_name')
    expect(nameMissing).toBe('adapter')
    expect(adapterMissing).toBe('name')
    expect(config).toBe('adapter')
  })

  describe('isEqualElements and type guards', () => {
    const pt = new PrimitiveType({
      elemID: new ElemID('test', 'prim'),
      primitive: PrimitiveTypes.STRING,
      annotations: {},
      annotationsValues: {},
    })
    const ot = new ObjectType({
      elemID: new ElemID('test', 'obj'),
      fields: {
        str: new Field(new ElemID('test', 'obj'), 'str_field', pt),
      },
      annotations: {
        anno: pt,
      },
      annotationsValues: {},
    })
    const strField = new Field(new ElemID('test', 'obj'), 'str_field', pt)
    const inst = new InstanceElement(new ElemID('test', 'inst'), ot, { str: 'test' })
    it('should identify equal primitive types', () => {
      const pt2 = _.cloneDeep(pt)
      expect(isEqualElements(pt, pt2)).toBe(true)
    })

    it('should identify equal object types', () => {
      const ot2 = _.cloneDeep(ot)
      expect(isEqualElements(ot, ot2)).toBe(true)
    })

    it('should identify equal fields', () => {
      const strField2 = _.cloneDeep(strField)
      expect(isEqualElements(strField, strField2)).toBe(true)
    })

    it('should identify equal instance elements', () => {
      const inst2 = _.cloneDeep(inst)
      expect(isEqualElements(inst, inst2)).toBe(true)
    })

    it('should identify one undefined as not euqal', () => {
      expect(isEqualElements(inst, undefined)).toBe(false)
      expect(isEqualElements(undefined, inst)).toBe(false)
    })

    it('should identify different elements as false', () => {
      expect(isEqualElements(inst, ot)).toBe(false)
    })

    it('should identify primitive type', () => {
      expect(isPrimitiveType(pt)).toBe(true)
      expect(isPrimitiveType(inst)).toBe(false)
    })

    it('should identify types', () => {
      expect(isType(inst)).toBe(false)
      expect(isType(pt)).toBe(true)
    })

    it('should identify object types', () => {
      expect(isObjectType(inst)).toBe(false)
      expect(isObjectType(ot)).toBe(true)
    })

    it('should identify instance elements', () => {
      expect(isInstanceElement(inst)).toBe(true)
      expect(isInstanceElement(pt)).toBe(false)
    })
  })
  describe('ElemID', () => {
    const exampleId = new ElemID('adapter', 'example')
    describe('isConfig', () => {
      const configTypeId = new ElemID('adapter')
      const configInstId = new ElemID('adapter', ElemID.CONFIG_INSTANCE_NAME)
      it('should return true for config type ID', () => {
        expect(configTypeId.isConfig()).toBe(true)
      })
      it('should return true for config instance ID', () => {
        expect(configInstId.isConfig()).toBe(true)
      })
      it('should return false for other IDs', () => {
        expect(exampleId.isConfig()).toBe(false)
      })
    })
    describe('createNestedID', () => {
      it('should create an ID with one additional name part', () => {
        expect(exampleId.createNestedID('test').nameParts).toEqual(['example', 'test'])
      })
    })
  })
})
