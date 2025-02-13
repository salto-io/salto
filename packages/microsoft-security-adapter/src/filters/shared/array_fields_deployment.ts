/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  filterUtils,
  ChangeElementResolver,
} from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { types } from '@salto-io/lowerdash'
import {
  elementExpressionStringifyReplacer,
  inspectValue,
  safeJsonStringify,
  filter,
  applyFunctionToChangeData,
} from '@salto-io/adapter-utils'
import { Options } from '../../definitions/types'
import { MICROSOFT_SECURITY } from '../../constants'
import { customConvertError } from '../../error_utils'
import { changeResolver } from '../../definitions/references'

const log = logger(module)

type ArrayElementChangeData = {
  id: string
  name: string
  [key: string]: unknown
}

export type MapArrayValueToChangeData = (value: unknown) => ArrayElementChangeData

export type DeployArrayFieldFilterParams = {
  topLevelTypeName: string
  fieldTypeName: string
  fieldName: string
  valueMapper: MapArrayValueToChangeData
}

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
    log.error(
      'Failed to calculate diff for %s, expected %s to be an array, got before:%s and after:%s',
      getChangeData(change).elemID.getFullName(),
      fieldName,
      inspectValue(beforeValues),
      inspectValue(afterValues),
    )
    throw new Error(`Invalid format: expected ${fieldName} to be an array`)
  }

  const [deployableDataBefore, deployableDataAfter] = [beforeValues, afterValues].map(arrayValues =>
    arrayValues.map(valueMapper),
  )
  const overlappingValues = _.intersectionWith(deployableDataBefore, deployableDataAfter, isEqualValues)
  const valuesToDelete = _.differenceWith(deployableDataBefore, overlappingValues, isEqualValues)
  const valuesToAdd = _.differenceWith(deployableDataAfter, overlappingValues, isEqualValues)
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
  arrayFieldDefinition: DeployArrayFieldFilterParams
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
  arrayFieldDefinition,
  ...args
}: Omit<DeployArrayFieldInput<Options>, 'filterParams'> & {
  arrayFieldDefinition: DeployArrayFieldFilterParams
}): Promise<DeployResult> => {
  const topLevelChangeData = getChangeData(change)
  let valuesToDelete: ArrayElementChangeData[]
  let valuesToAdd: ArrayElementChangeData[]
  try {
    ;({ valuesToDelete, valuesToAdd } = mapArrayValuesAndCalculateDiff({
      change,
      ...arrayFieldDefinition,
    }))
  } catch (e) {
    log.error(
      'Failed to calculate diff for %s %s, skipping %s deploy filter on %s %s',
      arrayFieldDefinition.fieldName,
      topLevelChangeData.elemID.getFullName(),
      arrayFieldDefinition.fieldName,
      arrayFieldDefinition.topLevelTypeName,
      topLevelChangeData.elemID.getFullName(),
    )
    return {
      appliedChanges: [],
      errors: [
        {
          elemID: topLevelChangeData.elemID,
          severity: 'Error',
          message: e.message,
          detailedMessage: e.message,
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
    elemID: new ElemID(MICROSOFT_SECURITY, arrayFieldDefinition.fieldTypeName),
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

  await applyFunctionToChangeData(change, instance => {
    instance.value[arrayFieldDefinition.fieldName] = calculateAppliedChangesOnArrayField({
      change,
      arrayFieldDefinition,
      deployResult,
      attemptedValuesToDelete: valuesToDelete,
      attemptedValuesToAdd: valuesToAdd,
    })
    return instance
  })

  return {
    appliedChanges: [change],
    errors: [],
  }
}

/**
 * Create a filter that deploys array fields.
 * The filter will deploy the top level change and then deploy the array field changes, which can be either additions or removals.
 */
export const deployArrayFieldsFilterCreator =
  (
    arrayFieldDefinition: DeployArrayFieldFilterParams,
  ): filterUtils.AdapterFilterCreator<{}, filter.FilterResult, {}, Options> =>
  ({ definitions, elementSource, sharedContext }) => ({
    name: 'deployArrayFieldsFilter',
    deploy: async (changes, changeGroup) => {
      const { deploy, ...otherDefs } = definitions
      const { topLevelTypeName } = arrayFieldDefinition
      if (deploy === undefined) {
        log.error('could not find deploy definitions')
        const message = 'Deploy not supported'
        return {
          deployResult: {
            appliedChanges: [],
            errors: [
              {
                severity: 'Error',
                message,
                detailedMessage: message,
              },
            ],
          },
          leftoverChanges: changes,
        }
      }
      if (changeGroup === undefined) {
        log.error('change group not provided')
        const message = 'Deploy not supported'
        return {
          deployResult: {
            appliedChanges: [],
            errors: [
              {
                severity: 'Error',
                message,
                detailedMessage: message,
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
        convertError: customConvertError,
        changeResolver,
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
            safeJsonStringify(arrayFieldDefinition),
          )
          return deployArrayField({
            change,
            ...deployArgsWithoutChanges,
            arrayFieldDefinition,
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
