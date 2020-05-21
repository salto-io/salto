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
import { Value, ElemID, Element, VariableExpression, ReferenceExpression, TemplateExpression, isReferenceExpression, ObjectType, Field, PrimitiveType, Values, PrimitiveTypes, TypeMap, Variable, InstanceElement, INSTANCE_ANNOTATIONS, isObjectType, TemplatePart, TypeElement, ListType } from '@salto-io/adapter-api'
import wu from 'wu'
import { HclExpression, SourceRange } from './types'
import { SourceMap } from './source_map'
import { Keywords } from '../language'
import { evaluateFunction, Functions } from '../functions'

interface FuncWatcher {
  parent: Value
  key: string | number
}

interface InternalParseRes<T> {
  value: T
  source: SourceRange
  sourceMap?: SourceMap
}

type AttrData = [string, Value]

type FieldData = {
  annotations: Values
  type: string
  name: string
}

type TopLevelElementData = {
  elements: Element[]
  sourceMap: SourceMap
}

type ElementItem = AttrData | FieldData | TypeMap

interface LexerToken {
  type: string
  value: string
  text: string
  line: number
  lineBreaks: number
  col: number
  offset: number
}

const INSTANCE_ANNOTATIONS_ATTRS: string[] = Object.values(INSTANCE_ANNOTATIONS)

type Token = LexerToken | InternalParseRes<Value>

type NearleyErrorToken = Partial<InternalParseRes<Value> & LexerToken>

export class NearleyError extends Error {
  constructor(
    public token: NearleyErrorToken,
    public offset: number,
    message: string
  ) {
    super(message)
  }
}

export class IllegalReference {
  constructor(public ref: string, public message: string) {}
}

let currentFilename: string
let currentFunctions: Functions
let allowWildcard = false
let funcWatchers: FuncWatcher[] = []

const isLexerToken = (token: Token): token is LexerToken => 'value' in token
    && 'text' in token
    && 'line' in token
    && 'col' in token
    && 'offset' in token

export const startParse = (filename: string, functions: Functions): void => {
  currentFilename = filename
  currentFunctions = functions
  allowWildcard = false
}

export const replaceFunctionValues = async (): Promise<void> => {
  await Promise.all(funcWatchers.map(async watcher => {
    const { parent, key } = watcher
    parent[key] = await parent[key]
  }))
  funcWatchers = []
}

export const setErrorRecoveryMode = (): void => {
  allowWildcard = true
}

const addFuncWatcher = (parent: Value, key: string | number): void => {
  if (parent[key].then) {
    funcWatchers.push({ parent, key })
  }
}

const createSourceRange = (st: Token, et: Token): SourceRange => {
  const start = isLexerToken(st)
    ? { line: st.line, col: st.col, byte: st.offset }
    : (st as InternalParseRes<Value>).source.start
  const end = isLexerToken(et)
    ? {
      line: et.line + et.lineBreaks,
      col: et.lineBreaks === 0 ? et.col + et.text.length : et.text.length - et.text.lastIndexOf('\n'),
      byte: et.offset + et.text.length,
    }
    : (et as InternalParseRes<Value>).source.end
  return { filename: currentFilename, start, end }
}

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

export const convertMain = (
  topLevelElements: TopLevelElementData[]
): TopLevelElementData => {
  const elements = _.flatten(topLevelElements.map(item => item.elements))
  const sourceMaps = topLevelElements.map(item => item.sourceMap)
  const mergedSourceMap = new SourceMap()
  // TODO - this should use merge source maps from the source map file
  sourceMaps.forEach(sourceMap => {
    sourceMap.forEach((value, key) => mergedSourceMap.push(key, ...value))
  })
  return { elements, sourceMap: mergedSourceMap }
}

const convertAttributes = (
  attrs: InternalParseRes<AttrData>[]
): Omit<InternalParseRes<Values>, 'source'> => {
  const value: Record<string, Value> = {}
  const sourceMap = new SourceMap()
  attrs.forEach(attr => {
    const [attrKey, attrValue] = attr.value
    if (value[attrKey] !== undefined) {
      throw new NearleyError(attr, attr.source.start.byte, 'Attribute redefined')
    }
    value[attrKey] = attrValue
    addFuncWatcher(value, attrKey)
    sourceMap.push(attrKey, attr.source)
    if (attr.sourceMap) {
      sourceMap.mount(attrKey, attr.sourceMap)
    }
  })
  return {
    value,
    sourceMap,
  }
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

export const convertArray = (
  ob: LexerToken,
  arrayItems: InternalParseRes<Value>[],
  cb: LexerToken
): InternalParseRes<Value[]> => {
  const sourceMap = new SourceMap()
  const value: Value[] = []
  arrayItems.forEach((item, index) => {
    sourceMap.push(index.toString(), item.source)
    value.push(item.value)
    addFuncWatcher(value, index)
    if (item.sourceMap) {
      sourceMap.mount(index.toString(), item.sourceMap)
    }
  })
  return {
    value,
    source: createSourceRange(ob, cb),
    sourceMap,
  }
}

export const convertObject = (
  ob: LexerToken,
  attrs: InternalParseRes<AttrData>[],
  cb: LexerToken
): InternalParseRes<Values> => ({
  ...convertAttributes(attrs),
  source: createSourceRange(ob, cb),
})

export const convertReference = (
  reference: LexerToken
): InternalParseRes<ReferenceExpression | IllegalReference> => {
  const ref = reference.value
  const source = createSourceRange(reference, reference)
  try {
    const elemId = ElemID.fromFullName(ref)
    return elemId.adapter === ElemID.VARIABLES_NAMESPACE
      ? { value: new VariableExpression(elemId), source }
      : { value: new ReferenceExpression(elemId), source }
  } catch (e) {
    return { value: new IllegalReference(ref, e.message), source }
  }
}

const unescapeTemplateMarker = (text: string): string =>
  text.replace(/\\\$\{/gi, '${',)

export const convertString = (
  oq: LexerToken,
  contentTokens: LexerToken[],
  cq: LexerToken
): InternalParseRes<string | TemplateExpression> => {
  const source = createSourceRange(oq, cq)
  const convertedTokens = contentTokens.map(t => (isReferenceExpression(t)
    ? convertReference(t)
    : JSON.parse(`"${unescapeTemplateMarker(t.text)}"`)))
  if (_.some(convertedTokens, isReferenceExpression)) {
    return {
      value: new TemplateExpression({ parts: convertedTokens }),
      source,
    }
  }
  return {
    value: convertedTokens.join(),
    source,
  }
}

export const convertMultilineString = (
  mlStart: LexerToken,
  contentTokens: LexerToken[],
  mlEnd: LexerToken
): InternalParseRes<string | TemplateExpression> => {
  const expressions = contentTokens.map((t, index) => {
    const withoutEscaping = unescapeTemplateMarker(t.text)
    const value = index === contentTokens.length - 1
      ? withoutEscaping.slice(0, withoutEscaping.length - 1) // Remove the last \n
      : withoutEscaping
    return t.type === 'reference'
      ? convertReference(t).value
      : value
  })
  const source = createSourceRange(mlStart, mlEnd)
  return _.some(expressions, exp => isReferenceExpression(exp))
    ? { value: new TemplateExpression({ parts: expressions as TemplatePart[] }), source }
    : { value: expressions.join(''), source }
}

export const convertBoolean = (bool: LexerToken): InternalParseRes<boolean> => ({
  value: bool.text === 'true',
  source: createSourceRange(bool, bool), // LOL. This was unindented. Honest.
})

export const convertNumber = (num: LexerToken): InternalParseRes<number> => ({
  value: parseFloat(num.text),
  source: createSourceRange(num, num),
})

const convertAttrKey = (key: LexerToken): string => (key.type === 'string'
  ? JSON.parse(key.text)
  : key.text)

export const convertAttr = (
  attrKey: LexerToken,
  attrValue: InternalParseRes<Value>
): InternalParseRes<AttrData> => {
  const key = convertAttrKey(attrKey)
  const value = [key, attrValue.value] as AttrData
  const source = createSourceRange(attrKey, attrValue)
  return { value, source, sourceMap: attrValue.sourceMap }
}

// This is really broken fix this
export const convertWildcard = (wildcard: LexerToken): HclExpression => {
  const exp = {
    type: 'dynamic',
    expressions: [],
    source: createSourceRange(wildcard, wildcard),
  } as HclExpression
  if (allowWildcard) return exp
  throw new NearleyError(exp, wildcard.offset, 'Invalid wildcard token')
}

export const convertFunction = (
  funcName: LexerToken,
  parameters: InternalParseRes<Value>[],
  funcEnd: LexerToken
): InternalParseRes<Promise<Value>> => {
  const source = createSourceRange(funcName, funcEnd)
  const value = evaluateFunction(
    funcName.value,
    parameters.map(p => p.value),
    currentFunctions
  )
  return { source, value }
}


/* console.log("Don't forget functions!")
console.log("Don't forget instance IDs in source map!!! - ADD TESTS!")
console.log("Don't forget to add tests for objects with functions!")
console.log('Add comment to the create instance regarding the unset usage') */
