/*
*                      Copyright 2022 Salto Labs Ltd.
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
  Change,
  Element,
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ARTICLE_TYPE_NAME, CATEGORY_TYPE_NAME, SECTION_TYPE_NAME, ZENDESK } from '../../src/constants'
import categoriesOrderFilter from '../../src/filters/order_in_categories'
import sectionsOrderFilter from '../../src/filters/order_in_sections'
import { LOGO_FIELD } from '../../src/filters/brand_logo'
import { createFilterCreatorParams } from '../utils'
import { ARTICLES_FIELD, SECTIONS_FIELD } from '../../src/filters/guide_order_utils'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})
mockDeployChange.mockImplementation(async () => ({ appliedChanges: ['change'] }))

type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy'>
// const brandType = new ObjectType({
//   elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
//   fields: {
//     has_help_center: { refType: BuiltinTypes.BOOLEAN },
//   },
// })
const categoryType = new ObjectType({
  elemID: new ElemID(ZENDESK, CATEGORY_TYPE_NAME),
})
const sectionType = new ObjectType({
  elemID: new ElemID(ZENDESK, SECTION_TYPE_NAME),
})
const articleType = new ObjectType({
  elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME),
})

const regularDeployChangeParam = (change: Change) : {} => ({
  change,
  fieldsToIgnore: [LOGO_FIELD, 'categories'],
  client: expect.anything(),
  endpointDetails: expect.anything(),
})

const categoryDeployChangeParam = (change: Change) : {} => ({
  change,
  client: expect.anything(),
  endpointDetails: expect.anything(),
})

const removeNonRelevantFields = (categories: InstanceElement[]) : void => {
  categories.forEach(c => { c.value = { id: c.value.id, position: c.value.position } })
}

const PARENT_ID = 96
// const createBrandInstance = (has_help_center = true): InstanceElement =>
//   new InstanceElement('brand', brandType, { id: PARENT_ID, has_help_center, subdomain: 'test' })

const createChildInstance = (
  id = 0,
  type: string,
  refType: ObjectType,
  parentKey: string,
  position?: number,
  createdAt?: string
): InstanceElement =>
  new InstanceElement(`${type}${id}`, refType, {
    [parentKey]: PARENT_ID,
    testField: 'test',
    id,
    position,
    created_at: createdAt,
  })

const createCategoryInstance = (id = 0, position?: number, createdAt?: string): InstanceElement =>
  createChildInstance(id, 'category_id', categoryType, 'brand', position, createdAt)

const createSectionInCategoryInstance = (
  id = 2, // Not 1 or 2 to avoid having two sections with the same id and name
  position?: number,
  createdAt?: string
) : InstanceElement =>
  createChildInstance(id, 'section', sectionType, 'category_id', position, createdAt)

const createSectionInSectionInstance = (
  id = 0,
  position?: number,
  createdAt?: string
) : InstanceElement =>
  createChildInstance(id, 'section', sectionType, 'parent_section_id', position, createdAt)

const createArticleInstance = (id = 0, position?: number, createdAt?: string): InstanceElement =>
  createChildInstance(id, 'article', articleType, 'section_id', position, createdAt)

let filter: FilterType
let elementsSourceValues: Element[] = []
const elementsSource = {
  get: (elemId: ElemID) => elementsSourceValues.find(
    v => v.elemID.getFullName() === elemId.getFullName()
  ),
} as unknown as ReadOnlyElementsSource

const testFetch = async ({ createParent, createChild, orderField }
  : {
    createParent: () => InstanceElement
    createChild: (id: number, position?: number, createdAt?: string) => InstanceElement
    orderField: string
  })
 : Promise<void> => {
  const parentInstance = createParent()
  parentInstance.value.id = PARENT_ID
  const EARLY_CREATED_AT = '2022-10-29T11:00:00Z'
  const LATE_CREATED_AT = '2022-11-30T12:00:00Z'
  const childInstances = [
    createChild(0, 0, EARLY_CREATED_AT),
    createChild(1, 0, LATE_CREATED_AT),
    createChild(2, 1, LATE_CREATED_AT),
    createChild(3, 1, EARLY_CREATED_AT)]

  await filter.onFetch([parentInstance, ...childInstances])

  expect(parentInstance.value[orderField].length).toBe(4)
  expect(parentInstance.value[orderField])
    .toMatchObject([childInstances[1], childInstances[0], childInstances[2], childInstances[3]]
      .map(c => new ReferenceExpression(c.elemID, c)))
}

type deployInstances = {
  beforeParent: InstanceElement
  firstChild: InstanceElement
  secondChild: InstanceElement
  beforeFirstChild: InstanceElement
  beforeSecondChild: InstanceElement
  afterFirstChild: InstanceElement
  afterSecondChild: InstanceElement
}

const initDeployInstances = (
  createParent: () => InstanceElement,
  createChild: (id: number, position?: number, createdAt?: string) => InstanceElement,
  orderField: string
) : deployInstances => {
  const beforeParent = createParent()
  beforeParent.value.id = PARENT_ID
  const FIRST_ID = 0
  const SECOND_ID = 1

  const firstChild = createChild(FIRST_ID)
  const secondChild = createChild(SECOND_ID)

  const beforeFirstChild = createChild(FIRST_ID, 0)
  const beforeSecondChild = createChild(SECOND_ID, 1)
  const afterFirstChild = createChild(FIRST_ID, 1)
  const afterSecondChild = createChild(SECOND_ID, 0)

  // The code shouldn't deploy non-relevant fields, so we remove them from the result elements
  removeNonRelevantFields([
    beforeFirstChild,
    beforeSecondChild,
    afterFirstChild,
    afterSecondChild,
  ])

  beforeParent.value[orderField] = [firstChild, secondChild].map(
    c => new ReferenceExpression(c.elemID, c)
  )
  firstChild.value.position = 0
  secondChild.value.position = 1
  elementsSourceValues = [firstChild, secondChild]

  return {
    beforeParent,
    firstChild,
    secondChild,
    beforeFirstChild,
    beforeSecondChild,
    afterFirstChild,
    afterSecondChild,
  }
}

const beforeDeploy = (firstChild: InstanceElement, secondChild: InstanceElement): void => {
  mockDeployChange.mockReset()
  firstChild.value.position = 0
  secondChild.value.position = 1
  elementsSourceValues = [firstChild, secondChild]
}

const testDeployWithOrderChanges = async (
  deployInstances: deployInstances,
  withRegularChange: boolean,
  orderField: string
): Promise<void> => {
  const {
    beforeParent,
    firstChild,
    secondChild,
    beforeFirstChild,
    beforeSecondChild,
    afterFirstChild,
    afterSecondChild,
  } = deployInstances
  const afterParent = beforeParent.clone()
  afterParent.value[orderField] = [secondChild, firstChild].map(
    c => new ReferenceExpression(c.elemID, c)
  )
  if (withRegularChange) {
    afterParent.value.testField = 'changed'
  }
  // should deploy categories position change and not return appliedChanges
  elementsSourceValues.push(afterParent)

  const res = await filter.deploy([{
    action: 'modify',
    data: { before: beforeParent, after: afterParent },
  }])

  const isBrand = beforeParent.elemID.typeName === 'brand' // brandFilter also deploys its changes
  if (isBrand) {
    expect(mockDeployChange).toHaveBeenCalledWith(regularDeployChangeParam({ action: 'modify', data: { before: beforeParent, after: afterParent } }))
  }

  expect(mockDeployChange).toHaveBeenCalledTimes(isBrand ? 3 : 2)
  expect(res.deployResult.appliedChanges).toHaveLength(isBrand ? 1 : 0)

  expect(mockDeployChange).toHaveBeenCalledWith(categoryDeployChangeParam({ action: 'modify', data: { before: beforeSecondChild, after: afterSecondChild } }))
  expect(mockDeployChange).toHaveBeenCalledWith(categoryDeployChangeParam({ action: 'modify', data: { before: beforeFirstChild, after: afterFirstChild } }))
}

const testDeployWithoutOrderChanges = async (
  deployInstances: deployInstances,
  orderField: string
): Promise<void> => {
  const {
    beforeParent,
    firstChild,
    secondChild,
  } = deployInstances
  const afterParent = beforeParent.clone()
  afterParent.value[orderField] = [firstChild, secondChild].map(
    c => new ReferenceExpression(c.elemID, c)
  )
  afterParent.value.testField = 'changed'
  // should deploy categories position change and not return appliedChanges
  elementsSourceValues.push(afterParent)

  const res = await filter.deploy([
    { action: 'add', data: { after: beforeParent } },
    { action: 'remove', data: { before: beforeParent } },
    { action: 'modify', data: { before: beforeParent, after: afterParent } },
  ])

  const isBrand = beforeParent.elemID.typeName === 'brand' // brandFilter also deploys its changes
  expect(mockDeployChange).toHaveBeenCalledTimes(isBrand ? 3 : 0)
  expect(res.deployResult.appliedChanges).toHaveLength(isBrand ? 3 : 0)

  if (isBrand) {
    expect(mockDeployChange).toHaveBeenCalledWith(regularDeployChangeParam({ action: 'add', data: { after: beforeParent } }))
    expect(mockDeployChange).toHaveBeenCalledWith(regularDeployChangeParam({ action: 'remove', data: { before: beforeParent } }))
    expect(mockDeployChange).toHaveBeenCalledWith(regularDeployChangeParam({ action: 'modify', data: { before: beforeParent, after: afterParent } }))
  }
}
/*
describe('categories order in brand', () => {
  beforeEach(async () => {
    filter = brandOrderFilter(createFilterCreatorParams({ elementsSource })) as FilterType
  })

  describe('on fetch', () => {
    it('with Guide active', async () => {
      const config = DEFAULT_CONFIG
      config[FETCH_CONFIG].enableGuide = true
      filter = brandOrderFilter(createFilterCreatorParams({ elementsSource, config })) as FilterType
      await testFetch({
        createParent: createBrandInstance,
        createChild: createCategoryInstance,
        orderField: CATEGORIES_FIELD,
      })
    })
    it('with Guide not active in the brand', async () => {
      filter = brandOrderFilter(createFilterCreatorParams({ elementsSource })) as FilterType
      // Should not create categories order field at all
      const brandWithoutGuide = createBrandInstance(false)
      const categories = [createCategoryInstance(), createCategoryInstance()]
      await filter.onFetch([brandWithoutGuide, ...categories])

      expect(brandWithoutGuide.value.categories).toBeUndefined()
    })
    it('with Guide not active in Salto', async () => {
      const config = DEFAULT_CONFIG
      config[FETCH_CONFIG].enableGuide = false
      filter = brandOrderFilter(createFilterCreatorParams({ elementsSource, config })) as FilterType
      // Should not create categories order field at all
      const brandWithoutGuide = createBrandInstance()
      const categories = [createCategoryInstance(), createCategoryInstance()]
      await filter.onFetch([brandWithoutGuide, ...categories])

      expect(brandWithoutGuide.value.categories).toBeUndefined()
    })
  })

  describe('on deploy', () => {
    const deployInstances = initDeployInstances(
      createBrandInstance,
      createCategoryInstance,
      CATEGORIES_FIELD
    )
    beforeEach(() => {
      beforeDeploy(deployInstances.firstChild, deployInstances.secondChild)
    })

    it(`with only ${CATEGORIES_FIELD} order change`, async () => {
      await testDeployWithOrderChanges(deployInstances, false, CATEGORIES_FIELD)
    })

    it(`with ${CATEGORIES_FIELD} change and regular change`, async () => {
      await testDeployWithOrderChanges(deployInstances, true, CATEGORIES_FIELD)
    })

    it('with only non-order changes', async () => {
      await testDeployWithoutOrderChanges(deployInstances, CATEGORIES_FIELD)
    })
  })
})
*/
describe('sections order in category', () => {
  beforeEach(async () => {
    filter = categoriesOrderFilter(createFilterCreatorParams({ elementsSource })) as FilterType
  })

  it('on fetch', async () => {
    await testFetch({
      createParent: createCategoryInstance,
      createChild: createSectionInCategoryInstance,
      orderField: SECTIONS_FIELD,
    })
  })

  describe('on deploy', () => {
    const deployInstances = initDeployInstances(
      createCategoryInstance,
      createSectionInCategoryInstance,
      SECTIONS_FIELD
    )
    beforeEach(() => {
      beforeDeploy(deployInstances.firstChild, deployInstances.secondChild)
    })

    it(`with only ${SECTIONS_FIELD} order change`, async () => {
      await testDeployWithOrderChanges(deployInstances, false, SECTIONS_FIELD)
    })

    it(`with ${SECTIONS_FIELD} change and regular change`, async () => {
      await testDeployWithOrderChanges(deployInstances, true, SECTIONS_FIELD)
    })

    it('with only non-order changes', async () => {
      await testDeployWithoutOrderChanges(deployInstances, SECTIONS_FIELD)
    })
  })
})

describe('sections and articles order in section', () => {
  beforeEach(async () => {
    filter = sectionsOrderFilter(createFilterCreatorParams({ elementsSource })) as FilterType
  })

  it('on fetch', async () => {
    await testFetch({
      createParent: createSectionInCategoryInstance,
      createChild: createSectionInSectionInstance,
      orderField: SECTIONS_FIELD,
    })
    await testFetch({
      createParent: createSectionInCategoryInstance,
      createChild: createArticleInstance,
      orderField: ARTICLES_FIELD,
    })
  })

  describe('on deploy', () => {
    describe('section in section', () => {
      const deployInstances = initDeployInstances(
        createSectionInCategoryInstance,
        createSectionInSectionInstance,
        SECTIONS_FIELD
      )
      beforeEach(() => {
        beforeDeploy(deployInstances.firstChild, deployInstances.secondChild)
      })

      it(`with only ${SECTIONS_FIELD} order change`, async () => {
        await testDeployWithOrderChanges(deployInstances, false, SECTIONS_FIELD)
      })

      it(`with ${SECTIONS_FIELD} change and regular change`, async () => {
        await testDeployWithOrderChanges(deployInstances, true, SECTIONS_FIELD)
      })

      it('with only non-order changes', async () => {
        await testDeployWithoutOrderChanges(deployInstances, SECTIONS_FIELD)
      })
    })
    describe('article in section', () => {
      const deployInstances = initDeployInstances(
        createSectionInCategoryInstance,
        createArticleInstance,
        ARTICLES_FIELD
      )
      beforeEach(() => {
        beforeDeploy(deployInstances.firstChild, deployInstances.secondChild)
      })

      it(`with only ${ARTICLES_FIELD} order change`, async () => {
        await testDeployWithOrderChanges(deployInstances, false, ARTICLES_FIELD)
      })

      it(`with ${ARTICLES_FIELD} change and regular change`, async () => {
        await testDeployWithOrderChanges(deployInstances, true, ARTICLES_FIELD)
      })

      it('with only non-order changes', async () => {
        await testDeployWithoutOrderChanges(deployInstances, ARTICLES_FIELD)
      })
    })
  })
})
