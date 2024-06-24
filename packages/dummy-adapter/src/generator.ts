/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  PrimitiveType,
  ElemID,
  PrimitiveTypes,
  Element,
  ObjectType,
  FieldDefinition,
  BuiltinTypes,
  ListType,
  TypeElement,
  InstanceElement,
  Value,
  isPrimitiveType,
  isObjectType,
  isListType,
  TypeMap,
  Values,
  CORE_ANNOTATIONS,
  StaticFile,
  calculateStaticFileHash,
  ReferenceExpression,
  getDeepInnerType,
  isContainerType,
  MapType,
  isMapType,
  ProgressReporter,
  createRefToElmWithValue,
  DeployActions,
  DeployAction,
  createRestriction,
  SeverityLevel,
  TemplateExpression,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { uniqueNamesGenerator, adjectives, colors, names } from 'unique-names-generator'
import { collections, promises, values as lowerDashValues } from '@salto-io/lowerdash'
import fs from 'fs'
import path from 'path'
import seedrandom from 'seedrandom'
import readdirp from 'readdirp'
import { merger, expressions, elementSource } from '@salto-io/workspace'
import { parser, parserUtils } from '@salto-io/parser'
import {
  createMatchingObjectType,
  createTemplateExpression,
  ImportantValues,
  inspectValue,
} from '@salto-io/adapter-utils'

const { isDefined } = lowerDashValues
const { mapValuesAsync } = promises.object
const { arrayOf } = collections.array
const { awu } = collections.asynciterable
const log = logger(module)

export const DUMMY_ADAPTER = 'dummy'

export type ChangeErrorFromConfigFile = {
  detailedMessage: string
  elemID: string
  message: string
  severity: SeverityLevel
  deployActions?: DeployActions
}

const deployActionType = createMatchingObjectType<DeployAction>({
  elemID: new ElemID(DUMMY_ADAPTER, 'deployAction'),
  fields: {
    title: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    description: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: false,
      },
    },
    subActions: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        _required: true,
      },
    },
    documentationURL: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: false,
      },
    },
  },
})

const deployActionsType = createMatchingObjectType<DeployActions>({
  elemID: new ElemID(DUMMY_ADAPTER, 'deployActions'),
  fields: {
    preAction: { refType: deployActionType },
    postAction: { refType: deployActionType },
  },
})

export const changeErrorType = createMatchingObjectType<ChangeErrorFromConfigFile>({
  elemID: new ElemID(DUMMY_ADAPTER, 'changeError'),
  fields: {
    detailedMessage: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    elemID: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    message: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    severity: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: ['Info', 'Warning', 'Error'],
          enforce_value: true,
        }),
      },
    },
    deployActions: {
      refType: deployActionsType,
    },
  },
})

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
  templateExpressionFreq?: number
  templateStaticFileFreq?: number
  parentFreq: number
  refFreq: number
  multilLinesStringLinesMean: number
  multilLinesStringLinesStd: number
  staticFileLinesMean: number
  staticFileLinesStd: number
  listLengthMean: number
  listLengthStd: number
  changeErrors?: ChangeErrorFromConfigFile[]
  extraNaclPaths?: string[]
  generateEnvName?: string
  fieldsToOmitOnDeploy?: string[]
  elementsToExclude?: string[]
  importantValuesFreq?: number
}

export const defaultParams: Omit<GeneratorParams, 'extraNaclPaths'> = {
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
  templateExpressionFreq: 0.0075,
  templateStaticFileFreq: 0,
  multilLinesStringLinesMean: 3.2,
  multilLinesStringLinesStd: 0.97,
  multilineFreq: 0.002,
  staticFileLinesMean: 9.1,
  staticFileLinesStd: 4.85,
  listLengthMean: 8.7,
  listLengthStd: 3.6,
  importantValuesFreq: 0.75,
}

const MOCK_NACL_SUFFIX = 'nacl.mock'
const templateExpressionFreqVal = defaultParams.templateExpressionFreq ?? 0.0075
const templateStaticFileFreqVal = defaultParams.templateStaticFileFreq ?? 0

const getDataPath = (): string => process.env.SALTO_DUMMY_ADAPTER_DATA_PATH || path.join(__dirname, 'data')

const defaultObj = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'DEFAULT'),
  fields: {
    legit: { refType: BuiltinTypes.STRING },
  },
  annotations: { [CORE_ANNOTATIONS.SERVICE_URL]: 'https://www.salto.io/' },
  path: [DUMMY_ADAPTER, 'Default', 'Default'],
})

const permissionsType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'Permissions'),
  fields: {
    name: { refType: BuiltinTypes.STRING },
    read: { refType: BuiltinTypes.BOOLEAN },
    write: { refType: BuiltinTypes.BOOLEAN },
    edit: { refType: BuiltinTypes.BOOLEAN },
  },
  path: [DUMMY_ADAPTER, 'Default', 'Permissions'],
})

const layoutAssignmentsType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'LayoutAssignments'),
  fields: {
    layout: { refType: BuiltinTypes.STRING },
    recordType: { refType: BuiltinTypes.STRING },
  },
  path: [DUMMY_ADAPTER, 'Default', 'LayoutAssignments'],
})

const profileType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'Profile'),
  fields: {
    ObjectLevelPermissions: {
      refType: new MapType(permissionsType),
    },
    FieldLevelPermissions: {
      refType: new MapType(new MapType(permissionsType)),
    },
    LayoutAssignments: {
      refType: new MapType(new ListType(layoutAssignmentsType)),
    },
  },
  path: [DUMMY_ADAPTER, 'Default', 'Profile'],
})

export const generateElements = async (
  params: GeneratorParams,
  progressReporter: ProgressReporter,
): Promise<Element[]> => {
  const randomGen = seedrandom(params.seed.toString())
  const elementRanks: Record<string, number> = {}
  const primitiveByRank: PrimitiveType[][] = arrayOf(defaultParams.maxRank + 1, () => [])
  const objByRank: ObjectType[][] = arrayOf(defaultParams.maxRank + 1, () => [])
  objByRank[0][0] = defaultObj
  const dataPath = getDataPath()
  const datFilePath = path.join(dataPath, 'strings.dat')
  const stringLinesOpts = JSON.parse(Buffer.from(fs.readFileSync(datFilePath, 'utf8'), 'base64').toString())
  const staticFileIds: Set<string> = new Set()
  const referenceFields: Set<string> = new Set()
  const templateExpressionFields: Set<string> = new Set()
  // Standard Normal variate using Marsaglia polar method
  const normalRandom = (mean: number, stdDev: number): number => {
    let u
    let v
    let s: number
    do {
      u = randomGen() * 2 - 1
      v = randomGen() * 2 - 1
      s = u * u + v * v
    } while (s >= 1 || s === 0)
    s = Math.sqrt(-2.0 * (Math.log(s) / s))
    return Math.max(Math.floor(mean + stdDev * u * s), 0)
  }

  const weightedRandomSelect = <T>(items: T[], weights?: number[]): T => {
    const rValue = randomGen()
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
      Object.values(BuiltinTypes).filter(type => type !== BuiltinTypes.UNKNOWN && type !== BuiltinTypes.HIDDEN_STRING),
      weightedRandomSelect(primitiveByRank.slice(0, -1)) || [],
      weightedRandomSelect(objByRank.slice(0, -1)) || [],
    ]
    const fieldTypeWeights = [
      defaultParams.builtinFieldFreq,
      defaultParams.primitiveFieldFreq,
      1 - defaultParams.builtinFieldFreq - defaultParams.primitiveFieldFreq,
    ]
    const fieldType = weightedRandomSelect(
      fieldTypeOptions.filter(l => l.length > 0).map(opt => weightedRandomSelect(opt as TypeElement[])),
      fieldTypeWeights.filter((_l, i) => fieldTypeOptions[i].length > 0),
    )
    if (allowContainers && randomGen() < defaultParams.listFieldFreq + defaultParams.mapFieldFreq) {
      if (randomGen() < defaultParams.mapFieldFreq / (defaultParams.listFieldFreq + defaultParams.listFieldFreq)) {
        return new MapType(fieldType)
      }
      return new ListType(fieldType)
    }
    return fieldType
  }
  const generatedNamesCount: Record<string, number> = {}
  const getName = (): string => {
    const name = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, names],
      style: 'capital',
      separator: '',
      seed: randomGen() * 10000000000000,
    })
    const cleanName = name.replace(/\W/g, '')
    generatedNamesCount[cleanName] = generatedNamesCount[cleanName] ?? 0
    const uniqueName =
      generatedNamesCount[cleanName] === 0 ? cleanName : `${cleanName}${generatedNamesCount[cleanName] + 1}`
    generatedNamesCount[cleanName] += 1
    return uniqueName
  }

  const getMaxRank = async (elements: Element[]): Promise<number> =>
    elements.length > 0
      ? Math.max(
          ...(await awu(elements)
            .map(e => (isContainerType(e) ? getDeepInnerType(e) : e))
            .map(e => elementRanks[e.elemID.getFullName()] || 0)
            .toArray()),
        )
      : 0

  const updateElementRank = async (element: TypeElement): Promise<void> => {
    const maxAnnotationRank = await getMaxRank(Object.values(await element.getAnnotationTypes()))
    const maxFieldsRank = isObjectType(element)
      ? await getMaxRank(await Promise.all(Object.values(element.fields).map(field => field.getType())))
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

  const getListLength = (): number => normalRandom(params.listLengthMean, params.listLengthStd) + 1

  const getSingleLine = (): string => stringLinesOpts[Math.floor(randomGen() * stringLinesOpts.length)]
  const getMultiLine = (numOflines: number): string => arrayOf(numOflines, getSingleLine).join('\n')
  const generateBoolean = (): boolean => randomGen() < 0.5
  const generateNumber = (): number => Math.floor(randomGen() * 1000)
  const generateString = (): string =>
    randomGen() > defaultParams.multilineFreq
      ? getSingleLine()
      : getMultiLine(normalRandom(params.multilLinesStringLinesMean, params.multilLinesStringLinesStd))

  const generateFileContent = (): Buffer =>
    Buffer.from(getMultiLine(normalRandom(params.staticFileLinesMean, params.staticFileLinesStd)))

  const generateImportantValues = (fieldNames: string[]): ImportantValues | undefined => {
    // the  important values should be only a small portion of the fields
    const finalFieldNames = fieldNames.filter(name => !name.startsWith('_'))
    const halfLength = Math.floor(finalFieldNames.length / 2 + 1)
    const randomNum = randomGen()
    const importantValuesFreq = params.importantValuesFreq ?? 1
    const randomNumToUse = randomNum < importantValuesFreq ? randomNum : 0
    const numberOfImportantValues = Math.floor(randomNumToUse * halfLength)
    const fieldSet = new Set<string>()
    const importantValuesDef = Array.from({ length: numberOfImportantValues })
      .map(() => {
        const value = weightedRandomSelect(finalFieldNames)
        if (fieldSet.has(value) || value === undefined) {
          return undefined
        }
        fieldSet.add(value)
        const singleImportantValue = {
          value,
          highlighted: generateBoolean(),
          indexed: generateBoolean(),
        }
        return singleImportantValue.highlighted === false && singleImportantValue.indexed === false
          ? undefined
          : singleImportantValue
      })
      .filter(isDefined)
    return !_.isEmpty(importantValuesDef) ? importantValuesDef : undefined
  }

  const chooseObjIgnoreRank = (): ObjectType =>
    weightedRandomSelect(weightedRandomSelect(objByRank.filter(rank => rank.length > 0))) || defaultObj

  const generateTemplateExpression = async (): Promise<TemplateExpression> => {
    const parts = await Promise.all(
      arrayOf(getListLength(), async () =>
        randomGen() < 0.5 ? generateString() : new ReferenceExpression(chooseObjIgnoreRank().elemID),
      ),
    )
    if (_.isEmpty(parts.filter(isReferenceExpression))) {
      parts.push(new ReferenceExpression(chooseObjIgnoreRank().elemID))
    }
    return createTemplateExpression({ parts })
  }

  const generateTemplateStaticFile = async (): Promise<StaticFile> => {
    const template = await generateTemplateExpression()
    const filepath = [getName(), 'txt'].join('.')
    return parserUtils.templateExpressionToStaticFile(template, filepath)
  }

  const generateValue = async (ref: TypeElement, isHidden?: boolean): Promise<Value> => {
    if (staticFileIds.has(ref.elemID.getFullName()) && !isHidden) {
      if (randomGen() < (params.templateStaticFileFreq ?? templateStaticFileFreqVal)) {
        return generateTemplateStaticFile()
      }
      const content = generateFileContent()
      return new StaticFile({
        content,
        hash: calculateStaticFileHash(content),
        filepath: [getName(), 'txt'].join('.'),
      })
    }
    if (referenceFields.has(ref.elemID.getFullName()) && !isHidden) {
      return new ReferenceExpression(chooseObjIgnoreRank().elemID)
    }
    if (templateExpressionFields.has(ref.elemID.getFullName()) && !isHidden) {
      return generateTemplateExpression()
    }
    if (isPrimitiveType(ref)) {
      switch (ref.primitive) {
        case PrimitiveTypes.STRING:
          return generateString()
        case PrimitiveTypes.NUMBER:
          return generateNumber()
        case PrimitiveTypes.BOOLEAN:
          return generateBoolean()
        default:
          generateString()
      }
    }
    if (isObjectType(ref)) {
      return mapValuesAsync(ref.fields, async field =>
        generateValue(
          await field.getType(),
          isHidden ||
            (await field.getType()).annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] ||
            ref.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE],
        ),
      )
    }
    if (isListType(ref)) {
      return Promise.all(
        arrayOf(getListLength(), async () =>
          generateValue(
            await ref.getInnerType(),
            isHidden || (await ref.getInnerType()).annotations[CORE_ANNOTATIONS.HIDDEN_VALUE],
          ),
        ),
      )
    }
    if (isMapType(ref)) {
      return Object.fromEntries(
        (
          await Promise.all(
            arrayOf(getListLength(), async () =>
              generateValue(
                await ref.getInnerType(),
                isHidden || (await ref.getInnerType()).annotations[CORE_ANNOTATIONS.HIDDEN_VALUE],
              ),
            ),
          )
        ).map((val, index) => [`k${index}`, val]),
      )
    }
    // Linter token
    return undefined
  }

  const generateAnnotations = async (annoTypes: TypeMap, hidden = false): Promise<Values> => {
    const anno = await mapValuesAsync(
      _.omit(annoTypes, [
        CORE_ANNOTATIONS.RESTRICTION,
        CORE_ANNOTATIONS.IMPORTANT_VALUES,
        CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES,
      ]) as TypeMap,
      type => generateValue(type, hidden),
    )
    if (hidden) {
      anno[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
    }
    return anno
  }

  const generateFields = async (inHiddenObj = false): Promise<Record<string, FieldDefinition>> =>
    Object.fromEntries(
      await Promise.all(
        arrayOf(normalRandom(defaultParams.fieldsNumMean, defaultParams.fieldsNumStd) + 1, async () => {
          const name = getName()
          const fieldType = getFieldType(true)
          return [
            name,
            {
              refType: fieldType,
              annotations: await generateAnnotations(
                // don't generate random annotations for builtin types, even if they
                // support additional annotation types
                fieldType === BuiltinTypes.HIDDEN_STRING ? {} : await fieldType.getAnnotationTypes(),
                inHiddenObj,
              ),
            },
          ]
        }),
      ),
    )

  const generateAnnotationTypes = (annoNum: number): TypeMap =>
    Object.fromEntries(arrayOf(annoNum, () => [getName(), getFieldType()]))

  // Note that this has side effects tracking the static fields and reference fields
  const generatePrimitiveTypes = (): Promise<PrimitiveType[]> =>
    Promise.all(
      arrayOf(params.numOfPrimitiveTypes, async () => {
        const name = getName()
        const annotationRefsOrTypes = generateAnnotationTypes(
          normalRandom(defaultParams.primAnnoMean, defaultParams.primAnnoStd),
        )
        const element = new PrimitiveType({
          elemID: new ElemID(DUMMY_ADAPTER, name),
          primitive: weightedRandomSelect([PrimitiveTypes.BOOLEAN, PrimitiveTypes.STRING, PrimitiveTypes.NUMBER]),
          annotationRefsOrTypes,
          annotations: await generateAnnotations(annotationRefsOrTypes, false),
          path: [DUMMY_ADAPTER, 'Types', name],
        })
        await updateElementRank(element)
        if (
          element.primitive === PrimitiveTypes.STRING &&
          randomGen() < (params.templateExpressionFreq ?? templateExpressionFreqVal)
        ) {
          templateExpressionFields.add(element.elemID.getFullName())
        } else if (element.primitive === PrimitiveTypes.STRING && randomGen() < 1) {
          // defaultParams.staticFileFreq) {
          staticFileIds.add(element.elemID.getFullName())
        } else if (randomGen() < defaultParams.refFreq) {
          referenceFields.add(element.elemID.getFullName())
        }
        return element
      }),
    )

  const generateTypes = async (): Promise<ObjectType[]> =>
    Promise.all(
      arrayOf(params.numOfTypes, async () => {
        const name = getName()
        const annotationRefsOrTypes = generateAnnotationTypes(
          normalRandom(defaultParams.typetAnnoMean, defaultParams.typetAnnoStd),
        )
        const objType = new ObjectType({
          elemID: new ElemID(DUMMY_ADAPTER, name),
          fields: await generateFields(true),
          annotationRefsOrTypes,
          annotations: await generateAnnotations(annotationRefsOrTypes, true),
          path: [DUMMY_ADAPTER, 'Types', name],
        })
        const fieldNames = Object.keys(objType.fields)
        const annotationNames = Object.keys(objType.annotations)
        objType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] = generateImportantValues(fieldNames)
        objType.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES] = generateImportantValues(annotationNames)
        await updateElementRank(objType)
        return objType
      }),
    )

  const generateObjects = async (): Promise<ObjectType[]> =>
    (
      await Promise.all(
        arrayOf(params.numOfObjs, async () => {
          const name = getName()
          const annotationRefsOrTypes = generateAnnotationTypes(
            normalRandom(defaultParams.objectAnnoMean, defaultParams.objectAnnoStd),
          )
          const fullObjType = new ObjectType({
            elemID: new ElemID(DUMMY_ADAPTER, name),
            fields: await generateFields(),
            annotationRefsOrTypes,
            annotations: await generateAnnotations(annotationRefsOrTypes),
          })
          const fieldNames = Object.keys(fullObjType.fields)
          const annotationNames = Object.keys(fullObjType.annotations)
          fullObjType.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] = generateImportantValues(fieldNames)
          fullObjType.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES] = generateImportantValues(annotationNames)
          fullObjType.annotations[CORE_ANNOTATIONS.ALIAS] = `${fullObjType.elemID.name}_alias`
          const fieldsObjType = new ObjectType({
            elemID: fullObjType.elemID,
            fields: fullObjType.fields,
            path: [DUMMY_ADAPTER, 'Objects', name, `${name}Fields`],
          })
          const annoTypesObjType = new ObjectType({
            elemID: fullObjType.elemID,
            annotationRefsOrTypes: await fullObjType.getAnnotationTypes(),
            annotations: fullObjType.annotations,
            path: [DUMMY_ADAPTER, 'Objects', name, `${name}Annotations`],
          })
          await updateElementRank(fullObjType)
          return [fieldsObjType, annoTypesObjType]
        }),
      )
    ).flat()

  const generateRecords = async (): Promise<InstanceElement[]> =>
    Promise.all(
      arrayOf(params.numOfRecords, async () => {
        const objectTypes = objByRank.flat()
        const name = getName()
        const instanceType = weightedRandomSelect(objectTypes)
        const record = new InstanceElement(
          name,
          instanceType,
          await generateValue(instanceType, instanceType.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]),
          [DUMMY_ADAPTER, 'Records', instanceType.elemID.name, name],
        )
        record.annotations[CORE_ANNOTATIONS.ALIAS] = `${name}_alias`
        if (randomGen() < defaultParams.parentFreq) {
          record.annotations[CORE_ANNOTATIONS.PARENT] = new ReferenceExpression(chooseObjIgnoreRank().elemID)
        }
        return record
      }),
    )

  const generateProfileLike = (): InstanceElement[] => {
    const objects = objByRank.flat()
    const allObjectsIDs = objects.map(obj => obj.elemID.getFullName())
    const allFieldsIDs = objects.flatMap(obj => Object.values(obj.fields).map(field => field.elemID.getFullName()))

    const generatePermissions = (ids: string[]): Values[] =>
      ids.map(id => ({
        name: id,
        read: generateBoolean(),
        write: generateBoolean(),
        edit: generateBoolean(),
      }))

    const generateLayoutAssignments = (ids: string[]): Values[] =>
      ids.map((id, index) => ({
        layout: `layout_${id}`,
        ...(index % 2 === 0 ? {} : { recordType: `rec_${id}` }),
      }))

    function toFlatMap(arr: Values[], key: string): Record<string, Values> {
      return Object.fromEntries(arr.map(p => [p?.[key].split('.').pop(), p]))
    }
    function toNestedMap(arr: Values[], key: string): Record<string, Record<string, Values>> {
      return Object.fromEntries(
        _.chunk(arr, arr.length / params.numOfMapChunks)
          .map(c => toFlatMap(c, key))
          .map((m, i) => [`chunk${i}`, m]),
      )
    }
    function toListMap(arr: Values[], key: string): Record<string, Values[]> {
      return Object.fromEntries(
        _.chunk(arr, arr.length / params.numOfMapChunks).map(c => [c[0]?.[key].split('.').pop(), c]),
      )
    }

    return arrayOf(params.numOfProfiles, () => {
      const name = getName()
      const objectPermissions = generatePermissions(allObjectsIDs)
      const fieldPermissions = generatePermissions(allFieldsIDs)
      const layoutAssignments = generateLayoutAssignments(allObjectsIDs)
      const profileTypeRef = createRefToElmWithValue(profileType)
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
    }).flat()
  }
  const generateExtraElements = async (naclDirs: string[]): Promise<Element[]> => {
    const allNaclMocks = (
      await Promise.all(
        naclDirs.map(naclDir =>
          readdirp.promise(naclDir, {
            fileFilter: [`*.${MOCK_NACL_SUFFIX}`],
          }),
        ),
      )
    ).flatMap(list => list)
    log.debug('the list of files read in generateExtraElements is: %s', allNaclMocks.map(mock => mock.path).join(' , '))
    const elements = await awu(
      allNaclMocks.map(async file => {
        const content = fs.readFileSync(file.fullPath, 'utf8')
        log.debug('content of file %s is %s', file.path, content)
        const parsedNaclFile = await parser.parse(Buffer.from(content), file.basename, {
          file: {
            parse: async funcParams => {
              const [filepath] = funcParams
              let fileContent: Buffer
              try {
                fileContent = fs.readFileSync(`${file.fullPath.replace(file.basename, '')}${filepath}`)
              } catch {
                fileContent = Buffer.from('THIS IS STATIC FILE')
              }
              return new StaticFile({
                content: fileContent,
                filepath,
              })
            },
            dump: async () => ({ funcName: 'file', parameters: [] }),
            isSerializedAsFunction: () => true,
          },
        })
        log.debug(`parsedNaclFile of file ${file.fullPath} is equal ${inspectValue(parsedNaclFile)}`)
        await awu(parsedNaclFile.elements).forEach(elem => {
          elem.path = [DUMMY_ADAPTER, 'extra', file.basename.replace(new RegExp(`.${MOCK_NACL_SUFFIX}$`), '')]
        })
        return parsedNaclFile.elements
      }),
    )
      .flat()
      .toArray()
    const mergedElements = await merger.mergeElements(awu(elements))
    log.debug(`mergedElements is equal ${inspectValue(mergedElements)}`)
    const inMemElemSource = elementSource.createInMemoryElementSource(
      await awu(mergedElements.merged.values()).toArray(),
    )
    return (await Promise.all(elements.map(async elem => expressions.resolve([elem], inMemElemSource)))).flat()
  }

  const generateEnvElements = (): Element[] => {
    const envID = params.generateEnvName ?? process.env.SALTO_ENV
    if (envID === undefined) return []
    const PrimWithHiddenAnnos = new PrimitiveType({
      elemID: new ElemID('dummy', 'PrimWithAnnos'),
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {
        SharedHidden: BuiltinTypes.HIDDEN_STRING,
        DiffHidden: BuiltinTypes.HIDDEN_STRING,
        active: BuiltinTypes.BOOLEAN,
        name: BuiltinTypes.STRING,
      },
      path: [DUMMY_ADAPTER, 'EnvStuff', 'PrimWithAnnos'],
      annotations: {
        [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [
          {
            value: 'active',
            indexed: true,
            highlighted: true,
          },
          {
            value: 'name',
            indexed: false,
            highlighted: false,
          },
        ],
      },
    })

    const sharedObj = new ObjectType({
      elemID: new ElemID(DUMMY_ADAPTER, 'EnvObj'),
      fields: {
        SharedField: {
          refType: BuiltinTypes.STRING,
        },
        SharedButDiffField: {
          refType: BuiltinTypes.STRING,
        },
        [`${envID}Field`]: {
          refType: BuiltinTypes.STRING,
        },
        [`${envID}FieldWithHidden`]: {
          refType: PrimWithHiddenAnnos,
          annotations: {
            SharedHidden: 'HIDDEN!',
            DiffHidden: `${envID}-HIDDENNNN!!!!`,
            active: true,
            name: 'test',
          },
        },
      },
      annotationRefsOrTypes: {
        ShardAnno: BuiltinTypes.STRING,
        SharedButDiffAnno: BuiltinTypes.STRING,
        [`${envID}Anno`]: BuiltinTypes.STRING,
        SharedHidden: BuiltinTypes.HIDDEN_STRING,
        DiffHidden: BuiltinTypes.HIDDEN_STRING,
      },
      annotations: {
        SharedAnno: 'AnnoValue',
        SharedButDiffAnno: `${envID}AnnoValue`,
        [`${envID}Anno`]: 'AnnoValue',
        SharedHidden: 'HIDDEN!',
        DiffHidden: `${envID}-HIDDENNNN!!!!`,
        [CORE_ANNOTATIONS.ALIAS]: 'EnvObj_alias',
        [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [
          {
            value: 'SharedButDiffField',
            indexed: true,
            highlighted: true,
          },
          {
            value: 'SharedField',
            indexed: false,
            highlighted: false,
          },
          {
            value: 'doesNotExist',
            indexed: false,
            highlighted: true,
          },
        ],
        [CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES]: [
          {
            value: 'SharedButDiffAnno',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'SharedAnno',
            indexed: false,
            highlighted: true,
          },
        ],
      },
      path: [DUMMY_ADAPTER, 'EnvStuff', 'EnvObj'],
    })
    const sharedInst = new InstanceElement(
      'EnvInst',
      sharedObj,
      {
        SharedField: 'FieldValue',
        SharedButDiffField: `${envID}FieldValue`,
        [`${envID}Field`]: 'FieldValue',
      },
      [DUMMY_ADAPTER, 'EnvStuff', 'EnvInst'],
      {
        [CORE_ANNOTATIONS.SERVICE_URL]: `http://www.somthing.com/${envID}`,
        [CORE_ANNOTATIONS.ALIAS]: 'EnvInst_alias',
      },
    )
    const envSpecificObj = new ObjectType({
      elemID: new ElemID(DUMMY_ADAPTER, `${envID}EnvObj`),
      fields: {
        Field: {
          refType: BuiltinTypes.STRING,
        },
        active: {
          refType: BuiltinTypes.BOOLEAN,
        },
      },
      path: [DUMMY_ADAPTER, 'EnvStuff', `${envID}EnvObj`],
      annotations: {
        [CORE_ANNOTATIONS.ALIAS]: `${envID}EnvObj_alias`,
        [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [
          {
            value: 'Field',
            indexed: false,
            highlighted: true,
          },
          {
            value: 'active',
            indexed: true,
            highlighted: false,
          },
        ],
      },
    })
    const envSpecificInst = new InstanceElement(
      `${envID}EnvInst`,
      envSpecificObj,
      {
        Field: 'FieldValue',
        active: true,
      },
      [DUMMY_ADAPTER, 'EnvStuff', `${envID}EnvInst`],
      {
        [CORE_ANNOTATIONS.ALIAS]: `${envID}EnvInst_alias`,
      },
    )
    const res = [envSpecificInst, sharedObj, sharedInst, PrimWithHiddenAnnos]
    if (!process.env.SALTO_OMIT) {
      res.push(envSpecificObj)
    }
    return res
  }

  const defaultTypes = [defaultObj, permissionsType, profileType, layoutAssignmentsType]
  progressReporter.reportProgress({ message: 'Generating primitive types' })
  const primtiveTypes = await generatePrimitiveTypes()
  progressReporter.reportProgress({ message: 'Generating types' })
  const types = await generateTypes()
  progressReporter.reportProgress({ message: 'Generating objects' })
  const objects = await generateObjects()
  progressReporter.reportProgress({ message: 'Generating records' })
  const records = await generateRecords()
  progressReporter.reportProgress({ message: 'Generating profile likes' })
  const profiles = generateProfileLike()
  progressReporter.reportProgress({ message: 'Generating extra elements' })
  const extraElements = params.extraNaclPaths ? await generateExtraElements(params.extraNaclPaths) : []
  const defaultExtraElements = await generateExtraElements([path.join(dataPath, 'fixtures')])
  log.debug('default fixture element are: %s', defaultExtraElements.map(elem => elem.elemID.getFullName()).join(' , '))
  progressReporter.reportProgress({ message: 'Generating conflicted elements' })
  const envObjects = generateEnvElements()
  progressReporter.reportProgress({ message: 'Generation done' })
  const elementsToExclude = new Set(params.elementsToExclude ?? [])
  return [
    ...defaultTypes,
    ...primtiveTypes,
    ...types,
    ...records,
    ...objects,
    ...profiles,
    new ObjectType({ elemID: new ElemID(DUMMY_ADAPTER, 'noPath'), fields: {} }),
    ...extraElements,
    ...defaultExtraElements,
    ...envObjects,
  ].filter(e => !elementsToExclude.has(e.elemID.getFullName()))
}
