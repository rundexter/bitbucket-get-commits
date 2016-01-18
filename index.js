var _ = require('lodash'),
    util = require('./util.js');

var request = require('request').defaults({
    baseUrl: 'https://api.bitbucket.org/2.0/'
});

var pickInputs = {
        'owner': { key: 'owner', validate: { req: true } },
        'repo_slug': { key: 'repo_slug', validate: { req: true } },
        'branchortag': 'branchortag',
        'include': 'include',
        'exclude': 'exclude'
    },
    pickOutputs = {
        '-': {
            key: 'values',
            fields: {
                'html': 'links.html.href',
                'date': 'date',
                'message': 'message',
                'repository': 'repository.name',
                'author_name': 'author.user.username',
                'author_display_name': 'author.user.display_name'
            }
        }
    };

module.exports = {
    /**
     * The main entry point for the Dexter module
     *
     * @param {AppStep} step Accessor for the configuration for the step using this module.  Use step.input('{key}') to retrieve input data.
     * @param {AppData} dexter Container for all data used in this workflow.
     */
    run: function(step, dexter) {
        var credentials = dexter.provider('bitbucket').credentials(),
            inputs = util.pickInputs(step, pickInputs),
            validateErrors = util.checkValidateErrors(inputs, pickInputs);

        // check params.
        if (validateErrors)
            return this.fail(validateErrors);

        var uriLink = 'repositories/' + inputs.owner + '/' + inputs.repo_slug + '/commits';
        //send API request
        request.get({
            uri: uriLink,
            qs: _.omit(inputs, ['owner', 'repo_slug']),
            oauth: credentials,
            json: true
        }, function (error, response, body) {
            if (error || (body && body.error))
                this.fail(error || body.error);
            else if (typeof body === 'string')
                this.fail('Status code: ' + response.statusCode);
            else
                this.complete(util.pickOutputs(body, pickOutputs) || {});
        }.bind(this));
    }
};
