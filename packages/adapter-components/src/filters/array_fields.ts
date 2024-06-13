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
  AdditionChange,
  CORE_ANNOTATIONS,
  Change,
  DeployResult,
  ElemID,
  InstanceElement,
  ModificationChange,
  ObjectType,
  RemovalChange,
  SaltoElementError,
  SaltoError,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections, types } from '@salto-io/lowerdash'
import { elementExpressionStringifyReplacer, inspectValue, safeJsonStringify } from '@salto-io/adapter-utils'
import { APIDefinitionsOptions, ApiDefinitions, ResolveCustomNameMappingOptionsType, UserConfig } from '../definitions'
import { ConvertError, defaultConvertError, deployChanges } from '../deployment'
import { ChangeElementResolver, createChangeElementResolver } from '../resolve_utils'
import { ChangeAndContext } from '../definitions/system/deploy'
import { FilterCreationArgs } from './common_filters'
import { AdapterFilterCreator, FilterResult } from '../filter_utils'
import { generateLookupFunc } from '../references'

const log = logger(module)
const { awu } = collections.asynciterable

export type ArrayElementChangeData = {
  id: string
  name: string
  [key: string]: unknown
}

export type MapArrayValueToChangeData = (value: unknown) => ArrayElementChangeData

type SingleFieldDefinition = {
  fieldTypeName: string
  fieldName: string
  valueMapper: MapArrayValueToChangeData
}

type CommonDefinition = {
  adapterName: string
  parentTypeName: string
}

export type DeployArrayFieldFilterParams = CommonDefinition & {
  arrayFields: SingleFieldDefinition[]
}

type AdditionOrModificationChange = AdditionChange<InstanceElement> | ModificationChange<InstanceElement>

type DeployArrayFieldInput<Options extends APIDefinitionsOptions> = {
  change: AdditionOrModificationChange
  definitions: types.PickyRequired<ApiDefinitions<Options>, 'deploy'>
  convertError: ConvertError
  changeResolver: ChangeElementResolver<Change<InstanceElement>>
} & Omit<ChangeAndContext, 'change'> & { filterParams: DeployArrayFieldFilterParams }

const mapArrayValuesAndCalculateDiff = ({
  change,
  parentTypeName,
  fieldName,
  valueMapper,
}: { change: AdditionOrModificationChange } & CommonDefinition & Omit<SingleFieldDefinition, 'fieldTypeName'>): {
  valuesToDelete: ArrayElementChangeData[]
  valuesToAdd: ArrayElementChangeData[]
} => {
  const beforeValues = isModificationChange(change) ? _.get(change.data.before.value, fieldName, []) : []
  const afterValues = _.get(change.data.after.value, fieldName, [])
  if (!_.isArray(beforeValues) || !_.isArray(afterValues)) {
    throw new Error(
      `Failed to calculate diff for ${parentTypeName}:${fieldName} ${getChangeData(change).elemID.getFullName()}, expected ${fieldName} to be an array, got ${inspectValue(beforeValues)} and ${inspectValue(afterValues)}`,
    )
  }

  const [resolvedBeforeValues, resolvedAfterValues] = [beforeValues, afterValues].map(arrayValues =>
    arrayValues.map(valueMapper),
  )
  const overlappingValues = _.intersectionWith(resolvedBeforeValues, resolvedAfterValues, _.isEqual)
  const valuesToDelete = _.differenceWith(resolvedBeforeValues, overlappingValues, _.isEqual)
  const valuesToAdd = _.differenceWith(resolvedAfterValues, overlappingValues, _.isEqual)
  return { valuesToDelete, valuesToAdd }
}

const deploySingleArrayField = async <Options extends APIDefinitionsOptions>({
  change,
  singleFieldDefinitions,
  ...args
}: Omit<DeployArrayFieldInput<Options>, 'filterParams'> & {
  singleFieldDefinitions: CommonDefinition & SingleFieldDefinition
}): Promise<DeployResult> => {
  const parentChangeData = getChangeData(change)
  let valuesToDelete: ArrayElementChangeData[]
  let valuesToAdd: ArrayElementChangeData[]
  try {
    ;({ valuesToDelete, valuesToAdd } = mapArrayValuesAndCalculateDiff({ change, ...singleFieldDefinitions }))
  } catch (e) {
    log.error(
      'Failed to calculate diff for %s %s, skipping %s deploy filter on %s %s',
      singleFieldDefinitions.fieldName,
      parentChangeData.elemID.getFullName(),
      singleFieldDefinitions.fieldName,
      singleFieldDefinitions.parentTypeName,
      parentChangeData.elemID.getFullName(),
    )
    return {
      appliedChanges: [],
      errors: [
        {
          severity: 'Error',
          message: e.message,
        },
      ],
    }
  }
  log.debug('Found %d values to delete and %d values to add', valuesToDelete.length, valuesToAdd.length)
  log.trace(
    'values to delete: %s, values to add: %s',
    safeJsonStringify(valuesToDelete, elementExpressionStringifyReplacer),
    safeJsonStringify(valuesToAdd, elementExpressionStringifyReplacer),
  )

  const fieldObjectType = new ObjectType({
    elemID: new ElemID(singleFieldDefinitions.adapterName, singleFieldDefinitions.fieldTypeName),
  })

  const createChange = ({
    action,
    arrayChangeData,
  }: {
    action: 'add' | 'remove'
    arrayChangeData: ArrayElementChangeData
  }): RemovalChange<InstanceElement> | AdditionChange<InstanceElement> => {
    const instance = new InstanceElement(
      `${arrayChangeData.name}_${arrayChangeData.id}`,
      fieldObjectType,
      arrayChangeData,
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [parentChangeData.value],
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

  const removalChanges = valuesToDelete.map(vals => createChange({ action: 'remove', arrayChangeData: vals }))
  const removalRes = await deployChanges({
    changes: removalChanges,
    ...args,
  })
  const additionChanges = valuesToAdd.map(vals => createChange({ action: 'add', arrayChangeData: vals }))
  const additionRes = await deployChanges({
    changes: additionChanges,
    ...args,
  })
  return {
    appliedChanges: [...removalRes.appliedChanges, ...additionRes.appliedChanges],
    errors: [...removalRes.errors, ...additionRes.errors],
  }
}

/**
 *
 */
export const deployArrayFieldsFilterCreator =
  <Options extends APIDefinitionsOptions, Co extends UserConfig<ResolveCustomNameMappingOptionsType<Options>>>({
    convertError = defaultConvertError,
    ...specificTypeParams
  }: Pick<FilterCreationArgs<Options, Co>, 'convertError'> & DeployArrayFieldFilterParams): AdapterFilterCreator<
    {},
    FilterResult,
    {},
    Options
  > =>
  ({ definitions, elementSource, sharedContext }) => ({
    name: 'deployArrayFieldsFilter',
    deploy: async (changes, changeGroup) => {
      const { deploy, ...otherDefs } = definitions
      const { parentTypeName, arrayFields } = specificTypeParams
      if (deploy === undefined) {
        throw new Error('could not find deploy definitions')
      }
      if (changeGroup === undefined) {
        throw new Error('change group not provided')
      }

      const deployArgsWithoutChanges = {
        definitions: { deploy, ...otherDefs },
        changeGroup,
        elementSource,
        convertError,
        changeResolver: createChangeElementResolver<Change<InstanceElement>>({
          getLookUpName: generateLookupFunc(definitions.references?.rules ?? []),
        }),
        sharedContext,
      }

      const appliedChanges: Change[] = []
      const errors: (SaltoError | SaltoElementError)[] = []
      const [relevantChangesInstances, otherChanges] = _.partition(
        changes,
        change =>
          isInstanceChange(change) &&
          isAdditionOrModificationChange(change) &&
          getChangeData(change).elemID.typeName === parentTypeName,
      ) as [AdditionOrModificationChange[], Change[]]

      await awu(relevantChangesInstances).forEach(async change => {
        const changeData = getChangeData(change)
        const { errors: deployErrors } = await deployChanges({
          changes: [change],
          ...deployArgsWithoutChanges,
        })
        if (!_.isEmpty(deployErrors)) {
          errors.push(...deployErrors)
          return
        }
        log.debug(
          'successfully deployed %s %s, starting to deploy %s',
          parentTypeName,
          changeData.elemID.getFullName(),
          arrayFields.map(field => field.fieldName).join(', '),
        )
        await awu(arrayFields).forEach(async singleFieldDefinitions => {
          const deployResult = await deploySingleArrayField({
            change,
            ...deployArgsWithoutChanges,
            singleFieldDefinitions: {
              ...singleFieldDefinitions,
              adapterName: specificTypeParams.adapterName,
              parentTypeName,
            },
          })
          if (!_.isEmpty(deployResult.errors)) {
            errors.push(...deployResult.errors)
            const deployedIds = deployResult.appliedChanges.map(appliedChange =>
              // We create the changes as instance changes, so we can safely assume the value exists
              _.get(getChangeData(appliedChange), 'value.id'),
            )
            const { fieldName, valueMapper } = singleFieldDefinitions
            const arrayWithDeployedChangesOnly = _.get(changeData, fieldName, []).filter((val: unknown) =>
              deployedIds.includes(valueMapper(val).id),
            )
            if (_.isEmpty(arrayWithDeployedChangesOnly)) {
              delete change.data.after.value[fieldName]
            } else {
              change.data.after.value[fieldName] = arrayWithDeployedChangesOnly
            }
          }
        })
        appliedChanges.push(change)
      })
      return {
        deployResult: { appliedChanges, errors },
        leftoverChanges: otherChanges,
      }
    },
  })
