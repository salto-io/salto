/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ActionName, Values } from '@salto-io/adapter-api'
import { ArgsWithCustomizer, DefaultWithCustomizations, TransformDefinition } from '../shared'
import { DeployRequestDefinition } from './request'
import { ChangeIdFunction } from '../../../deployment/grouping'
import { ChangeAndContext, ChangeAndExtendedContext } from './types'

export type ValueReferenceResolver = (args: { value: Values }) => Values

export type DeployRequestCondition = ArgsWithCustomizer<
  boolean,
  {
    // when false, the request will be sent even if the before and after values are equal
    // default: true
    skipIfIdentical?: boolean
    // transformation to use on before and after of the change when comparing the values
    transformForCheck?: TransformDefinition<ChangeAndContext>
  },
  ChangeAndExtendedContext
>

export type DeployableRequestDefinition<ClientOptions extends string> = {
  // when provided, only changes matching the condition will be used in this request
  condition?: DeployRequestCondition

  request: DeployRequestDefinition<ClientOptions>

  // define what (if any) part of the response should be copied back to the workspace (via the original change), or be available for subsequent calls within the operation.
  // by default, only values of fields marked as service id are copied
  copyFromResponse?: {
    // default: true
    // note: if the request's transformation defines nestUnderField, it is used as the root when extracting service ids
    updateServiceIDs?: boolean
    // default: nothing
    additional?: TransformDefinition<ChangeAndExtendedContext>
    // values that should be available as extra context to other requests within the deployment
    // default: nothing
    toSharedContext?: TransformDefinition<ChangeAndExtendedContext> & {
      // when true, the transformation result will be stored under a path based on the elem id, to avoid unintentional overlaps
      // default: true
      nestUnderElemID?: boolean
    }
  }
}

type ChangeIdentifier<AdditionalAction extends string> = {
  type: string
  action?: ActionName | AdditionalAction
}

export type ChangeDependency<AdditionalAction extends string> = {
  first: ChangeIdentifier<ActionName | AdditionalAction>
  second: ChangeIdentifier<ActionName | AdditionalAction>
}

export type ActionDependency<AdditionalAction extends string> = {
  first: ActionName | AdditionalAction
  second: ActionName | AdditionalAction
}

type RecurseIntoPath = {
  fieldPath: string[]
  // the type name in the specified path, the type should have its own deploy definition
  typeName: string
  changeIdFields: string[]
  // when provided, only changes matching the condition will recurse into specified path
  condition?: DeployRequestCondition
  // when missing, all actions are used. currently only standard actions are supported
  onActions?: ActionName[]
}

export type InstanceDeployApiDefinitions<AdditionalAction extends string, ClientOptions extends string> = {
  // a sorted list of requests to make in order to deploy a change of this type
  requestsByAction: DefaultWithCustomizations<
    DeployableRequestDefinition<ClientOptions>[],
    ActionName | AdditionalAction
  >

  // when provided, changes will be calculated from the data at the specified path,
  // and deployed according to the definition of the provided type.
  // this is mainly used for deploying array fields, where each array item must be deployed separately.
  // note: the data is not removed from the main change, but can be excluded using the main change's deploy definition.
  recurseIntoPath?: RecurseIntoPath[]

  // how many changes of this type can be deployed in parallel
  // default = unlimited (max concurrency)
  // note: max concurrency can also be set by using a non-positive number
  concurrency?: number

  // customize the action(s) taken for the given change.
  // by default, the only action is the action from the change
  // example: if an app should be activated in a separate call after being added, we can add a custom "activate" action
  // and have the relevant addition changes be run as add + activate.
  // changes will be marked as applied if at least one action succeeded, but will include errors from all changes (TODO may revisit in SALTO-5557).
  // Note: in most cases, customizing the actions goes hand in hand with customizing dependencies
  // (e.g. defining that all activate actions come after all add actions)
  toActionNames?: ({
    change,
    changeGroup,
    elementSource,
  }: ChangeAndContext) => Promise<(ActionName | AdditionalAction)[]>

  // by default, all actions for a type are run in parallel.
  // if the order is important (e.g. removals before additions), it can be controlled here
  actionDependencies?: ActionDependency<AdditionalAction>[]

  referenceResolution?: {
    // when to deploy references (can be extended further as needed)
    // - early resolution happens in the beginning of the change group's deploy logic, and restored before exiting
    // - on_demand resolution is done only for the relevant deploy requests and never persisted
    // default is on_demand
    when?: 'on_demand' | 'early'
    // TODO support additional resolvers (e.g. for template expressions)
  }

  changeGroupId?: ChangeIdFunction

  // fail if the change already has (error-level) errors from previous actions
  // default: true
  failIfChangeHasErrors?: boolean
}

export type DeployApiDefinitions<AdditionalAction extends string, ClientOptions extends string> = {
  instances: DefaultWithCustomizations<InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>>

  // optional edges determining how to parallelize requests between changes *within the same group*.
  // for example, we can use this to specify that field additions should be made before field_option additions
  // Notes:
  // - action dependencies within the same type can be controlled with actionDependencies
  // - this is usually needed when adding custom actions
  dependencies?: ChangeDependency<AdditionalAction>[]
}
