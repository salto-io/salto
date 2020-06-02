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
import { InternalParseRes, AttrData, TopLevelElementData, FieldData, ElementItem, LexerToken, NearleyError } from './types'
import { createSourceRange } from './context'
import { convertAttributes } from './values'

const INSTANCE_ANNOTATIONS_ATTRS: string[] = Object.values(INSTANCE_ANNOTATIONS)
type ElementInternalParseRes = {element: Element; sourceMap: SourceMap; listTypes: ListType[]}

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
    if (attr.sourceMap) {
      sourceMap.mount(variable.elemID.getFullName(), attr.sourceMap)
    }
    sourceMap.push(variable.elemID.getFullName(), source)
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
): ElementInternalParseRes => {
  const elemID = parseElemID(typeName)
  const typeObj = new ObjectType({
    elemID,
    annotationTypes,
    annotations: annotations.value,
    isSettings,
  })
  const sourceMap = new SourceMap()
  if (annotations.sourceMap) {
    sourceMap.mount(elemID.createNestedID('attr').getFullName(), annotations.sourceMap)
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
    const field = new Field(typeObj, name, fieldType, fieldAnnotation)
    typeObj.fields[name] = field
    if (fieldData.sourceMap) {
      sourceMap.mount(field.elemID.getFullName(), fieldData.sourceMap)
    }
    sourceMap.push(field.elemID.getFullName(), fieldData.source)
  })

  return { element: typeObj, sourceMap, listTypes: wu(listElements.values()).toArray() }
}

const parsePrimitiveType = (
  labels: InternalParseRes<string>[],
  annotationTypes: TypeMap,
  annotations: Omit<InternalParseRes<Values>, 'source'>,
): ElementInternalParseRes => {
  const [typeName, kw, baseType] = labels
  if (kw.value !== Keywords.TYPE_INHERITANCE_SEPARATOR) {
    throw new NearleyError(
      kw,
      createSourceRange(kw).start.byte,
      `expected keyword ${Keywords.TYPE_INHERITANCE_SEPARATOR}. found ${kw}`
    )
  }
  const elemID = parseElemID(typeName.value)
  const sourceMap = new SourceMap()
  if (annotations.sourceMap) {
    sourceMap.mount([elemID.getFullName(), 'attr'].join(ElemID.NAMESPACE_SEPARATOR), annotations.sourceMap)
  }
  return {
    element: new PrimitiveType({
      elemID,
      primitive: primitiveType(baseType.value),
      annotationTypes,
      annotations: annotations.value,
    }),
    sourceMap,
    listTypes: [],
  }
}

const parseInstance = (
  instanceType: string,
  labels: string[],
  attrs: Omit<InternalParseRes<Values>, 'source'>
): ElementInternalParseRes => {
  let typeID = parseElemID(instanceType)
  if (_.isEmpty(typeID.adapter) && typeID.name.length > 0) {
    // In this case if there is just a single name we have to assume it is actually the adapter
    typeID = new ElemID(typeID.name)
  }
  const name = labels[0] || ElemID.CONFIG_NAME
  const annotations = _.pick(attrs.value, INSTANCE_ANNOTATIONS_ATTRS)
  const values = attrs.value
  // using unset instead of _.pick in order to maintatin the element muteable,
  // which is needed in order for the promise value replacer to replace the content
  // on the proper object.
  INSTANCE_ANNOTATIONS_ATTRS.forEach(annoAttr => _.unset(values, annoAttr))
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
  return { element: inst, sourceMap, listTypes: [] }
}

const parseElementBlock = (
  elementType: InternalParseRes<string>,
  elementLabels: InternalParseRes<string>[],
  annotationsTypes: TypeMap,
  attributes: Omit<InternalParseRes<Values>, 'source'>,
  fields: InternalParseRes<FieldData>[]
): ElementInternalParseRes => {
  if (elementType.value === Keywords.TYPE_DEFINITION && elementLabels.length > 1) {
    return parsePrimitiveType(elementLabels, annotationsTypes, attributes)
  }
  const isSettings = elementType.value === Keywords.SETTINGS_DEFINITION
  if (elementType.value === Keywords.TYPE_DEFINITION || isSettings) {
    return parseType(elementLabels[0].value, fields, annotationsTypes, attributes, isSettings)
  }
  if (elementLabels.length === 0 || elementLabels.length === 1) {
    const { element, sourceMap, listTypes } = parseInstance(
      elementType.value,
      elementLabels.map(l => l.value),
      attributes
    )
    return { element, sourceMap, listTypes }
  }
  // Without this exception the linter won't allow us to end the function
  // without a return value
  throw new NearleyError(
    { text: [elementType, ...elementLabels].map(l => l.value).join(' ') },
    createSourceRange(elementType).start.byte,
    'unsupported block definition'
  )
}

export const converTopLevelBlock = (
  labels: InternalParseRes<string>[],
  elementItems: InternalParseRes<ElementItem>[],
  cb: LexerToken
): TopLevelElementData => {
  const isAnnotationsBlock = (
    item: InternalParseRes<Value>
  ): item is InternalParseRes<TypeMap> => (
    _.isPlainObject(item.value) && _(item.value).values().every(isObjectType)
  )
  const isFieldBlock = (
    item: InternalParseRes<Value>
  ): item is InternalParseRes<FieldData> => item.value.annotations !== undefined
      && item.value.type !== undefined
      && item.value.name !== undefined
  const isAttribute = (
    item: InternalParseRes<Value>
  ): item is InternalParseRes<AttrData> => _.isArray(item.value) && item.value.length === 2

  const [elementType, ...elementLabels] = labels
  const annotationTypes = elementItems.filter(isAnnotationsBlock)[0]
  const attributes = elementItems.filter(isAttribute)
  const fields = elementItems.filter(isFieldBlock)
  if (elementType.value === Keywords.VARIABLES_DEFINITION) {
    if (!(_.isEmpty(fields) && _.isEmpty(annotationTypes))) {
      throw new NearleyError(
        labels[0],
        createSourceRange(labels[0]).start.byte,
        'illegal var block'
      )
    }
    return parseVariablesBlock(attributes)
  }
  const annotations = convertAttributes(attributes)
  const { element, sourceMap, listTypes } = parseElementBlock(
    elementType,
    elementLabels,
    annotationTypes?.value ?? {},
    annotations,
    fields
  )
  const elemKey = element.elemID.getFullName()
  if (annotationTypes?.sourceMap) {
    sourceMap.mount(elemKey, annotationTypes.sourceMap)
  }
  sourceMap.push(elemKey, createSourceRange(labels[0], cb))
  return { elements: [element, ...listTypes], sourceMap }
}

const convertAnnotationTypes = (
  annotationLabel: InternalParseRes<string>,
  annotationTypes: InternalParseRes<FieldData>[],
  closingBracket: LexerToken
): InternalParseRes<TypeMap> => {
  const source = createSourceRange(annotationLabel, closingBracket)
  const sourceMap = new SourceMap()
  const value: Record<string, ObjectType> = {}
  annotationTypes.forEach(annoType => {
    const { annotations, type, name } = annoType.value
    value[name] = new ObjectType({
      elemID: parseElemID(type),
      annotations,
    })
    const sourcePrefix = ['annotation', name].join(ElemID.NAMESPACE_SEPARATOR)
    if (annoType.sourceMap) {
      sourceMap.mount(sourcePrefix, annoType.sourceMap)
    }
    sourceMap.push(sourcePrefix, annoType.source)
  })
  sourceMap.push('annotation', source)
  return { value, source, sourceMap }
}

const convertField = (
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

export const convertNestedBlock = (
  labels: InternalParseRes<string>[],
  blockItems: InternalParseRes<FieldData | AttrData>[],
  cb: LexerToken
): InternalParseRes<FieldData | TypeMap> => {
  if (labels.length === 1 && labels[0].value === 'annotations') {
    return convertAnnotationTypes(
      labels[0],
      blockItems as InternalParseRes<FieldData>[],
      cb
    )
  }
  if (labels.length === 2) {
    return convertField(
      labels[0],
      labels[1],
      blockItems as InternalParseRes<AttrData>[],
      cb
    )
  }
  throw new NearleyError(
    labels[0],
    createSourceRange(labels[0], cb).start.byte,
    'unsupported nested block'
  )
}
