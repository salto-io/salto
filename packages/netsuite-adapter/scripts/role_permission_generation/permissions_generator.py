 #!/usr/bin/python3
import os
from pathlib import Path
from constants import LICENSE_HEADER, LINE_SEPERATOR, TAB
import pandas as pd

SCRIPT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.join(SCRIPT_DIR, '../../src/autogen/')
PERMISSIONS_DIR = os.path.join(SRC_DIR, 'role_permissions/')
PERMISSION_TABLE_ROW_LENGTH = 4

permissions_table_link = 'https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_N3236764.html'
role_permissions_file_template = LICENSE_HEADER + '''

export type PermissionLevel = 'NONE' | 'VIEW' | 'FULL' | 'CREATE' | 'EDIT'
export const ID_TO_PERMISSION_INFO: Readonly<Record<string, ReadonlySet<PermissionLevel>>> = {{
  {permission_id_to_valid_levels}
}}
'''

def is_valid_row(row_cells, permissions, permission_id):
  return (len(row_cells) == PERMISSION_TABLE_ROW_LENGTH
  and permission_id not in permissions)

def parse_table_row(row, permissions):
  if len(row) == 0: return
  permission_id = row[0]
  if is_valid_row(row, permissions, permission_id):
    permissions[permission_id] = row[3].split(', ')

def parse_permissions_table():
    table = pd.read_html(permissions_table_link)[0].dropna(how='all')
    permissions = {}
    for row in table.values.tolist():
      parse_table_row(row, permissions)
    return permissions

def create_permissions_file(permissions):
  formatted_permissions = [" {key}: new Set({value}),".format(key = key,value = [level.upper() for level in permissions[key]]) for key in permissions]
  file_content = role_permissions_file_template.format(permission_id_to_valid_levels = (LINE_SEPERATOR + TAB).join(formatted_permissions))
  Path(PERMISSIONS_DIR).mkdir(parents=True, exist_ok=True)
  with open(PERMISSIONS_DIR + 'role_permissions.ts', 'w') as file:
    file.write(file_content)

def main():
  permissions = parse_permissions_table()
  create_permissions_file(permissions)

if __name__=='__main__':
  main()