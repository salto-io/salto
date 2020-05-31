#!/usr/bin/python3

from selenium import webdriver
import os
import pyotp
import re
import sys
import time
import logging

logging.basicConfig(format='%(asctime)s %(levelname)s %(message)s', level=logging.INFO)

SCRIPT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.join(SCRIPT_DIR, '../src/')
TYPES_DIR = os.path.join(SRC_DIR, 'types/')
CUSTOM_TYPES_DIR = os.path.join(TYPES_DIR, 'custom_types/')

enums_link_template = 'https://{account_id}.app.netsuite.com/app/help/helpcenter.nl?fid=SDFxml_2405618192.html'
script_ids_prefix_link_template = 'https://{account_id}.app.netsuite.com/app/help/helpcenter.nl?fid=subsect_1537555588.html&whence='
sdf_xml_definitions_link_template = 'https://{account_id}.app.netsuite.com/app/help/helpcenter.nl?fid=SDFxml.html'

SCRIPT_ID_FIELD_NAME = 'scriptid'
FIELDS = 'fields'
ANNOTATIONS = 'annotations'
NAME = 'name'
IS_LIST = 'is_list'
TYPE = 'type'
DESCRIPTION = 'description'

INNER_TYPE_NAME_TO_DEF = 'inner_type_name_to_def'
TYPE_DEF = 'type_def'

LICENSE_HEADER = '''/*
*                      Copyright 2020 Salto Labs Ltd.
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
'''

list_type_import = ' ListType,'
enums_import = '''import { enums } from '../enums'
'''
field_types_import = '''import { fieldTypes } from '../field_types'
'''

import_statements_for_type_def_template = '''import {{
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType,{list_type_import}
}} from '@salto-io/adapter-api'
import * as constants from '../../constants'
{enums_import}{field_types_import}
'''

type_inner_types_array_template = '''export const {type_name}InnerTypes: ObjectType[] = []

'''

COMMON_IMPORT_STATEMENTS_FOR_ENUMS_DEF = '''import {{ CORE_ANNOTATIONS, createRestriction, ElemID, PrimitiveType, PrimitiveTypes }} from '@salto-io/adapter-api'
import * as constants from '../constants'

'''

DISABLE_LINT_CAMEL_CASE = '''/* eslint-disable @typescript-eslint/camelcase */
'''

DISABLE_LINT_LINE_LENGTH = '''/* eslint-disable max-len */
'''

HEADER_FOR_DEFS = LICENSE_HEADER + DISABLE_LINT_LINE_LENGTH + DISABLE_LINT_CAMEL_CASE

type_elem_id_template = '''const {type_name}ElemID = new ElemID(constants.NETSUITE, '{type_name}')
'''

SUBTYPES_FOLDER_PATH_DEF = '''const enumsFolderPath = [constants.NETSUITE, constants.TYPES_PATH, constants.SUBTYPES_PATH]

'''

primitive_string_type_entry_template = '''  {type_name}: new PrimitiveType({{
    elemID: {type_name}ElemID,
    primitive: PrimitiveTypes.STRING,
    annotations: {{
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({{ values:
        {values} }}),
    }},
    path: [...enumsFolderPath, {type_name}ElemID.name],
  }}),
'''

enums_file_template = HEADER_FOR_DEFS + COMMON_IMPORT_STATEMENTS_FOR_ENUMS_DEF + SUBTYPES_FOLDER_PATH_DEF + '''{enums_elem_ids}
export const enums: Record<string, PrimitiveType> = {{
{enums_entries}}}
'''

inner_types_def_template = '''const {inner_type_name}ElemID = new ElemID(constants.NETSUITE, '{inner_type_name}')
{type_def}
{type_name}InnerTypes.push({inner_type_name})

'''

type_annotation_template = '''
    {annotation_name}: '{annotation_value}','''

type_annotations_template = '''
  annotations: {{{annotations}
  }},'''

type_template = '''
{export}const {type_name} = new ObjectType({{
  elemID: {type_name}ElemID,{annotations}
  fields: {{
{field_definitions}
  }},
  path: {path},
}})
'''

type_path_template = '[constants.NETSUITE, constants.TYPES_PATH, {type_name}ElemID.name]'

field_template = '''    {field_name}: {{
      type: {field_type},
      annotations: {{{annotations}
      }},
    }},'''

field_annotation_template = '''
        {annotation_name}: {annotation_value},'''

import_type_statement_template = '''import {{ {type_name}, {type_name}InnerTypes }} from './types/custom_types/{type_name}'
'''

custom_types_map_entry_template = '''  {type_name},
'''

type_inner_types_vars_template = '''  ...{type_name}InnerTypes,
'''

types_file_template = LICENSE_HEADER + '''import {{ ObjectType, TypeElement }} from '@salto-io/adapter-api'
import _ from 'lodash'
{import_types_statements}import {{ fieldTypes }} from './types/field_types'
import {{ enums }} from './types/enums'


/**
* generated using types_generator.py as Netsuite don't expose a metadata API for them.
*/
export const customTypes: Readonly<Record<string, ObjectType>> = {{
{custom_types_map_entries}}}

const innerCustomTypes: ObjectType[] = [
{all_inner_types_vars}]

export const isCustomType = (type: ObjectType): boolean =>
  !_.isUndefined(customTypes[type.elemID.name])

export const getAllTypes = (): TypeElement[] => [
  ...Object.values(customTypes),
  ...innerCustomTypes,
  ...Object.values(enums),
  ...Object.values(fieldTypes),
]
'''

default_value_pattern = re.compile("[\s\S]*The default value is '?‘?([-|#\w]*)’?'?\.[\s\S]*") # e.g. ‘MIDDLE’, 'NORMAL', T, '|', '#000000', 'windows-1252'
possible_values_pattern = re.compile("[\s\S]*For information about possible values, see ('*\w*'*)\.[\s\S]*")

def extract_default_value_from_field_description(description):
    regex_matches = default_value_pattern.match(description)
    if regex_matches:
        return regex_matches.groups()[0]
    return None

def parse_field_def(type_name, cells, is_attribute, is_inner_type):
    def to_field_type(field_name, netsuite_field_type, description):
        field_full_name = type_name + '_' + field_name
        if field_full_name in field_name_to_type_name:
            return field_name_to_type_name[field_full_name]
        if field_name == SCRIPT_ID_FIELD_NAME:
            return 'BuiltinTypes.SERVICE_ID'
        if netsuite_field_type in ['string', 'date', 'time', 'rgb']:
            return 'BuiltinTypes.STRING'
        if netsuite_field_type == 'boolean':
            return 'BuiltinTypes.BOOLEAN'
        if netsuite_field_type == 'integer' or netsuite_field_type.startswith('float'): # in kpiscorecard.highlighting the field type (float) contains description
            return 'BuiltinTypes.NUMBER'
        if netsuite_field_type == 'single-select list':
            references_to_single_enum = 'For information about possible values, see' in description
            if references_to_single_enum:
                regex_matches = possible_values_pattern.match(description)
                if regex_matches:
                    enum_name = regex_matches.groups()[0]
                    return "enums.{0}".format(enum_name)
        return 'BuiltinTypes.STRING /* Original type was {0} */'.format('   '.join(netsuite_field_type.splitlines()))

    field_name = cells[0].text
    description = cells[3].text
    field_type = to_field_type(field_name, cells[1].text, description)
    is_required = cells[2].text.lower() == 'required'
    has_length_limitations = 'value can be up to' in description and 'BuiltinTypes.STRING' in field_type
    is_name_field = type_name in top_level_type_name_to_name_field and top_level_type_name_to_name_field[type_name] == field_name
    annotations = {}
    if is_required and (field_name != SCRIPT_ID_FIELD_NAME or is_inner_type): # we don't set SCRIPT_ID_FIELD_NAME as required ONLY for top level types so the adapter will generate default in case it's missing to ease Salto user's add operation
        annotations['[CORE_ANNOTATIONS.REQUIRED]'] = 'true'
    if is_attribute:
        annotations['[constants.IS_ATTRIBUTE]'] = 'true'
    if is_name_field:
        annotations['[constants.IS_NAME]'] = 'true'
    if has_length_limitations:
      regex_matches = re.match("[\s\S]*value can be up to (\d*) characters long\.[\s\S]*", description)
      length_limit = regex_matches.groups()[0]
      annotations['// [CORE_ANNOTATIONS.LENGTH_LIMIT]'] = length_limit

    return { NAME: field_name, TYPE: field_type, ANNOTATIONS: annotations, DESCRIPTION: '   '.join(description.splitlines()) }


def parse_enums(account_id):
    webpage.get(enums_link_template.format(account_id = account_id))
    enums_list_items = webpage.find_elements_by_xpath('//*[@id="nshelp"]/div[2]/div/ul/li/p/a')
    enum_name_to_page_link = { enum_link.text : enum_link.get_attribute('href') for enum_link in enums_list_items }
    enum_to_possible_values = {}
    for enum_name, page_link in enum_name_to_page_link.items():
        try:
            webpage.get(page_link)
            enum_to_possible_values[enum_name] = [possible_value.text.split()[0] for possible_value in webpage.find_elements_by_xpath('//*[@id="nshelp"]/div[2]/div/div/ul/li/p')]
        except Exception as e:
            logging.error('Failed to extract possible values for enum: ' + enum_name + '. Error: ', e)
    return enum_to_possible_values


def parse_type_for_inner_structured_field(type_name, inner_type_name_to_def, top_level_type_name):
    type_def = parse_type(type_name, None, inner_type_name_to_def, top_level_type_name)
    inner_type_name_to_def[type_name] = type_def
    return type_name


def parse_type(type_name, script_id_prefix, inner_type_name_to_def, top_level_type_name = None):
    if top_level_type_name is None:
        top_level_type_name = type_name

    is_inner_type = type_name != top_level_type_name

    def extract_script_id_prefix_from_description(field_cells):
        script_id_prefix_from_description = extract_default_value_from_field_description(field_cells[3].text)
        if script_id_prefix_from_description:
            padded_script_id_prefix_from_description = pad_script_id_prefix_with_underscore(script_id_prefix_from_description)
            if padded_script_id_prefix_from_description != script_id_prefix:
                return padded_script_id_prefix_from_description
        return None

    def is_structured_list_field(fields_tables_len, structured_fields_len):
        type_description_sections = webpage.find_elements_by_xpath('//*[@id="nshelp"]/div[2]/div/p')
        is_explicitly_not_a_list = any([('field group is a DEFAULT' in type_description_section.text) for type_description_section in type_description_sections])
        is_explicitly_a_list = any([('field group is a COLLECTION' in type_description_section.text) for type_description_section in type_description_sections])
        return is_explicitly_a_list or (fields_tables_len == 1 and structured_fields_len == 1 and not is_explicitly_not_a_list)

    fields_tables = webpage.find_elements_by_xpath('//*[@class="nshelp_section"]')
    field_definitions = []
    annotations = {}
    for fields_table in fields_tables:
        fields_section_headline = fields_table.find_element_by_xpath('.//h2').text
        if fields_section_headline == 'Feature Dependencies':
            # we don't have anything interesting to extract here
            continue
        if fields_section_headline == 'Additional Files':
            additional_file_suffix = fields_table.find_element_by_xpath('.//ul/li/p/strong').text[len('Object-Script-ID.template.'):]
            field_definitions.append({ NAME: 'content', TYPE: 'fieldTypes.fileContent',
                ANNOTATIONS: {'[constants.ADDITIONAL_FILE_SUFFIX]': "'{0}'".format(additional_file_suffix)}, IS_LIST: False })
            continue
        if fields_section_headline == 'Structured Fields':
            inner_structured_field_name_to_link = { inner_structured_field.text : inner_structured_field.get_attribute('href')
                for inner_structured_field in fields_table.find_elements_by_xpath('.//ul/li/p/a') }
            is_list_from_doc = is_structured_list_field(len(fields_tables), len(inner_structured_field_name_to_link.items()))
            for inner_structured_field_name, link in inner_structured_field_name_to_link.items():
                webpage.get(link)
                # we create inner types with their parent's type_name so there will be no Salto element naming collisions
                created_inner_type_name = parse_type_for_inner_structured_field(type_name + '_' + inner_structured_field_name, inner_type_name_to_def, top_level_type_name)
                is_list = False
                if (is_list_from_doc and created_inner_type_name not in should_not_be_list) or created_inner_type_name in should_be_list:
                    is_list = True
                field_definitions.append({ NAME: inner_structured_field_name, TYPE: created_inner_type_name, ANNOTATIONS: {}, IS_LIST: is_list })
            continue

        if fields_section_headline == 'Attributes':
            is_attribute = True
        elif fields_section_headline == 'Fields':
            is_attribute = False
        else:
            raise Exception('unknown fields section ', fields_section_headline)

        for field_row in fields_table.find_elements_by_xpath('.//tbody/tr'):
            cells = field_row.find_elements_by_xpath('.//td')
            if is_attribute and cells[0].text == SCRIPT_ID_FIELD_NAME and not is_inner_type:
                # extract script_id for top level types from the description since the script_ids prefixes aren't accurate in https://{account_id}.app.netsuite.com/app/help/helpcenter.nl?fid=subsect_1537555588.html
                script_id_prefix_from_description = extract_script_id_prefix_from_description(cells)
                annotations['[constants.SCRIPT_ID_PREFIX]'] = script_id_prefix_from_description if script_id_prefix_from_description is not None else script_id_prefix

            field_def = parse_field_def(type_name, cells, is_attribute, is_inner_type)
            field_def[IS_LIST] = False
            field_definitions.append(field_def)

    return { NAME: type_name, ANNOTATIONS: annotations, FIELDS: field_definitions }

def pad_script_id_prefix_with_underscore(script_id_prefix):
    return (script_id_prefix + '_') if not script_id_prefix.endswith('_') else script_id_prefix

def parse_types_definitions(account_id, type_name_to_script_id_prefix):
    def get_script_id_prefix(type_name):
        if type_name.lower() in type_name_to_script_id_prefix:
            return pad_script_id_prefix_with_underscore(type_name_to_script_id_prefix[type_name.lower()])
        return "'FIX_ME!'"

    webpage.get(sdf_xml_definitions_link_template.format(account_id = account_id))
    types_list_items = webpage.find_elements_by_xpath('//*[@id="nshelp"]/div[2]/div/ul/li/p/a')
    type_name_to_page_link = { type_link.text : type_link.get_attribute('href') for type_link in types_list_items }
    type_name_to_types_defs = {}
    for type_name, page_link in type_name_to_page_link.items():
        try:
            webpage.get(page_link)
            script_id_prefix = get_script_id_prefix(type_name)
            inner_type_name_to_def = {}
            type_def = parse_type(type_name, script_id_prefix, inner_type_name_to_def)
            type_name_to_types_defs[type_name] = { TYPE_DEF: type_def, INNER_TYPE_NAME_TO_DEF: inner_type_name_to_def }
        except Exception as e:
            logging.error('Failed to parse type: ' + type_name + '. Error: ', sys.exc_info())
    return type_name_to_types_defs


def generate_type_name_to_script_id_prefix():
    type_name_to_script_id_prefix = {}
    for row in webpage.find_elements_by_xpath('//*[@id="nshelp"]/div[2]/div/div[2]/table/tbody/tr'):
        cells = row.find_elements_by_xpath('.//td/p')
        type_name_to_script_id_prefix[cells[0].text] = cells[1].text
    return type_name_to_script_id_prefix


def login(username, password, secret_key_2fa):
    # submit username & password
    time.sleep(1)
    webpage.find_element_by_xpath('/html/body/form/table/tbody/tr[2]/td/table/tbody/tr[1]/td[2]/input').send_keys(username)
    webpage.find_element_by_xpath('/html/body/form/table/tbody/tr[2]/td/table/tbody/tr[2]/td[2]/input').send_keys(password)
    webpage.find_element_by_xpath('//*[@id="rememberme"]').click()
    webpage.find_element_by_xpath('//*[@id="Submit"]').click()
    time.sleep(2)

    # generate 2FA token and submit
    token2fa = pyotp.TOTP(secret_key_2fa).now()
    webpage.find_element_by_xpath('//*[@id="n-id-component-19"]').send_keys(token2fa)
    webpage.find_element_by_xpath('//*[@id="n-id-component-44"]').click()
    time.sleep(1)


def create_types_file(type_names):
    import_types_statements = ''.join([import_type_statement_template.format(type_name = type_name) for type_name in type_names])
    custom_types_map_entries = ''.join([custom_types_map_entry_template.format(type_name = type_name) for type_name in type_names])
    all_inner_types_vars = ''.join([type_inner_types_vars_template.format(type_name = type_name) for type_name in type_names])
    file_content = types_file_template.format(import_types_statements = import_types_statements, custom_types_map_entries = custom_types_map_entries, all_inner_types_vars = all_inner_types_vars)
    with open(SRC_DIR + 'types.ts', 'w') as file:
        file.write(file_content)


def parse_netsuite_types(account_id, username, password, secret_key_2fa):
    try:
        logging.info('Starting to parse Netsuite types')
        webpage.get(script_ids_prefix_link_template.format(account_id = account_id))
        login(username, password, secret_key_2fa)
        logging.info('Logged in')

        type_name_to_script_id_prefix = generate_type_name_to_script_id_prefix()
        type_name_to_types_defs = parse_types_definitions(account_id, type_name_to_script_id_prefix)
        if len(type_name_to_types_defs.keys()) != len(top_level_type_name_to_name_field):
            logging.warning('Parsed {0} types while there are {1} top_level_type_name_to_name_field entries'.format(len(type_name_to_types_defs.keys()), len(top_level_type_name_to_name_field)))
        logging.info('Parsed objects definitions')

        enum_to_possible_values = parse_enums(account_id)
        logging.info('Parsed enums definitions')
        return type_name_to_types_defs, enum_to_possible_values
    finally:
        webpage.quit()


def generate_enums_file(enum_to_possible_values):
    enums_elem_ids_list = [type_elem_id_template.format(type_name = enum_name) for enum_name in enum_to_possible_values.keys()]
    enums_entries_list = [primitive_string_type_entry_template.format(type_name = enum_name, values = values) for enum_name, values in enum_to_possible_values.items()]
    file_content = enums_file_template.format(enums_elem_ids = ''.join(enums_elem_ids_list), enums_entries = ''.join(enums_entries_list))
    with open(TYPES_DIR + 'enums.ts', 'w') as file:
        file.write(file_content)


def format_type_def(type_name, type_def, top_level_type_name = None):
    def format_type_annotations():
        formatted_type_annotations = ''
        for key, val in type_def[ANNOTATIONS].items():
            formatted_type_annotations += type_annotation_template.format(annotation_name = key, annotation_value = val)
        return type_annotations_template.format(annotations = formatted_type_annotations)

    def format_field_annotations(field_annotations):
        formatted_field_annotations = ''
        for key, val in field_annotations.items():
            formatted_field_annotations += field_annotation_template.format(annotation_name = key, annotation_value = val)
        return formatted_field_annotations

    def format_field_def(field_def):
        formatted_field_annotations = format_field_annotations(field_def[ANNOTATIONS])
        field_type = 'new ListType({0})'.format(field_def[TYPE]) if field_def[IS_LIST] else field_def[TYPE]
        formatted_field = field_template.format(field_name = field_def[NAME], type_name = type_name, field_type = field_type, annotations = formatted_field_annotations)
        field_description_comment = ' /* Original description: {0} */'.format(field_def[DESCRIPTION]) if (DESCRIPTION in field_def and field_def[DESCRIPTION] != '') else ''
        return formatted_field + field_description_comment

    is_inner_type = top_level_type_name != None
    annotations = format_type_annotations()
    field_definitions = []
    for field_def in type_def[FIELDS]:
        field_definitions.append(format_field_def(field_def))
    path = type_path_template.format(type_name = top_level_type_name if is_inner_type else type_name) # all inner_types will be located in the same file as their parent
    export = 'export ' if not is_inner_type else ''
    return type_template.format(type_name = type_name, export = export, annotations = annotations,
      field_definitions = '\n'.join(field_definitions), path = path)


def format_inner_types_defs(top_level_type_name, inner_type_name_to_def):
    inner_types_defs = []
    for inner_type_name, inner_type_def in inner_type_name_to_def.items():
        formatted_inner_type_def = format_type_def(inner_type_name, inner_type_def, top_level_type_name)
        inner_types_defs.append(inner_types_def_template.format(type_name = top_level_type_name, inner_type_name = inner_type_name, type_def = formatted_inner_type_def))
    return ''.join(inner_types_defs)


# in addressForm, entryForm and transactionForm the order of the fields matters in the sent XML to SDF
# and thus we order it on the type definition so the adapter will be able to sort the values based on that order
def order_types_fields(type_name_to_types_defs):
    type_name_to_fields_order = {
        'addressForm': ['scriptid', 'standard', 'name', 'mainFields', 'addressTemplate', 'countries'],
        'addressForm_mainFields': ['fieldGroup', 'defaultFieldGroup'],
        'entryForm': ['scriptid', 'standard', 'name', 'recordType', 'inactive', 'preferred',
            'storedWithRecord', 'mainFields', 'tabs', 'quickViewFields', 'actionbar', 'useForPopup',
             'editingInList'], # customCode & buttons fields are intentionally omitted as it seems that they do not exist and if they are sent to SDF they cause errors no matter in which order
        'entryForm_mainFields': ['fieldGroup', 'defaultFieldGroup'],
        'entryForm_tabs_tab_fieldGroups': ['fieldGroup', 'defaultFieldGroup'],
        'entryForm_tabs_tab_subItems_subTab_fieldGroups': ['fieldGroup', 'defaultFieldGroup'],
        'transactionForm': ['scriptid', 'standard', 'name', 'recordType', 'inactive', 'preferred',
            'storedWithRecord', 'mainFields', 'tabs', 'quickViewFields', 'actionbar', 'disclaimer',
            'address', 'allowAddMultiple', 'printingType'], # customCode & buttons fields are intentionally omitted as it seems that they do not exist and if they are sent to SDF they cause errors no matter in which order
        'transactionForm_mainFields': ['fieldGroup', 'defaultFieldGroup'],
        'transactionForm_tabs_tab_fieldGroups': ['fieldGroup', 'defaultFieldGroup'],
        'transactionForm_tabs_tab_subItems_subTab_fieldGroups': ['fieldGroup', 'defaultFieldGroup']
    }

    for type_name, fields_order in type_name_to_fields_order.items():
        top_level_type_name = type_name.split('_')[0]
        type_defs = type_name_to_types_defs[top_level_type_name]
        type_def = type_defs[INNER_TYPE_NAME_TO_DEF][type_name] if top_level_type_name != type_name else type_defs[TYPE_DEF]
        type_def_fields = type_def[FIELDS]
        if len(fields_order) != len(type_def_fields):
            logging.warning('Mismatch in the order of {0} type fields! len(fields_order)={1} len(type_def_fields)={2}'.format(type_name, len(fields_order), len(type_def_fields)))
        field_name_to_def = dict((field[NAME], field) for field in type_def_fields)
        ordered_fields = []
        for field_name in fields_order:
            ordered_fields.append(field_name_to_def[field_name])
        type_def[FIELDS] = ordered_fields


def generate_file_per_type(type_name_to_types_defs):
    order_types_fields(type_name_to_types_defs)
    for type_name, type_defs in type_name_to_types_defs.items():
        inner_type_name_to_def = type_defs[INNER_TYPE_NAME_TO_DEF]
        type_def = type_defs[TYPE_DEF]
        elem_id_def = type_elem_id_template.format(type_name = type_name)
        formatted_type_def = format_type_def(type_name, type_def)
        file_data = type_inner_types_array_template.format(type_name = type_name) + elem_id_def + format_inner_types_defs(type_name, inner_type_name_to_def) + formatted_type_def
        import_statements = import_statements_for_type_def_template.format(
            list_type_import = list_type_import if 'new ListType(' in file_data else '',
            enums_import = enums_import if 'enums.' in file_data else '',
            field_types_import = field_types_import if 'fieldTypes.' in file_data else '')
        type_def_file_content = HEADER_FOR_DEFS + import_statements + file_data
        with open(CUSTOM_TYPES_DIR + type_name + '.ts', 'w') as file:
            file.write(type_def_file_content)


should_not_be_list = {
    'addressForm_mainFields_fieldGroup_fields',
    'addressForm_mainFields_defaultFieldGroup_fields',
    'entryForm_mainFields_fieldGroup_fields',
    'entryForm_mainFields_defaultFieldGroup_fields',
    'entryForm_tabs_tab_fieldGroups_fieldGroup_fields',
    'entryForm_tabs_tab_fieldGroups_defaultFieldGroup_fields',
    'entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields',
    'entryForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields',
    'transactionForm_mainFields_fieldGroup_fields',
    'transactionForm_mainFields_defaultFieldGroup_fields',
    'transactionForm_printingType_advanced',
    'transactionForm_printingType_basic',
    'transactionForm_tabs_tab_fieldGroups_fieldGroup_fields',
    'transactionForm_tabs_tab_fieldGroups_defaultFieldGroup_fields',
    'transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup_fields',
    'transactionForm_tabs_tab_subItems_subTab_fieldGroups_defaultFieldGroup_fields',
}

should_be_list = {
    'addressForm_mainFields_fieldGroup',
    'entryForm_mainFields_fieldGroup',
    'entryForm_tabs_tab_fieldGroups_fieldGroup',
    'entryForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup',
    'transactionForm_mainFields_fieldGroup',
    'transactionForm_tabs_tab_fieldGroups_fieldGroup',
    'transactionForm_tabs_tab_subItems_subTab_fieldGroups_fieldGroup',
    'workflow_workflowstates_workflowstate_workflowactions',
    'workflow_workflowstates_workflowstate_workflowactions_addbuttonaction',
    'workflow_workflowstates_workflowstate_workflowactions_confirmaction',
    'workflow_workflowstates_workflowstate_workflowactions_createlineaction',
    'workflow_workflowstates_workflowstate_workflowactions_createrecordaction',
    'workflow_workflowstates_workflowstate_workflowactions_customaction',
    'workflow_workflowstates_workflowstate_workflowactions_gotopageaction',
    'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction',
    'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction',
    'workflow_workflowstates_workflowstate_workflowactions_lockrecordaction',
    'workflow_workflowstates_workflowstate_workflowactions_removebuttonaction',
    'workflow_workflowstates_workflowstate_workflowactions_returnusererroraction',
    'workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction',
    'workflow_workflowstates_workflowstate_workflowactions_sendemailaction',
    'workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction',
    'workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction',
    'workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction',
    'workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction',
    'workflow_workflowstates_workflowstate_workflowactions_showmessageaction',
    'workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction',
    'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction',
    'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup',
    'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup',
}

top_level_type_name_to_name_field = {
    'addressForm': 'name',
    'advancedpdftemplate': 'title',
    'bankstatementparserplugin': 'name',
    'bundleinstallationscript': 'name',
    'center': 'label',
    'centercategory': 'label',
    'centertab': 'label',
    'clientscript': 'name',
    'cmscontenttype': 'label',
    'crmcustomfield': 'label',
    'customglplugin': 'name',
    'customlist': 'name',
    'customrecordtype': 'recordname',
    'customsegment': 'label',
    'customtransactiontype': 'name',
    'dataset': 'name',
    'emailcaptureplugin': 'name',
    'emailtemplate': 'name',
    'entitycustomfield': 'label',
    'entryForm': 'name',
    'ficonnectivityplugin': 'name',
    'itemcustomfield': 'label',
    'itemnumbercustomfield': 'label',
    'itemoptioncustomfield': 'label',
    'kpiscorecard': 'name',
    'mapreducescript': 'name',
    'massupdatescript': 'name',
    'othercustomfield': 'label',
    'pluginimplementation': 'name',
    'plugintype': 'name',
    'portlet': 'name',
    'promotionsplugin': 'name',
    'publisheddashboard': 'name',
    'restlet': 'name',
    'role': 'name',
    'savedcsvimport': 'importname',
    'savedsearch': 'scriptid',
    'scheduledscript': 'name',
    'sdfinstallationscript': 'name',
    'sspapplication': 'name',
    'sublist': 'label',
    'subtab': 'title',
    'suitelet': 'name',
    'transactionForm': 'name',
    'transactionbodycustomfield': 'label',
    'transactioncolumncustomfield': 'label',
    'translationcollection': 'name',
    'usereventscript': 'name',
    'workbook': 'name',
    'workflow': 'name',
    'workflowactionscript': 'name',
}

field_name_to_type_name = {
    'crmcustomfield_sourcefrom': 'BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */',
    'customrecordtype_customrecordcustomfields_customrecordcustomfield_sourcefrom': 'BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */',
    'entitycustomfield_sourcefrom': 'BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */',
    'itemcustomfield_sourcefrom': 'BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */',
    'itemnumbercustomfield_sourcefrom': 'BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */',
    'itemoptioncustomfield_sourcefrom': 'BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */',
    'othercustomfield_sourcefrom': 'BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */',
    'transactionbodycustomfield_sourcefrom': 'BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */',
    'transactioncolumncustomfield_sourcefrom': 'BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */',
    'transactionForm_tabs_tab_subItems_subList_id': 'BuiltinTypes.STRING /* Original type was enums.transactionform_sublistid but it can also be CRMCONTACTS */',
    'transactionForm_tabs_tab_subItems_subLists_subList_id': 'BuiltinTypes.STRING /* Original type was enums.transactionform_sublistid but it can also be CRMCONTACTS */',
    'addressForm_addressTemplate': 'fieldTypes.cdata',
    'dataset_definition': 'fieldTypes.cdata',
    'workbook_definition': 'fieldTypes.cdata',
    'workflow_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_addbuttonaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_confirmaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_createlineaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_createrecordaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_customaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_gotopageaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_gotorecordaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_initiateworkflowaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_lockrecordaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_removebuttonaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_returnusererroraction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_sendcampaignemailaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_sendemailaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_setdisplaylabelaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_setdisplaytypeaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_setfieldmandatoryaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_setfieldvalueaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_showmessageaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_subscribetorecordaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_transformrecordaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_workflowactiongroup_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_createrecordaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_returnusererroraction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_sendemailaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowactions_workflowsublistactiongroup_setfieldvalueaction_initcondition_formula': 'fieldTypes.cdata',
    'workflow_workflowstates_workflowstate_workflowtransitions_workflowtransition_initcondition_formula': 'fieldTypes.cdata',
}


webpage = webdriver.Chrome() # the web page is defined here to avoid passing it to all inner methods
def main():
    account_id, username, password, secret_key_2fa = (sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
    type_name_to_types_defs, enum_to_possible_values = parse_netsuite_types(account_id, username, password, secret_key_2fa)
    generate_enums_file(enum_to_possible_values)
    logging.info('Generated enums file')
    generate_file_per_type(type_name_to_types_defs)
    logging.info('Generated file per Netsuite type')
    create_types_file(type_name_to_types_defs.keys())
    logging.info('Generated Types file')
    logging.info('Done!')


main()



# --- known issues that were handled in the script: ---
# lists are not identified correctly -> should use also manual mappings (should_be_list, should_not_be_list)
# script_ids table is not accurate and not complete -> we are calculating also from the scriptid field's description column
# script_id is not always padded with '_'
# we mark SCRIPT_ID_FIELD_NAME as not required ONLY for top level types so the adapter will add defaults in case it's missing
# we set the type of SCRIPT_ID_FIELD_NAME as BuiltinTypes.SERVICE_ID
# emailtemplate & advancedpdftemplate types have an additional file containing the template data. We add the file's extension as an annotation to the type and added a 'content' field to the type.
# there are fields that suppose to have a certain type but in fact they have another type, handled using field_name_to_type_name
# every top level type has its own IS_NAME field, we set it manually using top_level_type_name_to_name_field
# in addressForm, entryForm and transactionForm the order of the fields matters in the sent XML to SDF (https://{account_id}.app.netsuite.com/app/help/helpcenter.nl?fid=section_1497980303.html)
#    we order it manually in order_types_fields.
# in addressForm and transactionForm, customCode & buttons fields are intentionally omitted as it seems that they do not exist and if they are sent to SDF they cause errors no matter in which order