Field Context options guide

references:
https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-custom-field-options#api-group-issue-custom-field-options

https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-custom-field-contexts/#api-rest-api-3-field-fieldid-context-defaultvalue-put

The Field Context Options logic has several API limitations that should be addressed:

1. Options API
2. Options order API
3. Cascade options limitations
4. Default Values API
5. 10K options limitation

API constraints:

- Options should be added after the context is added, as they need its id
- Cascade options should be added after their parents, as they their ids
- Options API support batch operations for add and modify (with a 1K limitation)
- Options API limits the amount of options to 10K. we use private (slower, one by one) API for more than 10K options
- Default Values should be deployed after the options deployment as they use the option's id
- Cascade options should be deleted before their parents options

In addition options usually have different ids in different environments. As a result we are creating them as instances. If we add them as a map inside the context we lose the inter-environment id connection when an option is changed.

Following the API limitations we are using the following design:

- We group Contexts and Options together, as we need the following order in addition: add context => add options => set default value. The default value is a field in the context (making it something else will be counterintuitive for the users), so we must group them
- We group options orders with the context and options on removal. The reason is that without it a circle of dependency is created (parent dependencies are kept on removal, others are reversed, so the order references the context as parent and the options reference it, causing a circle) and the group is broken.
- We sort the removal cascade options to be the first options removed
- We count the amount of options and use private API for options over 10K
- We do not call removal of options with a removed context parent
