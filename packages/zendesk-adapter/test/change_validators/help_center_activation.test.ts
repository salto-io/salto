import {ElemID, InstanceElement, ObjectType, toChange} from '@salto-io/adapter-api'
import {BRAND_TYPE_NAME, ZENDESK} from '../../src/constants'
import {helpCenterActivationValidator} from "../../src/change_validators";


describe('helpCenterActivationValidator', () => {

  const BrandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
  })

  const brandOneInstance = new InstanceElement(
    'Test1',
    BrandType,
    {
      help_center_state: 'enabled',
      has_help_center: true,
      brand_url: 'https://free-tifder.zendesk.com',
    },
  )

  it('should return an error when help_center_state is changed', async () => {
    const brandTwoInstance = new InstanceElement(
      'Test2',
      BrandType,
      {
        help_center_state: 'restricted',
        has_help_center: true,
        brand_url: 'https://free-tifder.zendesk.com',
      },
    )
    const errors = await helpCenterActivationValidator(
      [toChange({ before: brandOneInstance, after: brandTwoInstance })]
    )
    expect(errors).toEqual([{
      elemID: brandTwoInstance.elemID,
      severity: 'Error',
      message: 'Activation or deactivation of help center for a certain brand is not supported via Salto.',
      detailedMessage: `Activation or deactivation of help center for a certain brand is not supported via Salto. To activate or deactivate a help center, please go to ${brandTwoInstance.value.brand_url}/hc/admin/general_settings`,
    }])
  })

  it('should not return an error when help_center_state is not changed', async () => {
    const brandTwoInstance = new InstanceElement(
      'Test2',
      BrandType,
      {
        help_center_state: 'enabled',
        has_help_center: true,
        brand_url: 'https://free.zendesk.com',
      },
    )
    const errors = await helpCenterActivationValidator(
      [toChange({ before: brandOneInstance, after: brandTwoInstance })]
    )
    expect(errors).toHaveLength(0)
  })

  it('should not return an error when the change is addition', async () => {
    const errors = await helpCenterActivationValidator(
      [toChange({ after: brandOneInstance })]
    )
    expect(errors).toHaveLength(0)
  })

  it('should not return an error when the change is removal', async () => {
    const errors = await helpCenterActivationValidator(
      [toChange({ before: brandOneInstance })]
    )
    expect(errors).toHaveLength(0)
  })


})
