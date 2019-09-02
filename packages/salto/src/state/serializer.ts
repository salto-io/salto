import _ from 'lodash'
import {
  PrimitiveType, ElemID, Field, Element, BuiltinTypes,
  ObjectType, InstanceElement, isType, isElement,
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

// const CLASS_NAME = '_salto_class'
interface ClassName {className: string}
export const serialize = (elements: Element[]): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementReplacer = (_k: string, e: any): any => {
    if (isElement(e)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const o = e as Element & ClassName
      o.className = e.constructor.name
      return o
    }
    return e
  }

  const weakElements = elements.map(element => _.cloneDeepWith(
    element,
    (v, k) => ((k !== undefined && isType(v)) ? new ObjectType({ elemID: v.elemID }) : undefined)
  ))

  return JSON.stringify(weakElements, elementReplacer)
}

export const deserialize = (data: string): Element[] => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const revivers: {[key: string]: (v: {[key: string]: any}) => Element} = {
    [InstanceElement.name]: v => new InstanceElement(
      new ElemID(v.elemID.adapter, ...v.elemID.nameParts),
      v.type,
      v.value,
    ),
    [ObjectType.name]: v => new ObjectType({
      elemID: new ElemID(v.elemID.adapter, ...v.elemID.nameParts),
      fields: v.fields,
      annotations: v.annotations,
      annotationsValues: v.annotationsValues,
    }),
    [PrimitiveType.name]: v => new PrimitiveType({
      elemID: new ElemID(v.elemID.adapter, ...v.elemID.nameParts),
      primitive: v.primitive,
      annotations: v.annotations,
      annotationsValues: v.annotationsValues,
    }),
    [Field.name]: v => new Field(
      new ElemID(v.parentID.adapter, ...v.parentID.nameParts),
      v.name,
      v.type,
      v.annotationsValues,
      v.isList,
    ),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementReviver = (_k: string, v: any): any => {
    if (v.className) {
      return revivers[v.className](v)
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
