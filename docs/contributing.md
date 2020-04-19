# Contributing

Salto is an open source project and we love to receive contributions of all kinds from our community.

There are many ways to contribute, from writing tutorials or blog posts, improving the documentation, recording bug reports and feature requests, writing code which can be incorporated into the project to providing (much valuable!) product feedback.

## Bug Reports

If you think you have found a bug in Salto, first make sure you are testing against the latest version of Salto (all relevant components, including vs-code extension if relevant) — your issue may already have been fixed. If not, search our issues list on GitHub in case a similar issue has already been opened, as well as our known limitations list at <TODO LINK>.

It is very helpful if you can prepare a reproduction of the bug. In other words, provide a small test case which we can run to confirm your bug. It makes it easier to find the problem and to fix it. Then, try to describe your test case / reproduction scenario clearly in a GitHub issue.

Provide as much information as you can. The easier it is for us to recreate your problem, the faster it is likely to be fixed.

## Feature Requests

These are still very early days for Salto, and  feedback from our community on required features is extremely important for us.  Please open an issue on our issues list on GitHub which describes the feature you would like to see, why you need it, and how it should work.

## Contributing code and documentation changes

If you have a bugfix or new feature that you would like to contribute to Salto, please find or open an issue about it first. Talk about what you would like to do. It may be that somebody is already working on it, or that there are particular issues that you should know about before implementing the change.

We enjoy working with contributors to get their code accepted. There are many approaches to fixing a problem and it is important to find the best approach before writing too much code.

The process for contributing code and/or documentation changes is:

1. Fork and clone the repository, see [https://help.github.com/articles/fork-a-repo](https://help.github.com/articles/fork-a-repo) for help.
2. Code and test your changes
3. Rebase your branch on top of the latest master branch. We prefer your initial changes to be squashed into a single commit. Later, if we ask you to make changes, add them as separate commits. This makes them easier to review. As a final step before merging we will either ask you to squash all commits yourself or we'll do it for you.
4. Submit a pull request. Push your local changes to your forked copy of the repository and submit a pull request. In the pull request, choose a title which sums up the changes that you have made, and in the body provide more details about what your changes do. Also mention the number of the issue where discussion has taken place, eg "Closes #666".

Then sit back and wait. There will probably be discussion about the pull request and, if any changes are needed, we would love to work with you to get your pull request merged into Salto.

Please adhere to the general guideline that you should never force push to a publicly shared branch. Once you have opened your pull request, you should consider your branch publicly shared. Instead of force pushing you can just add incremental commits; this is generally easier on your reviewers. If you need to pick up changes from master, you can merge master into your branch. A reviewer might ask you to rebase a long-running pull request in which case force pushing is okay for that request. Note that squashing at the end of the review process should also not be done, that can be done when the pull request is [integrated via GitHub](https://github.com/blog/2141-squash-your-commits).

>We would like to credit Elasticsearch's [contribution guide](https://github.com/elastic/elasticsearch/blob/master/CONTRIBUTING.md) which was used as a reference and inspiration when composing this guide.