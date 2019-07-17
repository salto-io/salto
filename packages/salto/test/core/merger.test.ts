import {
  ObjectType, PrimitiveType, PrimitiveTypes, ElemID,
  Field,
} from 'adapter-api'
import mergeElements from '../../src/core/merger'


describe('Merger module', () => {
  const strType = new PrimitiveType({
    elemID: new ElemID('salesforce', 'string'),
    primitive: PrimitiveTypes.STRING,
  })

  const numType = new PrimitiveType({
    elemID: new ElemID('salesforce', 'number'),
    primitive: PrimitiveTypes.NUMBER,
  })

  const boolType = new PrimitiveType({
    elemID: new ElemID('salesforce', 'bool'),
    primitive: PrimitiveTypes.BOOLEAN,
  })

  const model = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
  })
  model.fields.name = new Field(model.elemID, 'name', strType, { label: 'Name' })
  model.fields.num = new Field(model.elemID, 'num', numType)

  model.annotationsValues = {
    // eslint-disable-next-line @typescript-eslint/camelcase
    lead_convert_settings: {
      account: [
        {
          input: 'bla',
          output: 'foo',
        },
      ],
    },
    // eslint-disable-next-line @typescript-eslint/camelcase
    anno_that: 'old',
  }

  const extension = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
    isExtension: true,
  })
  extension.fields.one = new Field(
    extension.elemID,
    'one',
    strType,
    { label: 'Expended field' }
  )

  extension.annotationsValues = {
    // eslint-disable-next-line @typescript-eslint/camelcase
    anno_this: {
      foo: 'foo',
    },
  }


  const extension2 = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
    isExtension: true,
  })
  extension2.fields.two = new Field(
    extension2.elemID,
    'two',
    strType,
    { label: 'Expended field' }
  )

  extension2.annotationsValues = {
    // eslint-disable-next-line @typescript-eslint/camelcase
    anno_that: 'new',
  }

  const missingModelExt = new ObjectType({
    elemID: new ElemID('salesforce', 'missing'),
    isExtension: true,
  })
  missingModelExt.fields.missing = new Field(
    missingModelExt.elemID,
    'missing',
    strType,
    { label: 'Expended field' }
  )

  const modelFieldExt = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
    isExtension: true,
  })
  modelFieldExt.fields.name = new Field(
    modelFieldExt.elemID,
    'name',
    strType,
    { label: 'Expended field in base model' }
  )

  const doubleAnnoExt = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
    isExtension: true,
  })
  doubleAnnoExt.fields.double = new Field(
    doubleAnnoExt.elemID,
    'double',
    strType,
    { label: 'Expended field' }
  )

  doubleAnnoExt.annotationsValues = {
    // eslint-disable-next-line @typescript-eslint/camelcase
    anno_this: {
      foo: 'foo',
    },
  }

  const doubleFieldExt = new ObjectType({
    elemID: new ElemID('salesforce', 'test'),
    isExtension: true,
  })
  doubleFieldExt.fields.one = new Field(
    doubleFieldExt.elemID,
    'one',
    strType,
    { label: 'Expended field' }
  )

  doubleFieldExt.annotationsValues = {
    // eslint-disable-next-line @typescript-eslint/camelcase
    anno_who: {
      foo: 'foo',
    },
  }

  const nonModelExt = new ObjectType({
    elemID: new ElemID('salesforce', 'string'),
    isExtension: true,
  })
  doubleFieldExt.fields.asas = new Field(
    doubleFieldExt.elemID,
    'asas',
    strType,
    { label: 'Expended field' }
  )


  it('should not modify a list element with no extensions', () => {
    const elements = [
      strType, numType, boolType, model,
    ]
    const merged = mergeElements(elements)
    expect(merged.length).toBe(4)
  })

  it('should merge types with their proper extensions', () => {
    const elements = [
      strType, numType, boolType, model, extension, extension2,
    ]
    const merged = mergeElements(elements)
    expect(merged.length).toBe(4)
    const mergedElement = merged.filter(e => e.elemID.name === 'test')[0] as ObjectType
    expect(mergedElement).toBeDefined()
    expect(mergedElement.fields.one).toBeDefined()
    expect(mergedElement.fields.two).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/camelcase
    expect(mergedElement.annotationsValues.anno_this).toBeDefined()
    expect(mergedElement.annotationsValues.anno_that).toBe('new')
    // eslint-disable-next-line @typescript-eslint/camelcase
    expect(mergedElement.annotationsValues.lead_convert_settings).toBeDefined()
  })

  it('should not allow extensions that add a field twice', () => {
    const elements = [
      strType,
      numType,
      boolType,
      model,
      extension,
      extension2,
      doubleFieldExt,
    ]
    expect(() => mergeElements(elements)).toThrow()
  })

  it('should not allow to modify a field set in the base model', () => {
    const elements = [
      strType,
      numType,
      boolType,
      model,
      extension,
      extension2,
      modelFieldExt,
    ]
    expect(() => mergeElements(elements)).toThrow()
  })

  it('should not allow to modify an annotation value twice', () => {
    const elements = [
      strType,
      numType,
      boolType,
      model,
      extension,
      extension2,
      doubleAnnoExt,
    ]
    expect(() => mergeElements(elements)).toThrow()
  })

  it('should not allow extensions to missing model', () => {
    const elements = [
      strType,
      numType,
      boolType,
      model,
      extension,
      extension2,
      missingModelExt,
    ]
    expect(() => mergeElements(elements)).toThrow()
  })

  it('should not allow extensions on something other then model', () => {
    const elements = [
      strType,
      numType,
      boolType,
      model,
      extension,
      extension2,
      nonModelExt,
    ]
    expect(() => mergeElements(elements)).toThrow()
  })
})
