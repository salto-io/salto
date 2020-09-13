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
import { PrimitiveType, ElemID, PrimitiveTypes, Element, ObjectType, FieldDefinition, BuiltinTypes, ListType, TypeElement, InstanceElement, Value, isPrimitiveType, isObjectType, isListType, TypeMap, Values, CORE_ANNOTATIONS, StaticFile, calculateStaticFileHash, ReferenceExpression, INSTANCE_ANNOTATIONS } from '@salto-io/adapter-api'
import _ from 'lodash'
import { uniqueNamesGenerator, adjectives, colors, names } from 'unique-names-generator'
import { collections } from '@salto-io/lowerdash'
import fs from 'fs'
import seedrandom from 'seedrandom'

const { arrayOf } = collections.array

export type GeneratorParams = {
    seed: number
    numOfPrimitiveTypes: number
    numOfTypes: number
    numOfObjs: number
    numOfRecords: number
    primitiveFieldFreq: number
    builtinFieldFreq: number
    listFieldFreq: number
    numOfProfiles: number
    maxRank: number
    multilineFreq: number
    fieldsNumMean: number
    fieldsNumStd: number
    objectAnnoMean: number
    objectAnnoStd: number
    primAnnoMean: number
    primAnnoStd: number
    typetAnnoMean: number
    typetAnnoStd: number
    staticFileFreq: number
    parentFreq: number
    refFreq: number
    multilLinesStringLinesMean: number
    multilLinesStringLinesStd: number
    staticFileLinesMean: number
    staticFileLinesStd: number
}

export const defaultParams: GeneratorParams = {
  seed: 123456,
  numOfPrimitiveTypes: 100,
  numOfTypes: 100,
  numOfObjs: 100,
  numOfRecords: 100,
  primitiveFieldFreq: 0.3,
  builtinFieldFreq: 0.3,
  listFieldFreq: 0.3,
  numOfProfiles: 30,
  maxRank: 4,
  multilineFreq: 0.1,
  fieldsNumMean: 5,
  fieldsNumStd: 2,
  objectAnnoMean: 5,
  objectAnnoStd: 2,
  primAnnoMean: 5,
  primAnnoStd: 2,
  typetAnnoMean: 5,
  typetAnnoStd: 2,
  staticFileFreq: 0.05,
  parentFreq: 0.3,
  refFreq: 0.05,
  multilLinesStringLinesMean: 10,
  multilLinesStringLinesStd: 4,
  staticFileLinesMean: 20,
  staticFileLinesStd: 10,
}

export const DUMMY_ADAPTER = 'dummy'

const defaultObj = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'DEFULT'),
  fields: {
    legit: { type: BuiltinTypes.STRING },
  },
  path: [DUMMY_ADAPTER, 'Default', 'Default'],
})

const permissionsType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'Permissions'),
  fields: {
    name: { type: BuiltinTypes.STRING },
    read: { type: BuiltinTypes.BOOLEAN },
    write: { type: BuiltinTypes.BOOLEAN },
    edit: { type: BuiltinTypes.BOOLEAN },
  },
  path: [DUMMY_ADAPTER, 'Default', 'Permissions'],
})

const profileType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'Profile'),
  fields: {
    ObjectLevelPermissions: { type: new ListType(permissionsType) },
    FieldLevelPermissions: { type: new ListType(permissionsType) },
  },
  path: [DUMMY_ADAPTER, 'Default', 'Profile'],
})

export const generateElements = (params: GeneratorParams): Element[] => {
  seedrandom(params.seed.toString(), { global: true })
  const elementRanks: Record<string, number> = {}
  const primitiveByRank: PrimitiveType[][] = arrayOf(defaultParams.maxRank + 1, () => [])
  const objByRank: ObjectType[][] = arrayOf(defaultParams.maxRank + 1, () => [])
  objByRank[0][0] = defaultObj
  const stringLinesOpts = JSON.parse(
    Buffer.from(fs.readFileSync(`${__dirname}/data/strings.dat`, 'utf8'), 'base64').toString()
  )
  const staticFileIds: Set<string> = new Set()
  const referenceFields: Set<string> = new Set()
  // Standard Normal variate using Marsaglia polar method
  const normalRandom = (mean: number, stdDev: number): number => {
    let u; let v
    let s: number
    do {
      u = (Math.random() * 2) - 1
      v = (Math.random() * 2) - 1
      s = u * u + v * v
    } while (s >= 1 || s === 0)
    s = Math.sqrt(-2.0 * (Math.log(s) / s))
    return Math.floor(mean + (stdDev * u * s))
  }

  const weightedRandomSelect = <T>(items: T[], weights?: number[]): T => {
    const rValue = Math.random()
    let sumOfWeights = 0
    // I also hate disabling lint - but in this specific case I think its legit.
    // Just makes the code simpler... (lint does not allow for/in loops)
    // eslint-disable-next-line
    for (const i in items) {
      const itemWeight = weights ? weights[i] : 1 / items.length
      sumOfWeights += itemWeight
      if (rValue < sumOfWeights) {
        return items[i]
      }
    }
    return items[items.length - 1]
  }

  const getFieldType = (allowLists = false): TypeElement => {
    const fieldTypeOptions = [
      Object.values(BuiltinTypes),
      weightedRandomSelect(primitiveByRank.slice(0, -1)) || [],
      weightedRandomSelect(objByRank.slice(0, -1)) || [],
    ]
    const fieldTypeWeights = [
      defaultParams.builtinFieldFreq,
      defaultParams.primitiveFieldFreq,
      1 - defaultParams.builtinFieldFreq - defaultParams.primitiveFieldFreq,
    ]
    const fieldType = weightedRandomSelect(
      fieldTypeOptions.filter(l => l.length > 0)
        .map(opt => weightedRandomSelect(opt as TypeElement[])),
      fieldTypeWeights.filter((_l, i) => fieldTypeOptions[i].length > 0)
    )
    if (allowLists && Math.random() < defaultParams.listFieldFreq) {
      return new ListType(fieldType)
    }
    return fieldType
  }

  const getName = (): string => {
    const name = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, names],
      style: 'capital',
      separator: '',
    })
    return name
  }

  const getMaxRank = (elements: Element[]): number => (elements.length > 0
    ? Math.max(...elements
      .map(e => (isListType(e) ? e.innerType : e))
      .map(e => elementRanks[e.elemID.getFullName()] || 0)) : 0)

  const updateElementRank = (element: TypeElement): void => {
    const maxAnnotationRank = getMaxRank(Object.values(element.annotationTypes))
    const maxFieldsRank = isObjectType(element)
      ? getMaxRank(Object.values(element.fields).map(field => field.type))
      : 0
    const rank = Math.max(maxAnnotationRank, maxFieldsRank)
    elementRanks[element.elemID.getFullName()] = rank + 1
    if (isObjectType(element)) {
      objByRank[rank].push(element)
    }
    if (isPrimitiveType(element)) {
      primitiveByRank[rank].push(element)
    }
  }

  const getListLength = (): number => 10

  const getSingleLine = (): string => (
    stringLinesOpts[Math.floor(Math.random() * stringLinesOpts.length)]
  )
  const getMultiLine = (numOflines: number): string => (
    arrayOf(numOflines, getSingleLine).join('\n')
  )
  const generateBoolean = (): boolean => Math.random() < 0.5
  const generateNumber = (): number => Math.floor(Math.random() * 1000)
  const generateString = (): string => (Math.random() > defaultParams.multilineFreq
    ? getSingleLine()
    : getMultiLine(
      normalRandom(params.multilLinesStringLinesMean, params.multilLinesStringLinesStd)
    ))

  const generateFileContent = (): Buffer => Buffer.from(getMultiLine(
    normalRandom(params.staticFileLinesMean, params.staticFileLinesStd)
  ))
  const chooseObjIgnoreRank = (): ObjectType => weightedRandomSelect(
    weightedRandomSelect(objByRank.filter(rank => rank.length > 0))
  ) || defaultObj

  const generateValue = (ref: TypeElement): Value => {
    if (staticFileIds.has(ref.elemID.getFullName())) {
      const content = generateFileContent()
      return new StaticFile({
        content,
        hash: calculateStaticFileHash(content),
        filepath: [getName(), 'txt'].join('.'),
      })
    }
    if (referenceFields.has(ref.elemID.getFullName())) {
      return new ReferenceExpression(chooseObjIgnoreRank().elemID)
    }
    if (isPrimitiveType(ref)) {
      switch (ref.primitive) {
        case PrimitiveTypes.STRING: return generateString()
        case PrimitiveTypes.NUMBER: return generateNumber()
        case PrimitiveTypes.BOOLEAN: return generateBoolean()
        default: generateString()
      }
    }
    if (isObjectType(ref)) {
      return _.mapValues(ref.fields, field => generateValue(field.type))
    }
    if (isListType(ref)) {
      return arrayOf(getListLength(), () => generateValue(ref.innerType))
    }
    // Linter token
    return undefined
  }

  const generateFields = (): Record<string, FieldDefinition> => _.fromPairs(
    arrayOf(
      normalRandom(defaultParams.fieldsNumMean, defaultParams.fieldsNumStd),
      () => {
        const name = getName()
        const fieldType = getFieldType(true)
        return [name, { type: fieldType, annotations: generateValue(fieldType) }]
      }
    )
  )


  const generateAnnotationTypes = (annoNum: number): TypeMap => _.fromPairs(
    arrayOf(annoNum, () => [getName(), getFieldType()])
  )

  const generateAnnotations = (annoTypes: TypeMap, hidden = false): Values => {
    const anno = _.mapValues(annoTypes, type => generateValue(type))
    if (hidden) {
      anno[CORE_ANNOTATIONS.HIDDEN] = true
    }
    return anno
  }

  // Note that this has side effects tracking the static fields and reference fields
  const generatePrimitiveTypes = (): PrimitiveType[] => arrayOf(params.numOfPrimitiveTypes, () => {
    const name = getName()
    const annotationTypes = generateAnnotationTypes(
      normalRandom(defaultParams.primAnnoMean, defaultParams.primAnnoStd)
    )
    const element = new PrimitiveType({
      elemID: new ElemID(DUMMY_ADAPTER, name),
      primitive: weightedRandomSelect([
        PrimitiveTypes.BOOLEAN,
        PrimitiveTypes.STRING,
        PrimitiveTypes.NUMBER,
      ]),
      annotationTypes,
      annotations: generateAnnotations(annotationTypes, true),
      path: [DUMMY_ADAPTER, 'Types', name],
    })
    updateElementRank(element)
    if (element.primitive === PrimitiveTypes.STRING
        && Math.random() < defaultParams.staticFileFreq) {
      staticFileIds.add(element.elemID.getFullName())
    } else if (Math.random() < defaultParams.staticFileFreq) {
      referenceFields.add(element.elemID.getFullName())
    }
    return element
  })


  const generateTypes = (): ObjectType[] => arrayOf(params.numOfTypes, () => {
    const name = getName()
    const annotationTypes = generateAnnotationTypes(
      normalRandom(defaultParams.typetAnnoMean, defaultParams.typetAnnoStd)
    )
    const objType = new ObjectType({
      elemID: new ElemID(DUMMY_ADAPTER, name),
      fields: generateFields(),
      annotationTypes,
      annotations: generateAnnotations(annotationTypes, true),
      path: [DUMMY_ADAPTER, 'Types', name],
    })
    updateElementRank(objType)
    return objType
  })


  const generateObjects = (): ObjectType[] => _.flatten(
    arrayOf(params.numOfObjs, () => {
      const name = getName()
      const annotationTypes = generateAnnotationTypes(
        normalRandom(defaultParams.objectAnnoMean, defaultParams.objectAnnoStd)
      )
      const fullObjType = new ObjectType({
        elemID: new ElemID(DUMMY_ADAPTER, name),
        fields: generateFields(),
        annotationTypes,
        annotations: generateAnnotations(annotationTypes),
      })
      const fieldsObjType = new ObjectType({
        elemID: fullObjType.elemID,
        fields: fullObjType.fields,
        path: [DUMMY_ADAPTER, 'Objects', name, `${name}Fields`],
      })
      const annoTypesObjType = new ObjectType({
        elemID: fullObjType.elemID,
        annotationTypes: fullObjType.annotationTypes,
        annotations: fullObjType.annotations,
        path: [DUMMY_ADAPTER, 'Objects', name, `${name}Annotations`],
      })
      updateElementRank(fullObjType)
      return [fieldsObjType, annoTypesObjType]
    })
  )

  const generateRecords = (
  ): InstanceElement[] => arrayOf(params.numOfRecords, () => {
    const objectTypes = _.flatten(objByRank)
    const name = getName()
    const instanceType = weightedRandomSelect(objectTypes)
    const record = new InstanceElement(
      name,
      instanceType,
      generateValue(instanceType),
      [DUMMY_ADAPTER, 'Records', instanceType.elemID.name, name]
    )
    if (Math.random() < defaultParams.parentFreq) {
      record.annotations[INSTANCE_ANNOTATIONS.PARENT] = new ReferenceExpression(
        chooseObjIgnoreRank().elemID
      )
    }
    return record
  })

  const generateProfileLike = (): InstanceElement[] => {
    const objects = _.flatten(objByRank)
    const allObjectsIDs = objects.map(obj => obj.elemID.getFullName())
    const allFieldsIDs = objects.flatMap(
      obj => Object.values(obj.fields).map(field => field.elemID.getFullName())
    )
    return arrayOf(
      params.numOfProfiles,
      () => {
        const name = getName()
        return new InstanceElement(
          name,
          profileType,
          {
            ObjectLevelPermissions: allObjectsIDs.map(id => ({
              name: id,
              read: generateBoolean(),
              write: generateBoolean(),
              edit: generateBoolean(),
            })),
            FieldLevelPermissions: allFieldsIDs.map(id => ({
              name: id,
              read: generateBoolean(),
              write: generateBoolean(),
              edit: generateBoolean(),
            })),
          },
          [DUMMY_ADAPTER, 'Records', 'Profile', name]
        )
      }
    )
  }

  const defaultTypes = [defaultObj, permissionsType, profileType]
  const primtiveTypes = generatePrimitiveTypes()
  const types = generateTypes()
  const objects = generateObjects()
  const records = generateRecords()
  const profiles = generateProfileLike()
  return [
    ...defaultTypes,
    ...primtiveTypes,
    ...types,
    ...records,
    ...objects,
    ...profiles,
  ]
}
