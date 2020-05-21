/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import { Element, INSTANCE_ANNOTATIONS, Variable, ElemID, PrimitiveTypes, TypeMap, Values, TypeElement, ListType, ObjectType, Field, PrimitiveType, InstanceElement, Value, isObjectType } from '@salto-io/adapter-api'
import wu from 'wu'
import { SourceMap } from '../../source_map'
import { Keywords } from '../../language'
import { InternalParseRes, AttrData, TopLevelElementData, FieldData, ElementItem, LexerToken } from './types'
import { createSourceRange } from './context'
import { convertAttributes } from './values'

const INSTANCE_ANNOTATIONS_ATTRS: string[] = Object.values(INSTANCE_ANNOTATIONS)

export const parseElemID = (fullname: string): ElemID => {
  const separatorIdx = fullname.indexOf(Keywords.NAMESPACE_SEPARATOR)
  const adapter = (separatorIdx >= 0) ? fullname.slice(0, separatorIdx) : ''
  const name = fullname.slice(separatorIdx + Keywords.NAMESPACE_SEPARATOR.length)
  return new ElemID(adapter, name)
}

const parseVariablesBlock = (attrs: InternalParseRes<AttrData>[]): TopLevelElementData => {
  const sourceMap = new SourceMap()
  const variables: Variable[] = []
  attrs.forEach(attr => {
    const { source } = attr
    const [name, value] = attr.value
    const variable = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, name), value)
    sourceMap.push(variable.elemID.getFullName(), source)
    if (attr.sourceMap) {
      sourceMap.mount(variable.elemID.getFullName(), attr.sourceMap)
    }
    variables.push(variable)
  })
  return { elements: variables, sourceMap }
}

const primitiveType = (typeName: string): PrimitiveTypes => {
  if (typeName === Keywords.TYPE_STRING) {
    return PrimitiveTypes.STRING
  }
  if (typeName === Keywords.TYPE_NUMBER) {
    return PrimitiveTypes.NUMBER
  }
  return PrimitiveTypes.BOOLEAN
}

const parseType = (
  typeName: string,
  fields: InternalParseRes<FieldData>[],
  annotationTypes: TypeMap,
  annotations: Omit<InternalParseRes<Values>, 'source'>,
  isSettings = false
): [TypeElement, SourceMap, ListType[]] => {
  const elemID = parseElemID(typeName)
  const typeObj = new ObjectType({
    elemID,
    annotationTypes,
    annotations: annotations.value,
    isSettings,
  })
  const sourceMap = new SourceMap()
  if (annotations.sourceMap) {
    sourceMap.mount([elemID.getFullName(), 'attr'].join(ElemID.NAMESPACE_SEPARATOR), annotations.sourceMap)
  }
  const listElements: Map<string, ListType> = new Map<string, ListType>()
  const createFieldType = (blockType: string): TypeElement => {
    if (blockType.startsWith(Keywords.LIST_PREFIX)
        && blockType.endsWith(Keywords.GENERICS_SUFFIX)) {
      const listType = new ListType(createFieldType(
        blockType.substring(
          Keywords.LIST_PREFIX.length,
          blockType.length - Keywords.GENERICS_SUFFIX.length
        )
      ))
      listElements.set(listType.elemID.getFullName(), listType)
      return listType
    }
    return new ObjectType({ elemID: parseElemID(blockType) })
  }

  fields.forEach(fieldData => {
    const { type, name, annotations: fieldAnnotation } = fieldData.value
    const fieldType = createFieldType(type)
    const field = new Field(elemID, name, fieldType, fieldAnnotation)
    typeObj.fields[name] = field
    sourceMap.push(field.elemID.getFullName(), fieldData.source)
    if (fieldData.sourceMap) {
      sourceMap.mount(field.elemID.getFullName(), fieldData.sourceMap)
    }
  })

  return [typeObj, sourceMap, wu(listElements.values()).toArray()]
}

const parsePrimitiveType = (
  labels: string[],
  annotationTypes: TypeMap,
  annotations: Omit<InternalParseRes<Values>, 'source'>,
): [PrimitiveType, SourceMap] => {
  const [typeName, kw, baseType] = labels
  if (kw !== Keywords.TYPE_INHERITANCE_SEPARATOR) {
    throw new Error(`expected keyword ${Keywords.TYPE_INHERITANCE_SEPARATOR}. found ${kw}`)
  }
  const elemID = parseElemID(typeName)
  const sourceMap = new SourceMap()
  if (annotations.sourceMap) {
    sourceMap.mount([elemID.getFullName(), 'attr'].join(ElemID.NAMESPACE_SEPARATOR), annotations.sourceMap)
  }
  return [
    new PrimitiveType({
      elemID,
      primitive: primitiveType(baseType),
      annotationTypes,
      annotations: annotations.value,
    }),
    sourceMap,
  ]
}

const parseInstance = (
  instanceType: string,
  labels: string[],
  attrs: Omit<InternalParseRes<Values>, 'source'>
): [InstanceElement, SourceMap] => {
  let typeID = parseElemID(instanceType)
  if (_.isEmpty(typeID.adapter) && typeID.name.length > 0) {
    // In this case if there is just a single name we have to assume it is actually the adapter
    typeID = new ElemID(typeID.name)
  }
  const name = labels[0] || ElemID.CONFIG_NAME
  const annotations = _.pick(attrs.value, INSTANCE_ANNOTATIONS_ATTRS)
  const values = attrs.value
  INSTANCE_ANNOTATIONS_ATTRS.forEach(annoAttr => _.unset(values, annoAttr))
  _.unset(attrs, INSTANCE_ANNOTATIONS_ATTRS)
  const inst = new InstanceElement(
    name,
    new ObjectType({
      elemID: typeID,
      isSettings: labels.length === 0 && !typeID.isConfig(),
    }),
    values,
    undefined,
    annotations,
  )
  const sourceMap = new SourceMap()
  if (attrs.sourceMap) {
    sourceMap.mount(inst.elemID.getFullName(), attrs.sourceMap)
  }
  return [inst, sourceMap]
}

const parseElementBlock = (
  elementType: string,
  elementLabels: string[],
  annotationsTypes: TypeMap,
  attributes: Omit<InternalParseRes<Values>, 'source'>,
  fields: InternalParseRes<FieldData>[]
): [Element, SourceMap, ListType[]] => {
  if (elementType === Keywords.TYPE_DEFINITION && elementLabels.length > 1) {
    const [inst, sourceMap] = parsePrimitiveType(elementLabels, annotationsTypes, attributes)
    return [inst, sourceMap, []]
  }
  const isSettings = elementType === Keywords.SETTINGS_DEFINITION
  if (elementType === Keywords.TYPE_DEFINITION || isSettings) {
    return parseType(elementLabels[0], fields, annotationsTypes, attributes, isSettings)
  }
  if (elementLabels.length === 0 || elementLabels.length === 1) {
    const [inst, sourceMap] = parseInstance(elementType, elementLabels, attributes)
    return [inst, sourceMap, []]
  }
  // Without this exception the linter won't allow us to end the function
  // without a return value
  throw new Error('unsupported block')
}

export const converTopLevelBlock = (
  labels: InternalParseRes<string>[],
  elementItems: InternalParseRes<ElementItem>[],
  cb: LexerToken
): TopLevelElementData => { // TODO always return array?
  const isAnnotationsBlock = (
    item: InternalParseRes<Value>
  ): item is InternalParseRes<TypeMap> => (
    _.isPlainObject(item.value) && _(item.value).values().every(isObjectType)
  )
  const isFieldBlock = (
    item: InternalParseRes<Value>
  ): item is InternalParseRes<FieldData> => item.value.annotations
      && item.value.type
      && item.value.name
  const isAttribute = (
    item: InternalParseRes<Value>
  ): item is InternalParseRes<AttrData> => _.isArray(item.value) && item.value.length === 2

  const [elementType, ...elementLabels] = labels.map(l => l.value)
  const annotationsTypes = elementItems.filter(isAnnotationsBlock)[0]
  const attributes = elementItems.filter(isAttribute)
  const fields = elementItems.filter(isFieldBlock)
  if (elementType === Keywords.VARIABLES_DEFINITION) {
    return parseVariablesBlock(attributes)
  }
  const annotations = convertAttributes(attributes)
  const [element, sourceMap, listTypes] = parseElementBlock(
    elementType,
    elementLabels,
      annotationsTypes?.value ?? {},
      annotations,
      fields
  )
  const elemKey = element.elemID.getFullName()
  if (annotationsTypes?.sourceMap) {
    sourceMap.mount(elemKey, annotationsTypes.sourceMap)
  }
  sourceMap.push(elemKey, createSourceRange(labels[0], cb))
  return { elements: [element, ...listTypes], sourceMap }
}

export const convertAnnotationTypes = (
  oToken: LexerToken,
  annotationTypes: InternalParseRes<FieldData>[],
  cb: LexerToken
): InternalParseRes<TypeMap> => {
  const source = createSourceRange(oToken, cb)
  const sourceMap = new SourceMap()
  const value: Record<string, ObjectType> = {}
  annotationTypes.forEach(annoType => {
    const { annotations, type, name } = annoType.value
    value[name] = new ObjectType({
      elemID: parseElemID(type),
      annotations,
    })
    const sourcePrefix = ['annotation', name].join(ElemID.NAMESPACE_SEPARATOR)
    sourceMap.push(sourcePrefix, annoType.source)
    if (annoType.sourceMap) {
      sourceMap.mount(sourcePrefix, annoType.sourceMap)
    }
  })
  sourceMap.push('annotation', source)
  return { value, source, sourceMap }
}

export const convertField = (
  fieldType: InternalParseRes<string>,
  fieldName: InternalParseRes<string>,
  attributes: InternalParseRes<AttrData>[],
  cb: LexerToken
): InternalParseRes<FieldData> => {
  const source = createSourceRange(fieldType, cb)
  const { value: annotations, sourceMap } = convertAttributes(attributes)
  return {
    value: {
      annotations,
      type: fieldType.value,
      name: fieldName.value,
    },
    source,
    sourceMap,
  }
}
