import _ from 'lodash'
import {
  ElementsRegistry,
  ElemID,
  Field,
  InstanceElement,
  isEqualElements,
  isInstanceElement,
  isObjectType,
  isPrimitiveType,
  isType,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  Value,
} from '../src/elements'

describe('Test elements.ts', () => {
  /**   ElemIDs   * */
  const primID = new ElemID('test', 'prim')
  const elemID = new ElemID('', 'string')

  /**   primitives   * */
  const primStr = new PrimitiveType({
    elemID: primID,
    primitive: PrimitiveTypes.STRING,
    annotationTypes: {},
    annotations: {},
  })

  const prim2Str = new PrimitiveType({
    elemID: new ElemID('test', 'prim2'),
    primitive: PrimitiveTypes.STRING,
    annotationTypes: {},
    annotations: {},
  })

  const primNum = new PrimitiveType({
    elemID: primID,
    primitive: PrimitiveTypes.NUMBER,
    annotationTypes: {},
    annotations: {},
  })

  /**   object types   * */
  const ot = new ObjectType({
    elemID: new ElemID('test', 'obj'),
    fields: {
      /* eslint-disable-next-line @typescript-eslint/camelcase */
      num_field: new Field(new ElemID('test', 'obj'), 'num_field', primNum),
      /* eslint-disable-next-line @typescript-eslint/camelcase */
      str_field: new Field(new ElemID('test', 'obj'), 'str_field', primStr),
    },
    annotationTypes: {},
    annotations: {},
  })

  const ot2 = new ObjectType({
    elemID: new ElemID('test', 'obj'),
    fields: {
      /* eslint-disable-next-line @typescript-eslint/camelcase */
      num_field: new Field(new ElemID('test', 'obj'), 'num_field', primNum),
    },
  })

  let registry: ElementsRegistry

  beforeEach(async () => {
    registry = new ElementsRegistry()
  })

  it('should create a basic primitive type with all params passed to the constructor', () => {
    expect(primStr.elemID.adapter).toEqual('test')
    expect(primStr.elemID.name).toEqual('prim')
    expect(primStr.primitive).toBe(PrimitiveTypes.STRING)

    expect(primNum.elemID.adapter).toEqual('test')
    expect(primNum.elemID.name).toEqual('prim')
    expect(primNum.primitive).toBe(PrimitiveTypes.NUMBER)
  })

  it('should create a basic object type with all params passed to the constructor', () => {
    expect(ot.elemID.adapter).toEqual('test')
    expect(ot.elemID.name).toEqual('obj')
    expect(ot.fields.num_field.type).toBeInstanceOf(PrimitiveType)
    expect(ot.fields.str_field.type).toBeInstanceOf(PrimitiveType)
  })

  it('should get fields not in other', () => {
    expect(ot.getFieldsThatAreNotInOther(ot2)).toEqual([ot.fields.str_field])
  })

  it('Should test getValuesThatNotInPrevOrDifferent func', () => {
    const prevInstance = new InstanceElement(new ElemID('test', 'diff'), new ObjectType({
      elemID: new ElemID('test', 'diff'),
      fields: {
      },
      annotationTypes: {},
      annotations: {},
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
      annotationTypes: {},
      annotations: {},
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
    expect(ot.getMutualFieldsWithOther(ot2)).toEqual([ot.fields.num_field])
  })

  it('should allow to create types from the correct type them using registry.getElement method', () => {
    const st = registry.getElement(elemID, PrimitiveTypes.STRING)
    expect(st).toBeInstanceOf(PrimitiveType)

    const ot1 = registry.getElement(new ElemID('', 'object'))
    expect(ot1).toBeInstanceOf(ObjectType)
  })

  it('should reuse created types', () => {
    const st = registry.getElement(elemID, PrimitiveTypes.STRING)
    const st2 = registry.getElement(elemID, PrimitiveTypes.STRING)
    const st3 = registry.getElement(
      new ElemID('', 'string2'),
      PrimitiveTypes.STRING,
    )

    expect(st).toBe(st2)
    expect(st).not.toBe(st3)
  })

  it('should register types that were registered explicitly', () => {
    registry.registerElement(primStr)
    expect(primStr).toBe(registry.getElement(primID))
  })

  it('should not allow registration of same type id twice', () => {
    registry.registerElement(primStr)
    expect(() => { registry.registerElement(primStr) }).toThrow()
  })

  it('should allow clone without annotations.', () => {
    const saltoAddr = registry.getElement(new ElemID('salto', 'address'))
    saltoAddr.annotationTypes.label = registry.getElement(elemID)
    saltoAddr.fields.country = registry.getElement(elemID)
    saltoAddr.fields.city = registry.getElement(elemID)

    const saltoAddr2 = saltoAddr.clone()
    expect(saltoAddr).not.toBe(saltoAddr2)
    expect(saltoAddr).toEqual(saltoAddr2)

    const prim = registry.getElement(
      new ElemID('', 'prim'),
      PrimitiveTypes.STRING,
    )
    const prim2 = prim.clone()

    expect(prim).not.toBe(prim2)
    expect(prim).toEqual(prim2)
  })

  it('should allow clone with annotationTypes.', () => {
    const annotations: { [key: string]: Value } = {}
    annotations.label = 'label'

    // Object
    const stringType = registry.getElement(elemID)
    const saltoAddr = registry.getElement(new ElemID('salto', 'address'))
    saltoAddr.fields.country = new Field(saltoAddr.elemID, 'country', stringType)
    saltoAddr.fields.city = new Field(saltoAddr.elemID, 'city', stringType)

    const saltoAddr2 = saltoAddr.clone(annotations)
    expect(saltoAddr).not.toBe(saltoAddr2)
    expect(saltoAddr2).toMatchObject(saltoAddr)

    const prim = registry.getElement(
      new ElemID('', 'prim'),
      PrimitiveTypes.STRING,
    )
    const prim2 = prim.clone(annotations)

    expect(prim).not.toBe(prim2)
    expect(prim2).toMatchObject(prim)
  })

  it('should provide type guard for all types', () => {
    const pt = registry.getElement(elemID, PrimitiveTypes.STRING)
    const ot1 = registry.getElement(primID)

    expect(isObjectType(ot1)).toBeTruthy()
    expect(isPrimitiveType(pt)).toBeTruthy()
  })

  it('should allow to init a registry with types', () => {
    registry = new ElementsRegistry([prim2Str, primNum])
    expect(registry.hasElement(prim2Str.elemID)).toBeTruthy()
    expect(registry.hasElement(primNum.elemID)).toBeTruthy()

    const allTypes = registry.getAllElements()
    expect(allTypes).toContain(prim2Str)
    expect(allTypes).toContain(primNum)
  })

  it('should allow basic registry merge', () => {
    registry = new ElementsRegistry([primStr])
    const registry2 = new ElementsRegistry([prim2Str])
    const mergedReg = registry.merge(registry2)

    expect(mergedReg.hasElement(primStr.elemID)).toBeTruthy()
    expect(mergedReg.hasElement(prim2Str.elemID)).toBeTruthy()
  })

  it('should create a basic instance element', () => {
    const ot1 = registry.getElement(
      new ElemID('test', 'ot1')
    )
    const inst = new InstanceElement(new ElemID('test', 'test'), ot1, { test: 'test' })
    expect(inst.elemID).toEqual(new ElemID('test', 'test'))
    expect(inst.type).toBe(ot1)
    expect(inst.value.test).toBe('test')
  })

  it('should create a basic instance element from registry', () => {
    const ot1 = registry.getElement(elemID)
    const inst = registry.getElement(primID, ot1)

    expect(inst.type).toBe(ot1)
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
    const objT = new ObjectType({
      elemID: new ElemID('test', 'obj'),
      fields: {
        str: new Field(new ElemID('test', 'obj'), 'str_field', primStr),
      },
      annotationTypes: {
        anno: primStr,
      },
      annotations: {},
    })

    const strField = new Field(new ElemID('test', 'obj'), 'str_field', primStr)
    const inst = new InstanceElement(new ElemID('test', 'inst'), objT, { str: 'test' })

    it('should identify equal primitive types', () => {
      expect(isEqualElements(primStr, _.cloneDeep(primStr))).toBeTruthy()
    })

    it('should identify equal object types', () => {
      expect(isEqualElements(ot, _.cloneDeep(ot))).toBeTruthy()
    })

    it('should identify different object types', () => {
      const otDiff = ot.clone()
      expect(isEqualElements(ot, otDiff)).toBeTruthy()

      otDiff.isSettings = true
      expect(isEqualElements(ot, otDiff)).toBeFalsy()
    })

    it('should identify equal fields', () => {
      expect(isEqualElements(strField, _.cloneDeep(strField))).toBeTruthy()
    })

    it('should identify equal instance elements', () => {
      expect(isEqualElements(inst, _.cloneDeep(inst))).toBeTruthy()
    })

    it('should identify one undefined as not equal', () => {
      expect(isEqualElements(inst, undefined)).toBeFalsy()
      expect(isEqualElements(undefined, inst)).toBeFalsy()
    })

    it('should identify different elements as false', () => {
      expect(isEqualElements(inst, ot)).toBeFalsy()
    })

    it('should identify primitive type', () => {
      expect(isPrimitiveType(primStr)).toBeTruthy()
      expect(isPrimitiveType(inst)).toBeFalsy()
    })

    it('should identify types', () => {
      expect(isType(inst)).toBeFalsy()
      expect(isType(primStr)).toBeTruthy()
    })

    it('should identify object types', () => {
      expect(isObjectType(inst)).toBeFalsy()
      expect(isObjectType(ot)).toBeTruthy()
    })

    it('should identify instance elements', () => {
      expect(isInstanceElement(inst)).toBeTruthy()
      expect(isInstanceElement(primStr)).toBeFalsy()
    })
  })

  describe('ElemID', () => {
    const exampleId = new ElemID('adapter', 'example')

    describe('isConfig', () => {
      const configTypeId = new ElemID('adapter')
      const configInstId = new ElemID('adapter', ElemID.CONFIG_INSTANCE_NAME)

      it('should return true for config type ID', () => {
        expect(configTypeId.isConfig()).toBeTruthy()
      })

      it('should return true for config instance ID', () => {
        expect(configInstId.isConfig()).toBeTruthy()
      })

      it('should return false for other IDs', () => {
        expect(exampleId.isConfig()).toBeFalsy()
      })
    })

    describe('createNestedID', () => {
      it('should create an ID with one additional name part', () => {
        expect(exampleId.createNestedID('test').nameParts).toEqual(['example', 'test'])
      })
    })

    describe('createParentID', () => {
      it('should create an ID with one less name part', () => {
        expect(exampleId.createParentID().nameParts).toEqual([])
      })
    })
  })
})
