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
import _ from 'lodash'
import {
  AdditionChange,
  CORE_ANNOTATIONS,
  Change,
  DeployResult,
  ElemID,
  InstanceElement,
  ModificationChange,
  ObjectType,
  RemovalChange,
  Values,
  getChangeData,
  isAdditionOrModificationChange,
  isEqualValues,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import {
  deployment,
  definitions as definitionsUtils,
  filters,
  filterUtils,
  references,
  ChangeElementResolver,
  createChangeElementResolver,
} from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { types } from '@salto-io/lowerdash'
import { elementExpressionStringifyReplacer, inspectValue, safeJsonStringify, filter } from '@salto-io/adapter-utils'
import { Options } from '../definitions/types'
import { UserConfig } from '../config'

const log = logger(module)

export type ArrayElementChangeData = {
  id: string
  name: string
  [key: string]: unknown
}

export type MapArrayValueToChangeData = (value: unknown) => ArrayElementChangeData

type ArrayFieldDefinition = {
  fieldTypeName: string
  fieldName: string
  valueMapper: MapArrayValueToChangeData
}

type CommonDefinition = {
  adapterName: string
  topLevelTypeName: string
}

export type DeployArrayFieldFilterParams = CommonDefinition & ArrayFieldDefinition

type AdditionOrModificationChange = AdditionChange<InstanceElement> | ModificationChange<InstanceElement>

type DeployArrayFieldInput<Options extends definitionsUtils.APIDefinitionsOptions> = {
  change: AdditionOrModificationChange
  definitions: types.PickyRequired<definitionsUtils.ApiDefinitions<Options>, 'deploy'>
  convertError: deployment.ConvertError
  changeResolver: ChangeElementResolver<Change<InstanceElement>>
} & Omit<definitionsUtils.deploy.ChangeAndContext, 'change'> & { filterParams: DeployArrayFieldFilterParams }

const mapArrayValuesAndCalculateDiff = ({
  change,
  fieldName,
  valueMapper,
}: { change: AdditionOrModificationChange } & Omit<DeployArrayFieldFilterParams, 'fieldTypeName'>): {
  valuesToDelete: ArrayElementChangeData[]
  valuesToAdd: ArrayElementChangeData[]
} => {
  const beforeValues = isModificationChange(change) ? _.get(change.data.before.value, fieldName, []) : []
  const afterValues = _.get(change.data.after.value, fieldName, [])
  if (!_.isArray(beforeValues) || !_.isArray(afterValues)) {
    throw new Error(
      `Failed to calculate diff for ${getChangeData(change).elemID.getFullName()}, expected ${fieldName} to be an array, got before:${inspectValue(beforeValues)} and after:${inspectValue(afterValues)}`,
    )
  }

  const [resolvedBeforeValues, resolvedAfterValues] = [beforeValues, afterValues].map(arrayValues =>
    arrayValues.map(valueMapper),
  )
  const overlappingValues = _.intersectionWith(resolvedBeforeValues, resolvedAfterValues, isEqualValues)
  const valuesToDelete = _.differenceWith(resolvedBeforeValues, overlappingValues, isEqualValues)
  const valuesToAdd = _.differenceWith(resolvedAfterValues, overlappingValues, isEqualValues)
  return { valuesToDelete, valuesToAdd }
}

const createSingleArrayFieldChange = ({
  action,
  arrayChangeData,
  fieldObjectType,
  topLevelChangeValues,
}: {
  action: 'add' | 'remove'
  arrayChangeData: ArrayElementChangeData
  fieldObjectType: ObjectType
  topLevelChangeValues: Values
}): RemovalChange<InstanceElement> | AdditionChange<InstanceElement> => {
  const instance = new InstanceElement(
    `${arrayChangeData.name}_${arrayChangeData.id}`,
    fieldObjectType,
    arrayChangeData,
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [topLevelChangeValues],
    },
  )

  return action === 'remove'
    ? {
        action,
        data: {
          before: instance,
        },
      }
    : {
        action,
        data: {
          after: instance,
        },
      }
}

const calculateAppliedChangesOnArrayField = ({
  change,
  arrayFieldDefinition,
  deployResult,
  attemptedValuesToDelete,
  attemptedValuesToAdd,
}: {
  change: AdditionOrModificationChange
  arrayFieldDefinition: ArrayFieldDefinition
  deployResult: DeployResult
  attemptedValuesToDelete: ArrayElementChangeData[]
  attemptedValuesToAdd: ArrayElementChangeData[]
}): Values[] => {
  const { valueMapper, fieldName } = arrayFieldDefinition
  const arrFieldBefore = isModificationChange(change) ? change.data.before.value[fieldName] : []
  const arrFieldAfter = getChangeData(change).value[fieldName]

  if (_.isEmpty(deployResult.errors)) {
    return arrFieldAfter
  }

  // The changes are created as Instance changes, so we know the value exists
  const appliedChangesIds = deployResult.appliedChanges.map(c => _.get(getChangeData(c), 'value.id'))
  const failedIdsToDelete = attemptedValuesToDelete
    .filter(val => !appliedChangesIds.includes(val.id))
    .map(val => val.id)
  const failedIdsToAdd = attemptedValuesToAdd.filter(val => !appliedChangesIds.includes(val.id)).map(val => val.id)
  const failedValuesToDelete = arrFieldBefore.filter((val: unknown) => failedIdsToDelete.includes(valueMapper(val).id))
  const arrayWithDeployedChangesOnly = arrFieldAfter
    .filter((val: unknown) => !failedIdsToAdd.includes(valueMapper(val).id))
    .concat(failedValuesToDelete)

  return arrayWithDeployedChangesOnly
}

const deployArrayField = async <Options extends definitionsUtils.APIDefinitionsOptions>({
  change,
  arrayFieldDefinitionsWithTopLevel,
  ...args
}: Omit<DeployArrayFieldInput<Options>, 'filterParams'> & {
  arrayFieldDefinitionsWithTopLevel: DeployArrayFieldFilterParams
}): Promise<DeployResult> => {
  const topLevelChangeData = getChangeData(change)
  let valuesToDelete: ArrayElementChangeData[]
  let valuesToAdd: ArrayElementChangeData[]
  try {
    ;({ valuesToDelete, valuesToAdd } = mapArrayValuesAndCalculateDiff({
      change,
      ...arrayFieldDefinitionsWithTopLevel,
    }))
  } catch (e) {
    log.error(
      'Failed to calculate diff for %s %s, skipping %s deploy filter on %s %s',
      arrayFieldDefinitionsWithTopLevel.fieldName,
      topLevelChangeData.elemID.getFullName(),
      arrayFieldDefinitionsWithTopLevel.fieldName,
      arrayFieldDefinitionsWithTopLevel.topLevelTypeName,
      topLevelChangeData.elemID.getFullName(),
    )
    return {
      appliedChanges: [],
      errors: [
        {
          elemID: topLevelChangeData.elemID,
          severity: 'Error',
          message: e.message,
        },
      ],
    }
  }
  log.trace(
    'values to delete: %s, values to add: %s',
    safeJsonStringify(valuesToDelete, elementExpressionStringifyReplacer),
    safeJsonStringify(valuesToAdd, elementExpressionStringifyReplacer),
  )

  const fieldObjectType = new ObjectType({
    elemID: new ElemID(arrayFieldDefinitionsWithTopLevel.adapterName, arrayFieldDefinitionsWithTopLevel.fieldTypeName),
  })

  const createChangeCommonParams = {
    fieldObjectType,
    topLevelChangeValues: topLevelChangeData.value,
  }
  const removalChanges = valuesToDelete.map(vals =>
    createSingleArrayFieldChange({ ...createChangeCommonParams, action: 'remove', arrayChangeData: vals }),
  )
  const additionChanges = valuesToAdd.map(vals =>
    createSingleArrayFieldChange({ ...createChangeCommonParams, action: 'add', arrayChangeData: vals }),
  )
  const deployResult = await deployment.deployChanges({
    changes: removalChanges.concat(additionChanges),
    ...args,
  })

  const appliedChangesOnArray = calculateAppliedChangesOnArrayField({
    change,
    arrayFieldDefinition: arrayFieldDefinitionsWithTopLevel,
    deployResult,
    attemptedValuesToDelete: valuesToDelete,
    attemptedValuesToAdd: valuesToAdd,
  })
  change.data.after.value[arrayFieldDefinitionsWithTopLevel.fieldName] = appliedChangesOnArray
  return {
    appliedChanges: [change],
    errors: [],
  }
}

/**
 *
 */
export const deployArrayFieldsFilterCreator =
  ({
    convertError = deployment.defaultConvertError,
    ...specificTypeParams
  }: Pick<filters.FilterCreationArgs<Options, UserConfig>, 'convertError'> &
    DeployArrayFieldFilterParams): filterUtils.AdapterFilterCreator<{}, filter.FilterResult, {}, Options> =>
  ({ definitions, elementSource, sharedContext }) => ({
    name: 'deployArrayFieldsFilter',
    deploy: async (changes, changeGroup) => {
      const { deploy, ...otherDefs } = definitions
      const { topLevelTypeName, ...arrayFieldDefinition } = specificTypeParams
      if (deploy === undefined) {
        return {
          deployResult: {
            appliedChanges: [],
            errors: [
              {
                severity: 'Error',
                message: 'missing deploy definitions',
              },
            ],
          },
          leftoverChanges: changes,
        }
      }
      if (changeGroup === undefined) {
        return {
          deployResult: {
            appliedChanges: [],
            errors: [
              {
                severity: 'Error',
                message: 'change group not provided',
              },
            ],
          },
          leftoverChanges: changes,
        }
      }

      const deployArgsWithoutChanges = {
        definitions: { deploy, ...otherDefs },
        changeGroup,
        elementSource,
        convertError,
        changeResolver: createChangeElementResolver<Change<InstanceElement>>({
          getLookUpName: references.generateLookupFunc(definitions.references?.rules ?? []),
        }),
        sharedContext,
      }

      const [relevantChanges, otherChanges] = _.partition(
        changes,
        change =>
          isInstanceChange(change) &&
          isAdditionOrModificationChange(change) &&
          getChangeData(change).elemID.typeName === topLevelTypeName,
      ) as [AdditionOrModificationChange[], Change[]]

      const deployResults = await Promise.all(
        relevantChanges.map(async (change): Promise<DeployResult> => {
          const changeData = getChangeData(change)
          const topLevelDeployResult = await deployment.deployChanges({
            changes: [change],
            ...deployArgsWithoutChanges,
          })
          if (!_.isEmpty(topLevelDeployResult.errors)) {
            return topLevelDeployResult
          }

          log.debug(
            'successfully deployed %s, starting to deploy %s',
            changeData.elemID.getFullName(),
            arrayFieldDefinition,
          )
          return deployArrayField({
            change,
            ...deployArgsWithoutChanges,
            arrayFieldDefinitionsWithTopLevel: {
              ...arrayFieldDefinition,
              adapterName: specificTypeParams.adapterName,
              topLevelTypeName,
            },
          })
        }),
      )
      return {
        deployResult: {
          appliedChanges: deployResults.flatMap(r => r?.appliedChanges ?? []),
          errors: deployResults.flatMap(r => r?.errors ?? []),
        },
        leftoverChanges: otherChanges,
      }
    },
  })
