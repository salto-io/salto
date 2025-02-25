/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Element,
  isInstanceElement,
  InstanceElement,
  ObjectType,
  ElemID,
  ListType,
  isObjectType,
  BuiltinTypes,
  ReferenceExpression,
  Change,
  getChangeData,
  isModificationChange,
  isInstanceChange,
  SaltoError,
  isSaltoError,
} from '@salto-io/adapter-api'
import {
  elements as elementsUtils,
  config as configUtils,
  definitions as definitionsUtils,
} from '@salto-io/adapter-components'
import { createSaltoElementError, applyFunctionToChangeData, pathNaclCase, inspectValue } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { ZENDESK } from '../../constants'
import { deployChange } from '../../deployment'
import ZendeskClient from '../../client/client'
import { Options } from '../../definitions/types'

const { TYPES_PATH, SUBTYPES_PATH, RECORDS_PATH, SETTINGS_NESTED_PATH } = elementsUtils

export type DeployFuncType = (
  change: Change<InstanceElement>,
  client: ZendeskClient,
  apiDefinitions: configUtils.AdapterApiConfig,
  definitions: definitionsUtils.ApiDefinitions<Options>,
) => Promise<void>

type ReorderFilterCreatorParams = {
  filterName: string
  typeName: string
  orderFieldName: string
  iterateesToSortBy?: Array<_.Many<_.ListIteratee<InstanceElement>>>
  deployFunc?: DeployFuncType
  // Note: if no active field name is provided,
  //  we don't split the instances to active and inactive lists
  activeFieldName?: string
}

export const createOrderTypeName = (typeName: string): string => `${typeName}_order`

export const createReorderFilterCreator =
  ({
    typeName,
    orderFieldName,
    iterateesToSortBy = [instance => instance.value.position],
    deployFunc = async (change, client, apiDefinitions, definitions) => {
      await deployChange({
        change,
        client,
        apiDefinitions,
        definitions,
      })
    },
    activeFieldName,
    filterName,
  }: ReorderFilterCreatorParams): FilterCreator =>
  ({ oldApiDefinitions, client, definitions }) => ({
    name: filterName,
    onFetch: async (elements: Element[]): Promise<void> => {
      const orderTypeName = createOrderTypeName(typeName)
      const objType = elements.filter(isObjectType).find(e => e.elemID.name === typeName)
      if (objType === undefined) {
        return
      }
      const instancesReferences = _.sortBy(
        elements.filter(isInstanceElement).filter(e => e.elemID.typeName === typeName),
        ...iterateesToSortBy,
      )
        .map(inst => {
          delete inst.value.position
          return inst
        })
        .map(refInst => new ReferenceExpression(refInst.elemID, refInst))
      const typeNameNaclCase = pathNaclCase(orderTypeName)
      const type = new ObjectType({
        elemID: new ElemID(ZENDESK, orderTypeName),
        fields: {
          active: {
            refType: new ListType(BuiltinTypes.NUMBER),
          },
          inactive: {
            refType: new ListType(BuiltinTypes.NUMBER),
          },
        },
        isSettings: true,
        path: [ZENDESK, TYPES_PATH, SUBTYPES_PATH, typeNameNaclCase],
      })
      const instance = new InstanceElement(
        ElemID.CONFIG_NAME,
        type,
        activeFieldName
          ? {
              active: instancesReferences.filter(ref => ref.value.value[activeFieldName]),
              inactive: instancesReferences.filter(ref => !ref.value.value[activeFieldName]),
            }
          : { active: instancesReferences },
        [ZENDESK, RECORDS_PATH, SETTINGS_NESTED_PATH, typeNameNaclCase],
      )
      // Those types already exist since we added the empty version of them
      //  via the add remaining types mechanism. So we first need to remove the old versions
      _.remove(elements, element => element.elemID.isEqual(type.elemID))
      elements.push(type, instance)
    },
    preDeploy: async changes => {
      changes
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === createOrderTypeName(typeName))
        .forEach(instance => {
          instance.value[orderFieldName] = (instance.value.active ?? []).concat(instance.value.inactive ?? [])
        })
    },
    onDeploy: async changes => {
      changes
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === createOrderTypeName(typeName))
        .forEach(instance => {
          delete instance.value[orderFieldName]
        })
    },
    deploy: async (changes: Change<InstanceElement>[]) => {
      const orderTypeName = createOrderTypeName(typeName)
      const [relevantChanges, leftoverChanges] = _.partition(
        changes,
        change => getChangeData(change).elemID.typeName === orderTypeName,
      )
      if (relevantChanges.length === 0) {
        return {
          deployResult: { appliedChanges: [], errors: [] },
          leftoverChanges,
        }
      }
      try {
        if (relevantChanges.length > 1) {
          const message = `${orderTypeName} element is a singleton and should have only on instance. Found multiple: ${relevantChanges.length}`
          const saltoError: SaltoError = {
            message,
            detailedMessage: message,
            severity: 'Error',
          }
          throw saltoError // in try block
        }
        const [change] = relevantChanges
        if (!isModificationChange(change)) {
          const message = `only modify change is allowed on ${orderTypeName}. Found ${change.action} action`
          throw createSaltoElementError({
            // in try block
            message,
            detailedMessage: message,
            severity: 'Error',
            elemID: getChangeData(change).elemID,
          })
        }
        await deployFunc(change, client, oldApiDefinitions, definitions)
      } catch (err) {
        if (!isSaltoError(err)) {
          throw err
        }
        return {
          deployResult: { appliedChanges: [], errors: [err] },
          leftoverChanges,
        }
      }
      return {
        deployResult: { appliedChanges: relevantChanges, errors: [] },
        leftoverChanges,
      }
    },
  })

const idsAreNumbers = (ids: unknown): ids is number[] => _.isArray(ids) && ids.every(Number.isInteger)

export const deployFuncCreator =
  (fieldName: string): DeployFuncType =>
  async (change, client, apiDefinitions, definitions) => {
    const clonedChange = await applyFunctionToChangeData(change, inst => inst.clone())
    const instance = getChangeData(clonedChange)
    const { ids } = instance.value
    if (!idsAreNumbers(ids)) {
      const message = `Not all the ids are numbers: ${inspectValue(ids, { maxArrayLength: null })}`
      throw createSaltoElementError({
        // caught in try block
        message,
        detailedMessage: message,
        severity: 'Error',
        elemID: getChangeData(change).elemID,
      })
    }
    const idsWithPositions = ids.map((id, position) => ({ id, position: position + 1 }))
    instance.value[fieldName] = idsWithPositions
    delete instance.value.ids
    await deployChange({
      change: clonedChange,
      client,
      apiDefinitions,
      definitions,
    })
  }
