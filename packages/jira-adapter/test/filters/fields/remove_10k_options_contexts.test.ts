/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, Element, CORE_ANNOTATIONS, Value } from '@salto-io/adapter-api'
import { createEmptyType, createMockElementsSource, getFilterParams } from '../../utils'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import remove10kOptionsContexts from '../../../src/filters/fields/remove_10k_options_contexts'
import { Filter } from '../../../src/filter'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'

const createOptions = (count: number): Value =>
  Object.fromEntries(_.range(count).map(i => [`option${i}`, { value: `option${i}`, id: i }]))

const createContext = (id: string, field: InstanceElement): InstanceElement =>
  new InstanceElement(id, createEmptyType(FIELD_CONTEXT_TYPE_NAME), { id }, undefined, {
    [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(field.elemID, field),
  })

describe('remove10kOptionsContexts', () => {
  let elements: Element[]
  let fields: InstanceElement[]
  let contexts: InstanceElement[]
  let filter: Filter
  let config: JiraConfig

  beforeAll(() => {
    const fieldType = createEmptyType(FIELD_TYPE_NAME)
    const fieldA = new InstanceElement('fieldA', fieldType, {})
    const fieldB = new InstanceElement('fieldB', fieldType, {})
    const fieldC = new InstanceElement('fieldC', fieldType, {})
    fields = [fieldA, fieldB, fieldC]

    const contextA1 = createContext('contextA1', fieldA)
    contextA1.value.options = createOptions(10001)
    const contextA2 = createContext('contextA2', fieldA)
    contextA2.value.options = createOptions(5000)
    contextA2.value.options.option0.cascadingOptions = createOptions(5001)
    const contextB1 = createContext('contextB1', fieldB)
    contextB1.value.options = createOptions(5)
    contexts = [contextA1, contextA2, contextB1]
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
  })

  beforeEach(() => {
    config.fetch.remove10KOptionsContexts = true
    const elementsSource = createMockElementsSource([...fields, ...contexts])
    filter = remove10kOptionsContexts(getFilterParams({ config, elementsSource })) as typeof filter
    elements = []
  })

  it('should remove contexts with more than 10K options', async () => {
    elements.push(...fields, ...contexts)
    const result = (await filter.onFetch?.(elements)) ?? {}
    expect(result.errors).toHaveLength(1)
    expect(result.errors?.[0]).toEqual({
      message: 'Other issues',
      detailedMessage:
        'The following contexts had over 10K options and were removed along with their options and orders: context "contextA1" for field "fieldA", context "contextA2" for field "fieldA"',
      severity: 'Warning',
    })
    expect(elements).toHaveLength(4)
    expect(elements.map(e => e.elemID.name).filter(name => name.startsWith('contextA1'))).toBeEmpty()
    expect(elements.map(e => e.elemID.name).filter(name => name.startsWith('contextA2'))).toBeEmpty()
  })
  it('should do nothing when there are no contexts with more than 10K options', async () => {
    elements.push(...fields, contexts[2])
    const result = (await filter.onFetch?.(elements)) ?? {}
    expect(result).toEqual({})
    expect(elements).toHaveLength(4)
  })
  it('when flag is off should do nothing', async () => {
    config.fetch.remove10KOptionsContexts = false
    filter = remove10kOptionsContexts(
      getFilterParams({
        config,
        elementsSource: createMockElementsSource([...fields, ...contexts]),
      }),
    ) as typeof filter
    elements.push(...fields, ...contexts)
    const result = await filter.onFetch?.(elements)
    expect(result).toEqual({})
    expect(elements).toHaveLength(6)
  })
})
