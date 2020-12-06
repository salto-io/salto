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
import {
  PrimitiveType, ElemID, PrimitiveTypes, Element, ObjectType,
  FieldDefinition, BuiltinTypes, ListType, TypeElement, InstanceElement,
  Value, isPrimitiveType, isObjectType, isListType, TypeMap, Values,
  CORE_ANNOTATIONS, StaticFile, calculateStaticFileHash, ReferenceExpression,
  getDeepInnerType, isContainerType, MapType, isMapType, ProgressReporter,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
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
    numOfMapChunks: number
    primitiveFieldFreq: number
    builtinFieldFreq: number
    listFieldFreq: number
    mapFieldFreq: number
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
    listLengthMean: number
    listLengthStd: number
    useOldProfiles: boolean
}

export const defaultParams: GeneratorParams = {
  seed: 123456,
  numOfRecords: 522,
  numOfPrimitiveTypes: 44,
  numOfObjs: 103,
  numOfMapChunks: 3,
  numOfProfiles: 0,
  numOfTypes: 496,
  maxRank: 9,
  primitiveFieldFreq: 0.349,
  builtinFieldFreq: 0.56,
  listFieldFreq: 0.0272,
  mapFieldFreq: 0.005,
  fieldsNumMean: 8.8,
  fieldsNumStd: 10.9,
  objectAnnoMean: 20.3,
  objectAnnoStd: 2.48,
  primAnnoMean: 10.6,
  primAnnoStd: 7.0,
  typetAnnoMean: 5.8,
  typetAnnoStd: 1.12,
  parentFreq: 2.12,
  refFreq: 0.015,
  staticFileFreq: 0.00278,
  multilLinesStringLinesMean: 3.2,
  multilLinesStringLinesStd: 0.97,
  multilineFreq: 0.002,
  staticFileLinesMean: 9.1,
  staticFileLinesStd: 4.85,
  listLengthMean: 8.7,
  listLengthStd: 3.6,
  useOldProfiles: false,
}

export const DUMMY_ADAPTER = 'dummy'

const defaultObj = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'DEFAULT'),
  fields: {
    legit: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
  },
  path: [DUMMY_ADAPTER, 'Default', 'Default'],
})

const permissionsType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'Permissions'),
  fields: {
    name: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    read: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
    write: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
    edit: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
  },
  path: [DUMMY_ADAPTER, 'Default', 'Permissions'],
})

const layoutAssignmentsType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'LayoutAssignments'),
  fields: {
    layout: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    recordType: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
  },
})

const oldProfileType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'Profile'),
  fields: {
    ObjectLevelPermissions: { refType: createRefToElmWithValue(new ListType(permissionsType)) },
    FieldLevelPermissions: { refType: createRefToElmWithValue(new ListType(permissionsType)) },
  },
  path: [DUMMY_ADAPTER, 'Default', 'Profile'],
})

const profileType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'Profile'),
  fields: {
    ObjectLevelPermissions: {
      refType: createRefToElmWithValue(new MapType(permissionsType)),
    },
    FieldLevelPermissions: {
      refType: createRefToElmWithValue(new MapType(new MapType(permissionsType))),
    },
    LayoutAssignments: {
      refType: createRefToElmWithValue(new MapType(new ListType(layoutAssignmentsType))),
    },
  },
  path: [DUMMY_ADAPTER, 'Default', 'Profile'],
})

export const generateElements = (
  params: GeneratorParams,
  progressReporter?: ProgressReporter
): Element[] => {
  seedrandom(params.seed.toString(), { global: true })
  const elementRanks: Record<string, number> = {}
  const primitiveByRank: PrimitiveType[][] = arrayOf(defaultParams.maxRank + 1, () => [])
  const objByRank: ObjectType[][] = arrayOf(defaultParams.maxRank + 1, () => [])
  objByRank[0][0] = defaultObj
  const datFilePath = process.env.SALTO_DUMMY_ADAPTER_DAT_FILE_PATH || `${__dirname}/data/strings.dat`
  const stringLinesOpts = JSON.parse(
    Buffer.from(fs.readFileSync(datFilePath, 'utf8'), 'base64').toString()
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

  const getFieldType = (allowContainers = false): TypeElement => {
    const fieldTypeOptions = [
      Object.values(BuiltinTypes).filter(type => type !== BuiltinTypes.UNKNOWN),
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
    if (
      allowContainers
      && Math.random() < defaultParams.listFieldFreq + defaultParams.mapFieldFreq
    ) {
      if (Math.random() < (
        defaultParams.mapFieldFreq / (defaultParams.listFieldFreq + defaultParams.listFieldFreq)
      )) {
        return new MapType(fieldType)
      }
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
    return name.replace(/\W/g, '')
  }

  const getMaxRank = (elements: Element[]): number => (elements.length > 0
    ? Math.max(...elements
      .map(e => (isContainerType(e) ? getDeepInnerType(e) : e))
      .map(e => elementRanks[e.elemID.getFullName()] || 0)) : 0)

  const updateElementRank = (element: TypeElement): void => {
    const maxAnnotationRank = getMaxRank(Object.values(element.getAnnotationTypes()))
    const maxFieldsRank = isObjectType(element)
      ? getMaxRank(Object.values(element.fields).map(field => field.getType()))
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

  const getListLength = (): number => normalRandom(params.listLengthMean, params.listLengthStd)

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
      return _.mapValues(ref.fields, field => generateValue(field.getType()))
    }
    if (isListType(ref)) {
      return arrayOf(getListLength(), () => generateValue(ref.getInnerType()))
    }
    if (isMapType(ref)) {
      return Object.fromEntries(
        arrayOf(getListLength(), () => generateValue(ref.getInnerType())).map(
          (val, index) => [`k${index}`, val]
        )
      )
    }
    // Linter token
    return undefined
  }

  const generateAnnotations = (annoTypes: TypeMap, hidden = false): Values => {
    const anno = _.mapValues(annoTypes, type => generateValue(type))
    if (hidden) {
      anno[CORE_ANNOTATIONS.HIDDEN] = true
    }
    return anno
  }

  const generateFields = (): Record<string, FieldDefinition> => Object.fromEntries(
    arrayOf(
      normalRandom(defaultParams.fieldsNumMean, defaultParams.fieldsNumStd),
      () => {
        const name = getName()
        const fieldType = getFieldType(true)
        return [name, {
          refType: createRefToElmWithValue(fieldType),
          annotations: generateAnnotations(
            // don't generate random annotations for builtin types, even if they
            // support additional annotation types
            fieldType === BuiltinTypes.HIDDEN_STRING ? {} : fieldType.getAnnotationTypes()
          ),
        }]
      }
    )
  )


  const generateAnnotationTypes = (annoNum: number): TypeMap => Object.fromEntries(
    arrayOf(annoNum, () => [getName(), getFieldType()])
  )

  // Note that this has side effects tracking the static fields and reference fields
  const generatePrimitiveTypes = (): PrimitiveType[] => arrayOf(params.numOfPrimitiveTypes, () => {
    const name = getName()
    const annotationRefsOrTypes = generateAnnotationTypes(
      normalRandom(defaultParams.primAnnoMean, defaultParams.primAnnoStd)
    )
    const element = new PrimitiveType({
      elemID: new ElemID(DUMMY_ADAPTER, name),
      primitive: weightedRandomSelect([
        PrimitiveTypes.BOOLEAN,
        PrimitiveTypes.STRING,
        PrimitiveTypes.NUMBER,
      ]),
      annotationRefsOrTypes,
      annotations: generateAnnotations(annotationRefsOrTypes, true),
      path: [DUMMY_ADAPTER, 'Types', name],
    })
    updateElementRank(element)
    if (element.primitive === PrimitiveTypes.STRING
        && Math.random() < 1) { // defaultParams.staticFileFreq) {
      staticFileIds.add(element.elemID.getFullName())
    } else if (Math.random() < defaultParams.staticFileFreq) {
      referenceFields.add(element.elemID.getFullName())
    }
    return element
  })


  const generateTypes = (): ObjectType[] => arrayOf(params.numOfTypes, () => {
    const name = getName()
    const annotationRefsOrTypes = generateAnnotationTypes(
      normalRandom(defaultParams.typetAnnoMean, defaultParams.typetAnnoStd)
    )
    const objType = new ObjectType({
      elemID: new ElemID(DUMMY_ADAPTER, name),
      fields: generateFields(),
      annotationRefsOrTypes,
      annotations: generateAnnotations(annotationRefsOrTypes, true),
      path: [DUMMY_ADAPTER, 'Types', name],
    })
    updateElementRank(objType)
    return objType
  })


  const generateObjects = (): ObjectType[] => arrayOf(params.numOfObjs, () => {
    const name = getName()
    const annotationRefsOrTypes = generateAnnotationTypes(
      normalRandom(defaultParams.objectAnnoMean, defaultParams.objectAnnoStd)
    )
    const fullObjType = new ObjectType({
      elemID: new ElemID(DUMMY_ADAPTER, name),
      fields: generateFields(),
      annotationRefsOrTypes,
      annotations: generateAnnotations(annotationRefsOrTypes),
    })
    const fieldsObjType = new ObjectType({
      elemID: fullObjType.elemID,
      fields: fullObjType.fields,
      path: [DUMMY_ADAPTER, 'Objects', name, `${name}Fields`],
    })
    const annoTypesObjType = new ObjectType({
      elemID: fullObjType.elemID,
      annotationRefsOrTypes: fullObjType.getAnnotationTypes(),
      annotations: fullObjType.annotations,
      path: [DUMMY_ADAPTER, 'Objects', name, `${name}Annotations`],
    })
    updateElementRank(fullObjType)
    return [fieldsObjType, annoTypesObjType]
  }).flat()


  const generateRecords = (
  ): InstanceElement[] => arrayOf(params.numOfRecords, () => {
    const objectTypes = objByRank.flat()
    const name = getName()
    const instanceType = weightedRandomSelect(objectTypes)
    const record = new InstanceElement(
      name,
      new ReferenceExpression(instanceType.elemID, instanceType),
      generateValue(instanceType),
      [DUMMY_ADAPTER, 'Records', instanceType.elemID.name, name]
    )
    if (Math.random() < defaultParams.parentFreq) {
      record.annotations[CORE_ANNOTATIONS.PARENT] = new ReferenceExpression(
        chooseObjIgnoreRank().elemID
      )
    }
    return record
  })

  const generateProfileLike = (useOldProfile = false): InstanceElement[] => {
    const objects = objByRank.flat()
    const allObjectsIDs = objects.map(obj => obj.elemID.getFullName())
    const allFieldsIDs = objects.flatMap(
      obj => Object.values(obj.fields).map(field => field.elemID.getFullName())
    )

    const generatePermissions = (ids: string[]): Values[] => (
      ids.map(id => ({
        name: id,
        read: generateBoolean(),
        write: generateBoolean(),
        edit: generateBoolean(),
      }))
    )

    const generateLayoutAssignments = (ids: string[]): Values[] => (
      ids.map((id, index) => ({
        layout: `layout_${id}`,
        ...(index % 2 === 0 ? {} : { recordType: `rec_${id}` }),
      }))
    )

    function toFlatMap(arr: Values[], key: string): Record<string, Values> {
      return Object.fromEntries(arr.map(p => [p?.[key].split('.').pop(), p]))
    }
    function toNestedMap(arr: Values[], key: string): Record<string, Record<string, Values>> {
      return Object.fromEntries(
        _.chunk(arr, arr.length / params.numOfMapChunks).map(c => toFlatMap(c, key)).map((m, i) => [`chunk${i}`, m])
      )
    }
    function toListMap(arr: Values[], key: string): Record<string, Values[]> {
      return Object.fromEntries(
        _.chunk(arr, arr.length / params.numOfMapChunks).map(c => [c[0]?.[key].split('.').pop(), c])
      )
    }

    return arrayOf(
      params.numOfProfiles,
      () => {
        const name = getName()
        const objectPermissions = generatePermissions(allObjectsIDs)
        const fieldPermissions = generatePermissions(allFieldsIDs)
        const layoutAssignments = generateLayoutAssignments(allObjectsIDs)
        if (useOldProfile) {
          return [new InstanceElement(
            name,
            new ReferenceExpression(oldProfileType.elemID, oldProfileType),
            {
              fullName: name,
              ObjectLevelPermissions: objectPermissions,
              FieldLevelPermissions: fieldPermissions,
            },
            [DUMMY_ADAPTER, 'Records', 'Profile', name],
          )]
        }
        const profileTypeRef = new ReferenceExpression(profileType.elemID, profileType)
        return [
          new InstanceElement(
            name,
            profileTypeRef,
            {
              fullName: name,
            },
            [DUMMY_ADAPTER, 'Records', 'Profile', name, 'Attributes'],
          ),
          new InstanceElement(
            name,
            profileTypeRef,
            {
              ObjectLevelPermissions: toFlatMap(objectPermissions, 'name'),
            },
            [DUMMY_ADAPTER, 'Records', 'Profile', name, 'ObjectLevelPermissions'],
          ),
          new InstanceElement(
            name,
            profileTypeRef,
            {
              FieldLevelPermissions: toNestedMap(fieldPermissions, 'name'),
            },
            [DUMMY_ADAPTER, 'Records', 'Profile', name, 'FieldLevelPermissions'],
          ),
          new InstanceElement(
            name,
            profileTypeRef,
            {
              LayoutAssignments: toListMap(layoutAssignments, 'layout'),
            },
            [DUMMY_ADAPTER, 'Records', 'Profile', name, 'LayoutAssignments'],
          ),
        ]
      }
    ).flat()
  }
  const reportProgress = (details: string, completedPercents: number): void => {
    if (progressReporter) progressReporter.reportProgress({ details, completedPercents })
  }
  const defaultTypes = [defaultObj, permissionsType, profileType]
  reportProgress('Generating primitive types', 10)
  const primtiveTypes = generatePrimitiveTypes()
  reportProgress('Generating types', 30)
  const types = generateTypes()
  reportProgress('Generating objects', 50)
  const objects = generateObjects()
  reportProgress('Generating records', 70)
  const records = generateRecords()
  reportProgress('Generating profile likes', 90)
  const profiles = generateProfileLike(params.useOldProfiles)
  reportProgress('Generation done', 100)
  return [
    ...defaultTypes,
    ...primtiveTypes,
    ...types,
    ...records,
    ...objects,
    ...profiles,
  ]
}
