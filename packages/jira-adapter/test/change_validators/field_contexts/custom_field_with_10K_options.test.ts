/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import each from 'jest-each'
import {
  CORE_ANNOTATIONS,
  ChangeError,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  Values,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { JIRA } from '../../../src/constants'
import { customFieldsWith10KOptionValidator } from '../../../src/change_validators/field_contexts/custom_field_with_10K_options'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { createEmptyType } from '../../utils'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, OPTIONS_ORDER_TYPE_NAME } from '../../../src/filters/fields/constants'

const generateOptions = (count: number): Values => {
  const options: { [key: string]: { value: string; disabled: boolean; position: number } } = {}
  Array.from({ length: count }, (_length, i) => i).forEach(i => {
    const key = `p${i}`
    options[key] = {
      value: key,
      disabled: false,
      position: i,
    }
  })
  return options
}

const severityWith = 'Error'
const messageWith = 'Cannot deploy a field context with more than 10K options'
const detailedMessageWith =
  'The deployment of context "context" for field "parentField"\'s options will be blocked because there are more than 10K options.'
const withRemoveFlagError = (elemID: ElemID): ChangeError => ({
  elemID,
  severity: severityWith,
  message: messageWith,
  detailedMessage: detailedMessageWith,
})

const severityWithout = 'Info'
const messageWithout = 'Slow deployment due to field context with more than 10K options'
const detailedMessageWithout =
  'The deployment of context "context" for field "parentField"\'s options will be slower because there are more than 10K options.'

const withoutRemoveFlagError = (elemID: ElemID): ChangeError => ({
  elemID,
  severity: severityWithout,
  message: messageWithout,
  detailedMessage: detailedMessageWithout,
})

describe('customFieldsWith10KOptionValidator', () => {
  let parentField: InstanceElement
  let contextInstance: InstanceElement
  let config: JiraConfig
  const tenKOptions = generateOptions(10010)
  beforeEach(() => {
    parentField = new InstanceElement('parentField', new ObjectType({ elemID: new ElemID(JIRA, 'Field') }), { id: 2 })
    contextInstance = new InstanceElement(
      'context',
      new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') }),
      {
        id: 3,
        options: [],
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
      },
    )
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.remove10KOptionsContexts = true
  })
  describe('without splitFieldContextOptions', () => {
    beforeEach(() => {
      config.fetch.splitFieldContextOptions = false
    })
    each([
      ['with', true, withRemoveFlagError],
      ['without', false, withoutRemoveFlagError],
    ]).describe('%s removal of 10k options', (_text, removalOf10KOptions, errorMessageFunc) => {
      beforeEach(() => {
        config.fetch.remove10KOptionsContexts = removalOf10KOptions
      })

      it('should return info message when context has more than 10K options', async () => {
        const largeOptionsObject = tenKOptions
        contextInstance.value.options = largeOptionsObject
        const changes = [toChange({ after: contextInstance })]
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors).toEqual([errorMessageFunc(contextInstance.elemID)])
      })
      it('should not return info message when context has less than 10K options', async () => {
        const smallOptionsObject = generateOptions(100)
        contextInstance.value.options = smallOptionsObject
        const changes = [toChange({ after: contextInstance })]
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
        expect(changeErrors).toHaveLength(0)
      })
      it('handle multi changes', async () => {
        const largeOptionsObject = tenKOptions
        const contextInstanceAfterOne = contextInstance.clone()
        const contextInstanceAfterTwo = contextInstance.clone()
        contextInstanceAfterTwo.value.id = '2'
        contextInstanceAfterOne.value.options = largeOptionsObject
        contextInstanceAfterTwo.value.options = largeOptionsObject
        const changes = [toChange({ after: contextInstanceAfterOne }), toChange({ after: contextInstanceAfterTwo })]
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
        expect(changeErrors).toHaveLength(2)
        expect(changeErrors).toEqual([
          errorMessageFunc(contextInstanceAfterOne.elemID),
          errorMessageFunc(contextInstanceAfterTwo.elemID),
        ])
      })
      it('should not return error if context has no new options', async () => {
        contextInstance.value.options = tenKOptions
        const contextInstanceAfter = contextInstance.clone()
        contextInstanceAfter.value.disabled = true
        const changes = [toChange({ before: contextInstance, after: contextInstanceAfter })]
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
        expect(changeErrors).toHaveLength(0)
      })
      it('should return error for modification change', async () => {
        contextInstance.value.options = tenKOptions
        const contextInstanceAfter = contextInstance.clone()
        contextInstanceAfter.value.options.p20002 = {
          value: 'p20002',
          disabled: false,
          position: 20002,
        }
        const changes = [toChange({ before: contextInstance, after: contextInstanceAfter })]
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors).toEqual([errorMessageFunc(contextInstance.elemID)])
      })
    })

    describe('with removal of 10K options', () => {
      it('should return info message when context has more than 10K options', async () => {
        const largeOptionsObject = tenKOptions
        contextInstance.value.options = largeOptionsObject
        const changes = [toChange({ after: contextInstance })]
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors).toEqual([
          {
            elemID: contextInstance.elemID,
            severity: 'Error',
            message: 'Cannot deploy a field context with more than 10K options',
            detailedMessage:
              'The deployment of context "context" for field "parentField"\'s options will be blocked because there are more than 10K options.',
          },
        ])
      })
      it('should not return info message when context has less than 10K options', async () => {
        const smallOptionsObject = generateOptions(100)
        contextInstance.value.options = smallOptionsObject
        const changes = [toChange({ after: contextInstance })]
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
        expect(changeErrors).toHaveLength(0)
      })
      it('handle multy changes', async () => {
        const largeOptionsObject = tenKOptions
        const contextInstanceAfterOne = contextInstance.clone()
        const contextInstanceAfterTwo = contextInstance.clone()
        contextInstanceAfterTwo.value.id = '2'
        contextInstanceAfterOne.value.options = largeOptionsObject
        contextInstanceAfterTwo.value.options = largeOptionsObject
        const changes = [toChange({ after: contextInstanceAfterOne }), toChange({ after: contextInstanceAfterTwo })]
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
        expect(changeErrors).toHaveLength(2)
        expect(changeErrors).toEqual([
          {
            elemID: contextInstanceAfterOne.elemID,
            severity: 'Error',
            message: 'Cannot deploy a field context with more than 10K options',
            detailedMessage:
              'The deployment of context "context" for field "parentField"\'s options will be blocked because there are more than 10K options.',
          },
          {
            elemID: contextInstanceAfterTwo.elemID,
            severity: 'Error',
            message: 'Cannot deploy a field context with more than 10K options',
            detailedMessage:
              'The deployment of context "context" for field "parentField"\'s options will be blocked because there are more than 10K options.',
          },
        ])
      })
      it('should not return error if context has no new options', async () => {
        contextInstance.value.options = tenKOptions
        const contextInstanceAfter = contextInstance.clone()
        contextInstanceAfter.value.disabled = true
        const changes = [toChange({ before: contextInstance, after: contextInstanceAfter })]
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
        expect(changeErrors).toHaveLength(0)
      })
      it('should return error for modification change', async () => {
        contextInstance.value.options = tenKOptions
        const contextInstanceAfter = contextInstance.clone()
        contextInstanceAfter.value.options.p20002 = {
          value: 'p20002',
          disabled: false,
          position: 20002,
        }
        const changes = [toChange({ before: contextInstance, after: contextInstanceAfter })]
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors).toEqual([
          {
            elemID: contextInstance.elemID,
            severity: 'Error',
            message: 'Cannot deploy a field context with more than 10K options',
            detailedMessage:
              'The deployment of context "context" for field "parentField"\'s options will be blocked because there are more than 10K options.',
          },
        ])
      })
    })
  })

  describe('with splitFieldContextOptions', () => {
    describe('without removal of 10K options', () => {
      beforeEach(() => {
        config.fetch.remove10KOptionsContexts = false
      })
      it('should return error for modification change', async () => {
        config.fetch.splitFieldContextOptions = true
        const orderInstance = new InstanceElement(
          'orderInstance',
          createEmptyType(OPTIONS_ORDER_TYPE_NAME),
          { options: _.range(0, 10001) },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
          },
        )
        const orderInstanceAfter = orderInstance.clone()
        orderInstanceAfter.value.options.p20002 = {
          value: 'p20002',
          disabled: false,
          position: 20002,
        }
        const changes = [toChange({ before: orderInstance, after: orderInstanceAfter })]
        const elementsSource = buildElementsSourceFromElements([orderInstanceAfter, contextInstance])
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors).toEqual([
          {
            elemID: contextInstance.elemID,
            severity: 'Info',
            message: 'Slow deployment due to field context with more than 10K options',
            detailedMessage:
              'The deployment of context "context" for field "parentField"\'s options will be slower because there are more than 10K options.',
          },
        ])
      })
      it('should not return error for modification change with less than 10K options', async () => {
        config.fetch.splitFieldContextOptions = true
        const orderInstance = new InstanceElement(
          'orderInstance',
          createEmptyType(OPTIONS_ORDER_TYPE_NAME),
          { options: _.range(0, 9999) },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
          },
        )
        const orderInstanceAfter = orderInstance.clone()
        orderInstanceAfter.value.options.p20002 = {
          value: 'p20002',
          disabled: false,
          position: 20002,
        }
        const changes = [toChange({ before: orderInstance, after: orderInstanceAfter })]
        const elementsSource = buildElementsSourceFromElements([orderInstanceAfter, contextInstance])
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
        expect(changeErrors).toHaveLength(0)
      })
      it('should return error for context with cascading options with more than 10K options overall', async () => {
        config.fetch.splitFieldContextOptions = true
        const orderInstance = new InstanceElement(
          'orderInstance',
          createEmptyType(OPTIONS_ORDER_TYPE_NAME),
          { options: _.range(0, 9000) },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
          },
        )
        const optionInstance = new InstanceElement(
          'optionInstance',
          createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
          {},
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
          },
        )
        const innerOrderInstance = new InstanceElement(
          'innerOrderInstance',
          createEmptyType(OPTIONS_ORDER_TYPE_NAME),
          { options: _.range(0, 1001) },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(optionInstance.elemID, optionInstance)],
          },
        )
        const changes = [toChange({ after: orderInstance }), toChange({ after: innerOrderInstance })]
        const elementsSource = buildElementsSourceFromElements([
          orderInstance,
          innerOrderInstance,
          optionInstance,
          contextInstance,
        ])
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
        expect(changeErrors).toHaveLength(2)
        expect(changeErrors).toEqual(
          _.range(0, 2).map(() => ({
            elemID: contextInstance.elemID,
            severity: 'Info',
            message: 'Slow deployment due to field context with more than 10K options',
            detailedMessage:
              'The deployment of context "context" for field "parentField"\'s options will be slower because there are more than 10K options.',
          })),
        )
      })
      it('should not return error without order changes', async () => {
        config.fetch.splitFieldContextOptions = true
        const changes = [toChange({ after: contextInstance })]
        const elementsSource = buildElementsSourceFromElements([contextInstance])
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
        expect(changeErrors).toHaveLength(0)
      })
      it('should not return error with undefined elements source', async () => {
        config.fetch.splitFieldContextOptions = true
        const orderInstance = new InstanceElement(
          'orderInstance',
          createEmptyType(OPTIONS_ORDER_TYPE_NAME),
          { options: _.range(0, 10001) },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
          },
        )
        const changes = [toChange({ after: orderInstance })]
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, undefined)
        expect(changeErrors).toHaveLength(0)
      })
      it('should handle order instances without options field', async () => {
        config.fetch.splitFieldContextOptions = true
        const orderInstance = new InstanceElement(
          'orderInstance',
          createEmptyType(OPTIONS_ORDER_TYPE_NAME),
          {},
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
          },
        )
        const changes = [toChange({ after: orderInstance })]
        const elementsSource = buildElementsSourceFromElements([orderInstance, contextInstance])
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
        expect(changeErrors).toHaveLength(0)
      })
    })
    describe('with removal of 10K options', () => {
      it('should return error for modification change', async () => {
        const orderInstance = new InstanceElement(
          'orderInstance',
          createEmptyType(OPTIONS_ORDER_TYPE_NAME),
          { options: _.range(0, 10001) },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
          },
        )
        const orderInstanceAfter = orderInstance.clone()
        orderInstanceAfter.value.options.p20002 = {
          value: 'p20002',
          disabled: false,
          position: 20002,
        }
        const sampleOptionsInstances = _.range(0, 5).map(
          i =>
            new InstanceElement(`optionInstance${i}`, createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME), {}, undefined, {
              [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
            }),
        )
        const changes = [
          toChange({ before: orderInstance, after: orderInstanceAfter }),
          ...sampleOptionsInstances.map((instance, index) =>
            toChange({ before: sampleOptionsInstances[(index - 1) % sampleOptionsInstances.length], after: instance }),
          ),
        ]
        const elementsSource = buildElementsSourceFromElements([
          orderInstanceAfter,
          contextInstance,
          ...sampleOptionsInstances,
        ])
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
        expect(changeErrors).toHaveLength(6)
        expect(changeErrors).toEqual(
          [orderInstance, ...sampleOptionsInstances].map(instance => ({
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Cannot deploy a field context with more than 10K options',
            detailedMessage:
              'The deployment of context "context" for field "parentField"\'s options will be blocked because there are more than 10K options.',
          })),
        )
      })
      it('should not return error for modification change with less than 10K options', async () => {
        config.fetch.splitFieldContextOptions = true
        const orderInstance = new InstanceElement(
          'orderInstance',
          createEmptyType(OPTIONS_ORDER_TYPE_NAME),
          { options: _.range(0, 9999) },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
          },
        )
        const orderInstanceAfter = orderInstance.clone()
        orderInstanceAfter.value.options.p20002 = {
          value: 'p20002',
          disabled: false,
          position: 20002,
        }
        const changes = [toChange({ before: orderInstance, after: orderInstanceAfter })]
        const elementsSource = buildElementsSourceFromElements([orderInstanceAfter, contextInstance])
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
        expect(changeErrors).toHaveLength(0)
      })
      it('should return error for context with cascading options with more than 10K options overall', async () => {
        config.fetch.splitFieldContextOptions = true
        const orderInstance = new InstanceElement(
          'orderInstance',
          createEmptyType(OPTIONS_ORDER_TYPE_NAME),
          { options: _.range(0, 9000) },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
          },
        )
        const optionInstance = new InstanceElement(
          'optionInstance',
          createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
          {},
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
          },
        )
        const innerOrderInstance = new InstanceElement(
          'innerOrderInstance',
          createEmptyType(OPTIONS_ORDER_TYPE_NAME),
          { options: _.range(0, 1001) },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(optionInstance.elemID, optionInstance)],
          },
        )
        const innerOptionInstance = new InstanceElement(
          'innerOptionInstance',
          createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
          {},
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(optionInstance.elemID, optionInstance)],
          },
        )
        const changes = [
          toChange({ after: orderInstance }),
          toChange({ after: innerOrderInstance }),
          toChange({ after: optionInstance }),
          toChange({ after: innerOptionInstance }),
        ]
        const elementsSource = buildElementsSourceFromElements([
          orderInstance,
          innerOrderInstance,
          optionInstance,
          innerOptionInstance,
          contextInstance,
        ])
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
        expect(changeErrors).toHaveLength(4)
        expect(changeErrors).toEqual(
          [orderInstance, innerOrderInstance, optionInstance, innerOptionInstance].map(instance => ({
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Cannot deploy a field context with more than 10K options',
            detailedMessage:
              'The deployment of context "context" for field "parentField"\'s options will be blocked because there are more than 10K options.',
          })),
        )
      })
      it('should not return error without order changes', async () => {
        config.fetch.splitFieldContextOptions = true
        const changes = [toChange({ after: contextInstance })]
        const elementsSource = buildElementsSourceFromElements([contextInstance])
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
        expect(changeErrors).toHaveLength(0)
      })
      it('should not return error with undefined elements source', async () => {
        config.fetch.splitFieldContextOptions = true
        const orderInstance = new InstanceElement(
          'orderInstance',
          createEmptyType(OPTIONS_ORDER_TYPE_NAME),
          { options: _.range(0, 10001) },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
          },
        )
        const changes = [toChange({ after: orderInstance })]
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, undefined)
        expect(changeErrors).toHaveLength(0)
      })
      it('should handle order instances without options field', async () => {
        config.fetch.splitFieldContextOptions = true
        const orderInstance = new InstanceElement(
          'orderInstance',
          createEmptyType(OPTIONS_ORDER_TYPE_NAME),
          {},
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
          },
        )
        const changes = [toChange({ after: orderInstance })]
        const elementsSource = buildElementsSourceFromElements([orderInstance, contextInstance])
        const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
        expect(changeErrors).toHaveLength(0)
      })
    })
  })
})
