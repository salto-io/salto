#!/usr/local/bin/python3

# Note: This script was created for personal use - hence is very scrappy.

import json
import ast
from settings_names import SETTINGS_NAMES

MISSING_FIELDS_JSON = 'missing_fields.json'
MISSING_FIELDS_UPDATED_JSON = 'updated_missing_fields.json'
OUTPUT_DICT = './autogen_settings.txt'
DIFF_SETTINGS = './autogen_diff.txt'
DIDNT_ADD = 'autogen_didnt_add.txt'
OUTPUT_JSON = './autogen_json.json'
SETTINGS_FILE = './settings_fields.txt'
APPROVED_FIELD_TYPES = ['boolean']

TYPESCRIPT_HEADER = '''  {{
    id: new ElemID(SALESFORCE, '{settings_type}'),
    fields: ['''
TYPESCRIPT_FIELD_BODY = '''
      {{
        name: '{field_name}',
        type: BuiltinTypes.BOOLEAN,
      }},'''
TYPESCRIPT_SUFFIX = '''
    ],
  },
'''

def extract_settings(link):
  return link.split('_')[-1::][0][:-4:]

def is_link(line):
  return '.htm' == line [-4::]

def parse_raw_settings_data(raw_settings_data):
  settings_data = raw_settings_data.split('\n')
  parsed_settings_data = []
  temp_settings = ''
  field = ''
  for line in settings_data:
    if is_link(line):
      if field != '':
        parsed_settings_data.append((temp_settings, ast.literal_eval(field)))
        field = ''
      temp_settings = extract_settings(line)
    else:
      field += line
    
  return parsed_settings_data

def parse_fields(raw_fields):
  parsed_fields = []
  for field in raw_fields:
    try:
      parsed_fields.append((field[0], field[1][0]))
    except:
      import ipdb; ipdb.set_trace()

  return parsed_fields

def generate_settings_file(settings_type):
  return ''.join(['/Users/amitgoldfarb/Temp/SaltoFun/salesforce/Types/', settings_type, '.nacl'])

def is_new_field(field, settings_type):
  try:
   with open(generate_settings_file(settings_type), 'r') as f:
      data = f.read()
      return not ((' ' + field + ' ') in data)
  except FileNotFoundError:
    print('couldnt handle ' + settings_type)
    return False

def is_approved_field(field_type):
  return field_type in APPROVED_FIELD_TYPES

def output_diff(settings_name, field_name, field_type):
  with open(DIFF_SETTINGS, 'a+') as f:
    f.write(''.join([settings_name, ',', field_name, ',', field_type, '\n']))
    
def generate_typescript(settings_fields):
  typescript_code = TYPESCRIPT_HEADER.format(settings_type = settings_fields[0])
  if len(settings_fields[1]) == 0:
    return ''
  for field_name, field_type in settings_fields[1]:
    if field_type != 'boolean':
      raise Exception('wtf wrong type, how did it get here')
    typescript_code += TYPESCRIPT_FIELD_BODY.format(field_name = field_name)
  
  typescript_code += TYPESCRIPT_SUFFIX

  return typescript_code

def parse_json_field(field_name):
  ret = {}
  ret['name'] = field_name
  ret['type'] = 'BOOLEAN'

  return ret

def generate_json(settings_fields):
  json_product = {}
  json_product['id'] = settings_fields[0]
  json_product['fields'] = []

  if len(settings_fields[1]) == 0:
    return ''
  
  for field_name, field_type in settings_fields[1]:
    if field_type != 'boolean':
      raise Exception('wtf wrong type, how did it get here')
    json_product['fields'].append(parse_json_field(field_name))

  return json_product

def output_verified_settings(settings_fields):
  with open(OUTPUT_DICT, 'a+') as f:
    f.write(generate_typescript(settings_fields))
  with open(OUTPUT_JSON, 'a+') as f:
    json_data = generate_json(settings_fields)
    if json_data == '':
      return
    f.write(json.dumps(json_data, indent=2) + ',\n')

def output_didnt_add(settings_name, field_name, field_type):
  with open(DIDNT_ADD, 'a+') as f:
    f.write(''.join([settings_name, ',', field_name, ',', field_type, '\n']))

def optimize_json():
  json_data = ''
  updated_json = []
  with open(MISSING_FIELDS_JSON) as f:
    json_data = json.load(f)
  
  for obj in json_data:
    updated_obj = {}
    updated_obj['id'] = obj['id']
    updated_obj['fields'] = []
    boolean_types = []
    for field in obj['fields']:
      if field['type'] == 'BOOLEAN':
        boolean_types.append(field['name'])
      else:
        updated_obj['fields'].append(field)
    if boolean_types != []:
      updated_obj['fields'].append({'boolean': boolean_types})
    updated_json.append(updated_obj)

  with open(MISSING_FIELDS_UPDATED_JSON, 'a+') as f:
    json.dump(updated_json, f, indent=2, separators=(',', ': '))
  

def main():
  settings_file = open(SETTINGS_FILE, 'r')

  raw_settings_data = settings_file.read()
  for i, (settings_type, fields) in enumerate(parse_raw_settings_data(raw_settings_data)):
    # If the camel case and the href are different
    if settings_type != SETTINGS_NAMES[i].lower():
      print('WTF settings_type = {0}, settings_name = {1}'.format(settings_type, SETTINGS_NAMES[i]))
    settings_fields = [SETTINGS_NAMES[i],[]]
    for field_name, field_type in parse_fields(fields):
      if is_new_field(field_name, SETTINGS_NAMES[i]):
        if is_approved_field(field_type):
          settings_fields[1].append((field_name, field_type))
        else:
          output_diff(SETTINGS_NAMES[i], field_name, field_type)
      else:
        output_didnt_add(SETTINGS_NAMES[i], field_name, field_type)
    output_verified_settings(settings_fields)

main()
optimize_json()