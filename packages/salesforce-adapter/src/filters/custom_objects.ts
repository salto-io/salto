/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import { collections, strings, promises } from '@salto-io/lowerdash'
import {
  ADAPTER, Element, Field, ObjectType, TypeElement, isObjectType, isInstanceElement, ElemID,
  BuiltinTypes, CORE_ANNOTATIONS, TypeMap, InstanceElement, Values,
  ReferenceExpression, ListType, Change, getChangeElement, isField, isObjectTypeChange,
  isAdditionOrRemovalChange, isFieldChange, isRemovalChange, isInstanceChange, toChange,
} from '@salto-io/adapter-api'
import { findObjectType, transformValues, getParents, pathNaclCase, createRefToElmWithValue } from '@salto-io/adapter-utils'
import { SalesforceClient } from 'index'
import { DescribeSObjectResult, Field as SObjField } from 'jsforce'
import _ from 'lodash'
import { UNSUPPORTED_SYSTEM_FIELDS, SYSTEM_FIELDS } from '../types'
import {
  API_NAME, CUSTOM_OBJECT, METADATA_TYPE, SALESFORCE, INSTANCE_FULL_NAME_FIELD,
  LABEL, FIELD_DEPENDENCY_FIELDS, LOOKUP_FILTER_FIELDS,
  VALUE_SETTINGS_FIELDS, API_NAME_SEPARATOR, FIELD_ANNOTATIONS, VALUE_SET_DEFINITION_FIELDS,
  VALUE_SET_FIELDS, DEFAULT_VALUE_FORMULA, FIELD_TYPE_NAMES, OBJECTS_PATH, INSTALLED_PACKAGES_PATH,
  FORMULA, LEAD_CONVERT_SETTINGS_METADATA_TYPE, ASSIGNMENT_RULES_METADATA_TYPE,
  WORKFLOW_METADATA_TYPE, QUICK_ACTION_METADATA_TYPE, CUSTOM_TAB_METADATA_TYPE,
  DUPLICATE_RULE_METADATA_TYPE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE, SHARING_RULES_TYPE,
  VALIDATION_RULES_METADATA_TYPE, BUSINESS_PROCESS_METADATA_TYPE, RECORD_TYPE_METADATA_TYPE,
  WEBLINK_METADATA_TYPE, INTERNAL_FIELD_TYPE_NAMES, CUSTOM_FIELD, NAME_FIELDS,
  COMPOUND_FIELD_TYPE_NAMES, INTERNAL_ID_ANNOTATION, INTERNAL_ID_FIELD,
} from '../constants'
import { FilterCreator } from '../filter'
import {
  getSObjectFieldElement, Types, isCustomObject, apiName, transformPrimitive, MetadataValues,
  formulaTypeName, metadataType, isCustom, isCustomSettings, metadataAnnotationTypes,
  MetadataTypeAnnotations, createInstanceElement, toCustomField, toCustomProperties, isLocalOnly,
  toMetadataInfo,
  isFieldOfCustomObject,
  createInstanceServiceIds,
} from '../transformers/transformer'
import {
  id, addApiName, addMetadataType, addLabel, getNamespace, boolValue,
  buildAnnotationsObjectType, generateApiNameToCustomObject, addObjectParentReference, apiNameParts,
  parentApiName,
  getDataFromChanges,
  isInstanceOfTypeChange,
  isInstanceOfType,
  isMasterDetailField,
} from './utils'
import { convertList } from './convert_lists'
import { DEPLOY_WRAPPER_INSTANCE_MARKER } from '../metadata_deploy'
import { CustomObject } from '../client/types'
import { WORKFLOW_FIELD_TO_TYPE, WORKFLOW_TYPE_TO_FIELD, WORKFLOW_DIR_NAME } from './workflow'

const log = logger(module)
const { makeArray } = collections.array
const { awu, groupByAsync, keyByAsync } = collections.asynciterable
const { removeAsync } = promises.array
const { mapValuesAsync, mapKeysAsync } = promises.object

export const INSTANCE_REQUIRED_FIELD = 'required'
export const INSTANCE_TYPE_FIELD = 'type'

export const NESTED_INSTANCE_VALUE_NAME = {
  WEB_LINKS: 'webLinks',
  VALIDATION_RULES: 'validationRules',
  BUSINESS_PROCESSES: 'businessProcesses',
  RECORD_TYPES: 'recordTypes',
  LIST_VIEWS: 'listViews',
  FIELD_SETS: 'fieldSets',
  COMPACT_LAYOUTS: 'compactLayouts',
  SHARING_REASONS: 'sharingReasons',
  INDEXES: 'indexes',
}

export const NESTED_INSTANCE_TYPE_NAME = {
  WEB_LINK: WEBLINK_METADATA_TYPE,
  VALIDATION_RULE: VALIDATION_RULES_METADATA_TYPE,
  BUSINESS_PROCESS: BUSINESS_PROCESS_METADATA_TYPE,
  RECORD_TYPE: RECORD_TYPE_METADATA_TYPE,
  LIST_VIEW: 'ListView',
  FIELD_SET: 'FieldSet',
  COMPACT_LAYOUT: 'CompactLayout',
  SHARING_REASON: 'SharingReason',
  INDEX: 'Index',
}

// The below metadata types extend Metadata and are mutable using a specific API call
export const NESTED_INSTANCE_VALUE_TO_TYPE_NAME = {
  [NESTED_INSTANCE_VALUE_NAME.WEB_LINKS]: NESTED_INSTANCE_TYPE_NAME.WEB_LINK,
  [NESTED_INSTANCE_VALUE_NAME.VALIDATION_RULES]: NESTED_INSTANCE_TYPE_NAME.VALIDATION_RULE,
  [NESTED_INSTANCE_VALUE_NAME.BUSINESS_PROCESSES]: NESTED_INSTANCE_TYPE_NAME.BUSINESS_PROCESS,
  [NESTED_INSTANCE_VALUE_NAME.RECORD_TYPES]: NESTED_INSTANCE_TYPE_NAME.RECORD_TYPE,
  [NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS]: NESTED_INSTANCE_TYPE_NAME.LIST_VIEW,
  [NESTED_INSTANCE_VALUE_NAME.FIELD_SETS]: NESTED_INSTANCE_TYPE_NAME.FIELD_SET,
  [NESTED_INSTANCE_VALUE_NAME.COMPACT_LAYOUTS]: NESTED_INSTANCE_TYPE_NAME.COMPACT_LAYOUT,
  [NESTED_INSTANCE_VALUE_NAME.SHARING_REASONS]: NESTED_INSTANCE_TYPE_NAME.SHARING_REASON,
  [NESTED_INSTANCE_VALUE_NAME.INDEXES]: NESTED_INSTANCE_TYPE_NAME.INDEX,
}

type TypesFromInstance = {
  standardAnnotationTypes: TypeMap
  customAnnotationTypes: TypeMap
  customSettingsAnnotationTypes: TypeMap
  nestedMetadataTypes: Record<string, ObjectType>
}

export const CUSTOM_OBJECT_TYPE_ID = new ElemID(SALESFORCE, CUSTOM_OBJECT)

const CUSTOM_ONLY_ANNOTATION_TYPE_NAMES = ['allowInChatterGroups', 'customHelp', 'customHelpPage',
  'customSettingsType', 'deploymentStatus', 'deprecated', 'enableActivities', 'enableBulkApi',
  'enableReports', 'enableSearch', 'enableSharing', 'enableStreamingApi', 'gender',
  'nameField', 'pluralLabel', 'sharingModel', 'startsWith', 'visibility']

const CUSTOM_SETTINGS_ONLY_ANNOTATION_TYPE_NAMES = ['customSettingsType', 'apiName',
  'metadataType', 'enableFeeds', 'visibility']

const ANNOTATIONS_TO_IGNORE_FROM_INSTANCE = ['eventType', 'publishBehavior', 'fields',
  INSTANCE_FULL_NAME_FIELD, LABEL, 'household', 'articleTypeChannelDisplay', INTERNAL_ID_FIELD]

const nestedMetadatatypeToReplaceDirName: Record<string, string> = { // <type, new-dir-name>
  [WEBLINK_METADATA_TYPE]: 'ButtonsLinksAndActions',
}

const getFieldName = (annotations: Values): string => (
  (annotations[FORMULA]
    ? formulaTypeName(annotations[INSTANCE_TYPE_FIELD] as FIELD_TYPE_NAMES)
    : annotations[INSTANCE_TYPE_FIELD])
)

const getFieldType = (type: string): TypeElement =>
  (_.isUndefined(type) ? BuiltinTypes.STRING : Types.get(type))

const annotationTypesForObject = (typesFromInstance: TypesFromInstance,
  instance: InstanceElement, custom: boolean): Record<string, TypeElement> => {
  let annotationTypes = typesFromInstance.standardAnnotationTypes
  if (isCustomSettings(instance)) {
    annotationTypes = typesFromInstance.customSettingsAnnotationTypes
  } else if (custom) {
    annotationTypes = typesFromInstance.customAnnotationTypes
  }
  return annotationTypes
}

const getObjectDirectoryPath = (obj: ObjectType, namespace?: string): string[] => {
  const objFileName = pathNaclCase(obj.elemID.name)
  if (namespace) {
    return [SALESFORCE, INSTALLED_PACKAGES_PATH, namespace, OBJECTS_PATH, objFileName]
  }
  return [SALESFORCE, OBJECTS_PATH, objFileName]
}

const getFieldDependency = (values: Values): Values | undefined => {
  const controllingField = values[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]
  const valueSettingsInfo = values[FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]
  if (controllingField && valueSettingsInfo) {
    const valueSettings = makeArray(valueSettingsInfo)
      .map(value => ({
        [VALUE_SETTINGS_FIELDS.VALUE_NAME]: value[VALUE_SETTINGS_FIELDS.VALUE_NAME],
        [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]:
          makeArray(value[VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]),
      }))
    return {
      [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: controllingField,
      [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: valueSettings,
    }
  }
  return undefined
}

const transfromAnnotationsNames = (fields: Values, parentName: string): Values => {
  const annotations: Values = {}
  const typeName = fields[INSTANCE_TYPE_FIELD]
  Object.entries(fields).forEach(([k, v]) => {
    switch (k) {
      case INSTANCE_REQUIRED_FIELD:
        annotations[CORE_ANNOTATIONS.REQUIRED] = v
        break
      case INSTANCE_FULL_NAME_FIELD:
        annotations[API_NAME] = [parentName, v].join(API_NAME_SEPARATOR)
        break
      case FIELD_ANNOTATIONS.DEFAULT_VALUE:
        if (typeName === FIELD_TYPE_NAMES.CHECKBOX) {
          annotations[k] = v
        } else {
          annotations[DEFAULT_VALUE_FORMULA] = v
        }
        break
      case FIELD_ANNOTATIONS.VALUE_SET:
        // Checks for global value set
        if (!_.isUndefined(v[VALUE_SET_FIELDS.VALUE_SET_NAME])) {
          annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] = v[VALUE_SET_FIELDS.VALUE_SET_NAME]
          annotations[FIELD_ANNOTATIONS.RESTRICTED] = true
        } else {
          const valueSetDefinition = v[VALUE_SET_FIELDS.VALUE_SET_DEFINITION]
          if (valueSetDefinition) {
            annotations[FIELD_ANNOTATIONS.VALUE_SET] = makeArray(valueSetDefinition[
              VALUE_SET_DEFINITION_FIELDS.VALUE
            ])
            annotations[VALUE_SET_DEFINITION_FIELDS.SORTED] = valueSetDefinition[
              VALUE_SET_DEFINITION_FIELDS.SORTED
            ] || false
            annotations[FIELD_ANNOTATIONS.RESTRICTED] = v[VALUE_SET_FIELDS.RESTRICTED] || false
          }
        }
        if (!_.isUndefined(getFieldDependency(v))) {
          annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY] = getFieldDependency(v)
        }
        break
      case FIELD_ANNOTATIONS.LOOKUP_FILTER:
        if (boolValue(v[LOOKUP_FILTER_FIELDS.IS_OPTIONAL])) {
          delete v[LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]
        }
        annotations[k] = v
        break
      case FIELD_ANNOTATIONS.REFERENCE_TO:
        annotations[k] = makeArray(v)
        break
      case FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS:
        annotations[k] = makeArray(v)
        break
      default:
        annotations[k] = v
    }
  })
  return annotations
}

export const transformFieldAnnotations = async (
  instanceFieldValues: Values,
  parentName: string
): Promise<Values> => {
  // Ignores instances without a defined type
  if (!_.has(instanceFieldValues, INSTANCE_TYPE_FIELD)) {
    return {}
  }

  const fieldType = Types.getKnownType(getFieldName(instanceFieldValues), true)
  if (_.isUndefined(fieldType)) {
    return {}
  }

  const annotations = transfromAnnotationsNames(instanceFieldValues, parentName)
  const annotationsType = buildAnnotationsObjectType(await fieldType.getAnnotationTypes())
  await convertList(annotationsType, annotations)

  return await transformValues(
    {
      values: annotations,
      type: annotationsType,
      transformFunc: transformPrimitive,
    }
  ) || {}
}

const transformObjectAnnotationValues = (instance: InstanceElement,
  annotationTypesFromInstance: TypeMap):
  Promise<Values | undefined> => {
  const annotationsObject = buildAnnotationsObjectType(annotationTypesFromInstance)
  return transformValues(
    {
      values: instance.value,
      type: annotationsObject,
      transformFunc: transformPrimitive,
    }
  )
}

const transformObjectAnnotations = async (
  customObject: ObjectType,
  annotationTypesFromInstance: TypeMap,
  instance: InstanceElement
): Promise<void> => {
  customObject.annotationRefTypes = {
    ...customObject.annotationRefTypes,
    ..._.mapValues(annotationTypesFromInstance, t => createRefToElmWithValue(t)),
  }

  customObject.annotations = {
    ...customObject.annotations,
    ...await transformObjectAnnotationValues(instance, annotationTypesFromInstance),
  }
}

const createFieldFromMetadataInstance = async (
  customObject: ObjectType,
  field: Values,
  instanceName: string,
): Promise<Field> => {
  let fieldValues = field
  if (!fieldValues[INSTANCE_TYPE_FIELD]) {
    fieldValues = { [INSTANCE_TYPE_FIELD]: INTERNAL_FIELD_TYPE_NAMES.UNKNOWN, ...fieldValues }
  }
  const annotations = await transformFieldAnnotations(
    fieldValues,
    instanceName,
  )
  annotations[FIELD_ANNOTATIONS.QUERYABLE] = false
  annotations[FIELD_ANNOTATIONS.UPDATEABLE] = false
  annotations[FIELD_ANNOTATIONS.CREATABLE] = false

  return new Field(
    customObject,
    fieldValues[INSTANCE_FULL_NAME_FIELD],
    getFieldType(getFieldName(fieldValues)),
    annotations,
  )
}

const mergeCustomObjectWithInstance = async (
  customObject: ObjectType, instance: InstanceElement, annotationTypesFromInstance: TypeMap
): Promise<void> => {
  const instanceFields = makeArray(instance.value.fields)
  const fieldByApiName = await mapKeysAsync(
    customObject.fields,
    async field => apiName(field, true)
  )
  const instanceName = instance.value[INSTANCE_FULL_NAME_FIELD]

  await awu(instanceFields).forEach(async values => {
    const fieldName = values[INSTANCE_FULL_NAME_FIELD]
    if (fieldByApiName[fieldName] !== undefined) {
      // extend annotations from metadata API
      Object.assign(fieldByApiName[fieldName].annotations, await transformFieldAnnotations(
        values,
        instanceName
      ))
    } else {
      // doesn't exist in SOAP - initialize from metadata API
      const field = await createFieldFromMetadataInstance(customObject, values, instanceName)
      if (await apiName(field) !== undefined) {
        log.debug(`Extending SObject ${await apiName(customObject)} with field ${fieldName} from metadata API`)
        customObject.fields[fieldName] = field
      }
    }
  })

  Object.values(customObject.fields).filter(field => (
    field.annotations[FIELD_ANNOTATIONS.VALUE_SET]
    && field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
  )).forEach(field => delete field.annotations[FIELD_ANNOTATIONS.VALUE_SET])

  await transformObjectAnnotations(customObject, annotationTypesFromInstance, instance)
}

const createNestedMetadataInstances = (instance: InstanceElement,
  { elemID: objElemID, path: objPath }: ObjectType,
  nestedMetadataTypes: Record<string, ObjectType>):
  Promise<InstanceElement[]> =>
  awu(Object.entries(nestedMetadataTypes))
    .flatMap(([name, type]) => {
      const nestedInstancesValues = makeArray(instance.value[name])
      if (_.isEmpty(nestedInstancesValues)) {
        return [] as InstanceElement[]
      }
      const removeDuplicateInstances = (instances: Values[]): Values[] => (
        _(instances).keyBy(INSTANCE_FULL_NAME_FIELD).values().value()
      )
      return awu(removeDuplicateInstances(nestedInstancesValues))
        .map(async nestedInstanceValues => {
          const nameParts = [
            await apiName(instance),
            nestedInstanceValues[INSTANCE_FULL_NAME_FIELD],
          ]
          const fullName = nameParts.join(API_NAME_SEPARATOR)
          const instanceName = Types.getElemId(
            nameParts.join('_'),
            true,
            createInstanceServiceIds(_.pick(nestedInstanceValues, INSTANCE_FULL_NAME_FIELD), type)
          ).name
          const instanceFileName = pathNaclCase(instanceName)
          const typeFolderName = pathNaclCase(
            nestedMetadatatypeToReplaceDirName[type.elemID.name] ?? type.elemID.name
          )
          nestedInstanceValues[INSTANCE_FULL_NAME_FIELD] = fullName
          const path = [
            ...(objPath as string[]).slice(0, -1),
            typeFolderName,
            instanceFileName,
          ]
          return new InstanceElement(instanceName, type, nestedInstanceValues,
            path, { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(objElemID)] })
        })
    }).toArray()

const createObjectType = async ({
  name,
  label,
  fields,
  systemFields,
}: {
  name: string
  label: string
  fields?: SObjField[]
  systemFields?: string[]
}): Promise<ObjectType> => {
  const serviceIds = {
    [ADAPTER]: SALESFORCE,
    [API_NAME]: name,
    [METADATA_TYPE]: CUSTOM_OBJECT,
  }
  const object = Types.createObjectType(name, true, false, serviceIds)
  addApiName(object, name)
  addMetadataType(object)
  addLabel(object, label)
  object.path = [
    ...getObjectDirectoryPath(object, await getNamespace(object)),
    pathNaclCase(object.elemID.name),
  ]
  if (!_.isUndefined(fields)) {
    const getCompoundTypeName = (nestedFields: SObjField[], compoundName: string): string => {
      if (compoundName === COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME) {
        return nestedFields.some(field => field.name === NAME_FIELDS.SALUTATION)
          ? COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME
          : COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME_NO_SALUTATION
      }
      return compoundName
    }

    // Only fields with "child's" refering to a field as it's compoundField
    // should be regarded as compound.
    const objCompoundFieldNames = _.mapValues(
      _.groupBy(
        fields.filter(field => field.compoundFieldName !== undefined),
        field => field.compoundFieldName,
      ),
      getCompoundTypeName,
    )

    fields
      .filter(field => !field.compoundFieldName) // Filter out nested fields of compound fields
      .map(f => getSObjectFieldElement(object, f, serviceIds, objCompoundFieldNames, systemFields))
      .forEach(field => {
        object.fields[field.name] = field
      })
  }
  return object
}

const createFromInstance = async (instance: InstanceElement,
  typesFromInstance: TypesFromInstance): Promise<Element[]> => {
  const objectName = instance.value[INSTANCE_FULL_NAME_FIELD]
  const object = await createObjectType({
    name: objectName,
    label: instance.value[LABEL],
  })
  const annotationTypes = annotationTypesForObject(typesFromInstance, instance,
    isCustom(objectName))
  await transformObjectAnnotations(object, annotationTypes, instance)
  const instanceFields = makeArray(instance.value.fields)
  await awu(instanceFields)
    .forEach(async (field: Values) => {
      const fieldFullName = field[INSTANCE_FULL_NAME_FIELD]
      object.fields[fieldFullName] = new Field(object, fieldFullName,
        getFieldType(getFieldName(field)), await transformFieldAnnotations(field, objectName))
    })
  const nestedMetadataInstances = await createNestedMetadataInstances(instance, object,
    typesFromInstance.nestedMetadataTypes)
  return [object, ...nestedMetadataInstances]
}

const fetchSObjects = async (
  client: SalesforceClient,
  customObjectInstances: Record<string, Element>
): Promise<Record<string, DescribeSObjectResult[]>> => {
  const sobjectsList = await client.listSObjects()

  const sobjectNames = sobjectsList
    .map(sobj => sobj.name)
    .filter(name => name in customObjectInstances)

  const sobjectsDescriptions = await client.describeSObjects(sobjectNames)

  return _.groupBy(sobjectsDescriptions, e => e.name)
}

const createFromSObjectsAndInstances = async (
  sObjects: DescribeSObjectResult[],
  instances: Record<string, InstanceElement>,
  typesFromInstance: TypesFromInstance,
  systemFields: string[],
): Promise<Element[]> =>
  awu(sObjects).flatMap(async ({ name, label, custom, fields }) => {
    const object = await createObjectType({ name, label, fields, systemFields })
    const instance = instances[name]
    if (!instance) {
      return [object]
    }
    const annotationTypes = annotationTypesForObject(typesFromInstance, instance, custom)
    await mergeCustomObjectWithInstance(
      object, instance, annotationTypes
    )
    return [object, ...await createNestedMetadataInstances(instance, object,
      typesFromInstance.nestedMetadataTypes)]
  }).toArray()

const removeIrrelevantElements = async (elements: Element[]): Promise<void> => {
  await removeAsync(elements, isInstanceOfType(CUSTOM_OBJECT))
  await removeAsync(elements, async elem => await apiName(elem) === CUSTOM_OBJECT)
  // We currently don't support platform event and article type objects (SALTO-530, SALTO-531)
  await removeAsync(elements, async elem => {
    const elemApiName = await apiName(elem)
    return (isObjectType(elem) && await isCustomObject(elem)
    && (elemApiName.endsWith('__e') || elemApiName.endsWith('__kav')))
  })
  await removeAsync(elements, async elem => (isObjectType(elem)
    && ['ArticleTypeChannelDisplay', 'ArticleTypeTemplate'].includes(await metadataType(elem))))
}

const removeUnsupportedFields = (elements: Element[], unsupportedSystemFields: string[]): void => {
  elements.forEach(element => {
    if (!isObjectType(element)) {
      return
    }
    unsupportedSystemFields.forEach(fieldName => {
      delete element.fields[fieldName]
    })
  })
}

// Instances metadataTypes that should be under the customObject folder and have a PARENT reference
const workflowDependentMetadataTypes = new Set([WORKFLOW_METADATA_TYPE,
  ...Object.values(WORKFLOW_FIELD_TO_TYPE)])
const dependentMetadataTypes = new Set([CUSTOM_TAB_METADATA_TYPE, DUPLICATE_RULE_METADATA_TYPE,
  QUICK_ACTION_METADATA_TYPE, WORKFLOW_METADATA_TYPE, LEAD_CONVERT_SETTINGS_METADATA_TYPE,
  ASSIGNMENT_RULES_METADATA_TYPE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE, SHARING_RULES_TYPE,
  ...workflowDependentMetadataTypes.values(),
])

const hasCustomObjectParent = async (instance: InstanceElement): Promise<boolean> =>
  dependentMetadataTypes.has(await metadataType(instance))

const fixDependentInstancesPathAndSetParent = async (elements: Element[]): Promise<void> => {
  const setDependingInstancePath = async (instance: InstanceElement, customObject: ObjectType):
    Promise<void> => {
    if (customObject.path) {
      instance.path = [
        ...customObject.path.slice(0, -1),
        ...(workflowDependentMetadataTypes.has(instance.elemID.typeName)
          ? [WORKFLOW_DIR_NAME,
            pathNaclCase(
              strings.capitalizeFirstLetter(
                WORKFLOW_TYPE_TO_FIELD[instance.elemID.typeName] ?? instance.elemID.typeName
              )
            )]
          : [pathNaclCase(instance.elemID.typeName)]),
        ...((await apiNameParts(instance)).length > 1
          ? [pathNaclCase(instance.elemID.name)] : []),
      ]
    }
  }

  const apiNameToCustomObject = await generateApiNameToCustomObject(elements)

  const getDependentCustomObj = async (
    instance: InstanceElement
  ): Promise<ObjectType | undefined> => {
    const customObject = apiNameToCustomObject.get(await parentApiName(instance))
    if (_.isUndefined(customObject)
      && await metadataType(instance) === LEAD_CONVERT_SETTINGS_METADATA_TYPE) {
      return apiNameToCustomObject.get('Lead')
    }
    return customObject
  }

  await awu(elements)
    .filter(isInstanceElement)
    .filter(hasCustomObjectParent)
    .forEach(async instance => {
      const customObj = await getDependentCustomObj(instance)
      if (_.isUndefined(customObj)) {
        return
      }
      await setDependingInstancePath(instance, customObj)
      addObjectParentReference(instance, customObj)
    })
}

const shouldIncludeFieldChange = (fieldsToSkip: ReadonlyArray<string>) => (
  async (fieldChange: Change): Promise<boolean> => {
    if (!isFieldChange(fieldChange)) {
      return false
    }
    const field = getChangeElement(fieldChange)
    const isRelevantField = (
      isField(field) && !isLocalOnly(field) && !fieldsToSkip.includes(await apiName(field, true))
    )
    return isRelevantField && (
      isAdditionOrRemovalChange(fieldChange)
      || !_.isEqual(
        await toCustomField(fieldChange.data.before),
        await toCustomField(fieldChange.data.after)
      )
    )
  }
)

const getNestedCustomObjectValues = async (
  fullName: string,
  changes: ReadonlyArray<Change>,
  fieldsToSkip: ReadonlyArray<string>,
  dataField: 'before' | 'after',
): Promise<Partial<CustomObject> & Pick<MetadataValues, 'fullName'>> => ({
  fullName,
  ...await mapValuesAsync(
    NESTED_INSTANCE_VALUE_TO_TYPE_NAME,
    async fieldType => (
      awu(getDataFromChanges(
        dataField,
        await awu(changes).filter(isInstanceOfTypeChange(fieldType)).toArray()
      )).map(async nestedInstance => ({
        ...await toMetadataInfo(nestedInstance as InstanceElement),
        [INSTANCE_FULL_NAME_FIELD]: await apiName(nestedInstance, true),
      })).toArray()
    )
  ),
  fields: await awu(getDataFromChanges(
    dataField,
    await awu(changes).filter(shouldIncludeFieldChange(fieldsToSkip)).toArray()
  )).map(field => toCustomField(field as Field)).toArray(),
})

const createCustomObjectInstance = (values: MetadataValues): InstanceElement => {
  const customFieldType = new ObjectType({
    elemID: new ElemID(SALESFORCE, CUSTOM_FIELD),
    annotations: { [METADATA_TYPE]: CUSTOM_FIELD },
  })
  const customObjectType = new ObjectType({
    elemID: new ElemID(SALESFORCE, CUSTOM_OBJECT),
    annotationRefsOrTypes: _.clone(metadataAnnotationTypes),
    annotations: {
      metadataType: CUSTOM_OBJECT,
      dirName: 'objects',
      suffix: 'object',
    } as MetadataTypeAnnotations,
    fields: {
      [DEPLOY_WRAPPER_INSTANCE_MARKER]: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {
          [FIELD_ANNOTATIONS.LOCAL_ONLY]: true,
        },
      },
      fields: {
        refType: createRefToElmWithValue(new ListType(customFieldType)),
      },
      ..._.mapValues(
        NESTED_INSTANCE_VALUE_TO_TYPE_NAME,
        fieldType => ({
          refType: createRefToElmWithValue(new ListType(new ObjectType({
            elemID: new ElemID(SALESFORCE, fieldType),
            annotations: { [METADATA_TYPE]: fieldType },
          }))),
        })
      ),
    },
  })
  return createInstanceElement(values, customObjectType)
}

const getCustomObjectFromChange = async (change: Change): Promise<ObjectType> => {
  const elem = getChangeElement(change)
  if (isObjectType(elem) && await isCustomObject(elem)) {
    return elem
  }
  if (isField(elem)) {
    return elem.parent
  }
  // If we reach here this is a child instance.
  // If it passed the isCustomObjectRelatedChange filter then it must have a custom object parent
  return awu(getParents(elem)).filter(isCustomObject).peek()
}

const getCustomObjectApiName = async (change: Change): Promise<string> => (
  apiName(await getCustomObjectFromChange(change))
)

const isCustomObjectChildInstance = async (instance: InstanceElement): Promise<boolean> =>
  Object.values(NESTED_INSTANCE_VALUE_TO_TYPE_NAME).includes(await metadataType(instance))

const isCustomObjectRelatedChange = async (change: Change): Promise<boolean> => {
  const elem = getChangeElement(change)
  return (await isCustomObject(elem))
  || (isField(elem) && await isFieldOfCustomObject(elem))
  || (
    isInstanceElement(elem)
    && await isCustomObjectChildInstance(elem)
    && await getCustomObjectFromChange(change) !== undefined
  )
}

const createCustomObjectChange = async (
  fieldsToSkip: string[] = [],
  fullName: string,
  changes: ReadonlyArray<Change>,
): Promise<Change<InstanceElement>> => {
  const objectChange = await awu(changes)
    .filter(isObjectTypeChange)
    .find(change => isCustomObject(getChangeElement(change)))

  if (objectChange !== undefined && objectChange.action === 'remove') {
    // if we remove the custom object we don't really need the field changes
    // We do need to include master-detail field removals explicitly because otherwise salesforce
    // won't let us delete the custom object
    const masterDetailFieldRemovals = Object.values(objectChange.data.before.fields)
      .filter(isMasterDetailField)
      .map(field => toChange({ before: field }))
    return {
      action: 'remove',
      data: {
        before: createCustomObjectInstance({
          ...await toCustomProperties(objectChange.data.before, false),
          ...await getNestedCustomObjectValues(
            fullName, masterDetailFieldRemovals, fieldsToSkip, 'before'
          ),
        }),
      },
    }
  }

  const getAfterInstanceValues = async (): Promise<MetadataValues> => {
    const nestedValues = await getNestedCustomObjectValues(fullName, changes, fieldsToSkip, 'after')
    const afterParent = objectChange?.data.after
    if (afterParent === undefined) {
      return {
        ...nestedValues,
        // We are not deploying a change to the custom object itself, so we mark this instance
        // as a "wrapper instance" to signal that we only want to deploy the nested instances
        [DEPLOY_WRAPPER_INSTANCE_MARKER]: true,
      }
    }
    // This means there is a change on one of the custom object annotations.
    const includeFieldsFromParent = objectChange?.action === 'add'
    const parentValues = await toCustomProperties(
      afterParent,
      includeFieldsFromParent,
      fieldsToSkip
    )
    if (parentValues.sharingModel === 'ControlledByParent' && !includeFieldsFromParent) {
      // If we have to deploy the custom object and it is controlled by parent we must include
      // master-detail fields in the deployment, otherwise the deploy request will fail validation
      parentValues.fields = await awu(Object.values(afterParent.fields))
        .filter(isMasterDetailField)
        .map(toCustomField)
        // new fields in the custom object can have an undefined fullName if they are new and rely
        // on our "addDefaults" to get an api name - in that case the field with the api name will
        // be in nestedValues so it is safe to filter it out here
        .filter(field => field.fullName !== undefined)
        .toArray()
    }
    const allFields = [
      ...makeArray(nestedValues.fields),
      ...makeArray(parentValues.fields),
    ]
    return {
      ...parentValues,
      ...nestedValues,
      fields: _.uniqBy(allFields, field => field.fullName),
    }
  }

  const after = createCustomObjectInstance(await getAfterInstanceValues())

  if (objectChange !== undefined && objectChange.action === 'add') {
    return { action: 'add', data: { after } }
  }

  const beforeParent = objectChange?.data.before
  const before = createCustomObjectInstance({
    ...await getNestedCustomObjectValues(fullName, changes, fieldsToSkip, 'before'),
    ...(beforeParent === undefined ? {} : await toCustomProperties(beforeParent, false)),
  })

  return { action: 'modify', data: { before, after } }
}

const getParentCustomObjectName = async (change: Change): Promise<string | undefined> => {
  const parent = await awu(getParents(getChangeElement(change))).find(isCustomObject)
  return parent === undefined ? undefined : apiName(parent)
}

const isSideEffectRemoval = (
  removedObjectNames: string[]
) => async (change: Change): Promise<boolean> => {
  const parentName = await getParentCustomObjectName(change)
  return isInstanceChange(change)
    && isRemovalChange(change)
    && parentName !== undefined && removedObjectNames.includes(parentName)
}

/**
 * Custom objects filter.
 * Fetches the custom objects via the soap api and adds them to the elements
 */
const filterCreator: FilterCreator = ({ client, config }) => {
  let originalChanges: Record<string, Change[]> = {}
  return {
    onFetch: async (elements: Element[]): Promise<void> => {
      const customObjectInstances = await keyByAsync(
        await awu(elements).filter(isInstanceOfType(CUSTOM_OBJECT)).toArray(),
        instance => apiName(instance),
      ) as Record<string, InstanceElement>

      const sObjects = await fetchSObjects(client, customObjectInstances).catch(e => {
        log.error('failed to fetch sobjects reason: %o', e)
        return []
      })

      const typesToMergeFromInstance = async (): Promise<TypesFromInstance> => {
        const fixTypesDefinitions = async (typesFromInstance: TypeMap): Promise<void> => {
          const listViewType = typesFromInstance[NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS] as
            ObjectType
          listViewType.fields.columns.refType = createRefToElmWithValue(
            new ListType(await listViewType.fields.columns.getType())
          )
          listViewType.fields.filters.refType = createRefToElmWithValue(
            new ListType(await listViewType.fields.filters.getType())
          )
          const fieldSetType = typesFromInstance[NESTED_INSTANCE_VALUE_NAME.FIELD_SETS] as
            ObjectType
          fieldSetType.fields.availableFields.refType = createRefToElmWithValue(new ListType(
            await fieldSetType.fields.availableFields.getType()
          ))
          fieldSetType.fields.displayedFields.refType = createRefToElmWithValue(new ListType(
            await fieldSetType.fields.displayedFields.getType()
          ))
          const compactLayoutType = typesFromInstance[NESTED_INSTANCE_VALUE_NAME.COMPACT_LAYOUTS] as
            ObjectType
          compactLayoutType.fields.fields.refType = createRefToElmWithValue(
            new ListType(await compactLayoutType.fields.fields.getType())
          )
          // internalId is also the name of a field on the custom object instances, therefore
          // we override it here to have the right type for the annotation.
          // we don't want to use HIDDEN_STRING as the type for the field because on fields
          // we can set annotations directly.
          typesFromInstance[INTERNAL_ID_ANNOTATION] = BuiltinTypes.HIDDEN_STRING
        }

        const getAllTypesFromInstance = async (): Promise<TypeMap> => {
          const customObjectType = findObjectType(elements, CUSTOM_OBJECT_TYPE_ID)
          if (_.isUndefined(customObjectType)) {
            return {}
          }
          const typesFromInstance: TypeMap = Object.fromEntries(
            await awu(Object.entries(customObjectType.fields))
              .filter(([name, _field]) => !ANNOTATIONS_TO_IGNORE_FROM_INSTANCE.includes(name))
              .map(async ([name, field]) => [name, await field.getType()])
              .toArray()
          )
          await fixTypesDefinitions(typesFromInstance)
          return typesFromInstance
        }

        const typesFromInstance = await getAllTypesFromInstance()
        const nestedMetadataTypes = _.pick(typesFromInstance,
          Object.keys(NESTED_INSTANCE_VALUE_TO_TYPE_NAME)) as Record<string, ObjectType>
        const customOnlyAnnotationTypes = _.pick(typesFromInstance,
          CUSTOM_ONLY_ANNOTATION_TYPE_NAMES)
        const customSettingsOnlyAnnotationTypes = _.pick(typesFromInstance,
          CUSTOM_SETTINGS_ONLY_ANNOTATION_TYPE_NAMES)
        const standardAnnotationTypes = _.omit(typesFromInstance,
          Object.keys(NESTED_INSTANCE_VALUE_TO_TYPE_NAME), CUSTOM_ONLY_ANNOTATION_TYPE_NAMES)
        return {
          standardAnnotationTypes,
          customAnnotationTypes: { ...standardAnnotationTypes, ...customOnlyAnnotationTypes },
          customSettingsAnnotationTypes: { ...standardAnnotationTypes,
            ...customSettingsOnlyAnnotationTypes },
          nestedMetadataTypes,
        }
      }

      const typesFromInstance = await typesToMergeFromInstance()
      const newElements: Element[] = await createFromSObjectsAndInstances(
        _.flatten(Object.values(sObjects)),
        customObjectInstances,
        typesFromInstance,
        config[SYSTEM_FIELDS] ?? [],
      )

      const objectTypeNames = new Set(Object.keys(sObjects))
      await awu(Object.entries(customObjectInstances))
        .forEach(async ([instanceApiName, instance]) => {
          // Adds objects that exists in the metadata api but don't exist in the soap api
          if (!objectTypeNames.has(instanceApiName)) {
            newElements.push(...await createFromInstance(instance, typesFromInstance))
          }
        })

      await removeIrrelevantElements(elements)
      const elementFullNames = new Set(elements.map(elem => id(elem)))
      newElements
        .filter(newElem => !elementFullNames.has(id(newElem)))
        .forEach(newElem => elements.push(newElem))
      await fixDependentInstancesPathAndSetParent(elements)
      removeUnsupportedFields(elements, config[UNSUPPORTED_SYSTEM_FIELDS] ?? [])
    },

    preDeploy: async changes => {
      const originalChangeMapping = await groupByAsync(
        awu(changes).filter(isCustomObjectRelatedChange),
        getCustomObjectApiName,
      )

      const deployableCustomObjectChanges = await awu(Object.entries(originalChangeMapping))
        .map(entry => createCustomObjectChange(config.systemFields, ...entry))
        .toArray()

      // Handle known side effects - if we remove a custom object we don't need to also remove
      // its dependent instances (like layouts, custom object translations and so on)
      const removedCustomObjectNames = Object.keys(originalChangeMapping)
        .filter(
          name => originalChangeMapping[name].filter(isObjectTypeChange).some(isRemovalChange)
        )

      const sideEffectRemovalsByObject = await groupByAsync(
        await awu(changes)
          .filter(isSideEffectRemoval(removedCustomObjectNames))
          .toArray() as Change[],
        async c => await getParentCustomObjectName(c) ?? '',
      )

      if (!_.isEmpty(sideEffectRemovalsByObject)) {
        // Store the changes we are about to remove in the original changes so we will restore
        // them if the custom object is deleted successfully
        Object.entries(sideEffectRemovalsByObject).forEach(([objectName, sideEffects]) => {
          originalChangeMapping[objectName].push(...sideEffects)
        })
        await removeAsync(changes, isSideEffectRemoval(removedCustomObjectNames))
      }

      // Remove all the non-deployable custom object changes from the original list and replace them
      // with the deployable changes we created here
      originalChanges = originalChangeMapping
      await removeAsync(changes, isCustomObjectRelatedChange)
      changes.push(...deployableCustomObjectChanges)
    },

    onDeploy: async changes => {
      const appliedCustomObjectApiNames = await awu(changes)
        .filter(isInstanceOfTypeChange(CUSTOM_OBJECT))
        .map(change => apiName(getChangeElement(change)))
        .toArray()

      const appliedOriginalChanges = appliedCustomObjectApiNames.flatMap(
        objectApiName => originalChanges[objectApiName] ?? []
      )

      // Remove the changes we generated in preDeploy and replace them with the original changes
      await removeAsync(changes, isInstanceOfTypeChange(CUSTOM_OBJECT))
      changes.push(...appliedOriginalChanges)
      return []
    },
  }
}

export default filterCreator
