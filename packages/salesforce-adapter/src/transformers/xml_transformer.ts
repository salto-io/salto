import { ElemID, InstanceElement, Value } from 'adapter-api'
import _ from 'lodash'
import { FileProperties, MetadataInfo, RetrieveResult } from 'jsforce'
import JSZip from 'jszip'
import { API_VERSION, METADATA_NAMESPACE } from '../client/client'
import { SALESFORCE } from '../constants'
import { ASSIGNMENT_RULES_TYPE_ID } from '../filters/assignment_rules'
import { apiName, metadataType, toMetadataInfo } from '../transformer'

const DEFAULT = 'default'

// Todo: currently fromRetrieveResult is not generic and supports only ApexClass & ApexTrigger
export const fromRetrieveResult = async (retrieveResult: RetrieveResult, fileProperties:
  FileProperties[]): Promise<MetadataInfo[]> => {
  const BASE_64 = 'base64'
  const decodeContent = async (zip: JSZip, fileName: string): Promise<string> =>
    zip.file(fileName).async(BASE_64)
      .then(data => Buffer.from(data, BASE_64).toString())

  const extractApiVersion = async (zip: JSZip, fileName: string): Promise<string> =>
    (await decodeContent(zip, fileName))
      .split('<apiVersion>')[1]
      .split('</apiVersion>')[0]

  const loadZip = async (zip: string): Promise<JSZip> =>
    new JSZip().loadAsync(Buffer.from(zip, BASE_64))

  const fileNameToFullName = _(fileProperties)
    .map(obj => [obj.fileName, obj.fullName])
    .fromPairs()
    .value()

  const zip = await loadZip(retrieveResult.zipFile)
  return Promise.all(Object.values(zip.files)
    .filter(file => Object.keys(fileNameToFullName).includes(file.name))
    .map(async file => (
    { fullName: fileNameToFullName[file.name],
      content: await decodeContent(zip, file.name),
      apiVersion: await extractApiVersion(zip, `${file.name}-meta.xml`) } as MetadataInfo)))
}

const toMetadataXml = (name: string, val: Value, inner = false): string => {
  if (_.isArray(val)) {
    return val.map(v => toMetadataXml(name, v, true)).join('')
  }
  const innerXml = _.isObject(val)
    ? _(val)
      .entries()
      .filter(([k]) => inner || k !== 'fullName')
      .map(([k, v]) => toMetadataXml(k, v, true))
      .value()
      .join('')
    : val
  const openName = inner ? name : `${name} xmlns="${METADATA_NAMESPACE}"`
  return `<${openName}>${innerXml}</${name}>`
}

type ZipProps = {
  typeId: ElemID
  dir: string
  fileSuffix: string
  addMetadataXml: boolean
  contentTransformation: (instance: InstanceElement) => string
}

const apexClassZipProps: ZipProps = {
  typeId: new ElemID(SALESFORCE, 'apex_class'),
  dir: 'classes',
  fileSuffix: 'cls',
  addMetadataXml: true,
  contentTransformation: instance => instance.value.content,
}

const apexTriggerZipProps: ZipProps = {
  typeId: new ElemID(SALESFORCE, 'apex_trigger'),
  dir: 'triggers',
  fileSuffix: 'trigger',
  addMetadataXml: true,
  contentTransformation: instance => instance.value.content,
}

const assignmentRulesZipProps: ZipProps = {
  typeId: ASSIGNMENT_RULES_TYPE_ID,
  dir: 'assignmentRules',
  fileSuffix: 'assignmentRules',
  addMetadataXml: false,
  contentTransformation: instance => toMetadataXml(metadataType(instance),
    toMetadataInfo(apiName(instance), instance.value)),
}

const zipsProps = [apexClassZipProps, apexTriggerZipProps, assignmentRulesZipProps]

export const toMetadataPackageZip = async (instance: InstanceElement, deletion = false):
  Promise<Buffer> => {
  const instanceName = apiName(instance)
  const typeName = metadataType(instance)
  const packageXmlContent = { version: API_VERSION }
  const zip = new JSZip()
  if (deletion) {
    // describe the instances that are about to be deleted
    zip.file(
      `${DEFAULT}/destructiveChanges.xml`,
      toMetadataXml('Package', {
        types: { members: instanceName, name: typeName },
      })
    )
  } else {
    const zipProps = zipsProps.find(props => instance.type.elemID.isEqual(props.typeId)) as ZipProps
    // Add the instance
    zip.file(`${DEFAULT}/${zipProps.dir}/${instanceName}.${zipProps.fileSuffix}`,
      zipProps.contentTransformation(instance))

    // instance metadata
    if (zipProps.addMetadataXml) {
      zip.file(`${DEFAULT}/${zipProps.dir}/${instanceName}.${zipProps.fileSuffix}-meta.xml`,
        toMetadataXml(typeName, { apiVersion: API_VERSION }))
    }
    _.set(packageXmlContent, 'types', { members: instanceName, name: typeName })
  }
  // Add package "manifest" that specifies the content of the zip that should be deployed
  zip.file(
    `${DEFAULT}/package.xml`,
    toMetadataXml('Package', packageXmlContent)
  )

  return zip.generateAsync({ type: 'nodebuffer' })
}
