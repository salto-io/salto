import _ from 'lodash'
import {
  PrimitiveType, ElemID, Field, Element, BuiltinTypes,
  ObjectType, InstanceElement, isType, isElement, isExpression,
  ReferenceExpression, TemplateExpression, Expression, isInstanceElement,
} from 'adapter-api'

// There are two issues with naive json stringification:
//
// 1) The class type information and methods are lost
//
// 2) Pointers are dumped by value, so if multiple object
//    point to the same object (for example, multiple type
//    instances for the same type) then the stringify process
//    will result in multiple copies of that object.
//
// To address this issue the serialization process:
//
// 1. Adds a '_salto_class' field with the class name to the object during the serialization.
// 2. Replaces all of the pointers with "placeholder" objects
//
// The deserialization process recover the information by creating the classes based
// on the _salto_class field, and then replacing the placeholders using the regular merge method.

interface ClassName {className: string}
export const serialize = (elements: Element[]): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementReplacer = (_k: string, e: any): any => {
    if (isElement(e) || isExpression(e)) {
      const o = e as Element & ClassName
      o.className = e.constructor.name
      return o
    }
    // We need to sort objects so that the state file won't change for the same data.
    if (_.isPlainObject(e)) {
      return _(e).toPairs().sortBy().fromPairs()
        .value()
    }
    return e
  }

  const weakElements = elements.map(element => _.cloneDeepWith(
    element,
    (v, k) => ((k !== undefined && isType(v)) ? new ObjectType({ elemID: v.elemID }) : undefined)
  ))
  const sortedElements = _.sortBy(weakElements, e => e.elemID.getFullName())
  return JSON.stringify(sortedElements, elementReplacer)
}

export const deserialize = (data: string): Element[] => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviveElemID = (v: {[key: string]: any}): ElemID => (
    new ElemID(v.adapter, v.typeName, v.idType, ...v.nameParts)
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const revivers: {[key: string]: (v: {[key: string]: any}) => Element|Expression} = {
    [InstanceElement.name]: v => new InstanceElement(
      reviveElemID(v.elemID).name,
      v.type,
      v.value,
    ),
    [ObjectType.name]: v => new ObjectType({
      elemID: reviveElemID(v.elemID),
      fields: v.fields,
      annotationTypes: v.annotationTypes,
      annotations: v.annotations,
    }),
    [PrimitiveType.name]: v => new PrimitiveType({
      elemID: reviveElemID(v.elemID),
      primitive: v.primitive,
      annotationTypes: v.annotationTypes,
      annotations: v.annotations,
    }),
    [Field.name]: v => new Field(
      reviveElemID(v.parentID),
      v.name,
      v.type,
      v.annotations,
      v.isList,
    ),
    [TemplateExpression.name]: v => new TemplateExpression({ parts: v.parts }),
    [ReferenceExpression.name]: v => new ReferenceExpression(v.elemId),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementReviver = (_k: string, v: any): any => {
    if (v.className) {
      const e = revivers[v.className](v)
      if (isType(e) || isInstanceElement(e)) {
        e.path = v.path
      }
      return e
    }
    return v
  }

  const elements = JSON.parse(data, elementReviver) as Element[]
  const elementsMap = _.keyBy(elements.filter(isType), e => e.elemID.getFullName())
  const builtinMap = _(BuiltinTypes).values().keyBy(b => b.elemID.getFullName()).value()
  const typeMap = _.merge({}, elementsMap, builtinMap)
  elements.forEach(element => {
    _.keys(element).forEach(k => {
      _.set(element, k, _.cloneDeepWith(_.get(element, k), v =>
        (isType(v) ? typeMap[v.elemID.getFullName()] : undefined)))
    })
  })
  return elements
}
