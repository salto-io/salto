import jszip from 'jszip'
import {
  ObjectType, ElemID, InstanceElement, Field, BuiltinTypes,
} from 'adapter-api'
import { toMetadataPackageZip, bpCase } from '../src/transformer'
import { METADATA_TYPE, METADATA_OBJECT_NAME_FIELD } from '../src/constants'

describe('transofmer', () => {
  const dummyTypeId = new ElemID('adapter', 'dummy')
  const dummyType = new ObjectType({
    elemID: dummyTypeId,
    annotations: {
      [METADATA_TYPE]: 'Dummy',
    },
    fields: {
      str: new Field(dummyTypeId, 'str', BuiltinTypes.STRING),
      lst: new Field(dummyTypeId, 'lst', BuiltinTypes.NUMBER, {}, true),
      bool: new Field(dummyTypeId, 'bool', BuiltinTypes.BOOLEAN),
    },
  })
  const dummyInstance = new InstanceElement(
    new ElemID('adapter', 'instance'),
    dummyType,
    {
      [bpCase(METADATA_OBJECT_NAME_FIELD)]: 'Instance',
      str: 'val',
      lst: [1, 2],
      bool: true,
    },
  )

  describe('toMetadataPackageZip', () => {
    const zip = toMetadataPackageZip(dummyInstance)
      .then(buf => jszip.loadAsync(buf))

    it('should contain package xml', async () => {
      const packageXml = (await zip).files['default/package.xml']
      expect(packageXml).toBeDefined()
      expect(await packageXml.async('text')).toMatch(
        `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <types><members>Instance</members><name>Dummy</name></types>
           <version>46.0</version>
         </Package>`.replace(/>\s+</gs, '><')
      )
    })

    it('should contain instance xml', async () => {
      const instanceXml = (await zip).files['default/dummy/Instance.dummy']
      expect(instanceXml).toBeDefined()
      expect(await instanceXml.async('text')).toMatch(
        `<Dummy xmlns="http://soap.sforce.com/2006/04/metadata">
           <str>val</str>
           <lst>1</lst>
           <lst>2</lst>
           <bool>true</bool>
         </Dummy>`.replace(/>\s+</gs, '><')
      )
    })
  })
})
