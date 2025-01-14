/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getChangeData } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { getParents, inspectValue } from '@salto-io/adapter-utils'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { get, omit } from 'lodash'
import { nodeMutation } from '../graphql_schemas'
import { transform as transformMulti } from '../../shared/transforms/graphql_adjuster'

const NODE_OPERATION_NAME = 'applyNodeListTransactionByFlowId'

// Node requests contain the node data, the subflow (answer) id and the flow (bot) id
// The transaction id is the node id - this may break in the future if Zendesk changes the id generation
// The events array contains a single event with the node data. This can be multiple events if needed - currently only one event is supported
// The 'Changed' action should have both the 'from' and 'to' fields, but this is not enforced so we simplify the logic.
// The `change` is assumed to be resolved values
export const transformRequest: (
  action: 'Added' | 'Deleted' | 'Changed',
) => definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndExtendedContext> = action => async item => {
  const {
    value,
    context: { change },
  } = item
  if (!lowerdashValues.isPlainObject(value)) {
    throw new Error('unexpected value for graphql item, not transforming')
  }
  const changeData = getChangeData(change)
  const answer = getParents(changeData)[0]
  const subFlowId = answer?.id?.toString()
  const flowId = answer?.flowId?.value?.value?.id?.toString()
  const id = get(value, 'id')?.toString()
  if (subFlowId === undefined || flowId === undefined || id === undefined) {
    throw new Error(
      `Missing required fields for conversation bot node item.
      Received subFlowId: ${subFlowId}, flowId: ${flowId} and node id: ${id}, not transforming: ${inspectValue(value)}`,
    )
  }
  // Events do not accept the id field, so we omit it
  const events = ['Added', 'Changed'].includes(action)
    ? [
        {
          eventType: action,
          id,
          from: null,
          to: omit(value, 'id'),
        },
      ]
    : [
        {
          eventType: action,
          id,
          from: omit(value, 'id'),
          to: null,
        },
      ]
  return {
    value: {
      query: nodeMutation,
      operationName: NODE_OPERATION_NAME,
      variables: {
        flowId,
        subFlowId,
        transactionId: id,
        events,
      },
    },
  }
}

// Node responses contain all nodes, we select the relevant node by id
export const transformResponse: (
  isDeleted?: boolean,
) => definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndExtendedContext> = isDeleted => async item => {
  try {
    const nodes = await transformMulti(NODE_OPERATION_NAME)(item)
    const {
      context: { change },
    } = item
    const changeData = getChangeData(change)
    const id = changeData.value.id.toString()
    const value = nodes?.find(node => node.value.id === id)
    if (value === undefined) {
      if (isDeleted === true) {
        return { value: { id } }
      }
      throw new Error(`Failed to find node with id ${id}`)
    }
    return { value: value.value }
  } catch (e) {
    if (isDeleted === true && e.message.includes('NODE_ACCESS_NOT_AUTHORISED')) {
      return { value: { id: getChangeData(item.context.change).value.id.toString() } }
    }
    throw e
  }
}
